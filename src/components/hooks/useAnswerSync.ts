import { useEffect, useRef, useState } from "react";
import { SESSION_LENGTH } from "@/lib/services/session";
import type { Alphabet, Direction, SessionResult } from "@/types";

export type SyncStatus = "saved" | "pending" | "failed";

interface QueuedAnswer {
  position: number;
  romaji: string;
  isCorrect: boolean;
}

interface SessionParams {
  alphabet: Alphabet;
  direction: Direction;
  total: number;
}

type CallResult<T> = { kind: "ok"; data: T } | { kind: "unauthorized" } | { kind: "retry" } | { kind: "fatal" };

/** Attempts per queue item (or per create/complete call) within a single drain. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** One request. Network errors and 5xx are retryable, 401 stops the queue, other 4xx are fatal. */
async function call<T>(url: string, body?: unknown): Promise<CallResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status >= 500) return { kind: "retry" };
    if (!response.ok) return { kind: "fatal" };
    return { kind: "ok", data: (await response.json()) as T };
  } catch {
    return { kind: "retry" };
  }
}

async function withRetries<T>(run: () => Promise<CallResult<T>>): Promise<CallResult<T>> {
  let result: CallResult<T> = { kind: "retry" };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAY_MS);
    result = await run();
    if (result.kind !== "retry") return result;
  }
  return result;
}

/**
 * Saves a practice session in the background: creates it on the server, sends answers one at a time
 * from an in-memory queue (kept on failure, retried on the next answer / on close) and completes it.
 */
export function useAnswerSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [sessionExpired, setSessionExpired] = useState(false);

  const generation = useRef(0);
  const params = useRef<SessionParams | null>(null);
  const sessionId = useRef<string | null>(null);
  const queue = useRef<QueuedAnswer[]>([]);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const dropped = useRef(false);

  // Invalidates any in-flight work when the component unmounts (leaving mid-session sends nothing extra).
  useEffect(() => {
    const counter = generation;
    return () => {
      counter.current++;
    };
  }, []);

  function fail(gen: number, result: CallResult<unknown>) {
    if (gen !== generation.current) return;
    if (result.kind === "unauthorized") setSessionExpired(true);
    setSyncStatus("failed");
  }

  async function runDrain(gen: number): Promise<boolean> {
    setSyncStatus("pending");
    while (gen === generation.current) {
      if (!sessionId.current) {
        const current = params.current;
        if (!current) return false;
        const created = await withRetries(() => call<{ id: string }>("/api/practice/sessions", current));
        if (gen !== generation.current) return false;
        if (created.kind !== "ok") {
          fail(gen, created);
          return false;
        }
        sessionId.current = created.data.id;
      }

      const item = queue.current[0] as QueuedAnswer | undefined;
      if (!item) {
        // An answer the server rejected was dropped: the session can never be complete, so report it as not saved.
        setSyncStatus(dropped.current ? "failed" : "saved");
        return !dropped.current;
      }
      const id = sessionId.current;
      const sent = await withRetries(() => call<unknown>(`/api/practice/sessions/${id}/answers`, item));
      if (gen !== generation.current) return false;
      if (sent.kind === "fatal") {
        // The server will never accept this answer (400/404); drop it so it cannot block the rest of the queue.
        queue.current.shift();
        dropped.current = true;
        continue;
      }
      if (sent.kind !== "ok") {
        fail(gen, sent);
        return false;
      }
      queue.current.shift();
    }
    return false;
  }

  /** Sends queued answers; resolves true when the queue is empty and the session exists on the server. */
  function drain(): Promise<boolean> {
    if (inFlight.current) return inFlight.current;
    const gen = generation.current;
    const run = runDrain(gen).finally(() => {
      if (gen === generation.current) inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }

  /** Starts tracking a new session and creates it on the server in the background. */
  function begin(alphabet: Alphabet, direction: Direction, total: number = SESSION_LENGTH) {
    generation.current++;
    params.current = { alphabet, direction, total };
    sessionId.current = null;
    queue.current = [];
    inFlight.current = null;
    dropped.current = false;
    setSessionExpired(false);
    void drain();
  }

  /** Queues an answer without waiting for the network. */
  function enqueue(answer: QueuedAnswer) {
    queue.current.push(answer);
    setSyncStatus("pending");
    void drain();
  }

  /** Drains the queue and closes the session; resolves the stored result, or null when saving failed. */
  async function complete(): Promise<SessionResult | null> {
    const gen = generation.current;
    setSessionExpired(false);
    setSyncStatus("pending");
    const drained = await drain();
    if (gen !== generation.current || !drained) return null;
    const id = sessionId.current;
    if (!id) return null;
    const closed = await withRetries(() => call<SessionResult>(`/api/practice/sessions/${id}/complete`));
    if (gen !== generation.current) return null;
    if (closed.kind !== "ok") {
      fail(gen, closed);
      return null;
    }
    setSyncStatus("saved");
    return closed.data;
  }

  /** Drops all tracking of the current session (it stays incomplete on the server). */
  function abort() {
    generation.current++;
    params.current = null;
    sessionId.current = null;
    queue.current = [];
    inFlight.current = null;
    dropped.current = false;
    setSessionExpired(false);
    setSyncStatus("saved");
  }

  /** Retries sending queued answers (no-op while a drain is running). */
  function retry() {
    setSessionExpired(false);
    void drain();
  }

  return { syncStatus, sessionExpired, begin, enqueue, complete, abort, retry };
}
