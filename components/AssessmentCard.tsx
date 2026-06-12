"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { AssessmentPdfExport } from "./AssessmentPdfExport";
import type { AssessmentProgress, AssessmentSummary } from "@/lib/types";
import { blockColor } from "@/lib/blockColors";
import { formatBlockLabel } from "@/lib/blockLabels";
import { countReviewQuestions } from "@/lib/progressStore";
import { getAssessmentSubject } from "@/lib/assessmentCatalog";

type Props = {
  assessment: AssessmentSummary;
  progress?: AssessmentProgress;
};

export function AssessmentCard({ assessment, progress }: Props) {
  const seen = Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length;
  const percent = assessment.questionCount ? Math.round((seen / assessment.questionCount) * 100) : 0;
  const tags = assessment.tags.slice(0, 4);
  const reviewCount = countReviewQuestions(assessment.questionIds, progress);
  const masteredInExam = progress?.attempts.some((attempt) => attempt.mode === "exam" && attempt.score > 90) ?? false;

  return (
    <article
      className="assessment-card card group overflow-visible p-5 transition hover:-translate-y-1 hover:shadow-lift"
      style={{ "--assessment-accent": blockColor(assessment.block) } as CSSProperties}
    >
      <Link href={`/assessment/${assessment.id}`} className="assessment-card-main" prefetch={false}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="eyebrow">
              {formatBlockLabel(assessment.block)} · {getAssessmentSubject(assessment)} · {assessment.lectureCode}
            </div>
            <h2 className="assessment-card-title mt-2 text-xl font-black leading-tight">{assessment.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {masteredInExam && (
              <span className="assessment-card-star" aria-label="Prüfungsmodus über 90 Prozent bestanden" title="Prüfungsmodus über 90%">
                ★
              </span>
            )}
            <span className="pill">{assessment.questionCount} Fragen</span>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${percent}%`, background: "var(--assessment-accent)" }} />
        </div>

        <div className="assessment-card-meta mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
          <span>{percent}% gesehen</span>
          <span>·</span>
          <span>Letzter Score {progress?.lastScore ?? "-"}%</span>
          <span>·</span>
          <span>{reviewCount} Review</span>
        </div>

        <div className="assessment-card-tags mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span className="pill" key={tag}>{tag}</span>
          ))}
        </div>
      </Link>

      <div className="assessment-card-actions">
        <AssessmentPdfExport assessment={assessment} />
      </div>
    </article>
  );
}
