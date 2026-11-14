import { useState } from "react";
import { KANA } from "@/lib/kana";
import { buildSession } from "@/lib/services/session";
import type { Alphabet, AnswerRecord, Direction, PracticeStep, Question } from "@/types";

export function usePracticeSession() {
  const [step, setStep] = useState<PracticeStep>("setup");
  const [alphabet, setAlphabet] = useState<Alphabet>("hiragana");
  const [direction, setDirection] = useState<Direction>("kana-to-romaji");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);

  const score = answers.filter((a) => a.chosenIndex === a.question.correctIndex).length;

  function start(nextAlphabet: Alphabet, nextDirection: Direction) {
    setAlphabet(nextAlphabet);
    setDirection(nextDirection);
    setQuestions(buildSession(KANA, nextAlphabet, nextDirection));
    setIndex(0);
    setSelected(null);
    setAnswers([]);
    setStep("question");
  }

  function answer(optionIndex: number) {
    if (step !== "question" || selected !== null) return;
    const question = questions[index] as Question | undefined;
    if (!question) return;
    setSelected(optionIndex);
    setAnswers((prev) => [...prev, { question, chosenIndex: optionIndex }]);
    setStep("feedback");
  }

  function next() {
    if (step !== "feedback") return;
    if (index + 1 >= questions.length) {
      setStep("summary");
      return;
    }
    setIndex(index + 1);
    setSelected(null);
    setStep("question");
  }

  /** Back to the setup screen ("Change settings"). */
  function restart() {
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
    start,
    answer,
    next,
    restart,
    startAgain,
  };
}
