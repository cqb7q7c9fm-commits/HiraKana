import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Alphabet, Direction, Question } from "@/types";

interface Props {
  question: Question;
  index: number;
  total: number;
  direction: Direction;
  alphabet: Alphabet;
  selected: number | null;
  onAnswer: (optionIndex: number) => void;
  onNext: () => void;
}

export function QuestionStep({ question, index, total, direction, alphabet, selected, onAnswer, onNext }: Props) {
  const answered = selected !== null;
  const isCorrect = selected === question.correctIndex;
  const promptIsKana = direction === "kana-to-romaji";
  const optionsAreKana = direction === "romaji-to-kana";
  const isLast = index + 1 >= total;
  const correctText = question.options[question.correctIndex];
  const pair = `${question.entry[alphabet]} = ${question.entry.romaji}`;

  return (
    <div className="space-y-6">
      <p className="text-center text-sm font-medium text-blue-100/70">
        {index + 1} / {total}
      </p>
      <p
        className={cn(
          "text-center font-bold text-white",
          promptIsKana ? "text-7xl leading-tight" : "text-6xl leading-tight",
        )}
        lang={promptIsKana ? "ja" : undefined}
      >
        {question.prompt}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {question.options.map((option, i) => {
          const isCorrectOption = answered && i === question.correctIndex;
          const isWrongChoice = answered && i === selected && i !== question.correctIndex;
          return (
            <button
              key={`${String(index)}-${option}`}
              type="button"
              disabled={answered}
              onClick={() => {
                onAnswer(i);
              }}
              className={cn(
                "flex min-h-16 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-2xl font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-purple-300/60",
                !answered && "border-white/20 bg-white/10 text-white hover:bg-white/20",
                answered && "cursor-default",
                answered && !isCorrectOption && !isWrongChoice && "border-white/10 bg-white/5 text-white/50",
                isCorrectOption && "border-green-300 bg-green-500/30 text-white ring-2 ring-green-300",
                isWrongChoice && "border-red-300 bg-red-500/30 text-white ring-2 ring-red-300",
              )}
            >
              {isCorrectOption ? <Check className="size-6 shrink-0" aria-hidden="true" /> : null}
              {isWrongChoice ? <X className="size-6 shrink-0" aria-hidden="true" /> : null}
              <span lang={optionsAreKana ? "ja" : undefined}>{option}</span>
              {isCorrectOption ? <span className="sr-only">(correct answer)</span> : null}
              {isWrongChoice ? <span className="sr-only">(your answer)</span> : null}
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="min-h-14 text-center">
        {answered ? (
          <>
            <p className={cn("text-lg font-semibold", isCorrect ? "text-green-200" : "text-red-200")}>
              {isCorrect ? "Correct" : "Incorrect"}
            </p>
            <p className="text-blue-100/80">
              <span lang="ja">{pair}</span>
              <span className="sr-only"> (correct answer: {correctText})</span>
            </p>
          </>
        ) : null}
      </div>

      {answered ? (
        <Button
          size="lg"
          className="h-14 w-full bg-purple-600 text-base text-white hover:bg-purple-500"
          onClick={onNext}
        >
          {isLast ? "Finish" : "Next"}
          <ArrowRight />
        </Button>
      ) : null}
    </div>
  );
}
