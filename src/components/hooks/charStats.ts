import type { CharStat } from "@/types";

/** Upper bound for the stats request; practice must never wait longer than this to start. */
const STATS_TIMEOUT_MS = 2500;

function isCharStat(value: unknown): value is CharStat {
  if (typeof value !== "object" || value === null) return false;
  const { romaji, answers, errors } = value as Record<string, unknown>;
  return (
    typeof romaji === "string" &&
    typeof answers === "number" &&
    typeof errors === "number" &&
    Number.isInteger(answers) &&
    Number.isInteger(errors) &&
    answers >= 0 &&
    errors >= 0 &&
    errors <= answers
  );
}

/**
 * Fetches recent per-character stats for weighted session building.
 * Never throws: any failure (network, non-200, bad shape, timeout) yields an empty map, i.e. uniform selection.
 */
export async function fetchCharStats(): Promise<ReadonlyMap<string, CharStat>> {
  try {
    const response = await fetch("/api/practice/stats", { signal: AbortSignal.timeout(STATS_TIMEOUT_MS) });
    if (response.status !== 200) return new Map();
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isCharStat)) return new Map();
    return new Map(body.map((stat) => [stat.romaji, stat]));
  } catch {
    return new Map();
  }
}
