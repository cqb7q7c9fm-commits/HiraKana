import type { CharStat } from "../types";

/** Picks the hardest characters: only those with errors, by error rate desc, then errors desc, then romaji asc. */
export function rankHotFive(stats: readonly CharStat[], limit = 5): CharStat[] {
  return stats
    .filter((stat) => stat.errors >= 1)
    .sort((a, b) => {
      // Compare errors/answers by cross-multiplication (no floats, no division by zero).
      const rate = b.errors * a.answers - a.errors * b.answers;
      if (rate !== 0) return rate;
      if (b.errors !== a.errors) return b.errors - a.errors;
      return a.romaji < b.romaji ? -1 : a.romaji > b.romaji ? 1 : 0;
    })
    .slice(0, limit);
}
