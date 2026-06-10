"use client";

import Link from "next/link";
import { formatBlockLabel } from "@/lib/blockLabels";
import { useMobileLearningData } from "./useMobileLearningData";

export function MobileTrain() {
  const data = useMobileLearningData();
  const recent = data.recentAssessment;

  return (
    <main className="mobile-action-page mobile-only" id="top">
      <header className="mobile-action-header">
        <p className="eyebrow">Train</p>
        <h1>Was passt gerade?</h1>
        <p>Kurze Sessions, direkt aus deinem aktuellen Lernstand.</p>
      </header>

      {recent && (
        <Link className="mobile-train-primary" href={`/quiz/${recent.id}?mode=training&quick=random&limit=5`}>
          <span>5 Minuten</span>
          <strong>Kurzes Training starten</strong>
          <small>{formatBlockLabel(recent.block)} · {recent.lectureCode} · 5 Fragen</small>
        </Link>
      )}

      <section className="mobile-train-list">
        <TrainCard
          count={data.wrongCount}
          disabled={!data.wrongTarget}
          href={data.wrongTarget ? `/quiz/${data.wrongTarget.id}?mode=training&quick=wrong&limit=10` : "#"}
          title="Falsche Fragen"
          subtitle={data.wrongTarget ? `${data.wrongTarget.lectureCode} · etwa 10 Minuten` : "Noch keine Fehler gespeichert"}
        />
        <TrainCard
          count={data.markedCount}
          disabled={!data.markedTarget}
          href={data.markedTarget ? `/quiz/${data.markedTarget.id}?mode=training&quick=marked&limit=10` : "#"}
          title="Markierte Fragen"
          subtitle={data.markedTarget ? `${data.markedTarget.lectureCode} · persönlicher Review` : "Noch nichts markiert"}
        />
        <TrainCard
          count={recent?.questionCount || 0}
          disabled={!recent}
          href={recent ? `/quiz/${recent.id}?mode=training&quick=random&limit=10` : "#"}
          title="Letzten Block wiederholen"
          subtitle={recent ? `${formatBlockLabel(recent.block)} · ${recent.lectureCode}` : "Noch keine letzte Aktivität"}
        />
        <TrainCard
          count={10}
          disabled={!recent}
          href={recent ? `/quiz/${recent.id}?mode=training&quick=random&limit=10` : "#"}
          title="10-Minuten-Mix"
          subtitle={recent ? `Zufällige Fragen aus ${formatBlockLabel(recent.block)}` : "Assessment auswählen"}
        />
        <TrainCard
          count={data.resume ? 1 : 0}
          disabled={!data.resume}
          href={data.resume ? `/quiz/${data.resume.assessmentId}?resume=1` : "#"}
          title="Offene Session"
          subtitle={data.resume ? `Weiter bei Frage ${data.resume.currentQuestionIndex + 1}` : "Keine Session unterbrochen"}
        />
      </section>
    </main>
  );
}

function TrainCard({
  title,
  subtitle,
  href,
  count,
  disabled
}: {
  title: string;
  subtitle: string;
  href: string;
  count: number;
  disabled?: boolean;
}) {
  return (
    <Link aria-disabled={disabled} className={disabled ? "mobile-train-card is-disabled" : "mobile-train-card"} href={href}>
      <div><strong>{title}</strong><span>{subtitle}</span></div>
      <b>{count}</b>
    </Link>
  );
}
