"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { AssessmentProgress, AssessmentSummary } from "@/lib/types";
import { blockColor } from "@/lib/blockColors";
import { formatBlockLabel } from "@/lib/blockLabels";

type Props = {
  assessment: AssessmentSummary;
  progress?: AssessmentProgress;
};

export function AssessmentCard({ assessment, progress }: Props) {
  const seen = Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length;
  const percent = assessment.questionCount ? Math.round((seen / assessment.questionCount) * 100) : 0;
  const masteredInExam = progress?.attempts.some((attempt) => attempt.mode === "exam" && attempt.score > 90) ?? false;

  return (
    <article
      className="assessment-card card group overflow-visible p-5 transition hover:-translate-y-1 hover:shadow-lift"
      style={{ "--assessment-accent": blockColor(assessment.block) } as CSSProperties}
    >
      <Link href={`/assessment/${assessment.id}`} className="assessment-card-main" prefetch={false}>
        <div className="assessment-card-head flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">
              {assessment.lectureCode} · {formatBlockLabel(assessment.block)}
            </div>
            <h2 className="assessment-card-title mt-2 text-xl font-black leading-tight">{assessment.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {masteredInExam && (
              <span className="assessment-card-star" aria-label="Prüfungsmodus über 90 Prozent bestanden" title="Prüfungsmodus über 90%">
                ★
              </span>
            )}
          </div>
        </div>

        <div className="assessment-card-progress mt-5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" aria-label={`${percent}% gesehen`}>
          <div className="h-full rounded-full" style={{ width: `${percent}%`, background: "var(--assessment-accent)" }} />
        </div>

        <div className="assessment-card-meta mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <span>{percent}% gesehen</span>
          <span>{assessment.questionCount} Fragen</span>
          <span aria-hidden="true">→</span>
        </div>
      </Link>
    </article>
  );
}
