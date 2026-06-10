"use client";

import { getStructuredExplanation } from "@/lib/questionQuality";
import { optionKey, optionLabel } from "@/lib/score";
import type { AssessmentQuestion, UserAnswer } from "@/lib/types";

export function QuestionExplanationPanel({
  question,
  answer,
  objective,
  compact = false
}: {
  question: AssessmentQuestion;
  answer?: UserAnswer;
  objective?: string;
  compact?: boolean;
}) {
  const explanation = getStructuredExplanation(question);
  if (!explanation && !objective) return null;

  const optionExplanations = question.options
    .map((option) => ({
      option,
      explanation: explanationForOption(question, option.id, option.originalId, option.displayId)
    }))
    .filter(({ option, explanation: text }) => (
      !!text && (question.type === "KPRIM" || !option.correct)
    ));

  return (
    <section className={`question-explanation-panel ${compact ? "is-compact" : ""}`}>
      {explanation?.coreIdea && (
        <div className="question-core-idea">
          <span>Core Idea</span>
          <strong>{explanation.coreIdea}</strong>
        </div>
      )}

      {explanation?.correctReasoning && (
        <details open={!compact}>
          <summary>Begründung der richtigen Antwort</summary>
          <p>{explanation.correctReasoning}</p>
        </details>
      )}

      {!!optionExplanations.length && (
        <details>
          <summary>{question.type === "KPRIM" ? "Begründung pro Aussage" : "Warum die anderen Antworten falsch sind"}</summary>
          <div className="question-option-rationales">
            {optionExplanations.map(({ option, explanation: text }) => {
              const chosen = question.type === "KPRIM"
                ? answer?.kprim?.[optionKey(option)]
                : answer?.selected === optionKey(option);
              return (
                <article key={optionKey(option)}>
                  <div>
                    <strong>{optionLabel(option)}</strong>
                    <span>{option.text}</span>
                  </div>
                  {question.type === "KPRIM" && (
                    <small>
                      Korrekt: {option.correct ? "richtig" : "falsch"}
                      {typeof chosen === "boolean" ? ` · Du: ${chosen ? "richtig" : "falsch"}` : ""}
                    </small>
                  )}
                  <p>{text}</p>
                </article>
              );
            })}
          </div>
        </details>
      )}

      {explanation?.commonTrap && (
        <details>
          <summary>Typische Falle</summary>
          <p>{explanation.commonTrap}</p>
        </details>
      )}

      {explanation?.highYield && (
        <div className="question-high-yield">
          <span>High Yield</span>
          <strong>{explanation.highYield}</strong>
        </div>
      )}

      {objective && (
        <details>
          <summary>Lernzielbezug</summary>
          <p>{objective}</p>
        </details>
      )}
    </section>
  );

  function explanationForOption(
    currentQuestion: AssessmentQuestion,
    id: string,
    originalId?: string,
    displayId?: string
  ): string {
    const map = getStructuredExplanation(currentQuestion)?.wrongAnswerExplanations || {};
    return map[id] || map[originalId || ""] || map[displayId || ""] || "";
  }
}
