"use client";

import { useEffect, useState } from "react";
import {
  AUTH_SESSION_CHANGED_EVENT,
  ensureSession,
  getStoredSession
} from "@/lib/supabaseClient";
import type { Assessment, QuizAttempt } from "@/lib/types";

type Props = {
  assessment: Assessment;
  attempt: QuizAttempt;
};

type ExportKind = "review" | "solutions";

export function CompletedAssessmentPdfExport({ assessment, attempt }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function update() {
      setLoggedIn(!!getStoredSession());
    }
    update();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  async function download(kind: ExportKind) {
    setBusy(kind);
    setError("");
    try {
      const session = await ensureSession();
      if (!session?.access_token) throw new Error("Bitte melde dich erneut an.");

      const endpoint = kind === "review"
        ? `/api/assessments/${encodeURIComponent(assessment.id)}/export/review-pdf`
        : `/api/assessments/${encodeURIComponent(assessment.id)}/export/solutions-pdf`;
      const response = await fetch(endpoint, {
        method: kind === "review" ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(kind === "review" ? { "Content-Type": "application/json" } : {})
        },
        ...(kind === "review" ? { body: JSON.stringify({ attempt }) } : {})
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `PDF-Export fehlgeschlagen (${response.status}).`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "review"
        ? `atlas-review_${slug(assessment.title)}_${attempt.completedAt.slice(0, 10)}.pdf`
        : `atlas-loesungen_${slug(assessment.title)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "PDF konnte nicht erstellt werden.");
    } finally {
      setBusy(null);
    }
  }

  if (!loggedIn) {
    return (
      <div className="review-export-locked">
        PDF-Export ist nur mit Account verfügbar.
      </div>
    );
  }

  return (
    <div className="review-export-actions">
      <button className="btn-primary" disabled={!!busy} onClick={() => void download("review")}>
        {busy === "review" ? "Review-PDF wird erstellt…" : "Review als PDF exportieren"}
      </button>
      <button className="btn-secondary" disabled={!!busy} onClick={() => void download("solutions")}>
        {busy === "solutions" ? "Lösungs-PDF wird erstellt…" : "Lösungen als PDF exportieren"}
      </button>
      {error && <p className="review-export-error">{error}</p>}
    </div>
  );
}

function slug(value: string): string {
  return String(value || "assessment")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "assessment";
}
