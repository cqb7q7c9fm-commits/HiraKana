import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { KANA } from "@/lib/kana";
import type { Alphabet, Direction, SessionRecord, SessionResult } from "@/types";

const ROMAJI_SET: ReadonlySet<string> = new Set(KANA.map((entry) => entry.romaji));

export const createSessionSchema = z.object({
  alphabet: z.enum(["hiragana", "katakana"]),
  direction: z.enum(["kana-to-romaji", "romaji-to-kana"]),
  total: z.number().int().min(1).max(50),
});

export const saveAnswerSchema = z.object({
  position: z.number().int().min(0),
  romaji: z.string().refine((value) => ROMAJI_SET.has(value), "Unknown romaji"),
  isCorrect: z.boolean(),
});

export const sessionIdSchema = z.uuid();

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

interface SessionRow {
  id: string;
  alphabet: Alphabet;
  direction: Direction;
  total: number;
  score: number | null;
  created_at: string;
  completed_at: string | null;
}

const SESSION_COLUMNS = "id, alphabet, direction, total, score, created_at, completed_at";

interface AnswerRow {
  position: number;
  romaji: string;
  is_correct: boolean;
}

function toSessionRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    alphabet: row.alphabet,
    direction: row.direction,
    total: row.total,
    score: row.score,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

async function findSession(supabase: SupabaseClient, userId: string, sessionId: string): Promise<SessionRow | null> {
  if (!sessionIdSchema.safeParse(sessionId).success) return null;
  const { data, error } = await supabase
    .from("practice_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load session: ${error.message}`);
  return data;
}

async function loadAnswers(supabase: SupabaseClient, userId: string, sessionId: string): Promise<AnswerRow[]> {
  const { data, error } = await supabase
    .from("session_answers")
    .select("position, romaji, is_correct")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw new Error(`Failed to load answers: ${error.message}`);
  return data;
}

function toResult(session: SessionRow, answers: AnswerRow[]): SessionResult {
  return {
    session: toSessionRecord(session),
    mistakes: answers.filter((answer) => !answer.is_correct).map((answer) => answer.romaji),
  };
}

/** Max sessions a user may start (and leave incomplete) within OPEN_SESSION_WINDOW_MS. */
const OPEN_SESSION_LIMIT = 30;
const OPEN_SESSION_WINDOW_MS = 60 * 60 * 1000;

/** Returns the new session id, or null when the user left too many sessions open recently. */
export async function createSession(
  supabase: SupabaseClient,
  userId: string,
  alphabet: Alphabet,
  direction: Direction,
  total: number,
): Promise<string | null> {
  const since = new Date(Date.now() - OPEN_SESSION_WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from("practice_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("completed_at", null)
    .gte("created_at", since);
  if (countError) throw new Error(`Failed to count open sessions: ${countError.message}`);
  if ((count ?? 0) >= OPEN_SESSION_LIMIT) return null;

  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({ user_id: userId, alphabet, direction, total })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data.id;
}

export type SaveAnswerOutcome = "saved" | "not-found" | "out-of-range";

/**
 * Idempotent per (session_id, position): the upsert uses ON CONFLICT DO NOTHING, so a retry never
 * duplicates or overwrites a row. DO NOTHING needs only the insert policy (no update policy exists
 * on session_answers) and no RETURNING, so no select policy is evaluated for the write either.
 * First write wins: a retry that carries a different `romaji`/`isCorrect` for an already stored position is
 * ignored and still answers 200 (the client queue only retries the same answer, so this is intended).
 */
export async function saveAnswer(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  answer: SaveAnswerInput,
): Promise<SaveAnswerOutcome> {
  const session = await findSession(supabase, userId, sessionId);
  if (!session) return "not-found";
  if (answer.position >= session.total) return "out-of-range";
  // A completed session is final: a late retry is a no-op (the database trigger rejects writes after completion).
  if (session.completed_at) return "saved";

  const { error } = await supabase.from("session_answers").upsert(
    {
      session_id: session.id,
      position: answer.position,
      user_id: userId,
      romaji: answer.romaji,
      direction: session.direction,
      is_correct: answer.isCorrect,
    },
    { onConflict: "session_id,position", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Failed to save answer: ${error.message}`);
  return "saved";
}

export type CompleteOutcome = { status: "ok"; result: SessionResult } | { status: "incomplete"; missing: number };

export async function completeSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<CompleteOutcome | null> {
  const session = await findSession(supabase, userId, sessionId);
  if (!session) return null;

  const answers = await loadAnswers(supabase, userId, session.id);
  if (session.completed_at) return { status: "ok", result: toResult(session, answers) };

  if (answers.length < session.total) {
    return { status: "incomplete", missing: session.total - answers.length };
  }

  const score = answers.filter((answer) => answer.is_correct).length;
  const { data, error } = await supabase
    .from("practice_sessions")
    .update({ score, completed_at: new Date().toISOString() })
    .eq("id", session.id)
    .eq("user_id", userId)
    .is("completed_at", null)
    .select(SESSION_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`Failed to complete session: ${error.message}`);

  // A concurrent completion may have won the race; re-read to return the stored result.
  const completed = data ?? (await findSession(supabase, userId, session.id));
  if (!completed) return null;
  return { status: "ok", result: toResult(completed, answers) };
}

export async function getResult(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<SessionResult | null> {
  const session = await findSession(supabase, userId, sessionId);
  if (!session) return null;
  return toResult(session, await loadAnswers(supabase, userId, session.id));
}

/** Completed sessions of the user, newest first. */
export async function listResults(supabase: SupabaseClient, userId: string, limit = 20): Promise<SessionRecord[]> {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  return (data as SessionRow[]).map(toSessionRecord);
}
