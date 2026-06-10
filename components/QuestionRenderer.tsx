"use client";

import { memo } from "react";
import type { AssessmentQuestion, UserAnswer } from "@/lib/types";
import { optionKey, optionLabel } from "@/lib/score";

type Props = {
  question: AssessmentQuestion;
  answer?: UserAnswer;
  revealed?: boolean;
  onChange: (answer: UserAnswer) => void;
};

export const QuestionRenderer = memo(function QuestionRenderer({ question, answer, revealed, onChange }: Props) {
  if (question.type === "KPRIM") {
    return <KPrimQuestion question={question} answer={answer} revealed={revealed} onChange={onChange} />;
  }

  return <TypeAQuestion question={question} answer={answer} revealed={revealed} onChange={onChange} />;
});

function TypeAQuestion({ question, answer, revealed, onChange }: Props) {
  return (
    <div className="grid gap-3">
      {question.options.map((option) => {
        const key = optionKey(option);
        const selected = answer?.selected === key;
        const state = revealed
          ? option.correct ? "border-green-400 bg-green-500/10" : selected ? "border-red-400 bg-red-500/10" : ""
          : selected ? "border-[var(--accent)] bg-blue-500/10" : "";

        return (
          <button
            type="button"
            aria-pressed={selected}
            className={`question-option grid grid-cols-[34px_1fr] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-left ${state}`}
            disabled={revealed}
            key={key}
            onClick={() => onChange({ selected: key })}
          >
            <strong className="grid h-8 w-8 place-items-center rounded-full bg-black/5 dark:bg-white/10">{optionLabel(option)}</strong>
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
        const key = optionKey(option);
        const chosen = values[key];
        const correct = chosen === option.correct;
        const state = revealed
          ? correct ? "border-green-400 bg-green-500/10" : "border-red-400 bg-red-500/10"
          : "";

        return (
          <div
            className={`kprim-option grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 md:grid-cols-[34px_1fr_auto] md:items-center ${state}`}
            key={key}
          >
            <strong className="grid h-8 w-8 place-items-center rounded-full bg-black/5 dark:bg-white/10">{optionLabel(option)}</strong>
            <span>{option.text}</span>
            <div className="kprim-toggle-group flex gap-2">
              {[true, false].map((value) => (
                <button
                  type="button"
                  aria-pressed={values[key] === value}
                  className={values[key] === value ? "btn-primary" : "btn-secondary"}
                  disabled={revealed}
                  key={String(value)}
                  onClick={() => onChange({ kprim: { ...values, [key]: value } })}
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
