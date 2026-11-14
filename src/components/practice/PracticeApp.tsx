import { usePracticeSession } from "@/components/hooks/usePracticeSession";
import { SetupStep } from "@/components/practice/SetupStep";
import { QuestionStep } from "@/components/practice/QuestionStep";
import { SummaryStep } from "@/components/practice/SummaryStep";

export default function PracticeApp() {
  const session = usePracticeSession();
  const question = session.questions[session.index] as (typeof session.questions)[number] | undefined;

  if (session.step === "summary") {
    return (
      <SummaryStep
        alphabet={session.alphabet}
        score={session.score}
        total={session.questions.length}
        answers={session.answers}
        onPracticeAgain={session.startAgain}
        onChangeSettings={session.restart}
      />
    );
  }

  if ((session.step === "question" || session.step === "feedback") && question) {
    return (
      <QuestionStep
        question={question}
        index={session.index}
        total={session.questions.length}
        direction={session.direction}
        alphabet={session.alphabet}
        selected={session.selected}
        onAnswer={session.answer}
        onNext={session.next}
      />
    );
  }

  return <SetupStep initialAlphabet={session.alphabet} initialDirection={session.direction} onStart={session.start} />;
}
