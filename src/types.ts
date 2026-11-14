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

/** A saved practice session as exposed to the client. */
export interface SessionRecord {
  id: string;
  alphabet: Alphabet;
  direction: Direction;
  total: number;
  score: number | null;
  createdAt: string;
  completedAt: string | null;
}

/** A session with the romaji of wrongly answered characters, in question order. */
export interface SessionResult {
  session: SessionRecord;
  mistakes: string[];
}
