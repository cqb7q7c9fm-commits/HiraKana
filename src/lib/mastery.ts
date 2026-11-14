import type { CharStat } from "../types";
// Keep the .ts extension: scripts/check-session.mjs loads this file via Node type stripping, which cannot resolve extensionless imports.
import { KANA, KANA_GROUPS } from "./kana.ts";

/** Minimum number of answers before a character is classified at all; fewer means "new". */
export const MIN_ANSWERS = 3;
/** Share of correct answers (percent) at or above which a character counts as strong. */
export const STRONG_PERCENT = 80;
/** Share of correct answers (percent) at or above which a character counts as medium (below it: weak). */
export const MEDIUM_PERCENT = 40;

export type Strength = "weak" | "medium" | "strong" | "new";

export interface MasteryChar {
  romaji: string;
  hiragana: string;
  katakana: string;
  strength: Strength;
}

export interface GroupMastery {
  id: string;
  label: string;
  strength: Strength;
  mastered: boolean;
  strongCount: number;
  total: number;
  chars: MasteryChar[];
}

/** Classifies one character from its answer window; integer math only (no floats, no division by zero). */
export function strengthOf(stat?: CharStat): Strength {
  if (!stat || stat.answers < MIN_ANSWERS) return "new";
  const correct = stat.answers - stat.errors;
  if (correct * 100 >= STRONG_PERCENT * stat.answers) return "strong";
  if (correct * 100 >= MEDIUM_PERCENT * stat.answers) return "medium";
  return "weak";
}

/** Group strength: any weak wins, then any medium, then any new; only all-strong is strong. */
function groupStrength(chars: readonly MasteryChar[]): Strength {
  if (chars.some((c) => c.strength === "weak")) return "weak";
  if (chars.some((c) => c.strength === "medium")) return "medium";
  if (chars.some((c) => c.strength === "new")) return "new";
  return "strong";
}

/** Builds the mastery view model: one entry per kana group, in KANA_GROUPS order. */
export function buildGroupMastery(stats: readonly CharStat[]): GroupMastery[] {
  const byRomaji = new Map(stats.map((stat) => [stat.romaji, stat]));
  return KANA_GROUPS.map((group) => {
    const chars: MasteryChar[] = KANA.filter((e) => e.group === group.id).map((e) => ({
      romaji: e.romaji,
      hiragana: e.hiragana,
      katakana: e.katakana,
      strength: strengthOf(byRomaji.get(e.romaji)),
    }));
    const strength = chars.length === 0 ? "new" : groupStrength(chars);
    return {
      id: group.id,
      label: group.label,
      strength,
      mastered: strength === "strong",
      strongCount: chars.filter((c) => c.strength === "strong").length,
      total: chars.length,
      chars,
    };
  });
}
