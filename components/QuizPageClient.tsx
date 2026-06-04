"use client";

import { useEffect, useState } from "react";
import { AltfragenAccessPanel } from "./AltfragenAccessPanel";
import { QuizEngine } from "./QuizEngine";
import { ALTFRAGEN_ACCESS_CHANGED_EVENT, canAccessAltfragen, isAltfragenAssessment } from "@/lib/altfragenAccess";
import { loadAssessmentById } from "@/lib/assessmentClient";
import { rememberAssessmentLibrarySelectionFromAssessment } from "@/lib/librarySelection";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import type { Assessment, QuizMode } from "@/lib/types";

export function QuizPageClient({ id, mode }: { id: string; mode: QuizMode }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [altfragenAccess, setAltfragenAccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAssessmentById(id)
      .then((value) => {
        setAssessment(value);
        if (value) rememberAssessmentLibrarySelectionFromAssessment(value);
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Assessment konnte nicht geladen werden."));
    void refreshAltfragenAccess();
  }, [id]);

  useEffect(() => {
    function updateAltfragenAccess() {
      void refreshAltfragenAccess();
    }

    window.addEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, updateAltfragenAccess);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, updateAltfragenAccess);
    return () => {
      window.removeEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, updateAltfragenAccess);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, updateAltfragenAccess);
    };
  }, []);

  async function refreshAltfragenAccess() {
    setAltfragenAccess(await canAccessAltfragen().catch(() => false));
  }

  if (error) return <main className="shell"><div className="card p-6 text-red-600">{error}</div></main>;
  if (!assessment) return <main className="shell"><div className="card p-6">Quiz wird geladen…</div></main>;
  if (isAltfragenAssessment(assessment) && !altfragenAccess) {
    return (
      <main className="shell">
        <AltfragenAccessPanel onUnlocked={() => void refreshAltfragenAccess()} />
      </main>
    );
  }

  return <QuizEngine assessment={assessment} initialMode={mode} />;
}
