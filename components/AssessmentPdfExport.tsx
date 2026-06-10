"use client";

import { useEffect, useRef, useState } from "react";
import { AUTH_SESSION_CHANGED_EVENT, ensureSession, getStoredSession } from "@/lib/supabaseClient";
import type { Assessment, AssessmentSummary } from "@/lib/types";

type Props = {
  assessment: Pick<Assessment | AssessmentSummary, "id" | "lectureCode" | "title">;
};

type ExportKind = "questions" | "solutions";

export function AssessmentPdfExport({ assessment }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function updateVisibility() {
      setVisible(!!getStoredSession());
    }

    updateVisibility();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, updateVisibility);
    window.addEventListener("storage", updateVisibility);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, updateVisibility);
      window.removeEventListener("storage", updateVisibility);
    };
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  if (!visible) return null;

  async function exportPdf(kind: ExportKind) {
    setBusy(kind);
    setError("");
    try {
      const session = await ensureSession();
      if (!session?.access_token) throw new Error("Bitte melde dich erneut an.");

      const endpoint = kind === "questions" ? "questions-pdf" : "solutions-pdf";
      const response = await fetch(`/api/assessments/${encodeURIComponent(assessment.id)}/export/${endpoint}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `PDF-Export fehlgeschlagen (${response.status}).`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileSafe(assessment.lectureCode || assessment.title)}-${kind === "questions" ? "fragen" : "loesungen"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "PDF konnte nicht erstellt werden.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="assessment-pdf-export" ref={menuRef}>
      <button
        className="assessment-pdf-trigger"
        type="button"
        aria-label="PDF exportieren"
        title="PDF exportieren"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        PDF
      </button>

      {open && (
        <div className="assessment-pdf-menu" onClick={(event) => event.stopPropagation()}>
          <button type="button" disabled={!!busy} onClick={() => void exportPdf("questions")}>
            {busy === "questions" ? "Erstelle..." : "Fragen-PDF herunterladen"}
          </button>
          <button type="button" disabled={!!busy} onClick={() => void exportPdf("solutions")}>
            {busy === "solutions" ? "Erstelle..." : "Lösungen-PDF herunterladen"}
          </button>
          {error && <p>{error}</p>}
        </div>
      )}
    </div>
  );
}

function fileSafe(value: string): string {
  return String(value || "atlas-assessment")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "atlas-assessment";
}
