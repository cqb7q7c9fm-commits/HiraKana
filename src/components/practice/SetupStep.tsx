import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Alphabet, Direction } from "@/types";

interface Props {
  initialAlphabet: Alphabet;
  initialDirection: Direction;
  onStart: (alphabet: Alphabet, direction: Direction) => void;
}

const ALPHABETS: { value: Alphabet; label: string; sample: string }[] = [
  { value: "hiragana", label: "Hiragana", sample: "あ" },
  { value: "katakana", label: "Katakana", sample: "ア" },
];

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "kana-to-romaji", label: "Kana → romaji" },
  { value: "romaji-to-kana", label: "Romaji → kana" },
];

interface ChoiceGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; sample?: string }[];
  onChange: (value: T) => void;
}

function ChoiceGroup<T extends string>({ label, value, options, onChange }: ChoiceGroupProps<T>) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-blue-100/80">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => {
                onChange(option.value);
              }}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center rounded-xl border px-3 py-2 text-base font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-purple-300/60",
                checked
                  ? "border-purple-300 bg-purple-500/40 text-white"
                  : "border-white/20 bg-white/5 text-blue-100/80 hover:bg-white/15",
              )}
            >
              {option.sample ? <span className="text-2xl">{option.sample}</span> : null}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SetupStep({ initialAlphabet, initialDirection, onStart }: Props) {
  const [alphabet, setAlphabet] = useState<Alphabet>(initialAlphabet);
  const [direction, setDirection] = useState<Direction>(initialDirection);

  return (
    <div className="space-y-6">
      <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-3xl font-bold text-transparent">
        Practice
      </h1>
      <ChoiceGroup label="Alphabet" value={alphabet} options={ALPHABETS} onChange={setAlphabet} />
      <ChoiceGroup label="Direction" value={direction} options={DIRECTIONS} onChange={setDirection} />
      <Button
        size="lg"
        className="h-14 w-full bg-purple-600 text-base text-white hover:bg-purple-500"
        onClick={() => {
          onStart(alphabet, direction);
        }}
      >
        <Play />
        Start
      </Button>
    </div>
  );
}
