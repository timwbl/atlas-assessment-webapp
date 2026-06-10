"use client";

import { useEffect, useState } from "react";
import { AltfragenAccessPanel } from "./AltfragenAccessPanel";
import { QuizEngine } from "./QuizEngine";
import { PageState } from "./ui/PageState";
import { ALTFRAGEN_ACCESS_CHANGED_EVENT, canAccessAltfragen, isAltfragenAssessment } from "@/lib/altfragenAccess";
import { loadAssessmentById } from "@/lib/assessmentClient";
import { rememberAssessmentLibrarySelectionFromAssessment } from "@/lib/librarySelection";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import type { Assessment, QuickTrainingType, QuizMode } from "@/lib/types";

export function QuizPageClient({
  id,
  mode,
  resume,
  quick,
  limit
}: {
  id: string;
  mode: QuizMode;
  resume: boolean;
  quick: QuickTrainingType;
  limit: number;
}) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [altfragenAccess, setAltfragenAccess] = useState(false);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setAssessment(null);
    setError("");
    void loadAssessmentById(id)
      .then((value) => {
        if (!active) return;
        setAssessment(value);
        if (value) rememberAssessmentLibrarySelectionFromAssessment(value);
      })
      .catch(() => {
        if (active) setError("Das Assessment konnte gerade nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.");
      });
    void refreshAltfragenAccess();
    return () => {
      active = false;
    };
  }, [id, loadVersion]);

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

  if (error) {
    return (
      <PageState
        actionLabel="Erneut versuchen"
        eyebrow="Verbindung"
        message={error}
        onAction={() => setLoadVersion((value) => value + 1)}
        title="Assessment nicht verfügbar"
      />
    );
  }
  if (!assessment) {
    return (
      <PageState
        eyebrow="Assessment"
        loading
        message="Fragen und dein letzter Stand werden vorbereitet."
        title="Quiz wird geladen"
      />
    );
  }
  if (isAltfragenAssessment(assessment) && !altfragenAccess) {
    return (
      <main className="shell">
        <AltfragenAccessPanel onUnlocked={() => void refreshAltfragenAccess()} />
      </main>
    );
  }

  return (
    <QuizEngine
      assessment={assessment}
      initialMode={mode}
      limit={limit}
      quick={quick}
      resume={resume}
    />
  );
}
