"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { QuestionRenderer } from "./QuestionRenderer";
import { ResultsPage } from "./ResultsPage";
import { useCompanion } from "./companion/CompanionProvider";
import { analyzeAssessmentResults } from "@/lib/assessmentAnalysis";
import {
  buildResultRows,
  correctAnswerLabel,
  isQuestionCorrect,
  optionKey,
  scorePercent,
  stableAnswer,
  toStoredQuestionResult
} from "@/lib/score";
import { createSessionQuestions } from "@/lib/sessionQuestions";
import { syncAssessmentProgress } from "@/lib/cloudProgress";
import {
  recordAttempt,
  reviewQuestionIds,
  setQuestionPriority,
  toggleQuestionReview,
  getProgress
} from "@/lib/progressStore";
import type { Assessment, AssessmentQuestion, QuizAttempt, QuizMode, QuizResultRow, UserAnswer } from "@/lib/types";

type Props = {
  assessment: Assessment;
  initialMode: QuizMode;
};

export function QuizEngine({ assessment, initialMode }: Props) {
  const didMount = useRef(false);
  const consecutiveErrors = useRef(0);
  // Confidence- und asynchrone Analyse-Events bleiben vorbereitet, bis der Quiz-Flow diese Zustände erfasst.
  const {
    setCompanionExamMode,
    triggerAriEvent
  } = useCompanion();
  const [mode, setMode] = useState<QuizMode>(initialMode);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(() => createSessionQuestions(selectQuestions(assessment, initialMode)));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [result, setResult] = useState<{ rows: QuizResultRow[]; attempt: QuizAttempt } | null>(null);
  const [finishError, setFinishError] = useState("");
  const [progressVersion, setProgressVersion] = useState(0);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const selected = selectQuestions(assessment, initialMode);
    setMode(initialMode);
    setQuestions(createSessionQuestions(selected));
    setIndex(0);
    setAnswers({});
    setRevealed({});
    setStartedAt(new Date().toISOString());
    setResult(null);
    setFinishError("");
  }, [assessment, initialMode]);

  useEffect(() => {
    setCompanionExamMode(mode === "exam" && !result);
    return () => setCompanionExamMode(false);
  }, [mode, result, setCompanionExamMode]);

  const question = questions[index];
  const progress = useMemo(() => getProgress(assessment.id), [assessment.id, progressVersion]);

  if (result) {
    return (
      <ResultsPage
        assessment={assessment}
        rows={result.rows}
        attempt={result.attempt}
        onRestart={() => restart(mode)}
        onRepeatWrong={() => restartWithQuestions(result.rows.filter((row) => !row.correct).map((row) => row.question), "review")}
      />
    );
  }

  if (!questions.length || !question) {
    return (
      <main className="shell">
        <div className="card p-6">
          <h1 className="text-2xl font-black">Keine Review-Fragen vorhanden</h1>
          <p className="mt-2 text-[var(--muted)]">Beantworte zuerst Fragen falsch oder markiere Fragen für Review.</p>
          <Link className="btn-primary mt-5 inline-flex items-center" href={`/assessment/${assessment.id}`}>Zurück</Link>
        </div>
      </main>
    );
  }

  const currentAnswer = answers[question.id] || {};
  const isRevealed = mode === "training" && revealed[question.id];
  const currentCorrect = isQuestionCorrect(question, currentAnswer);
  const stat = progress.questionStats[question.id];

  function setAnswer(answer: UserAnswer) {
    setAnswers((current) => ({ ...current, [question.id]: answer }));
  }

  function revealOrNext() {
    if (mode === "training" && !revealed[question.id]) {
      setRevealed((current) => ({ ...current, [question.id]: true }));
      if (currentCorrect) {
        consecutiveErrors.current = 0;
      } else {
        consecutiveErrors.current += 1;
        triggerAriEvent(consecutiveErrors.current >= 3 ? "many_errors_in_row" : "wrong_answer");
      }
      return;
    }
    if (index >= questions.length - 1) finishQuiz();
    else setIndex((value) => value + 1);
  }

  function finishQuiz() {
    const rows = buildResultRows(questions, answers);
    const correct = rows.filter((row) => row.correct).length;
    const partial = rows.filter((row) => row.status === "partial").length;
    const incorrect = rows.filter((row) => row.status === "incorrect").length;
    const points = rows.reduce((sum, row) => sum + row.points, 0);
    const maxPoints = rows.reduce((sum, row) => sum + row.maxPoints, 0);
    const completedAt = new Date().toISOString();
    const analysis = analyzeAssessmentResults(assessment, rows);
    const attempt: QuizAttempt = {
      id: createAttemptId(),
      assessmentId: assessment.id,
      mode,
      score: scorePercent(rows),
      correct,
      partial,
      incorrect,
      points,
      maxPoints,
      total: rows.length,
      startedAt,
      completedAt,
      answers: rows.reduce<Record<string, UserAnswer>>((acc, row) => {
        acc[row.question.id] = stableAnswer(row.question, row.answer);
        return acc;
      }, {}),
      wrongQuestionIds: rows.filter((row) => !row.correct).map((row) => row.question.id),
      questionResults: rows.map(toStoredQuestionResult),
      analysis
    };

    try {
      recordAttempt(assessment, attempt, rows);
      void syncAssessmentProgress(assessment.id).catch(() => undefined);
      setProgressVersion((value) => value + 1);
      setFinishError("");
    } catch (error) {
      setFinishError(error instanceof Error ? error.message : "Der Fortschritt konnte lokal nicht gespeichert werden.");
    }

    setResult({ rows, attempt });
    triggerAriEvent("assessment_completed");
  }

  function restart(nextMode: QuizMode) {
    const selected = selectQuestions(assessment, nextMode);
    setMode(nextMode);
    setQuestions(createSessionQuestions(selected));
    setIndex(0);
    setAnswers({});
    setRevealed({});
    setStartedAt(new Date().toISOString());
    setResult(null);
    setFinishError("");
    setProgressVersion((value) => value + 1);
    consecutiveErrors.current = 0;
  }

  function restartWithQuestions(nextQuestions: AssessmentQuestion[], nextMode: QuizMode) {
    setMode(nextMode);
    setQuestions(createSessionQuestions(nextQuestions));
    setIndex(0);
    setAnswers({});
    setRevealed({});
    setStartedAt(new Date().toISOString());
    setResult(null);
    setFinishError("");
    consecutiveErrors.current = 0;
  }

  return (
    <main id="top" className="shell quiz-shell">
      <div className="quiz-topbar mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link className="btn-secondary inline-flex items-center" href={`/assessment/${assessment.id}`}>Beenden</Link>
        <div className="quiz-mode-tabs flex flex-wrap gap-2">
          {(["training", "exam", "review"] as QuizMode[]).map((value) => (
            <button type="button" className={mode === value ? "btn-primary" : "btn-secondary"} key={value} onClick={() => restart(value)}>
              {value === "training" ? "Training" : value === "exam" ? "Prüfung" : "Review"}
            </button>
          ))}
        </div>
      </div>

      <section className="glass quiz-summary rounded-[28px] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="eyebrow">{mode} · Frage {index + 1}/{questions.length}</div>
            <h1 className="quiz-title mt-1 text-2xl font-black">{assessment.title}</h1>
          </div>
          <button
            type="button"
            className={stat?.markedForReview ? "btn-primary" : "btn-secondary"}
            onClick={() => {
              toggleQuestionReview(assessment.id, question.id);
              setProgressVersion((value) => value + 1);
            }}
          >
            {stat?.markedForReview ? "Markiert" : "Für Review markieren"}
          </button>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round((index / questions.length) * 100)}%` }} />
        </div>

        <div className="quiz-progress-nav mt-4 flex flex-wrap gap-2">
          {questions.map((item, itemIndex) => {
            const answered = !!answers[item.id]?.selected || item.options.every((option) => typeof answers[item.id]?.kprim?.[optionKey(option)] === "boolean");
            return (
              <button
                type="button"
                className={`quiz-progress-dot h-9 w-9 rounded-full border text-sm font-black ${itemIndex === index ? "border-[var(--accent)] bg-[var(--accent)] text-white" : answered ? "border-green-400 bg-green-500/10 text-green-700" : "border-[var(--line)] bg-[var(--surface-strong)] text-[var(--muted)]"}`}
                key={item.id}
                title={`Frage ${itemIndex + 1}: ${answered ? "beantwortet" : "offen"}`}
                onClick={() => setIndex(itemIndex)}
              >
                {itemIndex + 1}
              </button>
            );
          })}
        </div>
      </section>

      <article className="quiz-question-card card mt-5 p-5 md:p-7">
        <div className="flex flex-wrap gap-2">
          <span className="pill">{question.type}</span>
          <span className="pill">Level {question.difficulty}</span>
        </div>
        <h2 className="quiz-question-title mt-4 text-2xl font-black leading-tight">{question.stem}</h2>
        <div className="mt-6">
          <QuestionRenderer question={question} answer={currentAnswer} revealed={isRevealed} onChange={setAnswer} />
        </div>

        {isRevealed && (
          <div className={`quiz-feedback mt-5 rounded-2xl border p-4 ${currentCorrect ? "border-green-300 bg-green-500/10" : "border-red-300 bg-red-500/10"}`}>
            <strong>{currentCorrect ? "Richtig" : "Noch nicht"}</strong>
            <p className="mt-2 text-sm text-[var(--muted)]">Richtig wäre: {correctAnswerLabel(question)}</p>
            <p className="mt-3">{question.explanation}</p>
            {question.trap && <p className="mt-2 text-sm text-amber-600"><strong>Falle:</strong> {question.trap}</p>}
          </div>
        )}

        <div className="quiz-action-row mt-6 flex flex-wrap justify-between gap-2">
          <button type="button" className="btn-secondary" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
            Zur letzten Frage zurück
          </button>
          <div className="quiz-action-buttons flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setQuestionPriority(assessment.id, question.id, stat?.priority === "high" ? "normal" : "high");
                setProgressVersion((value) => value + 1);
              }}
            >
              {stat?.priority === "high" ? "Priorität normal" : "Priorisieren"}
            </button>
            <button type="button" className="btn-primary" onClick={revealOrNext}>
              {mode === "training" && !revealed[question.id] ? "Lösung zeigen" : index >= questions.length - 1 ? "Abgeben" : "Weiter"}
            </button>
            <button type="button" className="btn-secondary" onClick={finishQuiz}>Jetzt abgeben</button>
          </div>
        </div>
        {finishError && (
          <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-500/10 p-3 text-sm text-amber-700">
            Resultat wurde angezeigt, aber der lokale Fortschritt konnte nicht gespeichert werden: {finishError}
          </p>
        )}
      </article>
    </main>
  );
}

function createAttemptId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function selectQuestions(assessment: Assessment, mode: QuizMode): AssessmentQuestion[] {
  if (mode === "review") {
    const ids = new Set(reviewQuestionIds(assessment));
    return assessment.questions.filter((question) => ids.has(question.id));
  }

  if (mode === "exam") {
    return [...assessment.questions].sort(() => Math.random() - 0.5);
  }

  return assessment.questions;
}
