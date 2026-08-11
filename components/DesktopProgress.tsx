"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { blockColor } from "@/lib/blockColors";
import { formatBlockLabel } from "@/lib/blockLabels";
import { examForBlock } from "@/lib/studyProgram";
import { useMobileLearningData } from "@/components/mobile/useMobileLearningData";

export function DesktopProgress() {
  const data = useMobileLearningData();
  const rows = data.assessments
    .map((assessment) => {
      const progress = data.progress[assessment.id];
      const stats = Object.values(progress?.questionStats || {});
      const seen = stats.filter((stat) => stat.seen > 0).length;
      const wrong = stats.filter((stat) => stat.lastCorrect === false || stat.wrong > stat.correct).length;
      const marked = stats.filter((stat) => stat.markedForReview).length;
      const ratio = seen ? wrong / seen : -1;
      const lastAt = Math.max(
        progress?.lastAttemptAt ? new Date(progress.lastAttemptAt).getTime() : 0,
        progress?.activeSession ? new Date(progress.activeSession.lastOpenedAt).getTime() : 0
      );
      return { assessment, seen, wrong, marked, ratio, lastAt, score: progress?.lastScore ?? null };
    })
    .filter((row) => row.seen > 0 || row.lastAt > 0)
    .sort((left, right) => right.ratio - left.ratio || right.lastAt - left.lastAt);

  const percent = data.totalQuestions ? Math.round((data.seenCount / data.totalQuestions) * 100) : 0;

  return (
    <main className="shell desktop-only atlas-subpage-shell progress-desktop-page" id="top">
      <header className="atlas-subpage-hero">
        <p className="eyebrow">ATLAS Fortschritt</p>
        <h1>Mein Lernfortschritt</h1>
        <p>Ein ruhiger Überblick über Abdeckung, Fehler, markierte Fragen und die Bereiche, die als Nächstes Aufmerksamkeit brauchen.</p>
      </header>

      <section className="dashboard-progress-panel progress-hero-panel">
        <div className="dashboard-panel-head">
          <div>
            <p className="eyebrow">Fragenabdeckung</p>
            <h2>{percent}% des aktuellen Pools gesehen</h2>
          </div>
          <span className="dashboard-pill">{data.seenCount}/{data.totalQuestions || 0}</span>
        </div>
        <div className="dashboard-progress-bar">
          <span style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
        <div className="dashboard-metric-row">
          <Metric label="Gesehen" value={data.seenCount} />
          <Metric label="Offene Fehler" value={data.wrongCount} />
          <Metric label="Markiert" value={data.markedCount} />
          <Metric label="Aktive Bereiche" value={rows.length} />
        </div>
      </section>

      <section className="progress-table-panel">
        <div className="dashboard-panel-head">
          <div>
            <p className="eyebrow">Priorität</p>
            <h2>Aktuelle Bereiche</h2>
          </div>
          <Link className="dashboard-subtle-link" href="/assessments">Übungen öffnen</Link>
        </div>

        {rows.length ? (
          <div className="progress-row-list">
            {rows.slice(0, 18).map((row) => (
              <Link
                className="progress-row"
                href={`/assessment/${row.assessment.id}`}
                key={row.assessment.id}
                style={{ "--progress-accent": blockColor(row.assessment.block) } as CSSProperties}
              >
                <span className={`progress-health-dot ${healthClass(row.ratio)}`} />
                <div className="progress-row-main">
                  <strong>{row.assessment.title}</strong>
                  <span>
                    {formatBlockLabel(row.assessment.block)}
                    {examForBlock(row.assessment.block) ? ` · ${examForBlock(row.assessment.block)}` : ""}
                    {` · ${row.assessment.lectureCode}`}
                  </span>
                </div>
                <div className="progress-row-stats">
                  <span>{row.seen}/{row.assessment.questionCount}</span>
                  <span>{row.wrong} Fehler</span>
                  <span>{row.marked} markiert</span>
                  <span>{row.score === null ? "-" : `${row.score}%`}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state">Noch keine Lerndaten. Starte dein erstes Training.</div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="dashboard-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function healthClass(ratio: number): string {
  if (ratio < 0) return "is-empty";
  if (ratio >= 0.45) return "is-danger";
  if (ratio >= 0.2) return "is-warning";
  return "is-stable";
}
