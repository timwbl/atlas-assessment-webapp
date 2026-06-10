"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QuestionEditor } from "./QuestionEditor";
import { QuizEngine } from "./QuizEngine";
import { loadActiveAssessments } from "@/lib/assessmentClient";
import { isAltfragenAssessment } from "@/lib/altfragenAccess";
import { validateAssessment } from "@/lib/assessmentValidator";
import { analyzeQuestionQuality } from "@/lib/questionQuality";
import {
  applyStoredQuestionQualityReviews,
  consumeAdminQuestionTarget
} from "@/lib/questionQualityReviewStore";
import type { Assessment, AssessmentQuestion } from "@/lib/types";

export function AdminEditor({ contentType = "assessment" }: { contentType?: "assessment" | "altfragen" }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Assessment | null>(null);
  const [validation, setValidation] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetQuestionId, setTargetQuestionId] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void loadActiveAssessments()
      .then((items) => {
        const matching = items.filter((item) => (
          contentType === "altfragen" ? isAltfragenAssessment(item) : !isAltfragenAssessment(item)
        )).map(applyStoredQuestionQualityReviews);
        const target = consumeAdminQuestionTarget();
        const initialAssessment = matching.find((item) => item.id === target?.assessmentId) || matching[0];
        setAssessments(matching);
        setSelectedId(initialAssessment?.id || "");
        setDraft(initialAssessment ? structuredClone(initialAssessment) : null);
        setTargetQuestionId(target?.assessmentId === initialAssessment?.id ? target.questionId : "");
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Assessments konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, [contentType]);

  useEffect(() => {
    if (!draft || !targetQuestionId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`admin-question-${targetQuestionId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
      setTargetQuestionId("");
    }, 120);
    return () => window.clearTimeout(timer);
  }, [draft, targetQuestionId]);

  const filteredAssessments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assessments;
    return assessments.filter((assessment) => [
      assessment.lectureCode,
      assessment.title,
      assessment.block
    ].join(" ").toLowerCase().includes(needle));
  }, [assessments, query]);

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

  if (loading) {
    return (
      <div className="admin-loading card" aria-label="Assessments werden geladen"><span /><span /><span /></div>
    );
  }

  if (error) {
    return <div className="admin-alert admin-alert--error">{error}</div>;
  }

  if (!draft) {
    return (
      <section className="card admin-empty-state">
        <div className="eyebrow">{contentType === "altfragen" ? "Altfragen" : "Assessments"}</div>
        <h2>Keine Inhalte gefunden</h2>
        <p>In diesem Bereich sind aktuell keine passenden JSON-Assessments vorhanden.</p>
      </section>
    );
  }

  if (preview) {
    return (
      <div>
        <div className="pb-4">
          <div className="admin-preview-bar">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>Vorschau · {draft.lectureCode}</strong>
              <button className="btn-secondary" onClick={() => setPreview(false)}>Zurück zum Editor</button>
            </div>
          </div>
        </div>
        <QuizEngine assessment={draft} initialMode="training" />
      </div>
    );
  }

  return (
    <div>
      <header className="card admin-editor-header">
        <div className="admin-editor-header-inner">
          <div>
            <div className="eyebrow">{contentType === "altfragen" ? "ALTFRAGEN CONTENT" : "ASSESSMENT CONTENT"}</div>
            <h2>{contentType === "altfragen" ? "Altfragen verwalten" : "Assessment Editor"}</h2>
            <p>
              Änderungen bleiben lokal im Browser, bis du das JSON exportierst und in `/public/assessments` ersetzt.
            </p>
          </div>
          <div className="admin-editor-actions">
            <Link className="btn-secondary inline-flex items-center" href={`/assessment/${draft.id}`}>Details</Link>
            <button className="btn-secondary" onClick={() => setPreview(true)}>Quiz Preview</button>
            <button className="btn-primary" onClick={exportDraft}>Export Assessment JSON</button>
          </div>
        </div>
      </header>

      <section className="admin-assessment-layout">
        <aside className="card admin-assessment-list">
          <div className="admin-list-search">
            <input
              className="input"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Code, Titel oder Block suchen"
            />
            <span>{filteredAssessments.length} Inhalte</span>
          </div>
          <div className="admin-assessment-list-scroll">
            {filteredAssessments.map((assessment) => {
              const typeA = assessment.questions.filter((question) => question.type === "A").length;
              const kprim = assessment.questions.length - typeA;
              return (
                <button
                  className={selectedId === assessment.id ? "is-active" : ""}
                  key={assessment.id}
                  onClick={() => select(assessment.id)}
                  type="button"
                >
                  <span className="eyebrow">{assessment.block} · {assessment.lectureCode}</span>
                  <strong>{assessment.title}</strong>
                  <small>{assessment.questions.length} Fragen · {typeA} A · {kprim} K-prim</small>
                </button>
              );
            })}
            {!filteredAssessments.length && <p className="admin-list-empty">Keine passenden Inhalte.</p>}
          </div>
        </aside>

        <div className="admin-editor-main">
          {validation.length > 0 && (
            <section className="admin-alert admin-alert--warning">
              <div>{validation.map((item) => <p key={item}>{item}</p>)}</div>
            </section>
          )}

      <section className="card p-5">
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
            <button className="btn-secondary mt-2 w-full" type="button" onClick={() => updateDraft({ ...draft, block: "Altfragen" })}>
              Als Altfragen markieren
            </button>
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

      <section className="card mt-4 p-5">
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

      <section className="mt-4 grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-black">Fragen</h2>
          <button className="btn-primary" onClick={addQuestion}>Frage hinzufügen</button>
        </div>
        {draft.questions.map((question, index) => (
          <div className="scroll-mt-24" id={`admin-question-${question.id}`} key={question.id}>
            <QuestionEditor
              question={question}
              objectives={draft.learningObjectives}
              qualityAnalysis={analyzeQuestionQuality(draft, question, index)}
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
          </div>
        ))}
      </section>
        </div>
      </section>
    </div>
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
