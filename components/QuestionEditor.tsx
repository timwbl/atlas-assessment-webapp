"use client";

import type { AssessmentQuestion, LearningObjective } from "@/lib/types";

type Props = {
  question: AssessmentQuestion;
  objectives: LearningObjective[];
  onChange: (question: AssessmentQuestion) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
};

export function QuestionEditor({ question, objectives, onChange, onDelete, onMove }: Props) {
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

      <label className="mt-4 block">
        <span className="eyebrow">Frage</span>
        <textarea className="input mt-2 min-h-24 py-3" value={question.stem} onChange={(event) => update("stem", event.target.value)} />
      </label>

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

      <label className="mt-4 block">
        <span className="eyebrow">Tags, kommagetrennt</span>
        <input className="input mt-2" value={question.tags.join(", ")} onChange={(event) => update("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} />
      </label>
    </article>
  );
}
