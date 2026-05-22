"use client";

import { useEffect, useState } from "react";
import { QuizEngine } from "./QuizEngine";
import { loadAssessmentById } from "@/lib/assessmentClient";
import type { Assessment, QuizMode } from "@/lib/types";

export function QuizPageClient({ id, mode }: { id: string; mode: QuizMode }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAssessmentById(id)
      .then(setAssessment)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Assessment konnte nicht geladen werden."));
  }, [id]);

  if (error) return <main className="shell"><div className="card p-6 text-red-600">{error}</div></main>;
  if (!assessment) return <main className="shell"><div className="card p-6">Quiz wird geladen…</div></main>;

  return <QuizEngine assessment={assessment} initialMode={mode} />;
}
