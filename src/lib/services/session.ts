import type { Alphabet, Direction, KanaEntry, Question } from "../../types";

export const SESSION_LENGTH = 10;
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

export function buildSession(
  entries: readonly KanaEntry[],
  alphabet: Alphabet,
  direction: Direction,
  random: () => number = Math.random,
): Question[] {
  const minimum = Math.max(SESSION_LENGTH, OPTION_COUNT);
  if (entries.length < minimum) {
    throw new Error(`buildSession needs at least ${String(minimum)} entries, got ${String(entries.length)}`);
  }

  const kanaOf = (entry: KanaEntry) => entry[alphabet];
  const promptOf = (entry: KanaEntry) => (direction === "kana-to-romaji" ? kanaOf(entry) : entry.romaji);
  const answerOf = (entry: KanaEntry) => (direction === "kana-to-romaji" ? entry.romaji : kanaOf(entry));

  const targets = shuffle(entries, random).slice(0, SESSION_LENGTH);

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
