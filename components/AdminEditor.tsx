"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminDownloadsManager } from "./AdminDownloadsManager";
import { AdminProgressDashboard } from "./AdminProgressDashboard";
import { QuestionEditor } from "./QuestionEditor";
import { QuizEngine } from "./QuizEngine";
import { loadActiveAssessments } from "@/lib/assessmentClient";
import { validateAssessment } from "@/lib/assessmentValidator";
import type { Assessment, AssessmentQuestion } from "@/lib/types";

export function AdminEditor() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Assessment | null>(null);
  const [validation, setValidation] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    void loadActiveAssessments().then((items) => {
      setAssessments(items);
      setSelectedId(items[0]?.id || "");
      setDraft(items[0] ? structuredClone(items[0]) : null);
    });
  }, []);

  function select(id: string) {
    const assessment = assessments.find((item) => item.id === id) || null;
    setSelectedId(id);
    setDraft(assessment ? structuredClone(assessment) : null);
    setValidation([]);
    setPreview(false);
  }

  function updateDraft(next: Assessment) {
    setDraft(next);
    const result = validateAssessment(next);
    setValidation(result.ok ? result.warnings : result.errors);
  }

  function exportDraft() {
    if (!draft) return;
    const result = validateAssessment(draft);
    if (!result.ok) {
      setValidation(result.errors);
      return;
    }
    const blob = new Blob([JSON.stringify(result.value, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${draft.lectureCode.toLowerCase()}-${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function addQuestion() {
    if (!draft) return;
    const typeAOptions = ["A", "B", "C", "D", "E"].map((id, index) => ({ id, text: "", correct: index === 0 }));
    const question: AssessmentQuestion = {
      id: `q${draft.questions.length + 1}`,
      type: "A",
      difficulty: 3,
      learningObjectiveId: draft.learningObjectives[0]?.id || "",
      stem: "Neue Frage",
      options: typeAOptions,
      explanation: "",
      trap: "",
      tags: [],
      sourceReliability: "medium"
    };
    updateDraft({ ...draft, questions: [...draft.questions, question] });
  }

  if (!draft) {
    return (
      <main className="shell">
        <div className="card p-6">Keine Assessments gefunden.</div>
      </main>
    );
  }

  if (preview) {
    return (
      <div>
        <div className="shell pb-0">
          <div className="rounded-[24px] border border-amber-300 bg-amber-500/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>ADMIN MODE · Preview Quiz</strong>
              <button className="btn-secondary" onClick={() => setPreview(false)}>Zurück zum Editor</button>
            </div>
          </div>
        </div>
        <QuizEngine assessment={draft} initialMode="training" />
      </div>
    );
  }

  return (
    <main className="shell">
      <header className="rounded-[28px] border border-amber-300 bg-amber-500/10 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow text-amber-600">ADMIN MODE</div>
            <h1 className="mt-2 text-4xl font-black">Assessment Editor</h1>
            <p className="mt-3 text-[var(--muted)]">
              Änderungen bleiben lokal im Browser, bis du das JSON exportierst und in `/public/assessments` ersetzt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn-secondary inline-flex items-center" href="/">Library</Link>
            <button className="btn-secondary" onClick={() => setPreview(true)}>Quiz Preview</button>
            <button className="btn-primary" onClick={exportDraft}>Export Assessment JSON</button>
          </div>
        </div>
      </header>

      <AdminDownloadsManager />

      <AdminProgressDashboard />

      <section className="card mt-5 p-4">
        <select className="input" value={selectedId} onChange={(event) => select(event.target.value)}>
          {assessments.map((assessment) => (
            <option key={assessment.id} value={assessment.id}>{assessment.lectureCode} · {assessment.title}</option>
          ))}
        </select>
      </section>

      {validation.length > 0 && (
        <section className="card mt-5 border-amber-300 p-4 text-sm text-amber-700">
          {validation.map((item) => <p key={item}>{item}</p>)}
        </section>
      )}

      <section className="card mt-5 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label>
            <span className="eyebrow">Code</span>
            <input className="input mt-2" value={draft.lectureCode} onChange={(event) => updateDraft({ ...draft, lectureCode: event.target.value })} />
          </label>
          <label>
            <span className="eyebrow">Titel</span>
            <input className="input mt-2" value={draft.title} onChange={(event) => updateDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            <span className="eyebrow">Block</span>
            <input className="input mt-2" value={draft.block} onChange={(event) => updateDraft({ ...draft, block: event.target.value })} />
          </label>
          <label>
            <span className="eyebrow">Aktiv</span>
            <select className="input mt-2" value={draft.active === false ? "false" : "true"} onChange={(event) => updateDraft({ ...draft, active: event.target.value === "true" })}>
              <option value="true">aktiv</option>
              <option value="false">deaktiviert</option>
            </select>
          </label>
        </div>
        <label className="mt-4 block">
          <span className="eyebrow">Beschreibung</span>
          <textarea className="input mt-2 min-h-24 py-3" value={draft.sourceSummary} onChange={(event) => updateDraft({ ...draft, sourceSummary: event.target.value })} />
        </label>
      </section>

      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-black">Lernziele</h2>
          <button
            className="btn-secondary"
            onClick={() => updateDraft({
              ...draft,
              learningObjectives: [
                ...draft.learningObjectives,
                { id: `lo${draft.learningObjectives.length + 1}`, text: "Neues Lernziel" }
              ]
            })}
          >
            Lernziel hinzufügen
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {draft.learningObjectives.map((objective, index) => (
            <div className="grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-3 md:grid-cols-[120px_1fr_auto]" key={`${objective.id}-${index}`}>
              <input
                className="input"
                value={objective.id}
                onChange={(event) => {
                  const learningObjectives = [...draft.learningObjectives];
                  learningObjectives[index] = { ...objective, id: event.target.value };
                  updateDraft({ ...draft, learningObjectives });
                }}
              />
              <input
                className="input"
                value={objective.text}
                onChange={(event) => {
                  const learningObjectives = [...draft.learningObjectives];
                  learningObjectives[index] = { ...objective, text: event.target.value };
                  updateDraft({ ...draft, learningObjectives });
                }}
              />
              <button
                className="btn-danger"
                onClick={() => updateDraft({
                  ...draft,
                  learningObjectives: draft.learningObjectives.filter((_, itemIndex) => itemIndex !== index)
                })}
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-black">Fragen</h2>
          <button className="btn-primary" onClick={addQuestion}>Frage hinzufügen</button>
        </div>
        {draft.questions.map((question, index) => (
          <QuestionEditor
            key={question.id}
            question={question}
            objectives={draft.learningObjectives}
            onChange={(nextQuestion) => {
              const questions = [...draft.questions];
              questions[index] = normalizeQuestionOptions(nextQuestion);
              updateDraft({ ...draft, questions });
            }}
            onDelete={() => updateDraft({ ...draft, questions: draft.questions.filter((item) => item.id !== question.id) })}
            onMove={(direction) => {
              const target = index + direction;
              if (target < 0 || target >= draft.questions.length) return;
              const questions = [...draft.questions];
              [questions[index], questions[target]] = [questions[target], questions[index]];
              updateDraft({ ...draft, questions });
            }}
          />
        ))}
      </section>
    </main>
  );
}

function normalizeQuestionOptions(question: AssessmentQuestion): AssessmentQuestion {
  if (question.type === "KPRIM") {
    const options = question.options.slice(0, 4);
    while (options.length < 4) {
      options.push({ id: String.fromCharCode(65 + options.length), text: "", correct: false });
    }
    return { ...question, options };
  }

  const options = question.options.slice(0, 5);
  while (options.length < 5) {
    options.push({ id: String.fromCharCode(65 + options.length), text: "", correct: false });
  }
  const firstCorrect = options.findIndex((option) => option.correct);
  return {
    ...question,
    options: options.map((option, index) => ({ ...option, correct: index === Math.max(0, firstCorrect) }))
  };
}
