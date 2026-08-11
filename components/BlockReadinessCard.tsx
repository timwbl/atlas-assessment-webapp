"use client";

import Link from "next/link";
import {
  latestReadinessResults,
  readinessStatusLabel
} from "@/lib/blockReadiness";
import type { AssessmentProgress } from "@/lib/types";

export function BlockReadinessCard({
  blockId,
  progress,
  questionCount
}: {
  blockId: string;
  progress?: AssessmentProgress;
  questionCount: number;
}) {
  const results = latestReadinessResults(progress);
  const latest = results[0];
  const previous = results[1];
  const trend = latest && previous
    ? latest.readinessScore - previous.readinessScore
    : null;

  return (
    <section className="block-readiness-card" aria-label="Block Readiness">
      <div className="block-readiness-copy">
        <p className="eyebrow">Block Readiness</p>
        <h3>{latest ? readinessStatusLabel(latest.status) : "Kurzer Block-Check"}</h3>
        <p>
          {latest
            ? `${latest.weakLearningObjectiveIds.length} offene Schwäche${latest.weakLearningObjectiveIds.length === 1 ? "" : "n"}`
            : `${questionCount} Fragen im Pool`}
        </p>
      </div>
      {latest && (
        <div className={`block-readiness-status is-${latest.status}`}>
          <strong>{latest.readinessScore}%</strong>
          <span>{trend === null ? "Erster Check" : `${trend > 0 ? "+" : ""}${trend} Punkte`}</span>
          <small>{formatDate(latest.createdAt)}</small>
        </div>
      )}
      <Link className="btn-primary block-readiness-action" href={`/blocks/${blockId}/fast-quiz`}>
        {latest ? "Erneut prüfen" : "Fast Quiz"}
      </Link>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}
