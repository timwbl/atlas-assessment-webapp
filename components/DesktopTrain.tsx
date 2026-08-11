"use client";

import Link from "next/link";
import { AtlasIcon, type AtlasIconName } from "@/components/AtlasIcon";
import { useMobileLearningData } from "@/components/mobile/useMobileLearningData";
import { formatBlockLabel } from "@/lib/blockLabels";
import { examForBlock } from "@/lib/studyProgram";

type TrainAction = {
  title: string;
  description: string;
  href: string;
  icon: AtlasIconName;
  meta: string;
  disabled?: boolean;
  tone?: "blue" | "violet" | "green";
};

export function DesktopTrain() {
  const data = useMobileLearningData();
  const recent = data.recentAssessment;
  const resumeAssessment = data.resume
    ? data.assessments.find((assessment) => assessment.id === data.resume?.assessmentId) || null
    : null;

  const actions: TrainAction[] = [
    {
      title: "Session fortsetzen",
      description: resumeAssessment
        ? resumeAssessment.title
        : "Keine unterbrochene Session vorhanden.",
      href: resumeAssessment && data.resume ? `/quiz/${resumeAssessment.id}?resume=1` : "/assessments",
      icon: "play",
      meta: data.resume ? `Frage ${data.resume.currentQuestionIndex + 1}` : "Übung wählen",
      disabled: !resumeAssessment,
      tone: "blue"
    },
    {
      title: "5-Minuten-Runde",
      description: recent
        ? `Kurzer Mix aus ${formatBlockLabel(recent.block)}.`
        : "Starte zuerst eine Übung, dann erscheint hier dein Schnellstart.",
      href: recent ? `/quiz/${recent.id}?mode=training&quick=random&limit=5` : "/assessments",
      icon: "pulse",
      meta: recent ? `${recent.lectureCode} · 5 Fragen` : "Noch leer",
      disabled: !recent,
      tone: "green"
    },
    {
      title: "Fehler trainieren",
      description: data.wrongTarget
        ? data.wrongTarget.title
        : "Noch keine falschen Fragen für gezieltes Training gespeichert.",
      href: data.wrongTarget ? `/quiz/${data.wrongTarget.id}?mode=training&quick=wrong&limit=10` : "/train",
      icon: "checklist",
      meta: `${data.wrongCount} offene Fehler`,
      disabled: !data.wrongTarget,
      tone: "violet"
    },
    {
      title: "Markierte Fragen",
      description: data.markedTarget
        ? data.markedTarget.title
        : "Markiere Fragen im Training, um sie hier wiederzufinden.",
      href: data.markedTarget ? `/quiz/${data.markedTarget.id}?mode=training&quick=marked&limit=10` : "/train",
      icon: "bookmark",
      meta: `${data.markedCount} markiert`,
      disabled: !data.markedTarget
    }
  ];

  return (
    <main className="shell desktop-only atlas-subpage-shell train-desktop-page" id="top">
      <header className="atlas-subpage-hero">
        <p className="eyebrow">ATLAS Training</p>
        <h1>Gezielt trainieren.</h1>
        <p>Kurze, klare Einstiege aus deinem aktuellen Lernstand. Ruhig starten, ohne zuerst die ganze Bibliothek zu durchsuchen.</p>
      </header>

      <section className="train-action-grid" aria-label="Trainingsaktionen">
        {actions.map((action) => (
          <TrainActionCard action={action} key={action.title} />
        ))}
      </section>

      <section className="atlas-subpage-grid">
        <article className="atlas-subpage-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="eyebrow">Letzter Fokus</p>
              <h2>{recent ? recent.title : "Übung wählen"}</h2>
            </div>
            <AtlasIcon name="calendar" />
          </div>
          <p>
            {recent
              ? `${formatBlockLabel(recent.block)}${examForBlock(recent.block) ? ` · ${examForBlock(recent.block)}` : ""} · ${recent.questionCount} Fragen`
              : "Sobald du eine Übung öffnest, wird hier dein nächster Trainingsfokus angezeigt."}
          </p>
          <Link className="dashboard-inline-action" href={recent ? `/assessment/${recent.id}` : "/assessments"}>
            {recent ? "Übung öffnen" : "Zu den Übungen"}
            <span aria-hidden="true">→</span>
          </Link>
        </article>

        <article className="atlas-subpage-panel atlas-subpage-panel-muted">
          <p className="eyebrow">Lernlage</p>
          <div className="train-snapshot">
            <div><strong>{data.seenCount}</strong><span>gesehen</span></div>
            <div><strong>{data.wrongCount}</strong><span>Fehler</span></div>
            <div><strong>{data.markedCount}</strong><span>markiert</span></div>
          </div>
        </article>
      </section>
    </main>
  );
}

function TrainActionCard({ action }: { action: TrainAction }) {
  const className = action.disabled ? "train-action-card is-disabled" : "train-action-card";
  const body = (
    <>
      <span className={`dashboard-action-icon is-${action.tone || "blue"}`}>
        <AtlasIcon name={action.icon} />
      </span>
      <div>
        <h2>{action.title}</h2>
        <p>{action.description}</p>
      </div>
      <strong>{action.meta}</strong>
    </>
  );

  if (action.disabled) return <div className={className} aria-disabled="true">{body}</div>;
  return <Link className={className} href={action.href}>{body}</Link>;
}
