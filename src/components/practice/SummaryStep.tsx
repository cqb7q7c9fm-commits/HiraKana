import { RotateCcw, Settings } from "lucide-react";
import { useFocusOnChange } from "@/components/hooks/useFocusOnChange";
import { Button } from "@/components/ui/button";
import type { Alphabet, AnswerRecord } from "@/types";

interface Props {
  alphabet: Alphabet;
  score: number;
  total: number;
  answers: AnswerRecord[];
  onPracticeAgain: () => void;
  onChangeSettings: () => void;
}

export function SummaryStep({ alphabet, score, total, answers, onPracticeAgain, onChangeSettings }: Props) {
  const wrong = answers.filter((a) => a.chosenIndex !== a.question.correctIndex);
  const headingRef = useFocusOnChange<HTMLHeadingElement>(true);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent outline-none"
        >
          Session complete
        </h1>
        <p className="mt-3 text-5xl font-bold text-white">
          {score}/{total}
        </p>
      </div>

      {wrong.length === 0 ? (
        <p className="text-center text-green-200">Perfect session! Every character was recognised correctly.</p>
      ) : (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-blue-100/80">Characters to review</h2>
          <ul className="space-y-2">
            {wrong.map(({ question }) => (
              <li
                key={question.entry.romaji}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className="text-3xl" lang="ja">
                  {question.entry[alphabet]}
                </span>
                <span className="text-lg text-blue-100/80">{question.entry.romaji}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-14 flex-1 bg-purple-600 text-base text-white hover:bg-purple-500"
          onClick={onPracticeAgain}
        >
          <RotateCcw />
          Practice again
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 flex-1 border-white/20 bg-white/10 text-base text-white hover:bg-white/20 hover:text-white"
          onClick={onChangeSettings}
        >
          <Settings />
          Change settings
        </Button>
      </div>
    </div>
  );
}
