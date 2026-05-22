"use client";

import type { AssessmentQuestion, UserAnswer } from "@/lib/types";

type Props = {
  question: AssessmentQuestion;
  answer?: UserAnswer;
  revealed?: boolean;
  onChange: (answer: UserAnswer) => void;
};

export function QuestionRenderer({ question, answer, revealed, onChange }: Props) {
  if (question.type === "KPRIM") {
    return <KPrimQuestion question={question} answer={answer} revealed={revealed} onChange={onChange} />;
  }

  return <TypeAQuestion question={question} answer={answer} revealed={revealed} onChange={onChange} />;
}

function TypeAQuestion({ question, answer, revealed, onChange }: Props) {
  return (
    <div className="grid gap-3">
      {question.options.map((option) => {
        const selected = answer?.selected === option.id;
        const state = revealed
          ? option.correct ? "border-green-400 bg-green-500/10" : selected ? "border-red-400 bg-red-500/10" : ""
          : selected ? "border-[var(--accent)] bg-blue-500/10" : "";

        return (
          <button
            className={`grid grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-left ${state}`}
            key={option.id}
            onClick={() => onChange({ selected: option.id })}
          >
            <strong className="grid h-8 w-8 place-items-center rounded-full bg-black/5 dark:bg-white/10">{option.id}</strong>
            <span>{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function KPrimQuestion({ question, answer, revealed, onChange }: Props) {
  const values = answer?.kprim || {};

  return (
    <div className="grid gap-3">
      {question.options.map((option) => {
        const chosen = values[option.id];
        const correct = chosen === option.correct;
        const state = revealed
          ? correct ? "border-green-400 bg-green-500/10" : "border-red-400 bg-red-500/10"
          : "";

        return (
          <div
            className={`grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 md:grid-cols-[34px_1fr_auto] md:items-center ${state}`}
            key={option.id}
          >
            <strong className="grid h-8 w-8 place-items-center rounded-full bg-black/5 dark:bg-white/10">{option.id}</strong>
            <span>{option.text}</span>
            <div className="flex gap-2">
              {[true, false].map((value) => (
                <button
                  className={values[option.id] === value ? "btn-primary" : "btn-secondary"}
                  key={String(value)}
                  onClick={() => onChange({ kprim: { ...values, [option.id]: value } })}
                >
                  {value ? "richtig" : "falsch"}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
