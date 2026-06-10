"use client";

import type { AssessmentQuestion, LearningObjective } from "@/lib/types";
import {
  bloomLabel,
  difficultyLabel,
  qualityFlagLabel,
  type QuestionQualityAnalysis
} from "@/lib/questionQuality";

type Props = {
  question: AssessmentQuestion;
  objectives: LearningObjective[];
  onChange: (question: AssessmentQuestion) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  qualityAnalysis?: QuestionQualityAnalysis;
};

export function QuestionEditor({ question, objectives, onChange, onDelete, onMove, qualityAnalysis }: Props) {
  function update<K extends keyof AssessmentQuestion>(key: K, value: AssessmentQuestion[K]) {
    onChange({ ...question, [key]: value });
  }

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={question.type} onChange={(event) => update("type", event.target.value as AssessmentQuestion["type"])}>
            <option value="A">Typ A</option>
            <option value="KPRIM">KPRIM</option>
          </select>
          <input className="input w-28" type="number" min={1} max={5} value={question.difficulty} onChange={(event) => update("difficulty", Number(event.target.value))} />
          <select className="input w-auto" value={question.learningObjectiveId} onChange={(event) => update("learningObjectiveId", event.target.value)}>
            <option value="">Kein Lernziel</option>
            {objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.id}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => onMove(-1)}>↑</button>
          <button className="btn-secondary" onClick={() => onMove(1)}>↓</button>
          <button className="btn-danger" onClick={onDelete}>Löschen</button>
        </div>
      </div>

      {qualityAnalysis && (
        <div className="question-quality-summary">
          <div>
            <span>{difficultyLabel(qualityAnalysis.difficulty)}</span>
            <span>{bloomLabel(qualityAnalysis.bloomLevel)}</span>
            <span>{reviewStatusLabel(question.reviewStatus || qualityAnalysis.reviewStatus)}</span>
          </div>
          <div>
            {qualityAnalysis.activeFlags.map((flag) => <span key={flag}>{qualityFlagLabel(flag)}</span>)}
            {!qualityAnalysis.activeFlags.length && <span className="is-clear">Keine offenen Flags</span>}
          </div>
        </div>
      )}

      <label className="mt-4 block">
        <span className="eyebrow">Frage</span>
        <textarea className="input mt-2 min-h-24 py-3" value={question.stem} onChange={(event) => update("stem", event.target.value)} />
      </label>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label>
          <span className="eyebrow">Schwierigkeit</span>
          <select
            className="input mt-2"
            value={question.difficultyLevel || qualityAnalysis?.difficulty || "medium"}
            onChange={(event) => update("difficultyLevel", event.target.value as NonNullable<AssessmentQuestion["difficultyLevel"]>)}
          >
            <option value="easy">Einfach</option>
            <option value="medium">Mittel</option>
            <option value="hard">Schwierig</option>
            <option value="very_hard">Sehr schwierig</option>
          </select>
        </label>
        <label>
          <span className="eyebrow">Bloom-Level</span>
          <select
            className="input mt-2"
            value={question.bloomLevel || qualityAnalysis?.bloomLevel || "understanding"}
            onChange={(event) => update("bloomLevel", event.target.value as NonNullable<AssessmentQuestion["bloomLevel"]>)}
          >
            <option value="recall">Recall</option>
            <option value="understanding">Verständnis</option>
            <option value="application">Anwendung</option>
            <option value="mechanism">Mechanismus</option>
            <option value="transfer">Transfer</option>
            <option value="clinical_reasoning">Klinisches Denken</option>
          </select>
        </label>
        <label>
          <span className="eyebrow">Review Status</span>
          <select
            className="input mt-2"
            value={question.reviewStatus || qualityAnalysis?.reviewStatus || "needs_review"}
            onChange={(event) => update("reviewStatus", event.target.value as NonNullable<AssessmentQuestion["reviewStatus"]>)}
          >
            <option value="draft">Entwurf</option>
            <option value="needs_review">Review nötig</option>
            <option value="reviewed">Geprüft</option>
            <option value="verified">Verifiziert</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label>
          <span className="eyebrow">Konzepte, kommagetrennt</span>
          <input
            className="input mt-2"
            value={(question.concepts || []).join(", ")}
            onChange={(event) => update("concepts", splitList(event.target.value))}
            placeholder="z. B. MLCK, Calcium-Sensitivierung"
          />
        </label>
        <label>
          <span className="eyebrow">Frageziel</span>
          <input
            className="input mt-2"
            value={question.questionGoal || ""}
            onChange={(event) => update("questionGoal", event.target.value)}
            placeholder="Welche Denkoperation soll geprüft werden?"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3">
        {question.options.map((option, index) => (
          <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-3 md:grid-cols-[52px_1fr_auto]" key={option.id}>
            <input
              className="input"
              value={option.id}
              onChange={(event) => {
                const options = [...question.options];
                options[index] = { ...option, id: event.target.value };
                update("options", options);
              }}
            />
            <input
              className="input"
              value={option.text}
              onChange={(event) => {
                const options = [...question.options];
                options[index] = { ...option, text: event.target.value };
                update("options", options);
              }}
            />
            <button
              className={option.correct ? "btn-primary" : "btn-secondary"}
              onClick={() => {
                const options = question.options.map((item, optionIndex) => ({
                  ...item,
                  correct: question.type === "A" ? optionIndex === index : optionIndex === index ? !item.correct : item.correct
                }));
                update("options", options);
              }}
            >
              {question.type === "A" ? "korrekt" : option.correct ? "richtig" : "falsch"}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label>
          <span className="eyebrow">Erklärung</span>
          <textarea className="input mt-2 min-h-24 py-3" value={question.explanation} onChange={(event) => update("explanation", event.target.value)} />
        </label>
        <label>
          <span className="eyebrow">Typische Falle</span>
          <textarea className="input mt-2 min-h-24 py-3" value={question.trap} onChange={(event) => update("trap", event.target.value)} />
        </label>
      </div>

      <details className="question-explanation-editor mt-4">
        <summary>Strukturierte Erklärung bearbeiten</summary>
        <div className="mt-4 grid gap-3">
          <label>
            <span className="eyebrow">Core Idea</span>
            <textarea
              className="input mt-2 min-h-20 py-3"
              value={question.structuredExplanation?.coreIdea || ""}
              onChange={(event) => updateStructuredExplanation(question, onChange, "coreIdea", event.target.value)}
            />
          </label>
          <label>
            <span className="eyebrow">Correct Reasoning</span>
            <textarea
              className="input mt-2 min-h-28 py-3"
              value={question.structuredExplanation?.correctReasoning || question.explanation}
              onChange={(event) => updateStructuredExplanation(question, onChange, "correctReasoning", event.target.value)}
            />
          </label>
          <div className="grid gap-3">
            <span className="eyebrow">Erklärung pro Antwortoption</span>
            {question.options.map((option) => (
              <label className="question-option-explanation-editor" key={option.id}>
                <strong>{option.id}</strong>
                <textarea
                  className="input min-h-20 py-3"
                  value={question.structuredExplanation?.wrongAnswerExplanations?.[option.id] || ""}
                  onChange={(event) => {
                    const current = structuredExplanation(question);
                    onChange({
                      ...question,
                      structuredExplanation: {
                        ...current,
                        wrongAnswerExplanations: {
                          ...current.wrongAnswerExplanations,
                          [option.id]: event.target.value
                        }
                      }
                    });
                  }}
                  placeholder={question.type === "KPRIM"
                    ? "Warum ist diese Aussage richtig oder falsch?"
                    : option.correct ? "Optional: Warum ist diese Antwort richtig?" : "Warum ist diese Antwort falsch und plausibel?"}
                />
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="eyebrow">Common Trap</span>
              <textarea
                className="input mt-2 min-h-20 py-3"
                value={question.structuredExplanation?.commonTrap || question.trap}
                onChange={(event) => updateStructuredExplanation(question, onChange, "commonTrap", event.target.value)}
              />
            </label>
            <label>
              <span className="eyebrow">High Yield</span>
              <textarea
                className="input mt-2 min-h-20 py-3"
                value={question.structuredExplanation?.highYield || ""}
                onChange={(event) => updateStructuredExplanation(question, onChange, "highYield", event.target.value)}
              />
            </label>
          </div>
        </div>
      </details>

      <label className="mt-4 block">
        <span className="eyebrow">Tags, kommagetrennt</span>
        <input className="input mt-2" value={question.tags.join(", ")} onChange={(event) => update("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} />
      </label>
    </article>
  );
}

function structuredExplanation(question: AssessmentQuestion) {
  return question.structuredExplanation || {
    coreIdea: "",
    correctReasoning: question.explanation,
    wrongAnswerExplanations: {},
    commonTrap: question.trap,
    highYield: ""
  };
}

function updateStructuredExplanation(
  question: AssessmentQuestion,
  onChange: (question: AssessmentQuestion) => void,
  key: "coreIdea" | "correctReasoning" | "commonTrap" | "highYield",
  value: string
) {
  onChange({
    ...question,
    ...(key === "correctReasoning" ? { explanation: value } : {}),
    ...(key === "commonTrap" ? { trap: value } : {}),
    structuredExplanation: { ...structuredExplanation(question), [key]: value }
  });
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function reviewStatusLabel(value: NonNullable<AssessmentQuestion["reviewStatus"]>) {
  if (value === "verified") return "Verifiziert";
  if (value === "reviewed") return "Geprüft";
  if (value === "draft") return "Entwurf";
  return "Review nötig";
}
