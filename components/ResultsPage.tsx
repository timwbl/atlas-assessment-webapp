"use client";

import Link from "next/link";
import { AssessmentReviewPrompt } from "./AssessmentReviewPrompt";
import { CompletedAssessmentPdfExport } from "./CompletedAssessmentPdfExport";
import { QuestionExplanationPanel } from "./QuestionExplanationPanel";
import { formatBlockLabel } from "@/lib/blockLabels";
import { optionKey, optionLabel } from "@/lib/score";
import type {
  AnalysisPriority,
  Assessment,
  AssessmentQuestion,
  QuizAttempt,
  QuizResultRow,
  UserAnswer
} from "@/lib/types";

type Props = {
  assessment: Assessment;
  rows: QuizResultRow[];
  attempt: QuizAttempt;
  onRepeatWrong: () => void;
  onRestart: () => void;
};

export function ResultsPage({ assessment, rows, attempt, onRepeatWrong, onRestart }: Props) {
  const reviewRows = rows.filter((row) => row.status !== "correct");
  const partial = attempt.partial ?? rows.filter((row) => row.status === "partial").length;
  const incorrect = attempt.incorrect ?? rows.filter((row) => row.status === "incorrect").length;
  const points = attempt.points ?? rows.reduce((sum, row) => sum + row.points, 0);
  const maxPoints = attempt.maxPoints ?? rows.reduce((sum, row) => sum + row.maxPoints, 0);
  const analysis = attempt.analysis;

  return (
    <main id="top" className="shell assessment-review-shell">
      <header className="glass result-hero assessment-review-hero rounded-[28px] p-6 md:p-8">
        <div>
          <div className="eyebrow">Assessment abgeschlossen · {assessment.lectureCode}</div>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">{assessment.title}</h1>
          <p className="mt-2 text-[var(--muted)]">
            {formatBlockLabel(assessment.block)} · {formatCompletedAt(attempt.completedAt)} · {attempt.total} Fragen
          </p>
        </div>

        <div className="review-score-grid mt-6">
          <ReviewMetric label="Score" value={`${attempt.score}%`} accent />
          <ReviewMetric label="Punkte" value={`${formatPoints(points)} / ${formatPoints(maxPoints)}`} />
          <ReviewMetric label="Richtig" value={String(attempt.correct)} tone="success" />
          <ReviewMetric label="Teilrichtig" value={String(partial)} tone="warning" />
          <ReviewMetric label="Falsch" value={String(incorrect)} tone="danger" />
        </div>

        <div className="result-actions mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onRepeatWrong} disabled={!reviewRows.length}>
            Falsche und teilrichtige Fragen wiederholen
          </button>
          <button className="btn-secondary" onClick={onRestart}>Neues Quiz starten</button>
          <Link className="btn-secondary inline-flex items-center" href="/">Zur Übersicht</Link>
        </div>

        <div className="mt-5">
          <CompletedAssessmentPdfExport assessment={assessment} attempt={attempt} />
        </div>
      </header>

      {analysis && (
        <section className="review-analysis-section mt-6">
          <div className="card p-5 md:p-6">
            <div className="eyebrow">Leistungsanalyse</div>
            <h2 className="mt-1 text-2xl font-black">Deine nächsten Lernschritte</h2>
            <p className="mt-3 text-[var(--muted)]">{analysis.summary}</p>

            <div className="review-analysis-grid mt-5">
              <AnalysisList title="Stärken" items={analysis.strengths} />
              <AnalysisList title="Als Nächstes" items={analysis.nextStudySteps} />
            </div>
          </div>

          {!!analysis.weaknesses.length && (
            <div className="review-weakness-grid mt-4">
              {analysis.weaknesses.map((weakness) => (
                <article className="review-weakness-card card p-5" key={`${weakness.topic}-${weakness.priority}`}>
                  <PriorityBadge priority={weakness.priority} />
                  <h3 className="mt-3 text-lg font-black">{weakness.topic}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">{weakness.reason}</p>
                  <p className="mt-3 text-sm"><strong>Empfehlung:</strong> {weakness.recommendedAction}</p>
                  {!!weakness.relatedQuestions.length && (
                    <p className="mt-3 text-xs font-bold text-[var(--muted)]">
                      Fragen {weakness.relatedQuestions.join(", ")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}

          {!!analysis.errorPatterns.length && (
            <div className="card mt-4 p-5 md:p-6">
              <h2 className="text-xl font-black">Wiederkehrende Fehlermuster</h2>
              <div className="mt-4 grid gap-3">
                {analysis.errorPatterns.map((pattern) => (
                  <div className="review-pattern" key={pattern.pattern}>
                    <strong>{pattern.pattern}</strong>
                    <p>{pattern.correctionStrategy}</p>
                    <span>Beispiele: Fragen {pattern.exampleQuestionNumbers.join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <AssessmentReviewPrompt assessment={assessment} />

      <section className="mt-6">
        <div className="mb-4">
          <div className="eyebrow">Vollständiger Review</div>
          <h2 className="mt-1 text-2xl font-black">Alle Fragen und Antworten</h2>
        </div>
        <div className="grid gap-5">
          {rows.map((row, index) => (
            <ReviewQuestion
              assessment={assessment}
              index={index}
              key={row.question.id}
              row={row}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ReviewQuestion({
  assessment,
  index,
  row
}: {
  assessment: Assessment;
  index: number;
  row: QuizResultRow;
}) {
  const objective = assessment.learningObjectives.find(
    (item) => item.id === row.question.learningObjectiveId
  )?.text;

  return (
    <article className={`review-question-card card review-status-${row.status}`}>
      <div className="review-question-head">
        <div>
          <div className="eyebrow">
            Frage {index + 1} · {row.question.type === "KPRIM" ? "K-prim" : "Typ A"} · Level {row.question.difficulty}
          </div>
          <h3>{row.question.stem}</h3>
        </div>
        <StatusBadge row={row} />
      </div>

      <div className="review-option-list">
        {row.question.type === "KPRIM"
          ? row.question.options.map((option) => (
              <KPrimReviewOption
                answer={row.answer}
                key={optionKey(option)}
                option={option}
              />
            ))
          : row.question.options.map((option) => (
              <TypeAReviewOption
                answer={row.answer}
                key={optionKey(option)}
                option={option}
              />
            ))}
      </div>

      <QuestionExplanationPanel answer={row.answer} objective={objective} question={row.question} />
    </article>
  );
}

function TypeAReviewOption({
  option,
  answer
}: {
  option: AssessmentQuestion["options"][number];
  answer: UserAnswer;
}) {
  const selected = answer.selected === optionKey(option);
  const className = option.correct && selected
    ? "review-option is-correct is-selected"
    : selected
      ? "review-option is-wrong is-selected"
      : option.correct
        ? "review-option is-correct-answer"
        : "review-option";

  return (
    <div className={className}>
      <strong>{optionLabel(option)}</strong>
      <span>{option.text}</span>
      <small>
        {selected && option.correct
          ? "Deine Antwort · richtig"
          : selected
            ? "Deine Antwort"
            : option.correct
              ? "Richtige Antwort"
              : ""}
      </small>
    </div>
  );
}

function KPrimReviewOption({
  option,
  answer
}: {
  option: AssessmentQuestion["options"][number];
  answer: UserAnswer;
}) {
  const selected = answer.kprim?.[optionKey(option)];
  const matches = selected === option.correct;

  return (
    <div className={`review-option review-kprim-option ${matches ? "is-correct" : "is-wrong"}`}>
      <strong>{optionLabel(option)}</strong>
      <span>{option.text}</span>
      <div className="review-kprim-decisions">
        <small>Du: {typeof selected === "boolean" ? decisionLabel(selected) : "offen"}</small>
        <small>Korrekt: {decisionLabel(option.correct)}</small>
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: QuizResultRow }) {
  const label = row.status === "correct"
    ? "Richtig"
    : row.status === "partial"
      ? `Teilrichtig · ${formatPoints(row.points)} P`
      : "Falsch";
  return <span className={`review-status-badge is-${row.status}`}>{label}</span>;
}

function ReviewMetric({
  label,
  value,
  accent,
  tone
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "success" | "warning" | "danger";
}) {
  return (
    <div className={`review-metric ${accent ? "is-accent" : ""} ${tone ? `is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="review-analysis-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: AnalysisPriority }) {
  return (
    <span className={`review-priority is-${priority}`}>
      Priorität {priority === "high" ? "hoch" : priority === "medium" ? "mittel" : "niedrig"}
    </span>
  );
}

function formatCompletedAt(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function decisionLabel(value: boolean): string {
  return value ? "richtig" : "falsch";
}
