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
 * per-session cap is not exhausted (errored: MAX_REPEATS, otherwise 1). The previous target is excluded from each
 * draw, so adjacent duplicates cannot occur.
 */
function pickTargets(
  entries: readonly KanaEntry[],
  stats: ReadonlyMap<string, CharStat>,
  random: () => number,
): KanaEntry[] {
  const remaining = entries.map((entry) => {
    const stat = stats.get(entry.romaji);
    const errored = stat !== undefined && stat.answers > 0 && stat.errors > 0;
    return { entry, weight: weightOf(stat), left: errored ? MAX_REPEATS : 1 };
  });

  const targets: KanaEntry[] = [];
  let previous: KanaEntry | undefined;
  while (targets.length < SESSION_LENGTH) {
    const pool = remaining.filter((slot) => slot.left > 0 && slot.entry !== previous);
    if (pool.length === 0) {
      throw new Error("buildSession could not select enough questions");
    }
    const total = pool.reduce((sum, slot) => sum + slot.weight, 0);
    let threshold = random() * total;
    let chosen = pool[pool.length - 1];
    for (const slot of pool) {
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

export function buildSession(
  entries: readonly KanaEntry[],
  alphabet: Alphabet,
  direction: Direction,
  random: () => number = Math.random,
  stats: ReadonlyMap<string, CharStat> = new Map(),
): Question[] {
  const minimum = Math.max(SESSION_LENGTH, OPTION_COUNT);
  if (entries.length < minimum) {
    throw new Error(`buildSession needs at least ${String(minimum)} entries, got ${String(entries.length)}`);
  }

  const kanaOf = (entry: KanaEntry) => entry[alphabet];
  const promptOf = (entry: KanaEntry) => (direction === "kana-to-romaji" ? kanaOf(entry) : entry.romaji);
  const answerOf = (entry: KanaEntry) => (direction === "kana-to-romaji" ? entry.romaji : kanaOf(entry));

  const targets = pickTargets(entries, stats, random);

  return targets.map((entry) => {
    const distractors = shuffle(
      entries.filter((other) => other !== entry),
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
