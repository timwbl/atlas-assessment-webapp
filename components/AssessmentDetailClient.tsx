"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssessmentPublicReviews } from "./AssessmentPublicReviews";
import { loadAssessmentById } from "@/lib/assessmentClient";
import { collectAssessmentTags } from "@/lib/assessmentValidator";
import { formatBlockLabel } from "@/lib/blockLabels";
import { cloudSyncAvailable, resetCloudProgress, syncAssessmentProgress } from "@/lib/cloudProgress";
import { getProgress, resetProgress, reviewQuestionIds } from "@/lib/progressStore";
import type { Assessment, AssessmentProgress } from "@/lib/types";

export function AssessmentDetailClient({ id }: { id: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [progress, setProgress] = useState<AssessmentProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAssessmentById(id)
      .then((value) => {
        setAssessment(value);
        if (value) setProgress(getProgress(value.id));
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Assessment konnte nicht geladen werden."));
  }, [id]);

  const counts = useMemo(() => {
    if (!assessment) return { a: 0, kprim: 0, seen: 0, review: 0 };
    return {
      a: assessment.questions.filter((question) => question.type === "A").length,
      kprim: assessment.questions.filter((question) => question.type === "KPRIM").length,
      seen: Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length,
      review: reviewQuestionIds(assessment).length
    };
  }, [assessment, progress]);

  if (error) {
    return <main className="shell"><div className="card p-6 text-red-600">{error}</div></main>;
  }

  if (!assessment) {
    return <main className="shell"><div className="card p-6">Assessment wird geladen…</div></main>;
  }

  const tags = collectAssessmentTags(assessment);

  return (
    <main id="top" className="shell">
      <Link className="btn-secondary inline-flex items-center" href="/">Zur Library</Link>

      <header className="glass detail-hero mt-4 rounded-[28px] p-6 md:p-8">
        <div className="eyebrow">{formatBlockLabel(assessment.block)} · {assessment.lectureCode}</div>
        <h1 className="detail-title mt-2 text-4xl font-black leading-tight md:text-6xl">{assessment.title}</h1>
        <p className="mt-4 max-w-3xl text-[var(--muted)]">{assessment.sourceSummary || "Kein Beschreibungstext hinterlegt."}</p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <Stat label="Typ A" value={counts.a} />
          <Stat label="KPRIM" value={counts.kprim} />
          <Stat label="Gesehen" value={`${counts.seen}/${assessment.questions.length}`} />
          <Stat label="Review" value={counts.review} />
        </div>

        <div className="detail-actions mt-6 flex flex-wrap gap-2">
          <Link className="btn-primary inline-flex items-center" href={`/quiz/${assessment.id}?mode=training`}>Training starten</Link>
          <Link className="btn-secondary inline-flex items-center" href={`/quiz/${assessment.id}?mode=exam`}>Prüfungsmodus starten</Link>
          <Link className="btn-secondary inline-flex items-center" href={`/quiz/${assessment.id}?mode=review`}>Reviewmodus starten</Link>
          <button
            className="btn-danger"
            onClick={() => {
              if (confirm("Lokalen Fortschritt für dieses Assessment zurücksetzen?")) {
                resetProgress(assessment.id);
                void resetCloudProgress(assessment.id).catch(() => undefined);
                setProgress(getProgress(assessment.id));
              }
            }}
          >
            Fortschritt zurücksetzen
          </button>
        </div>
      </header>

      <AssessmentPublicReviews assessmentId={assessment.id} />

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5">
          <h2 className="text-2xl font-black">Lernziele</h2>
          <div className="mt-4 grid gap-3">
            {assessment.learningObjectives.length ? assessment.learningObjectives.map((objective) => (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4" key={objective.id}>
                <div className="eyebrow">{objective.id}</div>
                <p className="mt-1 text-sm text-[var(--muted)]">{objective.text}</p>
              </div>
            )) : <p className="text-[var(--muted)]">Keine Lernziele im JSON hinterlegt.</p>}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-2xl font-black">Tags & Fortschritt</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}
          </div>
          <div className="mt-6 grid gap-3 text-sm text-[var(--muted)]">
            <p>Letzter Score: <strong className="text-[var(--text)]">{progress?.lastScore ?? "-"}%</strong></p>
            <p>Bester Score: <strong className="text-[var(--text)]">{progress?.bestScore ?? 0}%</strong></p>
            <p>Versuche: <strong className="text-[var(--text)]">{progress?.attempts.length ?? 0}</strong></p>
          </div>
          {cloudSyncAvailable() && (
            <button
              className="btn-secondary mt-5 w-full"
              onClick={() => {
                void syncAssessmentProgress(assessment.id)
                  .then(() => setProgress(getProgress(assessment.id)))
                  .catch((syncError) => alert(syncError instanceof Error ? syncError.message : "Sync fehlgeschlagen."));
              }}
            >
              Fortschritt synchronisieren
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
