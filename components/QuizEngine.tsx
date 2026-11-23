"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { QuestionImages } from "./QuestionImages";
import { QuestionRenderer } from "./QuestionRenderer";
import { QuestionExplanationPanel } from "./QuestionExplanationPanel";
import { ResultsPage } from "./ResultsPage";
import { AtlasIcon } from "./AtlasIcon";
import { SummaryLinkButton } from "./SummaryLinkPanel";
import { AtlasDialog } from "./ui/AtlasDialog";
import { useCompanion } from "./companion/CompanionProvider";
import { isAltfragenAssessment } from "@/lib/altfragenAccess";
import { analyzeAssessmentResults } from "@/lib/assessmentAnalysis";
import {
  buildResultRows,
  correctAnswerLabel,
  evaluateQuestion,
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

const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  training: "Training",
  exam: "Prüfung",
  review: "Wiederholung"
};

type Confirmation = ({ kind: "finish" } | { kind: "mode"; mode: QuizMode }) & {
  input: "pointer" | "keyboard";
};
type QuizResult = { rows: QuizResultRow[]; attempt: QuizAttempt; animateArrival: boolean };

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
  const [result, setResult] = useState<QuizResult | null>(null);
  const [finishError, setFinishError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
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

  const questionHeading = useRef<HTMLHeadingElement>(null);
  const focusNextQuestion = useRef(false);
  const questionRail = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!focusNextQuestion.current) return;
    focusNextQuestion.current = false;
    const heading = questionHeading.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "nearest" });
  }, [index, mode, questions, result]);

  useLayoutEffect(() => {
    const rail = questionRail.current;
    const current = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!rail || !current) return;
    const left = current.offsetLeft;
    const right = left + current.offsetWidth;
    if (left < rail.scrollLeft) rail.scrollLeft = left - 4;
    else if (right > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = right - rail.clientWidth + 4;
  }, [index, questions, result]);

  function goToQuestion(next: number) {
    if (next === index) return;
    focusNextQuestion.current = true;
    setIndex(next);
  }

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
  const detailHref = isAltfragenAssessment(assessment)
    ? `/assessment/${assessment.id}?origin=altfragen`
    : `/assessment/${assessment.id}`;

  if (result) {
    return (
      <ResultsPage
        assessment={assessment}
        animateArrival={result.animateArrival}
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
          <Link className="btn-primary mt-5 inline-flex items-center" href={detailHref}>Zurück</Link>
        </div>
      </main>
    );
  }

  const currentAnswer = answers[question.id] || {};
  const usesImmediateFeedback = mode !== "exam";
  const isRevealed = usesImmediateFeedback && revealed[question.id];
  const evaluation = evaluateQuestion(question, currentAnswer);
  const currentCorrect = evaluation.status === "correct";
  const resultLabel = !currentAnswer.selected && !Object.keys(currentAnswer.kprim || {}).length
    ? "Ohne Antwort"
    : evaluation.status === "correct" ? "Richtig"
      : evaluation.status === "partial" ? "Teilweise richtig" : "Nicht richtig";
  const stat = progress.questionStats[question.id];
  const modeLabel = QUIZ_MODE_LABELS[mode];
  const progressPercent = Math.round(((index + 1) / questions.length) * 100);
  const answeredCount = answeredQuestionIds.size;
  const openCount = questions.length - answeredCount;

  function requestFinish(animateArrival: boolean) {
    if (openCount) setConfirmation({ kind: "finish", input: animateArrival ? "pointer" : "keyboard" });
    else finishQuiz(animateArrival);
  }

  function requestMode(next: QuizMode, pointer: boolean) {
    if (next === mode) return;
    if (Object.keys(answers).length || Object.values(revealed).some(Boolean)) {
      setConfirmation({ kind: "mode", mode: next, input: pointer ? "pointer" : "keyboard" });
    } else {
      restart(next);
    }
  }

  function revealOrNext(animateArrival: boolean) {
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
    if (index >= questions.length - 1) requestFinish(animateArrival);
    else goToQuestion(index + 1);
  }

  function retryCurrentQuestion() {
    setAnswers((current) => {
      const next = { ...current };
      delete next[question.id];
      return next;
    });
    setRevealed((current) => ({ ...current, [question.id]: false }));
  }

  function finishQuiz(animateArrival: boolean) {
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

    setResult({ rows, attempt, animateArrival });
    triggerAriEvent("assessment_completed");
  }

  function restart(nextMode: QuizMode) {
    focusNextQuestion.current = true;
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
    focusNextQuestion.current = true;
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
    <main id="top" className={`shell quiz-shell atlas-quiz-shell quiz-mode-${mode}`}>
      <section className="atlas-quiz-session" aria-label="Trainingssitzung">
        <div className="quiz-session-header">
          <Link className="atlas-quiz-exit" href={detailHref}>
            Beenden
          </Link>
          <div className="atlas-quiz-session-status">
            <strong>Frage {index + 1} von {questions.length}</strong>
            <span>{modeLabel} · {answeredCount} beantwortet</span>
          </div>
          <button
            type="button"
            aria-label="Frage markieren"
            aria-pressed={!!stat?.markedForReview}
            className={stat?.markedForReview ? "atlas-quiz-review-button is-marked" : "atlas-quiz-review-button"}
            onClick={() => {
              toggleQuestionReview(assessment.id, question.id);
              setProgress(getProgress(assessment.id));
            }}
          >
            <AtlasIcon name="bookmark" />
            <span>{stat?.markedForReview ? "Markiert" : "Markieren"}</span>
          </button>
        </div>

        <div className="atlas-quiz-progress-row">
          <div
            aria-label={`Frage ${index + 1} von ${questions.length}`}
            aria-valuemax={questions.length}
            aria-valuemin={1}
            aria-valuenow={index + 1}
            className="atlas-quiz-progress-track"
            role="progressbar"
          >
            <div style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <nav aria-label="Fragen der Übung" className="quiz-progress-nav atlas-quiz-question-rail" ref={questionRail}>
          {questions.map((item, itemIndex) => {
            const answered = answeredQuestionIds.has(item.id);
            return (
              <button
                type="button"
                aria-current={itemIndex === index ? "step" : undefined}
                aria-label={`Frage ${itemIndex + 1}: ${answered ? "beantwortet" : "offen"}`}
                className={`quiz-progress-dot atlas-quiz-step${itemIndex === index ? " is-current" : ""}${answered ? " is-answered" : ""}`}
                key={item.id}
                title={`Frage ${itemIndex + 1}: ${answered ? "beantwortet" : "offen"}`}
                onClick={() => goToQuestion(itemIndex)}
              >
                {itemIndex + 1}{answered && <span aria-hidden="true" className="quiz-step-complete" />}
              </button>
            );
          })}
        </nav>
        <details className="quiz-session-options">
          <summary>Modus und Optionen</summary>
          <div className="quiz-session-option-content">
            <div className="quiz-mode-tabs atlas-quiz-mode-tabs" role="group" aria-label="Quizmodus">
              {(["training", "exam", "review"] as QuizMode[]).map((value) => (
                <button
                  aria-pressed={mode === value}
                  className={mode === value ? "is-active" : ""}
                  key={value}
                  onClick={(event) => requestMode(value, event.detail > 0)}
                  type="button"
                >
                  {QUIZ_MODE_LABELS[value]}
                </button>
              ))}
            </div>
            <div className="quiz-session-option-actions">
              <button
                aria-pressed={stat?.priority === "high"}
                className="btn-secondary"
                onClick={() => {
                  setQuestionPriority(assessment.id, question.id, stat?.priority === "high" ? "normal" : "high");
                  setProgress(getProgress(assessment.id));
                }}
                type="button"
              >
                {stat?.priority === "high" ? "Priorität entfernen" : "Frage priorisieren"}
              </button>
              <SummaryLinkButton assessment={assessment} />
              <button className="btn-secondary" onClick={(event) => requestFinish(event.detail > 0)} type="button">Jetzt abgeben</button>
            </div>
          </div>
        </details>
      </section>

      <article className="quiz-question-card atlas-quiz-card">
        <div className="atlas-quiz-card-meta">
          <span>{question.type === "KPRIM" ? "K-Prim" : "Typ A"}</span>
          <span>Level {question.difficulty}</span>
        </div>
        <h1 className="quiz-question-title" ref={questionHeading} tabIndex={-1}>{question.stem}</h1>
        <QuestionImages images={question.images} key={question.id} />
        <div className="atlas-quiz-answer-list">
          <QuestionRenderer question={question} answer={currentAnswer} revealed={isRevealed} onChange={setAnswer} />
        </div>

        {isRevealed && (
          <div className={`quiz-feedback ${currentCorrect ? "is-correct" : evaluation.status === "partial" ? "is-partial" : "is-wrong"}`}>
            <div role="status">
              <strong>{resultLabel}</strong>
              <p>Richtige Antwort: {correctAnswerLabel(question)}</p>
            </div>
            <QuestionExplanationPanel
              answer={currentAnswer}
              compact
              objective={assessment.learningObjectives.find((item) => item.id === question.learningObjectiveId)?.text}
              question={question}
            />
          </div>
        )}

        <div className="quiz-action-row">
          <button type="button" className="btn-secondary" disabled={index === 0} onClick={() => goToQuestion(index - 1)}>
            Zurück
          </button>
          <div className="quiz-action-buttons">
            {mode === "review" && isRevealed && (
              <button type="button" className="btn-secondary" onClick={retryCurrentQuestion}>
                Nochmals üben
              </button>
            )}
            <button type="button" className="btn-primary" onClick={(event) => revealOrNext(event.detail > 0)}>
              {usesImmediateFeedback && !revealed[question.id]
                ? "Lösung zeigen"
                : mode === "review" && isRevealed
                  ? "Verstanden"
                  : index >= questions.length - 1
                    ? "Abgeben"
                    : "Weiter"}
            </button>
          </div>
        </div>
        {finishError && (
          <p className="quiz-save-warning" role="alert">
            Resultat wurde angezeigt, aber der lokale Fortschritt konnte nicht gespeichert werden: {finishError}
          </p>
        )}
      </article>
      {confirmation && (
        <AtlasDialog
          className="quiz-confirmation"
          label={confirmation.kind === "finish" ? "Übung abgeben?" : "Quizmodus wechseln?"}
          onDismiss={() => setConfirmation(null)}
          openingInput={confirmation.input}
        >
          {(dismiss) => (
            <>
              <h2>{confirmation.kind === "finish" ? "Übung abgeben?" : "Quizmodus wechseln?"}</h2>
              <p>{confirmation.kind === "finish"
                ? openCount === 1 ? "Eine Frage ist noch offen." : `${openCount} Fragen sind noch offen.`
                : `Mit «${QUIZ_MODE_LABELS[confirmation.mode]}» beginnst du eine neue Runde. Die Antworten aus dieser Runde gehen dabei verloren.`}</p>
              <div className="quiz-confirmation-actions">
                <button className="btn-secondary" onClick={dismiss} type="button">Weiter üben</button>
                <button
                  className="btn-primary"
                  onClick={(event) => {
                    setConfirmation(null);
                    if (confirmation.kind === "finish") finishQuiz(event.detail > 0);
                    else restart(confirmation.mode);
                  }}
                  type="button"
                >
                  {confirmation.kind === "finish" ? "Übung abgeben" : "Modus wechseln"}
                </button>
              </div>
            </>
          )}
        </AtlasDialog>
      )}
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
