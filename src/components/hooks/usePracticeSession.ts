import { useEffect, useRef, useState } from "react";
import { fetchCharStats } from "@/components/hooks/useCharStats";
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
  const [starting, setStarting] = useState(false);
  const sync = useAnswerSync();

  // Guards against double starts and against applying a start that was cancelled (restart / unmount) while awaiting stats.
  const startingRef = useRef(false);
  const startToken = useRef(0);

  useEffect(() => {
    const token = startToken;
    return () => {
      token.current++;
    };
  }, []);

  const score = answers.filter((a) => a.chosenIndex === a.question.correctIndex).length;

  async function start(nextAlphabet: Alphabet, nextDirection: Direction): Promise<void> {
    if (startingRef.current) return;
    startingRef.current = true;
    const token = ++startToken.current;
    setStarting(true);
    const stats = await fetchCharStats();
    // restart() or unmount happened while waiting: that path already reset the state, so do nothing.
    if (token !== startToken.current) return;
    startingRef.current = false;
    setStarting(false);
    setAlphabet(nextAlphabet);
    setDirection(nextDirection);
    const nextQuestions = buildSession(KANA, nextAlphabet, nextDirection, Math.random, stats);
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
    startToken.current++;
    startingRef.current = false;
    setStarting(false);
    sync.abort();
    setResult(null);
    setStep("setup");
    setQuestions([]);
    setIndex(0);
    setSelected(null);
    setAnswers([]);
  }

  /** New session with the same alphabet and direction ("Practice again"). */
  function startAgain(): Promise<void> {
    return start(alphabet, direction);
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
    starting,
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
