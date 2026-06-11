"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCompanion } from "./companion/CompanionProvider";
import { QuestionExplanationPanel } from "./QuestionExplanationPanel";
import { QuestionRenderer } from "./QuestionRenderer";
import {
  FAST_QUIZ_COUNTS,
  FAST_QUIZ_MODE_LABELS,
  buildBlockQuestionCandidates,
  calculateBlockReadiness,
  createFastQuizAssessment,
  formatBlockId,
  latestReadinessResults,
  readinessProgressId,
  readinessStatusLabel,
  selectFastQuizQuestions,
  toFastQuizQuestion,
  type BlockQuestionCandidate,
  type FastQuizSelection
} from "@/lib/blockReadiness";
import { loadActiveAssessmentsWithDiagnostics } from "@/lib/assessmentClient";
import { analyzeAssessmentResults } from "@/lib/assessmentAnalysis";
import { pushAllProgress } from "@/lib/cloudProgress";
import {
  clearActiveQuizSession,
  getAllProgress,
  getProgress,
  recordAttempt,
  recordCrossAssessmentQuestionStats,
  saveActiveQuizSession,
  PROGRESS_CHANGED_EVENT
} from "@/lib/progressStore";
import {
  buildResultRows,
  correctAnswerLabel,
  optionKey,
  scorePercent,
  stableAnswer,
  stableOptionId,
  toStoredQuestionResult
} from "@/lib/score";
import { createSessionQuestions, restoreSessionQuestions } from "@/lib/sessionQuestions";
import { blockIdForContent, isAltfragenValue, isThreeDContent } from "@/lib/studyProgram";
import type {
  ActiveQuizSession,
  AssessmentQuestion,
  BlockReadinessResult,
  FastQuizMode,
  FastQuizQuestionTelemetry,
  QuestionConfidence,
  QuizAttempt,
  QuizResultRow,
  UserAnswer
} from "@/lib/types";

type Phase = "setup" | "quiz" | "result";

type ResultState = {
  readiness: BlockReadinessResult;
  rows: QuizResultRow[];
  attempt: QuizAttempt;
  previousScore: number | null;
};

const MODE_COPY: Record<FastQuizMode, { duration: string; description: string; eyebrow: string }> = {
  pulse: {
    duration: "ca. 8 Minuten",
    description: "Breiter Überblick über möglichst viele Lernziele des Blocks.",
    eyebrow: "12–15 Fragen"
  },
  weakness: {
    duration: "ca. 12 Minuten",
    description: "Priorisiert frühere Fehler, unsichere Themen und Vergessensrisiken.",
    eyebrow: "15–25 Fragen"
  },
  readiness: {
    duration: "ca. 25 Minuten",
    description: "Strenger, prüfungsnaher Mix mit breiter Abdeckung und K-Prim-Anteil.",
    eyebrow: "30–40 Fragen"
  }
};

export function FastQuizClient({
  blockId,
  initialMode,
  autoStart,
  resume
}: {
  blockId: string;
  initialMode: FastQuizMode;
  autoStart: boolean;
  resume: boolean;
}) {
  const normalizedBlockId = normalizeBlockId(blockId);
  const progressId = readinessProgressId(normalizedBlockId);
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState(0);
  const [candidates, setCandidates] = useState<BlockQuestionCandidate[]>([]);
  const [selection, setSelection] = useState<FastQuizSelection | null>(null);
  const [mode, setMode] = useState<FastQuizMode>(initialMode);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [confidence, setConfidence] = useState<Record<string, QuestionConfidence>>({});
  const [startedAt, setStartedAt] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const [readinessProgress, setReadinessProgress] = useState(() => getProgress(progressId));
  const timings = useRef<Record<string, number>>({});
  const enteredAt = useRef(Date.now());
  const autoStarted = useRef(false);
  const pendingSession = useRef<ActiveQuizSession | null>(null);
  const {
    setCompanionAssessmentActive,
    setCompanionExamMode,
    triggerAriEvent
  } = useCompanion();

  const history = useMemo(
    () => latestReadinessResults(readinessProgress),
    [readinessProgress]
  );
  const activeSession = readinessProgress.activeSession;

  useEffect(() => {
    function refreshProgress() {
      setReadinessProgress(getProgress(progressId));
    }
    refreshProgress();
    window.addEventListener(PROGRESS_CHANGED_EVENT, refreshProgress);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, refreshProgress);
  }, [progressId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void loadActiveAssessmentsWithDiagnostics()
      .then((loaded) => {
        if (!active) return;
        const blockAssessments = loaded.assessments.filter((assessment) => (
          blockIdForContent(assessment) === normalizedBlockId
          && !isAltfragenValue(assessment.block)
          && !isThreeDContent(assessment)
        ));
        const nextCandidates = buildBlockQuestionCandidates(
          blockAssessments,
          getAllProgress(),
          normalizedBlockId
        );
        setCandidates(nextCandidates);
        setWarnings(loaded.skipped.length);
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Der Fragenpool konnte nicht geladen werden.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [normalizedBlockId]);

  useEffect(() => {
    const active = phase === "quiz";
    setCompanionAssessmentActive(active);
    setCompanionExamMode(active);
    document.body.classList.toggle("is-assessment-active", active);
    return () => {
      setCompanionAssessmentActive(false);
      setCompanionExamMode(false);
      document.body.classList.remove("is-assessment-active");
    };
  }, [phase, setCompanionAssessmentActive, setCompanionExamMode]);

  const startQuiz = useCallback((nextMode: FastQuizMode, restore = false) => {
    if (!candidates.length) return;
    const saved = restore ? getProgress(progressId).activeSession : undefined;
    if (saved?.fastQuizMode) {
      const allQuestions = candidates.map(toFastQuizQuestion);
      const restoredQuestions = restoreSessionQuestions(allQuestions, saved.questionOrder, saved.optionOrder);
      const candidateById = new Map(candidates.map((candidate) => [candidate.sessionQuestionId, candidate]));
      const restoredCandidates = saved.questionOrder
        .map((questionId) => candidateById.get(questionId))
        .filter((candidate): candidate is BlockQuestionCandidate => !!candidate);
      setSelection({
        mode: saved.fastQuizMode,
        requestedCount: saved.questionOrder.length,
        questions: restoredQuestions,
        candidates: restoredCandidates,
        availableCount: candidates.length,
        objectiveCount: new Set(restoredCandidates.flatMap((candidate) => candidate.learningObjectiveIds)).size,
        typeCounts: {
          A: restoredCandidates.filter((candidate) => candidate.question.type === "A").length,
          KPRIM: restoredCandidates.filter((candidate) => candidate.question.type === "KPRIM").length
        }
      });
      setMode(saved.fastQuizMode);
      setQuestions(restoredQuestions);
      setIndex(Math.min(saved.currentQuestionIndex, Math.max(0, restoredQuestions.length - 1)));
      setAnswers(saved.answers);
      setConfidence(saved.confidenceByQuestion || {});
      timings.current = saved.questionTimings || {};
      setStartedAt(saved.startedAt);
    } else {
      const nextSelection = selectFastQuizQuestions(candidates, nextMode);
      setSelection(nextSelection);
      setMode(nextMode);
      setQuestions(createSessionQuestions(nextSelection.questions));
      setIndex(0);
      setAnswers({});
      setConfidence({});
      timings.current = {};
      setStartedAt(new Date().toISOString());
      clearActiveQuizSession(progressId);
    }
    enteredAt.current = Date.now();
    setResult(null);
    setPhase("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [candidates, progressId]);

  useEffect(() => {
    if (loading || autoStarted.current || !candidates.length) return;
    if (resume && activeSession?.fastQuizMode) {
      autoStarted.current = true;
      startQuiz(activeSession.fastQuizMode, true);
    } else if (autoStart) {
      autoStarted.current = true;
      startQuiz(initialMode);
    }
  }, [activeSession, autoStart, candidates.length, initialMode, loading, resume, startQuiz]);

  useEffect(() => {
    if (phase !== "quiz" || !questions.length) {
      pendingSession.current = null;
      return;
    }
    const session: ActiveQuizSession = {
      assessmentId: progressId,
      blockId: normalizedBlockId,
      currentQuestionIndex: index,
      answers: stableSessionAnswers(questions, answers),
      questionOrder: questions.map((question) => question.id),
      optionOrder: questions.reduce<Record<string, string[]>>((acc, question) => {
        acc[question.id] = question.options.map(stableOptionId);
        return acc;
      }, {}),
      revealedQuestionIds: [],
      startedAt,
      lastOpenedAt: new Date().toISOString(),
      mode: "exam",
      fastQuizMode: mode,
      questionTimings: { ...timings.current },
      confidenceByQuestion: confidence,
      device: window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop"
    };
    pendingSession.current = session;
    saveActiveQuizSession(progressId, session);
  }, [answers, confidence, index, mode, normalizedBlockId, phase, progressId, questions, startedAt]);

  useEffect(() => {
    function flush() {
      if (pendingSession.current) saveActiveQuizSession(progressId, pendingSession.current);
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [progressId]);

  const question = questions[index];
  const currentAnswer = question ? answers[question.id] || {} : {};
  const answered = question ? isAnswered(question, currentAnswer) : false;
  const candidateById = useMemo(
    () => new Map((selection?.candidates || []).map((candidate) => [candidate.sessionQuestionId, candidate])),
    [selection]
  );

  function commitCurrentTime() {
    if (!question) return;
    const elapsed = Math.max(0, Math.round((Date.now() - enteredAt.current) / 1000));
    timings.current[question.id] = (timings.current[question.id] || 0) + elapsed;
    enteredAt.current = Date.now();
  }

  function goToQuestion(nextIndex: number) {
    commitCurrentTime();
    setIndex(Math.max(0, Math.min(questions.length - 1, nextIndex)));
  }

  function setAnswer(answer: UserAnswer) {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.id]: answer }));
  }

  function finishQuiz() {
    if (!selection || !questions.length) return;
    commitCurrentTime();
    const rows = buildResultRows(questions, answers);
    const completedAt = new Date().toISOString();
    const attemptId = createAttemptId();
    const previousResults = latestReadinessResults(getProgress(progressId));
    const readiness = calculateBlockReadiness({
      blockId: normalizedBlockId,
      mode,
      quizResultId: attemptId,
      rows,
      candidates: selection.candidates,
      allBlockCandidates: candidates,
      assessmentProgress: getAllProgress(),
      previousFastQuizScores: previousResults.map((item) => item.fastQuizPerformance),
      confidenceByQuestion: confidence,
      createdAt: completedAt
    });
    const virtualAssessment = createFastQuizAssessment(normalizedBlockId, mode, selection.candidates);
    const telemetry = buildTelemetry(rows, candidateById, timings.current, confidence);
    const correct = rows.filter((row) => row.correct).length;
    const partial = rows.filter((row) => row.status === "partial").length;
    const incorrect = rows.filter((row) => row.status === "incorrect").length;
    const points = rows.reduce((sum, row) => sum + row.points, 0);
    const maxPoints = rows.reduce((sum, row) => sum + row.maxPoints, 0);
    const attempt: QuizAttempt = {
      id: attemptId,
      assessmentId: progressId,
      mode: "exam",
      fastQuizMode: mode,
      blockId: normalizedBlockId,
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
      questionTelemetry: telemetry,
      analysis: analyzeAssessmentResults(virtualAssessment, rows),
      readinessResult: readiness
    };

    recordAttempt(virtualAssessment, attempt, rows);
    const changedSourceIds = recordCrossAssessmentQuestionStats(rows, completedAt, telemetry);
    clearActiveQuizSession(progressId);
    const changedProgress = Object.fromEntries(
      [progressId, ...changedSourceIds].map((id) => [id, getProgress(id)])
    );
    void pushAllProgress(changedProgress).catch(() => undefined);
    pendingSession.current = null;
    setResult({
      readiness,
      rows,
      attempt,
      previousScore: previousResults[0]?.readinessScore ?? null
    });
    setReadinessProgress(getProgress(progressId));
    setPhase("result");
    triggerAriEvent("assessment_completed");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leaveQuiz() {
    commitCurrentTime();
    const currentSession = pendingSession.current;
    if (currentSession) {
      const session = {
        ...currentSession,
        questionTimings: { ...timings.current },
        lastOpenedAt: new Date().toISOString()
      };
      pendingSession.current = session;
      saveActiveQuizSession(progressId, session);
    }
    setPhase("setup");
  }

  if (loading) {
    return (
      <main className="shell fast-quiz-shell">
        <div className="fast-quiz-loading" aria-label="Blockfragen werden priorisiert" role="status">
          <span /><span /><span />
        </div>
      </main>
    );
  }

  if (error || !candidates.length) {
    return (
      <main className="shell fast-quiz-shell">
        <Link className="btn-secondary inline-flex" href="/assessments">Zur Blockübersicht</Link>
        <section className="card fast-quiz-empty">
          <p className="eyebrow">Block Readiness</p>
          <h1>Fast Quiz nicht verfügbar</h1>
          <p>{error || `Für ${formatBlockId(normalizedBlockId)} sind noch nicht genügend gültige Fragen vorhanden.`}</p>
        </section>
      </main>
    );
  }

  if (phase === "result" && result) {
    return (
      <FastQuizResult
        blockId={normalizedBlockId}
        result={result}
        onRestart={(nextMode) => startQuiz(nextMode)}
      />
    );
  }

  if (phase === "quiz" && question && selection) {
    const objective = candidateById.get(question.id)?.learningObjectiveLabels[question.learningObjectiveId];
    return (
      <main className="shell fast-quiz-shell quiz-shell" id="top">
        <header className="fast-quiz-running-header">
          <button className="btn-secondary" onClick={leaveQuiz} type="button">Beenden</button>
          <div>
            <span>{FAST_QUIZ_MODE_LABELS[mode]}</span>
            <strong>{formatBlockId(normalizedBlockId)}</strong>
          </div>
          <span>Frage {index + 1}/{questions.length}</span>
        </header>

        <div className="fast-quiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={questions.length} aria-valuenow={index + 1}>
          <i style={{ width: `${(index + 1) / questions.length * 100}%` }} />
        </div>

        <nav className="fast-quiz-question-nav" aria-label="Fragen-Navigation">
          {questions.map((item, questionIndex) => (
            <button
              className={`${questionIndex === index ? "is-current" : ""} ${isAnswered(item, answers[item.id]) ? "is-answered" : ""}`}
              key={item.id}
              onClick={() => goToQuestion(questionIndex)}
              title={`Frage ${questionIndex + 1}: ${isAnswered(item, answers[item.id]) ? "beantwortet" : "offen"}`}
              type="button"
            >
              {questionIndex + 1}
            </button>
          ))}
        </nav>

        <article className="card fast-quiz-question">
          <div className="fast-quiz-question-meta">
            <span>{question.type === "KPRIM" ? "K-Prim" : "Typ A"}</span>
            <span>Level {question.difficulty}</span>
            {objective && <span>{objective}</span>}
          </div>
          <h1>{question.stem}</h1>
          <QuestionRenderer
            answer={currentAnswer}
            onChange={setAnswer}
            question={question}
            revealed={false}
          />

          {answered && (
            <fieldset className="fast-quiz-confidence">
              <legend>Wie sicher bist du?</legend>
              <button
                className={confidence[question.id] === "sure" ? "is-active" : ""}
                onClick={() => setConfidence((current) => ({ ...current, [question.id]: "sure" }))}
                type="button"
              >
                Sicher
              </button>
              <button
                className={confidence[question.id] === "unsure" ? "is-active" : ""}
                onClick={() => setConfidence((current) => ({ ...current, [question.id]: "unsure" }))}
                type="button"
              >
                Unsicher
              </button>
            </fieldset>
          )}
        </article>

        <footer className="fast-quiz-actions">
          <button className="btn-secondary" disabled={index === 0} onClick={() => goToQuestion(index - 1)} type="button">
            Zurück
          </button>
          <span>{Object.keys(answers).filter((id) => isAnswered(questions.find((item) => item.id === id), answers[id])).length}/{questions.length} beantwortet</span>
          {index === questions.length - 1 ? (
            <button className="btn-primary" onClick={finishQuiz} type="button">Readiness berechnen</button>
          ) : (
            <button className="btn-primary" disabled={!answered} onClick={() => goToQuestion(index + 1)} type="button">Weiter</button>
          )}
        </footer>
      </main>
    );
  }

  const latest = history[0];
  const previous = history[1];
  return (
    <main className="shell fast-quiz-shell" id="top">
      <Link className="btn-secondary inline-flex" href="/assessments">Zur Blockübersicht</Link>
      <header className="glass fast-quiz-hero">
        <div>
          <p className="eyebrow">Block Readiness</p>
          <h1>{formatBlockId(normalizedBlockId)} Fast Quiz</h1>
          <p>Kurze, lernzielorientierte Checks aus {candidates.length} verfügbaren Fragen. ATLAS priorisiert Qualität, Schwächen und Vergessensrisiko.</p>
        </div>
        {latest && (
          <div className={`fast-readiness-orb is-${latest.status}`}>
            <strong>{latest.readinessScore}%</strong>
            <span>{readinessStatusLabel(latest.status)}</span>
            {previous && <small>{signedDifference(latest.readinessScore - previous.readinessScore)} seit letztem Check</small>}
          </div>
        )}
      </header>

      {warnings > 0 && (
        <div className="fast-quiz-note">{warnings} unvollständige Assessment-Datei{warnings === 1 ? "" : "en"} wurden sicher übersprungen.</div>
      )}

      {activeSession?.fastQuizMode && (
        <section className="card fast-quiz-resume">
          <div>
            <p className="eyebrow">Offene Session</p>
            <h2>{FAST_QUIZ_MODE_LABELS[activeSession.fastQuizMode]}</h2>
            <p>Du warst bei Frage {activeSession.currentQuestionIndex + 1} von {activeSession.questionOrder.length}.</p>
          </div>
          <button className="btn-primary" onClick={() => startQuiz(activeSession.fastQuizMode!, true)} type="button">Fortsetzen</button>
        </section>
      )}

      <section className="fast-quiz-mode-grid">
        {(Object.keys(MODE_COPY) as FastQuizMode[]).map((value) => {
          const copy = MODE_COPY[value];
          return (
            <article className={`card fast-quiz-mode-card is-${value}`} key={value}>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h2>{FAST_QUIZ_MODE_LABELS[value]}</h2>
              <p>{copy.description}</p>
              <div>
                <span>{copy.duration}</span>
                <span>{Math.min(FAST_QUIZ_COUNTS[value], candidates.length)} Fragen</span>
              </div>
              <button className={value === "readiness" ? "btn-primary" : "btn-secondary"} onClick={() => startQuiz(value)} type="button">
                {value === "readiness" ? "Readiness prüfen" : "Quiz starten"}
              </button>
            </article>
          );
        })}
      </section>

      <section className="card fast-quiz-method">
        <div>
          <p className="eyebrow">Nachvollziehbare Auswahl</p>
          <h2>Warum diese Fragen?</h2>
        </div>
        <div className="fast-quiz-method-grid">
          <MethodStat label="Lernzielrelevanz" value="25%" />
          <MethodStat label="Persönliche Schwäche" value="25%" />
          <MethodStat label="Prüfungstrennschärfe" value="20%" />
          <MethodStat label="Vergessensrisiko" value="15%" />
          <MethodStat label="Konzepttiefe" value="10%" />
          <MethodStat label="Neuheit" value="5%" />
        </div>
      </section>
    </main>
  );
}

function FastQuizResult({
  blockId,
  result,
  onRestart
}: {
  blockId: string;
  result: ResultState;
  onRestart: (mode: FastQuizMode) => void;
}) {
  const { readiness, rows, previousScore } = result;
  const weakLabels = readiness.weakLearningObjectiveIds
    .map((id) => readiness.learningObjectiveLabels[id])
    .filter(Boolean);
  const strongLabels = readiness.strongLearningObjectiveIds
    .map((id) => readiness.learningObjectiveLabels[id])
    .filter(Boolean);
  const trend = previousScore === null ? null : readiness.readinessScore - previousScore;
  const incorrectRows = rows.filter((row) => !row.correct);
  const unsureCount = Object.values(result.attempt.questionTelemetry || {})
    .filter((item) => item.confidence === "unsure").length;

  return (
    <main className="shell fast-quiz-shell fast-quiz-result" id="top">
      <header className={`glass fast-quiz-result-hero is-${readiness.status}`}>
        <div>
          <p className="eyebrow">{formatBlockId(blockId)} · Block Readiness</p>
          <h1>{readiness.readinessScore}%</h1>
          <h2>{readinessStatusLabel(readiness.status)}</h2>
          <p>{readinessInterpretation(readiness, weakLabels)}</p>
        </div>
        <div className="fast-result-trend">
          <span>Trend</span>
          <strong>{trend === null ? "Erster Check" : signedDifference(trend)}</strong>
        </div>
      </header>

      <section className="fast-result-components">
        <ResultMetric label="Normale Assessments" value={readiness.assessmentPerformance === null ? "Noch keine Daten" : `${readiness.assessmentPerformance}%`} />
        <ResultMetric label="Fast Quiz" value={`${readiness.fastQuizPerformance}%`} />
        <ResultMetric label="Lernzielabdeckung" value={`${readiness.learningObjectiveCoverage}%`} />
        <ResultMetric label="Stabilität" value={`${readiness.stabilityScore}%`} />
      </section>

      <section className="fast-result-grid">
        <article className="card">
          <p className="eyebrow">Stabil</p>
          <h2>Stärkste Themen</h2>
          <TopicList empty="Noch kein Thema ist über genügend Fragen stabil belegt." items={strongLabels} tone="strong" />
        </article>
        <article className="card">
          <p className="eyebrow">Priorität</p>
          <h2>Offene Schwächen</h2>
          <TopicList empty="In diesem Check wurde kein klarer Schwachpunkt erkannt." items={weakLabels} tone="weak" />
        </article>
      </section>

      <section className="card fast-result-next">
        <div>
          <p className="eyebrow">Nächster sinnvoller Schritt</p>
          <h2>{nextStepTitle(readiness.recommendedNextMode)}</h2>
          <p>
            {incorrectRows.length} nicht vollständig richtige Antworten
            {unsureCount ? ` · ${unsureCount} unsichere Einschätzungen` : ""}.
            {weakLabels[0] ? ` Starte mit ${weakLabels.slice(0, 2).join(" und ")}.` : " Halte die Abdeckung mit einem kurzen Pulse stabil."}
          </p>
        </div>
        <div className="fast-result-actions">
          <button className="btn-primary" onClick={() => onRestart("weakness")} type="button">Gezieltes Weakness Quiz starten</button>
          {readiness.recommendedAssessmentId && (
            <Link className="btn-secondary" href={`/assessment/${readiness.recommendedAssessmentId}`}>Normales Assessment öffnen</Link>
          )}
          <Link className="btn-secondary" href="/assessments">Zur Blockübersicht</Link>
        </div>
      </section>

      {!!incorrectRows.length && (
        <section className="fast-result-review">
          <div className="fast-result-section-heading">
            <div><p className="eyebrow">Review</p><h2>Diese Fragen kosten noch Punkte</h2></div>
            <span>{incorrectRows.length}</span>
          </div>
          {incorrectRows.map((row, rowIndex) => (
            <article className="card fast-result-question" key={row.question.id}>
              <p className="eyebrow">Frage {rows.indexOf(row) + 1} · {row.question.type === "KPRIM" ? "K-Prim" : "Typ A"}</p>
              <h3>{row.question.stem}</h3>
              <p><strong>Richtig:</strong> {correctAnswerLabel(row.question)}</p>
              <QuestionExplanationPanel answer={row.answer} compact question={row.question} />
              {rowIndex >= 7 && <span className="sr-only">Weitere Reviewfrage</span>}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function buildTelemetry(
  rows: QuizResultRow[],
  candidates: Map<string, BlockQuestionCandidate>,
  timings: Record<string, number>,
  confidence: Record<string, QuestionConfidence>
): Record<string, FastQuizQuestionTelemetry> {
  return rows.reduce<Record<string, FastQuizQuestionTelemetry>>((acc, row) => {
    const candidate = candidates.get(row.question.id);
    if (!candidate) return acc;
    const timeSeconds = timings[row.question.id] || 0;
    acc[row.question.id] = {
      sourceAssessmentId: candidate.assessmentId,
      sourceQuestionId: candidate.sourceQuestionId,
      learningObjectiveIds: candidate.learningObjectiveIds,
      timeSeconds,
      confidence: confidence[row.question.id],
      mistakeType: row.correct
        ? undefined
        : timeSeconds > 90
          ? "too_slow"
          : confidence[row.question.id] === "sure"
            ? "conceptual_error"
            : "knowledge_gap"
    };
    return acc;
  }, {});
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

function isAnswered(question: AssessmentQuestion | undefined, answer: UserAnswer | undefined): boolean {
  if (!question || !answer) return false;
  if (question.type === "A") return !!answer.selected;
  return question.options.every((option) => typeof answer.kprim?.[optionKey(option)] === "boolean");
}

function normalizeBlockId(value: string): string {
  const number = String(value).match(/\d+/)?.[0];
  return number ? `block${number}` : String(value || "block").toLowerCase();
}

function createAttemptId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function MethodStat({ label, value }: { label: string; value: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return <div className="card"><span>{label}</span><strong>{value}</strong></div>;
}

function TopicList({
  items,
  empty,
  tone
}: {
  items: string[];
  empty: string;
  tone: "strong" | "weak";
}) {
  if (!items.length) return <p className="fast-topic-empty">{empty}</p>;
  return <ul className={`fast-topic-list is-${tone}`}>{items.slice(0, 6).map((item) => <li key={item}>{item}</li>)}</ul>;
}

function readinessInterpretation(readiness: BlockReadinessResult, weakLabels: string[]): string {
  const focus = weakLabels.slice(0, 2).join(" und ");
  if (readiness.status === "ready") {
    return focus
      ? `Deine Leistung ist insgesamt stabil. ${focus} bleiben die sinnvollsten Kontrollpunkte.`
      : "Du zeigst eine breite und stabile Leistung. Halte sie mit kurzen Wiederholungen aufrecht.";
  }
  if (readiness.status === "almost_ready") {
    return `Du bist grundsätzlich stabil${focus ? `, verlierst aber noch Punkte in ${focus}` : ""}. Ein gezielter Review sollte die Lücke schliessen.`;
  }
  if (readiness.status === "risk_zone") {
    return `Die Grundlage ist vorhanden, aber noch nicht prüfungsstabil${focus ? `. Priorisiere ${focus}` : ""}.`;
  }
  return `Aktuell besteht noch deutlicher Wiederholungsbedarf${focus ? `, besonders bei ${focus}` : ""}. Starte mit einem fokussierten Weakness Hunter.`;
}

function nextStepTitle(mode: FastQuizMode): string {
  if (mode === "pulse") return "Kurzen Block Pulse einplanen";
  if (mode === "readiness") return "Readiness unter Prüfungsbedingungen bestätigen";
  return "Schwächen gezielt schliessen";
}

function signedDifference(value: number): string {
  if (value === 0) return "±0 Punkte";
  return `${value > 0 ? "+" : ""}${value} Punkte`;
}
