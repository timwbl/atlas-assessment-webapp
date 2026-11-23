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
        <h1>Trainieren</h1>
        <p>Kurze Runden und Wiederholungen aus deinem Lernstand.</p>
      </header>

      {data.loading ? <p className="mobile-exercise-count" role="status">Training wird geladen …</p> : recent ? (
        <Link className="mobile-train-primary" href={`/quiz/${recent.id}?mode=training&quick=random&limit=5`}>
          <span>Kurze Runde</span>
          <strong>5 zufällige Fragen</strong>
          <small>{formatBlockLabel(recent.block)} · {recent.lectureCode}</small>
        </Link>
      ) : (
        <Link className="btn-primary mobile-primary-action" href="/assessments">Übung wählen</Link>
      )}

      {!data.loading && <section className="mobile-train-list" aria-label="Weitere Trainingsarten">
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
          count={10}
          disabled={!recent}
          href={recent ? `/quiz/${recent.id}?mode=training&quick=random&limit=10` : "#"}
          title="10 zufällige Fragen"
          subtitle={recent ? `${formatBlockLabel(recent.block)} · ${recent.lectureCode}` : "Übung auswählen"}
        />
        <TrainCard
          count={data.resume ? 1 : 0}
          disabled={!data.resume}
          href={data.resume ? `/quiz/${data.resume.assessmentId}?resume=1` : "#"}
          title="Offene Session"
          subtitle={data.resume ? `Weiter bei Frage ${data.resume.currentQuestionIndex + 1}` : "Keine Session unterbrochen"}
        />
      </section>}
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
  const content = <><div><strong>{title}</strong><span>{subtitle}</span></div><b>{count}</b></>;
  return disabled
    ? <div aria-disabled="true" className="mobile-train-card is-disabled">{content}</div>
    : <Link className="mobile-train-card" href={href}>{content}</Link>;
}
