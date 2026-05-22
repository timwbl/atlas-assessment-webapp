"use client";

import Link from "next/link";
import type { Assessment, AssessmentProgress } from "@/lib/types";
import { collectAssessmentTags } from "@/lib/assessmentValidator";
import { reviewQuestionIds } from "@/lib/progressStore";

type Props = {
  assessment: Assessment;
  progress?: AssessmentProgress;
};

export function AssessmentCard({ assessment, progress }: Props) {
  const seen = Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length;
  const percent = assessment.questions.length ? Math.round((seen / assessment.questions.length) * 100) : 0;
  const tags = collectAssessmentTags(assessment).slice(0, 4);
  const reviewCount = reviewQuestionIds(assessment).length;

  return (
    <Link
      href={`/assessment/${assessment.id}`}
      className="card group block overflow-hidden p-5 transition hover:-translate-y-1 hover:shadow-lift"
      style={{ borderTop: `4px solid ${blockColor(assessment.block)}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Block {assessment.block} · {assessment.lectureCode}</div>
          <h2 className="mt-2 text-xl font-black leading-tight">{assessment.title}</h2>
        </div>
        <span className="pill">{assessment.questions.length} Fragen</span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
        <span>{percent}% gesehen</span>
        <span>·</span>
        <span>Letzter Score {progress?.lastScore ?? "-"}%</span>
        <span>·</span>
        <span>{reviewCount} Review</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span className="pill" key={tag}>{tag}</span>
        ))}
      </div>
    </Link>
  );
}

function blockColor(block: string) {
  const palette = ["#2563eb", "#14b8a6", "#8b5cf6", "#f97316", "#22c55e", "#ef4444"];
  const value = [...String(block)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[value % palette.length];
}
