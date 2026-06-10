"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  stableOptionId,
  stableAnswer,
  toStoredQuestionResult
} from "@/lib/score";
import { createSessionQuestions, restoreSessionQuestions } from "@/lib/sessionQuestions";
import { syncAssessmentProgress } from "@/lib/cloudProgress";
import {
  recordAttempt,
  reviewQuestionIds,
  saveActiveQuizSession,
  clearActiveQuizSession,
  setQuestionPriority,
  toggleQuestionReview,
  getProgress
} from "@/lib/progressStore";
import type {
  ActiveQuizSession,
  Assessment,
  AssessmentQuestion,
  QuickTrainingType,
  QuizAttempt,
  QuizMode,
  QuizResultRow,
  UserAnswer
} from "@/lib/types";

type Props = {
  assessment: Assessment;
  initialMode: QuizMode;
  resume?: boolean;
  quick?: QuickTrainingType;
  limit?: number;
};

type InitialQuizState = {
  mode: QuizMode;
  questions: AssessmentQuestion[];
  index: number;
  answers: Record<string, UserAnswer>;
  revealed: Record<string, boolean>;
  startedAt: string;
};

export function QuizEngine({
  assessment,
  initialMode,
  resume = false,
  quick = "",
  limit = 0
}: Props) {
  const initial = useRef<InitialQuizState | null>(null);
  if (!initial.current) {
    initial.current = createInitialQuizState(assessment, initialMode, resume, quick, limit);
  }
  const didMount = useRef(false);
  const consecutiveErrors = useRef(0);
  const pendingSession = useRef<{ assessmentId: string; session: ActiveQuizSession } | null>(null);
  const localSaveTimer = useRef<number | null>(null);
  const cloudSyncTimer = useRef<number | null>(null);
  // Confidence- und asynchrone Analyse-Events bleiben vorbereitet, bis der Quiz-Flow diese Zustände erfasst.
  const {
    setCompanionAssessmentActive,
    setCompanionExamMode,
    triggerAriEvent
  } = useCompanion();
  const [mode, setMode] = useState<QuizMode>(initial.current.mode);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>(initial.current.questions);
  const [index, setIndex] = useState(initial.current.index);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>(initial.current.answers);
  const [revealed, setRevealed] = useState<Record<string, boolean>>(initial.current.revealed);
  const [startedAt, setStartedAt] = useState(initial.current.startedAt);
  const [result, setResult] = useState<{ rows: QuizResultRow[]; attempt: QuizAttempt } | null>(null);
  const [finishError, setFinishError] = useState("");
  const [progress, setProgress] = useState(() => getProgress(assessment.id));

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    const next = createInitialQuizState(assessment, initialMode, resume, quick, limit);
    setMode(next.mode);
    setQuestions(next.questions);
    setIndex(next.index);
    setAnswers(next.answers);
    setRevealed(next.revealed);
    setStartedAt(next.startedAt);
    setProgress(getProgress(assessment.id));
    setResult(null);
    setFinishError("");
  }, [assessment, initialMode, limit, quick, resume]);

  useEffect(() => {
    setCompanionExamMode(mode === "exam" && !result);
    return () => setCompanionExamMode(false);
  }, [mode, result, setCompanionExamMode]);

  useEffect(() => {
    setCompanionAssessmentActive(!result);
    document.body.classList.toggle("is-assessment-active", !result);
    return () => {
      setCompanionAssessmentActive(false);
      document.body.classList.remove("is-assessment-active");
    };
  }, [result, setCompanionAssessmentActive]);

  useEffect(() => {
    if (result) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("resume") === "1") return;
    url.searchParams.set("resume", "1");
    window.history.replaceState(window.history.state, "", url);
  }, [result]);

  useEffect(() => {
    if (result || !questions.length) {
      pendingSession.current = null;
      return;
    }
    const session: ActiveQuizSession = {
      assessmentId: assessment.id,
      blockId: assessment.block,
      lectureId: assessment.lectureCode,
      currentQuestionIndex: index,
      answers: stableSessionAnswers(questions, answers),
      questionOrder: questions.map((item) => item.id),
      optionOrder: questions.reduce<Record<string, string[]>>((acc, item) => {
        acc[item.id] = item.options.map(stableOptionId);
        return acc;
      }, {}),
      revealedQuestionIds: Object.keys(revealed).filter((id) => revealed[id]),
      startedAt,
      lastOpenedAt: new Date().toISOString(),
      mode,
      quickType: quick,
      device: window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop"
    };
    pendingSession.current = { assessmentId: assessment.id, session };

    if (localSaveTimer.current !== null) window.clearTimeout(localSaveTimer.current);
    localSaveTimer.current = window.setTimeout(() => {
      saveActiveQuizSession(assessment.id, session);
      localSaveTimer.current = null;
    }, 180);

    if (cloudSyncTimer.current !== null) window.clearTimeout(cloudSyncTimer.current);
    cloudSyncTimer.current = window.setTimeout(() => {
      void syncAssessmentProgress(assessment.id).catch(() => undefined);
      cloudSyncTimer.current = null;
    }, 2200);
  }, [answers, assessment, index, mode, questions, quick, result, revealed, startedAt]);

  useEffect(() => {
    function flushSession() {
      const pending = pendingSession.current;
      if (pending) saveActiveQuizSession(pending.assessmentId, pending.session);
    }

    window.addEventListener("pagehide", flushSession);
    return () => {
      window.removeEventListener("pagehide", flushSession);
      if (localSaveTimer.current !== null) window.clearTimeout(localSaveTimer.current);
      if (cloudSyncTimer.current !== null) window.clearTimeout(cloudSyncTimer.current);
      flushSession();
    };
  }, []);

  const question = questions[index];
  const questionId = question?.id;
  const setAnswer = useCallback((answer: UserAnswer) => {
    if (!questionId) return;
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }, [questionId]);

  const answeredQuestionIds = useMemo(() => new Set(
    questions
      .filter((item) => {
        const answer = answers[item.id];
        return !!answer?.selected
          || item.options.every((option) => typeof answer?.kprim?.[optionKey(option)] === "boolean");
      })
      .map((item) => item.id)
  ), [answers, questions]);

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
  const usesImmediateFeedback = mode !== "exam";
  const isRevealed = usesImmediateFeedback && revealed[question.id];
  const currentCorrect = isQuestionCorrect(question, currentAnswer);
  const stat = progress.questionStats[question.id];

  function revealOrNext() {
    if (usesImmediateFeedback && !revealed[question.id]) {
      setRevealed((current) => ({ ...current, [question.id]: true }));
      if (currentCorrect) {
        consecutiveErrors.current = 0;
        if (mode === "review") triggerAriEvent("review_item_corrected");
      } else {
        consecutiveErrors.current += 1;
        triggerAriEvent(consecutiveErrors.current >= 3 ? "many_errors_in_row" : "wrong_answer");
      }
      return;
    }
    if (index >= questions.length - 1) finishQuiz();
    else setIndex((value) => value + 1);
  }

  function retryCurrentQuestion() {
    setAnswers((current) => {
      const next = { ...current };
      delete next[question.id];
      return next;
    });
    setRevealed((current) => ({ ...current, [question.id]: false }));
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
      pendingSession.current = null;
      if (localSaveTimer.current !== null) window.clearTimeout(localSaveTimer.current);
      if (cloudSyncTimer.current !== null) window.clearTimeout(cloudSyncTimer.current);
      clearActiveQuizSession(assessment.id);
      const savedProgress = recordAttempt(assessment, attempt, rows);
      void syncAssessmentProgress(assessment.id).catch(() => undefined);
      setProgress(savedProgress);
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
    setProgress(getProgress(assessment.id));
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
    <main id="top" className={`shell quiz-shell quiz-mode-${mode}`}>
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
              setProgress(getProgress(assessment.id));
            }}
          >
            {stat?.markedForReview ? "Markiert" : "Für Review markieren"}
          </button>
        </div>

        <div
          aria-label={`Frage ${index + 1} von ${questions.length}`}
          aria-valuemax={questions.length}
          aria-valuemin={1}
          aria-valuenow={index + 1}
          className="mt-5 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${Math.round(((index + 1) / questions.length) * 100)}%` }}
          />
        </div>

        <div className="quiz-progress-nav mt-4 flex flex-wrap gap-2">
          {questions.map((item, itemIndex) => {
            const answered = answeredQuestionIds.has(item.id);
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
            {mode === "review" && isRevealed && (
              <button type="button" className="btn-secondary" onClick={retryCurrentQuestion}>
                Nochmals üben
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setQuestionPriority(assessment.id, question.id, stat?.priority === "high" ? "normal" : "high");
                setProgress(getProgress(assessment.id));
              }}
            >
              {stat?.priority === "high" ? "Priorität normal" : "Priorisieren"}
            </button>
            <button type="button" className="btn-primary" onClick={revealOrNext}>
              {usesImmediateFeedback && !revealed[question.id]
                ? "Lösung zeigen"
                : mode === "review" && isRevealed
                  ? "Verstanden"
                  : index >= questions.length - 1
                    ? "Abgeben"
                    : "Weiter"}
            </button>
            <button type="button" className="btn-secondary quiz-finish-button" onClick={finishQuiz}>Jetzt abgeben</button>
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

function selectQuestions(
  assessment: Assessment,
  mode: QuizMode,
  quick: QuickTrainingType = "",
  limit = 0
): AssessmentQuestion[] {
  const progress = getProgress(assessment.id);
  let selected: AssessmentQuestion[];

  if (quick === "wrong") {
    selected = assessment.questions.filter((question) => {
      const stat = progress.questionStats[question.id];
      return stat?.lastCorrect === false || (stat?.wrong || 0) > (stat?.correct || 0);
    });
  } else if (quick === "marked") {
    selected = assessment.questions.filter((question) => progress.questionStats[question.id]?.markedForReview);
  } else if (quick === "random") {
    selected = [...assessment.questions].sort(() => Math.random() - 0.5);
  } else if (mode === "review") {
    const ids = new Set(reviewQuestionIds(assessment));
    selected = assessment.questions.filter((question) => ids.has(question.id));
  } else if (mode === "exam") {
    selected = [...assessment.questions].sort(() => Math.random() - 0.5);
  } else {
    selected = assessment.questions;
  }

  return limit > 0 ? selected.slice(0, limit) : selected;
}

function createInitialQuizState(
  assessment: Assessment,
  mode: QuizMode,
  resume: boolean,
  quick: QuickTrainingType,
  limit: number
): InitialQuizState {
  const saved = resume ? getProgress(assessment.id).activeSession : undefined;
  if (saved) {
    const restoredQuestions = restoreSessionQuestions(assessment.questions, saved.questionOrder, saved.optionOrder);
    return {
      mode: saved.mode,
      questions: restoredQuestions,
      index: Math.min(saved.currentQuestionIndex, Math.max(0, restoredQuestions.length - 1)),
      answers: saved.answers,
      revealed: saved.revealedQuestionIds.reduce<Record<string, boolean>>((acc, id) => {
        acc[id] = true;
        return acc;
      }, {}),
      startedAt: saved.startedAt
    };
  }

  return {
    mode,
    questions: createSessionQuestions(selectQuestions(assessment, mode, quick, limit)),
    index: 0,
    answers: {},
    revealed: {},
    startedAt: new Date().toISOString()
  };
}

function stableSessionAnswers(
  questions: AssessmentQuestion[],
  answers: Record<string, UserAnswer>
): Record<string, UserAnswer> {
  return questions.reduce<Record<string, UserAnswer>>((acc, question) => {
    if (answers[question.id]) acc[question.id] = stableAnswer(question, answers[question.id]);
    return acc;
  }, {});
}
