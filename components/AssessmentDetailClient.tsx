"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { AltfragenAccessPanel } from "./AltfragenAccessPanel";
import { AssessmentPublicReviews } from "./AssessmentPublicReviews";
import { AtlasIcon } from "./AtlasIcon";
import { PageState } from "./ui/PageState";
import { SummaryLinkPanel } from "./SummaryLinkPanel";
import { ALTFRAGEN_ACCESS_CHANGED_EVENT, canAccessAltfragen, isAltfragenAssessment } from "@/lib/altfragenAccess";
import { loadAssessmentById } from "@/lib/assessmentClient";
import { ASSESSMENT_ROUTE_CONTEXT_CHANGED_EVENT } from "@/lib/assessmentRouteContext";
import { collectAssessmentTags } from "@/lib/assessmentValidator";
import { formatBlockLabel } from "@/lib/blockLabels";
import { cloudSyncAvailable, resetCloudProgress, syncAssessmentProgress } from "@/lib/cloudProgress";
import { rememberAssessmentLibrarySelectionFromAssessment } from "@/lib/librarySelection";
import { getProgress, resetProgress, reviewQuestionIds } from "@/lib/progressStore";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import type { Assessment, AssessmentProgress } from "@/lib/types";

export function AssessmentDetailClient({ id }: { id: string }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [progress, setProgress] = useState<AssessmentProgress | null>(null);
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
        if (value) {
          rememberAssessmentLibrarySelectionFromAssessment(value);
          setProgress(getProgress(value.id));
        }
      })
      .catch(() => {
        if (active) setError("Die Übung konnte gerade nicht geladen werden. Prüfe deine Verbindung und versuche es erneut.");
      });
    void refreshAltfragenAccess();
    return () => {
      active = false;
    };
  }, [id, loadVersion]);

  useEffect(() => {
    if (!assessment) return;
    window.dispatchEvent(new CustomEvent(ASSESSMENT_ROUTE_CONTEXT_CHANGED_EVENT, {
      detail: { area: isAltfragenAssessment(assessment) ? "altfragen" : "assessments" }
    }));
  }, [assessment]);

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

  const counts = useMemo(() => {
    if (!assessment) return { a: 0, kprim: 0, seen: 0, review: 0 };
    return {
      a: assessment.questions.filter((question) => question.type === "A").length,
      kprim: assessment.questions.filter((question) => question.type === "KPRIM").length,
      seen: Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length,
      review: reviewQuestionIds(assessment).length
    };
  }, [assessment, progress]);

  if (error) {
    return (
      <PageState
        actionLabel="Erneut versuchen"
        eyebrow="Verbindung"
        message={error}
        onAction={() => setLoadVersion((value) => value + 1)}
        title="Übung nicht verfügbar"
      />
    );
  }

  if (!assessment) {
    return (
      <PageState
        eyebrow="Übung"
        loading
        message="Übersicht und Fortschritt werden vorbereitet."
        title="Übung wird geladen"
      />
    );
  }

  const tags = collectAssessmentTags(assessment);
  const progressPercent = assessment.questions.length
    ? Math.round((counts.seen / assessment.questions.length) * 100)
    : 0;
  const primaryDescription = assessment.sourceSummary || "Keine Beschreibung hinterlegt.";
  const lastScoreLabel = typeof progress?.lastScore === "number" ? `${progress.lastScore}%` : "-";
  const isAltfragen = isAltfragenAssessment(assessment);
  const backHref = isAltfragen ? "/altfragen" : "/assessments";
  const backLabel = isAltfragen ? "Zu den Altfragen" : "Zu den Übungen";
  const quizOrigin = isAltfragen ? "&origin=altfragen" : "";

  if (isAltfragen && !altfragenAccess) {
    return (
      <main id="top" className="shell atlas-subpage-shell assessment-detail-shell">
        <Link className="assessment-detail-back" href={backHref}>{backLabel}</Link>
        <AltfragenAccessPanel onUnlocked={() => void refreshAltfragenAccess()} />
      </main>
    );
  }

  return (
    <main id="top" className="shell atlas-subpage-shell assessment-detail-shell">
      <Link className="assessment-detail-back" href={backHref}>{backLabel}</Link>

      <header className="assessment-detail-head">
        <div className="assessment-detail-intro">
          <div className="assessment-detail-kicker">{assessment.lectureCode} · {formatBlockLabel(assessment.block)}</div>
          <h1 className="detail-title assessment-detail-title">{assessment.title}</h1>
          <div className="assessment-detail-description-panel" aria-label="Beschreibung">
            <span>Beschreibung</span>
            <p>{primaryDescription}</p>
          </div>

          <div className="assessment-detail-meta" aria-label="Übungsdaten">
            <span>{assessment.questions.length} Fragen</span>
            <span>{counts.a} Typ A</span>
            <span>{counts.kprim} KPRIM</span>
            <span>{counts.review} Review</span>
          </div>
          <SummaryLinkPanel assessment={assessment} />
        </div>

        <aside className="assessment-launch-panel" aria-label="Übung starten">
          <div className="assessment-launch-summary">
            <div className="assessment-launch-progress" style={{ "--progress": `${progressPercent}%` } as CSSProperties}>
              <strong>{progressPercent}%</strong>
            </div>
            <div>
              <span>Übungsstand</span>
              <strong>{counts.seen}/{assessment.questions.length} gesehen</strong>
            </div>
          </div>
          <div className="assessment-launch-actions">
            <Link className="assessment-launch-action is-primary" href={`/quiz/${assessment.id}?mode=training${quizOrigin}`}>
              <span><AtlasIcon name="play" /></span>
              <strong>Training</strong>
              <small>Mit direktem Feedback</small>
            </Link>
            <Link className="assessment-launch-action" href={`/quiz/${assessment.id}?mode=exam${quizOrigin}`}>
              <span><AtlasIcon name="checklist" /></span>
              <strong>Prüfung</strong>
              <small>Ohne Zwischenlösung</small>
            </Link>
            <Link className="assessment-launch-action" href={`/quiz/${assessment.id}?mode=review${quizOrigin}`}>
              <span><AtlasIcon name="bookmark" /></span>
              <strong>Review</strong>
              <small>{counts.review ? `${counts.review} markiert` : "Markierte Fragen"}</small>
            </Link>
          </div>
        </aside>
      </header>

      <AssessmentPublicReviews assessmentId={assessment.id} />

      <section className="assessment-detail-grid">
        <article className="assessment-detail-card">
          <div className="assessment-detail-card-head">
            <div>
              <span className="assessment-detail-label">Inhalt</span>
              <h2>Lernziele</h2>
            </div>
            <span className="assessment-detail-count">{assessment.learningObjectives.length}</span>
          </div>

          <div className="detail-objective-list assessment-detail-objective-list">
            {assessment.learningObjectives.length ? assessment.learningObjectives.map((objective) => (
              <div className="detail-objective-item assessment-detail-objective" key={objective.id}>
                <strong>{objective.id}</strong>
                <p>{objective.text}</p>
              </div>
            )) : <p className="assessment-detail-empty">Keine Lernziele im JSON hinterlegt.</p>}
          </div>
        </article>

        <aside className="assessment-detail-card assessment-detail-side-card">
          <div className="assessment-detail-card-head">
            <div>
              <span className="assessment-detail-label">Status</span>
              <h2>Übungsstand</h2>
            </div>
            <span className="assessment-detail-count">{counts.seen}/{assessment.questions.length}</span>
          </div>

          <div className="assessment-detail-progress-list">
            <div>
              <span>Gesehen</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div>
              <span>Bester Score</span>
              <strong>{progress?.bestScore ?? 0}%</strong>
            </div>
            <div>
              <span>Versuche</span>
              <strong>{progress?.attempts.length ?? 0}</strong>
            </div>
          </div>

          <section className="assessment-detail-history" aria-label="Verlauf">
            <div>
              <span>Verlauf</span>
              <strong>{lastScoreLabel === "-" ? "Noch kein Versuch" : `Letzter Score ${lastScoreLabel}`}</strong>
            </div>
            <p>
              {progress?.attempts.length
                ? "Deine letzten Versuche werden im Lernfortschritt weiter ausgewertet."
                : "Starte eine Runde, danach erscheint hier dein persönlicher Verlauf."}
            </p>
          </section>

          {tags.length > 0 && (
            <section className="assessment-detail-topics" aria-label="Themen">
              <span>Themen</span>
              <div className="assessment-detail-tags">
                {tags.slice(0, 8).map((tag) => <span key={tag}>{tag}</span>)}
                {tags.length > 8 && <span>+{tags.length - 8}</span>}
              </div>
            </section>
          )}

          {cloudSyncAvailable() && (
            <button
              className="btn-secondary assessment-detail-wide-button"
              onClick={() => {
                void syncAssessmentProgress(assessment.id)
                  .then(() => setProgress(getProgress(assessment.id)))
                  .catch((syncError) => alert(syncError instanceof Error ? syncError.message : "Sync fehlgeschlagen."));
              }}
            >
              Fortschritt synchronisieren
            </button>
          )}
          <button
            className="assessment-detail-reset-button"
            onClick={() => {
              if (confirm("Lokalen Fortschritt für diese Übung zurücksetzen?")) {
                resetProgress(assessment.id);
                void resetCloudProgress(assessment.id).catch(() => undefined);
                setProgress(getProgress(assessment.id));
              }
            }}
          >
            Fortschritt zurücksetzen
          </button>
        </aside>
      </section>
    </main>
  );
}
