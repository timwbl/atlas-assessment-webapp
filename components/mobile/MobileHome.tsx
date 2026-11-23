"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AtlasIcon, type AtlasIconName } from "@/components/AtlasIcon";
import { formatBlockLabel } from "@/lib/blockLabels";
import { examForBlock } from "@/lib/studyProgram";
import { useMobileLearningData } from "./useMobileLearningData";

export function MobileHome() {
  const data = useMobileLearningData();
  const [name, setName] = useState("");

  useEffect(() => {
    function readName() {
      setName(window.localStorage.getItem("atlas-user-display-name")?.trim().split(/\s+/)[0] ?? "");
    }
    readName();
    window.addEventListener("atlas-profile-name-changed", readName);
    return () => window.removeEventListener("atlas-profile-name-changed", readName);
  }, []);

  const resumeAssessment = data.resume
    ? data.assessments.find(({ id }) => id === data.resume?.assessmentId)
    : null;
  const primary = resumeAssessment ?? data.recentAssessment;
  const primaryUrl = primary
    ? `/quiz/${primary.id}?${resumeAssessment ? "resume=1" : "mode=training"}`
    : "/assessments";
  const progressPercent = data.totalQuestions
    ? Math.min(100, Math.round(data.seenCount / data.totalQuestions * 100))
    : 0;

  return (
    <main className="mobile-action-page mobile-only mobile-study-home" id="top">
      <header className="mobile-action-header">
        <p className="eyebrow">{new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
        <h1>{name ? `Hallo ${name}` : "Deine Lernübersicht"}</h1>
      </header>

      {data.loading ? <p role="status" className="mobile-exercise-count">Lernübersicht wird geladen …</p> : data.error ? (
        <p className="mobile-data-error" role="alert">{data.error}</p>
      ) : (
        <>
          <section className="dashboard-next-study">
            <p className="eyebrow">{resumeAssessment ? "Laufende Übung" : "Training"}</p>
            <h2>{primary?.title ?? "Wähle eine Übung"}</h2>
            {primary && (
              <p>
                {formatBlockLabel(primary.block)} · {primary.lectureCode}
                {examForBlock(primary.block) ? ` · ${examForBlock(primary.block)}` : ""}
                {resumeAssessment && data.resume ? ` · Frage ${data.resume.currentQuestionIndex + 1}` : ` · ${primary.questionCount} Fragen`}
              </p>
            )}
            <Link className="btn-primary" href={primaryUrl}>
              <AtlasIcon name="play" />
              {resumeAssessment ? "Fortsetzen" : primary ? "Training starten" : "Übungen öffnen"}
            </Link>
          </section>

          <section className="mobile-study-quick" aria-labelledby="mobile-quick-title">
            <h2 id="mobile-quick-title">Kurz trainieren</h2>
            <ul className="dashboard-study-list">
              {primary && (
                <QuickLink
                  href={`/quiz/${primary.id}?mode=training&quick=random&limit=5`}
                  icon="play"
                  label="5 zufällige Fragen"
                  detail={primary.lectureCode}
                />
              )}
              {data.wrongTarget && (
                <QuickLink
                  href={`/quiz/${data.wrongTarget.id}?mode=training&quick=wrong&limit=10`}
                  icon="target"
                  label="Offene Fehler wiederholen"
                  detail={data.wrongTarget.lectureCode}
                />
              )}
              {data.markedTarget && (
                <QuickLink
                  href={`/quiz/${data.markedTarget.id}?mode=training&quick=marked&limit=10`}
                  icon="bookmark"
                  label="Markierte Fragen üben"
                  detail={data.markedTarget.lectureCode}
                />
              )}
              {data.otherResume && data.otherResumeAssessment && (
                <QuickLink
                  href={`/quiz/${data.otherResume.assessmentId}?resume=1`}
                  icon="book"
                  label="Übung aus anderem Semester fortsetzen"
                  detail={`${data.otherResumeAssessment.lectureCode} · Frage ${data.otherResume.currentQuestionIndex + 1}`}
                />
              )}
              <QuickLink href="/train" icon="checklist" label="Alle Trainingsmöglichkeiten" />
            </ul>
          </section>

          <section className="mobile-study-overview" aria-labelledby="mobile-overview-title">
            <div className="mobile-study-overview-head">
              <h2 id="mobile-overview-title">Lernfortschritt</h2>
              <Link href="/progress">Details</Link>
            </div>
            <div
              aria-label="Gesehene Fragen"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${data.seenCount} von ${data.totalQuestions} Fragen`}
              className="dashboard-progress-bar"
              role="progressbar"
            ><span style={{ width: `${progressPercent}%` }} /></div>
            <dl>
              <div><dt>Gesehen</dt><dd>{data.seenCount}/{data.totalQuestions}</dd></div>
              <div><dt>Offene Fehler</dt><dd>{data.wrongCount}</dd></div>
              <div><dt>Markiert</dt><dd>{data.markedCount}</dd></div>
            </dl>
          </section>
        </>
      )}
    </main>
  );
}

function QuickLink({ href, icon, label, detail }: { href: string; icon: AtlasIconName; label: string; detail?: string }) {
  return (
    <li>
      <Link className="dashboard-study-row" href={href}>
        <AtlasIcon name={icon} />
        <span className="dashboard-study-label"><strong>{label}</strong></span>
        {detail ? <small className="dashboard-study-count">{detail}</small> : <span />}
        <AtlasIcon name="chevronRight" />
      </Link>
    </li>
  );
}
