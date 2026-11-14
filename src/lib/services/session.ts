import type { Alphabet, CharStat, Direction, KanaEntry, Question } from "../../types";

export const SESSION_LENGTH = 10;
export const MAX_REPEATS = 3;
export const OPTION_COUNT = 4;

/** Fisher-Yates shuffle returning a new array. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/** Weight of a character for selection: 1 for no history, up to 4 when every recent answer was wrong. */
export function weightOf(stat: CharStat | undefined): number {
  if (!stat || stat.answers <= 0) return 1;
  return 1 + 3 * (stat.errors / stat.answers);
}

/**
 * Draws SESSION_LENGTH targets sequentially, with probability proportional to weight, from the characters whose
 * per-session cap is not exhausted (errored: MAX_REPEATS, otherwise ceil(SESSION_LENGTH / pool size)). The previous
 * target is excluded from each draw when possible; when nothing else is left, the draw repeats without the exclusion.
 */
function pickTargets(
  pool: readonly KanaEntry[],
  stats: ReadonlyMap<string, CharStat>,
  random: () => number,
): KanaEntry[] {
  const plainCap = Math.ceil(SESSION_LENGTH / pool.length);
  const remaining = pool.map((entry) => {
    const stat = stats.get(entry.romaji);
    const errored = stat !== undefined && stat.answers > 0 && stat.errors > 0;
    return { entry, weight: weightOf(stat), left: errored ? MAX_REPEATS : plainCap };
  });

  const targets: KanaEntry[] = [];
  let previous: KanaEntry | undefined;
  while (targets.length < SESSION_LENGTH) {
    let candidates = remaining.filter((slot) => slot.left > 0 && slot.entry !== previous);
    if (candidates.length === 0) {
      candidates = remaining.filter((slot) => slot.left > 0);
    }
    if (candidates.length === 0) {
      throw new Error("buildSession could not select enough questions");
    }
    const total = candidates.reduce((sum, slot) => sum + slot.weight, 0);
    let threshold = random() * total;
    let chosen = candidates[candidates.length - 1];
    for (const slot of candidates) {
      threshold -= slot.weight;
      if (threshold < 0) {
        chosen = slot;
        break;
      }
    }
    chosen.left--;
    previous = chosen.entry;
    targets.push(chosen.entry);
  }
  return targets;
}

/**
 * Builds a SESSION_LENGTH-question session. Targets and distractors both come from the practice group `group` (by
 * `entry.group`), or from all `entries` when it is null, so in a group session every option looks like a plausible answer.
 */
export function buildSession(
  entries: readonly KanaEntry[],
  alphabet: Alphabet,
  direction: Direction,
  random: () => number = Math.random,
  stats: ReadonlyMap<string, CharStat> = new Map(),
  group: string | null = null,
): Question[] {
  const pool = group === null ? entries : entries.filter((entry) => entry.group === group);
  if (pool.length === 0) {
    throw new Error(`buildSession: unknown or empty group "${String(group)}"`);
  }
  if (pool.length < OPTION_COUNT) {
    throw new Error(`buildSession needs at least ${String(OPTION_COUNT)} entries, got ${String(pool.length)}`);
  }

  const kanaOf = (entry: KanaEntry) => entry[alphabet];
  const promptOf = (entry: KanaEntry) => (direction === "kana-to-romaji" ? kanaOf(entry) : entry.romaji);
  const answerOf = (entry: KanaEntry) => (direction === "kana-to-romaji" ? entry.romaji : kanaOf(entry));

  const targets = pickTargets(pool, stats, random);

  return targets.map((entry) => {
    const distractors = shuffle(
      pool.filter((other) => other !== entry),
      random,
    ).slice(0, OPTION_COUNT - 1);
    const options = shuffle([entry, ...distractors], random);
    return {
      entry,
      prompt: promptOf(entry),
      options: options.map(answerOf),
      correctIndex: options.indexOf(entry),
    };
  });
}

/** Distinct romaji values in order of first occurrence (used to show each mistaken character once). */
export function uniqueRomaji(romaji: readonly string[]): string[] {
  return [...new Set(romaji)];
}
