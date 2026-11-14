import type { Alphabet, Direction } from "@/types";

export const ALPHABET_LABELS: Record<Alphabet, string> = {
  hiragana: "Hiragana",
  katakana: "Katakana",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  "kana-to-romaji": "Kana → Romaji",
  "romaji-to-kana": "Romaji → Kana",
};

/** Date and time in UTC, so server rendering is deterministic regardless of the runtime time zone. */
export function formatSessionDate(iso: string): string {
  return `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso))} UTC`;
}
