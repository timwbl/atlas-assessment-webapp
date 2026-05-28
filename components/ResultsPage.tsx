"use client";

import Link from "next/link";
import { AssessmentReviewPrompt } from "./AssessmentReviewPrompt";
import type { Assessment, QuizAttempt, QuizResultRow } from "@/lib/types";
import { answerLabel, correctAnswerLabel } from "@/lib/score";

type Props = {
  assessment: Assessment;
  rows: QuizResultRow[];
  attempt: QuizAttempt;
  onRepeatWrong: () => void;
  onRestart: () => void;
};

export function ResultsPage({ assessment, rows, attempt, onRepeatWrong, onRestart }: Props) {
  const wrong = rows.filter((row) => !row.correct);
  const tagErrors = wrong.reduce<Record<string, number>>((acc, row) => {
    row.question.tags.forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});
  const loErrors = wrong.reduce<Record<string, number>>((acc, row) => {
    acc[row.question.learningObjectiveId || "ohne Lernziel"] = (acc[row.question.learningObjectiveId || "ohne Lernziel"] || 0) + 1;
    return acc;
  }, {});
  const typeStats = ["A", "KPRIM"].map((type) => {
    const typeRows = rows.filter((row) => row.question.type === type);
    const correct = typeRows.filter((row) => row.correct).length;
    return { type, correct, total: typeRows.length };
  });

  return (
    <main id="top" className="shell">
      <header className="glass result-hero rounded-[28px] p-6 md:p-8">
        <div className="eyebrow">Resultat · {assessment.lectureCode}</div>
        <h1 className="result-score mt-2 text-5xl font-black">{attempt.score}%</h1>
        <p className="mt-3 text-[var(--muted)]">
          {attempt.correct} von {attempt.total} Fragen richtig · {wrong.length} Fehler
        </p>
        <div className="result-actions mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onRepeatWrong} disabled={!wrong.length}>Falsche Fragen wiederholen</button>
          <button className="btn-secondary" onClick={onRestart}>Neues Quiz starten</button>
          <Link className="btn-secondary inline-flex items-center" href="/">Zur Übersicht</Link>
        </div>
      </header>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <AnalysisCard title="Fehler-Tags" values={tagErrors} />
        <AnalysisCard title="Schwache Lernziele" values={loErrors} />
        <div className="card p-5">
          <h2 className="text-xl font-black">Fragetypen</h2>
          <div className="mt-4 grid gap-3">
            {typeStats.map((stat) => (
              <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-3" key={stat.type}>
                <span>{stat.type}</span>
                <strong>{stat.total ? Math.round((stat.correct / stat.total) * 100) : 0}%</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AssessmentReviewPrompt assessment={assessment} />

      <section className="mt-6 grid gap-4">
        {wrong.map((row) => (
          <article className="card p-5" key={row.question.id}>
            <div className="eyebrow">{row.question.type} · Level {row.question.difficulty}</div>
            <h2 className="mt-2 text-xl font-black">{row.question.stem}</h2>
            <div className="mt-4 grid gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
              <p><strong className="text-[var(--text)]">Deine Antwort:</strong> {answerLabel(row.question, row.answer)}</p>
              <p><strong className="text-[var(--text)]">Richtig wäre:</strong> {correctAnswerLabel(row.question)}</p>
            </div>
            <p className="mt-4 text-[var(--muted)]">{row.question.explanation}</p>
            {row.question.trap && <p className="mt-2 text-sm text-amber-600"><strong>Falle:</strong> {row.question.trap}</p>}
          </article>
        ))}
      </section>
    </main>
  );
}

function AnalysisCard({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="card p-5">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 grid gap-3">
        {entries.length ? entries.map(([label, count]) => (
          <div key={label}>
            <div className="flex justify-between text-sm">
              <span className="truncate text-[var(--muted)]">{label}</span>
              <strong>{count}</strong>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, count * 28)}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-[var(--muted)]">Keine Fehler in diesem Bereich.</p>}
      </div>
    </div>
  );
}
