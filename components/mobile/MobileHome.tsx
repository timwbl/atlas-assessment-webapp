"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { formatBlockLabel } from "@/lib/blockLabels";
import { useMobileLearningData } from "./useMobileLearningData";
import { examForBlock } from "@/lib/studyProgram";

const NAME_KEY = "atlas-user-display-name";

export function MobileHome() {
  const data = useMobileLearningData();
  const [name, setName] = useState("");

  useEffect(() => {
    setName(window.localStorage.getItem(NAME_KEY)?.split(/\s+/)[0] || "");
  }, []);
  const resumeAssessment = data.resume
    ? data.assessments.find((assessment) => assessment.id === data.resume?.assessmentId)
    : null;
  const primary = resumeAssessment || data.recentAssessment;
  const progressPercent = data.totalQuestions
    ? Math.round((data.seenCount / data.totalQuestions) * 100)
    : 0;

  return (
    <main className="mobile-action-page mobile-only" id="top">
      <header className="mobile-action-header">
        <p className="eyebrow">{todayLabel()}</p>
        <h1>{name ? `Hallo ${name}.` : "Bereit für eine kurze Runde?"}</h1>
        <p>{data.resume ? "Du kannst genau dort weitermachen, wo du aufgehört hast." : "Ein kleiner Lernblock reicht für heute völlig."}</p>
      </header>

      {data.loading ? <MobileSkeleton /> : data.error ? <p className="mobile-data-error">{data.error}</p> : (
        <>
          <section className="mobile-resume-card">
            <div>
              <p className="eyebrow">Weiterlernen</p>
              <h2>{primary?.title || "Noch keine Session begonnen"}</h2>
              {primary && (
                <p>
                  {formatBlockLabel(primary.block)} · {primary.lectureCode}
                  {examForBlock(primary.block) ? ` · ${examForBlock(primary.block)}` : ""}
                  {data.resume ? ` · Frage ${data.resume.currentQuestionIndex + 1}` : ""}
                </p>
              )}
            </div>
            {primary ? (
              <Link
                className="mobile-primary-action"
                href={data.resume
                  ? `/quiz/${primary.id}?resume=1`
                  : `/quiz/${primary.id}?mode=training`}
              >
                {data.resume ? "Fortsetzen" : "Starten"}
              </Link>
            ) : <Link className="mobile-primary-action" href="/assessments">Assessment wählen</Link>}
          </section>

          <section className="mobile-quick-grid" aria-label="Schnelle Lernaktionen">
            <QuickLink
              disabled={!data.recentAssessment}
              href={data.recentAssessment ? `/quiz/${data.recentAssessment.id}?mode=training&quick=random&limit=5` : "#"}
              label="Ich habe 5 Minuten"
              meta="5 zufällige Fragen"
            />
            <QuickLink
              disabled={!data.wrongTarget}
              href={data.wrongTarget ? `/quiz/${data.wrongTarget.id}?mode=training&quick=wrong&limit=10` : "#"}
              label="Schwächen trainieren"
              meta={`${data.wrongCount} offene Fehler`}
            />
            <QuickLink
              disabled={!data.resume}
              href={data.resume ? `/quiz/${data.resume.assessmentId}?resume=1` : "#"}
              label="Assessment fortsetzen"
              meta={data.resume ? `Frage ${data.resume.currentQuestionIndex + 1}` : "Keine offene Session"}
            />
            {data.otherResume && data.otherResumeAssessment && (
              <QuickLink
                href={`/quiz/${data.otherResume.assessmentId}?resume=1`}
                label="Andere Session fortsetzen"
                meta={`${formatBlockLabel(data.otherResumeAssessment.block)} · Frage ${data.otherResume.currentQuestionIndex + 1}`}
              />
            )}
          </section>

          <section className="mobile-progress-snapshot">
            <div>
              <p className="eyebrow">Fortschritt</p>
              <h2>{progressPercent}% gesehen</h2>
              <p>{data.wrongCount} falsch · {data.markedCount} markiert</p>
            </div>
            <div className="mobile-progress-ring" style={{ "--mobile-progress": `${progressPercent * 3.6}deg` } as CSSProperties}>
              <span>{progressPercent}%</span>
            </div>
          </section>

          <MobileInsight
            markedCount={data.markedCount}
            recentAt={data.recentAssessment ? data.progress[data.recentAssessment.id]?.lastAttemptAt : undefined}
            wrongCount={data.wrongCount}
          />
        </>
      )}
    </main>
  );
}

function QuickLink({ href, label, meta, disabled }: { href: string; label: string; meta: string; disabled?: boolean }) {
  return (
    <Link aria-disabled={disabled} className={disabled ? "mobile-quick-card is-disabled" : "mobile-quick-card"} href={href}>
      <strong>{label}</strong>
      <span>{meta}</span>
    </Link>
  );
}

function MobileInsight({ markedCount, wrongCount, recentAt }: { markedCount: number; wrongCount: number; recentAt?: string }) {
  let text = "";
  if (markedCount > 0) text = `Du hast ${markedCount} markierte Fragen offen.`;
  else if (wrongCount > 0) text = `${wrongCount} Fragen eignen sich aktuell für ein kurzes Review.`;
  else if (recentAt) {
    const days = Math.floor((Date.now() - new Date(recentAt).getTime()) / 86_400_000);
    if (days >= 3) text = `Deine letzte Session war vor ${days} Tagen. Ein kurzes Review würde reichen.`;
  }
  if (!text) return null;
  return <aside className="mobile-insight"><span aria-hidden="true">i</span><p>{text}</p></aside>;
}

function MobileSkeleton() {
  return <div className="mobile-skeleton"><span /><span /><span /></div>;
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}
