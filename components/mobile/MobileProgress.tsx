"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { blockColor } from "@/lib/blockColors";
import { formatBlockLabel } from "@/lib/blockLabels";
import { useMobileLearningData } from "./useMobileLearningData";

export function MobileProgress() {
  const data = useMobileLearningData();
  const rows = data.assessments
    .map((assessment) => {
      const stats = Object.values(data.progress[assessment.id]?.questionStats || {});
      const seen = stats.filter((stat) => stat.seen > 0).length;
      const wrong = stats.filter((stat) => stat.lastCorrect === false || stat.wrong > stat.correct).length;
      const ratio = seen ? wrong / seen : -1;
      return { assessment, seen, wrong, ratio, lastAt: data.progress[assessment.id]?.lastAttemptAt };
    })
    .filter((row) => row.seen > 0)
    .sort((a, b) => b.ratio - a.ratio);
  const percent = data.totalQuestions ? Math.round((data.seenCount / data.totalQuestions) * 100) : 0;

  return (
    <main className="mobile-action-page mobile-only" id="top">
      <header className="mobile-action-header">
        <p className="eyebrow">Progress</p>
        <h1>Deine Lernlage</h1>
        <p>Kompakt nach Aktivität und offenen Fehlern.</p>
      </header>

      <section className="mobile-progress-hero">
        <strong>{percent}%</strong>
        <span>des verfügbaren Fragenpools gesehen</span>
        <div><i style={{ width: `${percent}%` }} /></div>
      </section>

      <section className="mobile-stat-row">
        <div><strong>{data.seenCount}</strong><span>gesehen</span></div>
        <div><strong>{data.wrongCount}</strong><span>offen</span></div>
        <div><strong>{data.markedCount}</strong><span>markiert</span></div>
      </section>

      <section className="mobile-progress-list">
        <div className="mobile-section-heading"><h2>Aktuelle Bereiche</h2><span>{rows.length}</span></div>
        {rows.slice(0, 12).map(({ assessment, seen, wrong, ratio, lastAt }) => (
          <Link
            className="mobile-progress-card"
            href={`/assessment/${assessment.id}`}
            key={assessment.id}
            style={{ "--mobile-block-color": blockColor(assessment.block) } as CSSProperties}
          >
            <span className={`mobile-health-dot ${healthClass(ratio)}`} />
            <div>
              <strong>{assessment.lectureCode} · {assessment.title}</strong>
              <span>{formatBlockLabel(assessment.block)} · {seen} gesehen · {wrong} offen</span>
            </div>
            <small>{lastAt ? relativeDate(lastAt) : "neu"}</small>
          </Link>
        ))}
        {!rows.length && <div className="mobile-empty-state">Noch keine Lerndaten. Starte dein erstes Training.</div>}
      </section>
    </main>
  );
}

function healthClass(ratio: number): string {
  if (ratio < 0) return "is-empty";
  if (ratio >= 0.45) return "is-danger";
  if (ratio >= 0.2) return "is-warning";
  return "is-stable";
}

function relativeDate(value: string): string {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "gestern";
  return `vor ${days} T.`;
}
