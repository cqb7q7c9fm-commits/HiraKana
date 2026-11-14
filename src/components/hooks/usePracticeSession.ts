import { useState } from "react";
import { useAnswerSync } from "@/components/hooks/useAnswerSync";
import { KANA } from "@/lib/kana";
import { buildSession } from "@/lib/services/session";
import type { Alphabet, AnswerRecord, Direction, PracticeStep, Question, SessionResult } from "@/types";

export function usePracticeSession() {
  const [step, setStep] = useState<PracticeStep>("setup");
  const [alphabet, setAlphabet] = useState<Alphabet>("hiragana");
  const [direction, setDirection] = useState<Direction>("kana-to-romaji");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [result, setResult] = useState<SessionResult | null>(null);
  const sync = useAnswerSync();

  const score = answers.filter((a) => a.chosenIndex === a.question.correctIndex).length;

  function start(nextAlphabet: Alphabet, nextDirection: Direction) {
    setAlphabet(nextAlphabet);
    setDirection(nextDirection);
    const nextQuestions = buildSession(KANA, nextAlphabet, nextDirection);
    setQuestions(nextQuestions);
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setResult(null);
    sync.begin(nextAlphabet, nextDirection, nextQuestions.length);
    setStep("question");
  }

  function answer(optionIndex: number) {
    if (step !== "question" || selected !== null) return;
    const question = questions[index] as Question | undefined;
    if (!question) return;
    setSelected(optionIndex);
    setAnswers((prev) => [...prev, { question, chosenIndex: optionIndex }]);
    sync.enqueue({
      position: index,
      romaji: question.entry.romaji,
      isCorrect: optionIndex === question.correctIndex,
    });
    setStep("feedback");
  }

  /** Drains the answer queue and closes the session; the stored result feeds the summary. */
  async function finalize() {
    const saved = await sync.complete();
    if (saved) setResult(saved);
  }

  /** Retries saving: queued answers first, and closing the session when the summary is already shown. */
  function retry() {
    if (step === "summary") void finalize();
    else sync.retry();
  }

  function next() {
    if (step !== "feedback") return;
    if (index + 1 >= questions.length) {
      setStep("summary");
      void finalize();
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setStep("question");
  }

  /** Back to the setup screen ("Change settings"). */
  function restart() {
    sync.abort();
    setResult(null);
    setStep("setup");
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setAnswers([]);
  }

  /** New session with the same alphabet and direction ("Practice again"). */
  function startAgain() {
    start(alphabet, direction);
  }

  return {
    step,
    alphabet,
    direction,
    questions,
    index,
    selected,
    answers,
    score,
    result,
    syncStatus: sync.syncStatus,
    sessionExpired: sync.sessionExpired,
    retry,
    start,
    answer,
    next,
    restart,
    startAgain,
  };
}
