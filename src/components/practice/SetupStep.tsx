import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KANA_GROUPS } from "@/lib/kana";
import { cn } from "@/lib/utils";
import type { Alphabet, Direction } from "@/types";

interface Props {
  initialAlphabet: Alphabet;
  initialDirection: Direction;
  initialGroup: string | null;
  starting: boolean;
  onStart: (alphabet: Alphabet, direction: Direction, group: string | null) => void | Promise<void>;
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

const ALL_GROUPS = "all";

const GROUP_OPTIONS: { value: string; label: string; romaji?: string }[] = [
  { value: ALL_GROUPS, label: "All" },
  ...KANA_GROUPS.map((g) => ({ value: g.id, label: g.label, romaji: g.members.join(" ") })),
];

function GroupChoice({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-blue-100/80">Group</p>
      <div role="radiogroup" aria-label="Group" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {GROUP_OPTIONS.map((option) => {
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
                "flex min-h-11 flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-purple-300/60",
                checked
                  ? "border-purple-300 bg-purple-500/40 text-white"
                  : "border-white/20 bg-white/5 text-blue-100/80 hover:bg-white/15",
              )}
            >
              <span>{option.label}</span>
              {option.romaji ? <span className="text-[11px] leading-tight opacity-80">{option.romaji}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SetupStep({ initialAlphabet, initialDirection, initialGroup, starting, onStart }: Props) {
  const [alphabet, setAlphabet] = useState<Alphabet>(initialAlphabet);
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [group, setGroup] = useState<string>(initialGroup ?? ALL_GROUPS);

  return (
    <div className="space-y-6">
      <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-3xl font-bold text-transparent">
        Practice
      </h1>
      <ChoiceGroup label="Alphabet" value={alphabet} options={ALPHABETS} onChange={setAlphabet} />
      <ChoiceGroup label="Direction" value={direction} options={DIRECTIONS} onChange={setDirection} />
      <GroupChoice value={group} onChange={setGroup} />
      <Button
        size="lg"
        className="h-14 w-full bg-purple-600 text-base text-white hover:bg-purple-500"
        disabled={starting}
        onClick={() => {
          void onStart(alphabet, direction, group === ALL_GROUPS ? null : group);
        }}
      >
        <Play />
        Start
      </Button>
    </div>
  );
}
