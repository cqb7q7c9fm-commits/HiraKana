export type Alphabet = "hiragana" | "katakana";

export type Direction = "kana-to-romaji" | "romaji-to-kana";

export interface KanaEntry {
  romaji: string;
  hiragana: string;
  katakana: string;
}

/** A single quiz question; `prompt` and `options` are ready to display for the chosen alphabet and direction. */
export interface Question {
  entry: KanaEntry;
  prompt: string;
  options: string[];
  correctIndex: number;
}

/** A recorded answer: the question and the option index the user chose. */
export interface AnswerRecord {
  question: Question;
  chosenIndex: number;
}

export type PracticeStep = "setup" | "question" | "feedback" | "summary";
