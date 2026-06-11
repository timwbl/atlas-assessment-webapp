"use client";

import type {
  ActiveQuizSession,
  Assessment,
  AssessmentProgress,
  QuizAttempt,
  QuizResultRow,
  QuestionStat
} from "./types";

const STORAGE_KEY = "atlas-assessment-progress-v1";
export const PROGRESS_CHANGED_EVENT = "atlas-progress-changed";
let memoryProgress: Record<string, AssessmentProgress> | null = null;
let storageListenerReady = false;

function emptyProgress(assessmentId: string): AssessmentProgress {
  return {
    assessmentId,
    attempts: [],
    questionStats: {},
    bestScore: 0,
    lastScore: null,
    errorTags: {}
  };
}

function readAll(): Record<string, AssessmentProgress> {
  if (typeof window === "undefined") return {};
  ensureStorageListener();
  if (memoryProgress) return memoryProgress;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, AssessmentProgress>;
    memoryProgress = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    memoryProgress = {};
  }

  return memoryProgress;
}

function writeAll(value: Record<string, AssessmentProgress>): void {
  if (typeof window === "undefined") return;
  memoryProgress = value;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT));
}

export function getProgress(assessmentId: string): AssessmentProgress {
  return cloneProgress(readAll()[assessmentId] || emptyProgress(assessmentId));
}

export function getAllProgress(): Record<string, AssessmentProgress> {
  return cloneProgress(readAll());
}

export function saveProgress(progress: AssessmentProgress): void {
  const all = readAll();
  all[progress.assessmentId] = progress;
  writeAll(all);
}

export function saveAllProgress(progress: Record<string, AssessmentProgress>): void {
  writeAll(progress);
}

export function mergeProgress(local: AssessmentProgress, remote: AssessmentProgress): AssessmentProgress {
  const attempts = [...remote.attempts, ...local.attempts]
    .reduce<QuizAttempt[]>((acc, attempt) => {
      if (!acc.some((item) => item.id === attempt.id)) acc.push(attempt);
      return acc;
    }, [])
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 60);

  const questionStats: AssessmentProgress["questionStats"] = {
    ...remote.questionStats
  };

  Object.entries(local.questionStats).forEach(([questionId, localStat]) => {
    const remoteStat = questionStats[questionId];
    if (!remoteStat) {
      questionStats[questionId] = localStat;
      return;
    }

    const localTime = localStat.lastAnsweredAt ? new Date(localStat.lastAnsweredAt).getTime() : 0;
    const remoteTime = remoteStat.lastAnsweredAt ? new Date(remoteStat.lastAnsweredAt).getTime() : 0;
    questionStats[questionId] = {
      seen: Math.max(localStat.seen, remoteStat.seen),
      correct: Math.max(localStat.correct, remoteStat.correct),
      wrong: Math.max(localStat.wrong, remoteStat.wrong),
      lastCorrect: localTime >= remoteTime ? localStat.lastCorrect : remoteStat.lastCorrect,
      markedForReview: localStat.markedForReview || remoteStat.markedForReview,
      priority: localStat.priority === "high" || remoteStat.priority === "high" ? "high" : "normal",
      lastAnsweredAt: localTime >= remoteTime ? localStat.lastAnsweredAt : remoteStat.lastAnsweredAt,
      avgTimeSeconds: localTime >= remoteTime ? localStat.avgTimeSeconds : remoteStat.avgTimeSeconds,
      confidence: localTime >= remoteTime ? localStat.confidence : remoteStat.confidence,
      mistakeType: localTime >= remoteTime ? localStat.mistakeType : remoteStat.mistakeType
    };
  });

  const errorTags = { ...remote.errorTags };
  Object.entries(local.errorTags).forEach(([tag, count]) => {
    errorTags[tag] = Math.max(errorTags[tag] || 0, count);
  });

  const latestAttempt = attempts[0];
  const activeSessionClearedAt = newestTimestamp(
    local.activeSessionClearedAt,
    remote.activeSessionClearedAt
  );
  const activeSession = newestActiveSession(local.activeSession, remote.activeSession);
  const clearedAfterSession = activeSessionClearedAt
    && (!activeSession || new Date(activeSessionClearedAt).getTime() >= new Date(activeSession.lastOpenedAt).getTime());

  return {
    assessmentId: local.assessmentId || remote.assessmentId,
    attempts,
    questionStats,
    bestScore: Math.max(local.bestScore || 0, remote.bestScore || 0),
    lastScore: latestAttempt?.score ?? local.lastScore ?? remote.lastScore ?? null,
    lastAttemptAt: latestAttempt?.completedAt || local.lastAttemptAt || remote.lastAttemptAt,
    errorTags,
    activeSession: clearedAfterSession ? undefined : activeSession,
    activeSessionClearedAt
  };
}

function newestActiveSession(
  local?: ActiveQuizSession,
  remote?: ActiveQuizSession
): ActiveQuizSession | undefined {
  if (!local) return remote;
  if (!remote) return local;
  return new Date(local.lastOpenedAt).getTime() >= new Date(remote.lastOpenedAt).getTime()
    ? local
    : remote;
}

function newestTimestamp(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

export function mergeProgressMap(remote: Record<string, AssessmentProgress>): Record<string, AssessmentProgress> {
  const local = getAllProgress();
  const merged = { ...remote };

  Object.entries(local).forEach(([assessmentId, localProgress]) => {
    merged[assessmentId] = merged[assessmentId]
      ? mergeProgress(localProgress, merged[assessmentId])
      : localProgress;
  });

  saveAllProgress(merged);
  return merged;
}

export function resetProgress(assessmentId: string): void {
  const all = readAll();
  delete all[assessmentId];
  writeAll(all);
}

export function exportProgressJson(): string {
  return JSON.stringify(readAll(), null, 2);
}

export function importProgressJson(text: string): void {
  const parsed = JSON.parse(text) as Record<string, AssessmentProgress>;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Ungültige Fortschrittsdatei.");
  }
  writeAll(parsed);
}

function defaultQuestionStat(): QuestionStat {
  return {
    seen: 0,
    correct: 0,
    wrong: 0,
    lastCorrect: null,
    markedForReview: false,
    priority: "normal"
  };
}

export function recordAttempt(
  assessment: Assessment,
  attempt: QuizAttempt,
  rows: QuizResultRow[]
): AssessmentProgress {
  const progress = getProgress(assessment.id);

  rows.forEach((row) => {
    const stat = progress.questionStats[row.question.id] || defaultQuestionStat();
    stat.seen += 1;
    stat.lastCorrect = row.correct;
    stat.lastAnsweredAt = attempt.completedAt;
    if (row.correct) stat.correct += 1;
    else stat.wrong += 1;
    progress.questionStats[row.question.id] = stat;

    if (!row.correct) {
      row.question.tags.forEach((tag) => {
        progress.errorTags[tag] = (progress.errorTags[tag] || 0) + 1;
      });
    }
  });

  progress.attempts = [attempt, ...progress.attempts].slice(0, 60);
  progress.lastScore = attempt.score;
  progress.bestScore = Math.max(progress.bestScore || 0, attempt.score);
  progress.lastAttemptAt = attempt.completedAt;
  saveProgress(progress);
  return progress;
}

export function recordCrossAssessmentQuestionStats(
  rows: QuizResultRow[],
  completedAt: string,
  telemetry: Record<string, {
    sourceAssessmentId: string;
    sourceQuestionId: string;
    timeSeconds: number;
    confidence?: QuestionStat["confidence"];
    mistakeType?: QuestionStat["mistakeType"];
  }>
): string[] {
  const all = readAll();
  const changed = new Set<string>();

  rows.forEach((row) => {
    const observation = telemetry[row.question.id];
    if (!observation?.sourceAssessmentId || !observation.sourceQuestionId) return;
    const assessmentProgress = all[observation.sourceAssessmentId]
      || emptyProgress(observation.sourceAssessmentId);
    const stat = assessmentProgress.questionStats[observation.sourceQuestionId]
      || defaultQuestionStat();
    const previousSeen = stat.seen;
    stat.seen += 1;
    stat.lastCorrect = row.correct;
    stat.lastAnsweredAt = completedAt;
    if (row.correct) stat.correct += 1;
    else stat.wrong += 1;
    if (Number.isFinite(observation.timeSeconds)) {
      stat.avgTimeSeconds = previousSeen > 0 && typeof stat.avgTimeSeconds === "number"
        ? Math.round((stat.avgTimeSeconds * previousSeen + observation.timeSeconds) / stat.seen)
        : Math.round(observation.timeSeconds);
    }
    if (observation.confidence) stat.confidence = observation.confidence;
    if (observation.mistakeType) stat.mistakeType = observation.mistakeType;
    assessmentProgress.questionStats[observation.sourceQuestionId] = stat;
    if (!row.correct) {
      row.question.tags.forEach((tag) => {
        assessmentProgress.errorTags[tag] = (assessmentProgress.errorTags[tag] || 0) + 1;
      });
    }
    all[observation.sourceAssessmentId] = assessmentProgress;
    changed.add(observation.sourceAssessmentId);
  });

  if (changed.size) writeAll(all);
  return [...changed];
}

export function toggleQuestionReview(assessmentId: string, questionId: string): AssessmentProgress {
  const progress = getProgress(assessmentId);
  const stat = progress.questionStats[questionId] || defaultQuestionStat();
  stat.markedForReview = !stat.markedForReview;
  progress.questionStats[questionId] = stat;
  saveProgress(progress);
  return progress;
}

export function setQuestionPriority(
  assessmentId: string,
  questionId: string,
  priority: QuestionStat["priority"]
): AssessmentProgress {
  const progress = getProgress(assessmentId);
  const stat = progress.questionStats[questionId] || defaultQuestionStat();
  stat.priority = priority;
  stat.markedForReview = priority === "high" ? true : stat.markedForReview;
  progress.questionStats[questionId] = stat;
  saveProgress(progress);
  return progress;
}

export function saveActiveQuizSession(
  assessmentId: string,
  session: ActiveQuizSession
): AssessmentProgress {
  const progress = getProgress(assessmentId);
  progress.activeSession = session;
  delete progress.activeSessionClearedAt;
  saveProgress(progress);
  return progress;
}

export function clearActiveQuizSession(assessmentId: string): AssessmentProgress {
  const progress = getProgress(assessmentId);
  delete progress.activeSession;
  progress.activeSessionClearedAt = new Date().toISOString();
  saveProgress(progress);
  return progress;
}

export function getLatestActiveSession(): ActiveQuizSession | null {
  return Object.values(readAll())
    .map((progress) => progress.activeSession)
    .filter((session): session is ActiveQuizSession => !!session)
    .sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime())[0] || null;
}

export function reviewQuestionIds(assessment: Assessment): string[] {
  const progress = getProgress(assessment.id);
  const now = Date.now();

  return assessment.questions
    .filter((question) => {
      const stat = progress.questionStats[question.id];
      if (!stat) return false;
      const old = stat.lastAnsweredAt
        ? now - new Date(stat.lastAnsweredAt).getTime() > 1000 * 60 * 60 * 24 * 10
        : false;
      return stat.markedForReview || stat.priority === "high" || stat.lastCorrect === false || stat.wrong >= 2 || old;
    })
    .sort((a, b) => {
      const left = progress.questionStats[a.id];
      const right = progress.questionStats[b.id];
      return Number(right?.priority === "high") - Number(left?.priority === "high")
        || (right?.wrong || 0) - (left?.wrong || 0);
    })
    .map((question) => question.id);
}

export function countReviewQuestions(
  questionIds: string[],
  progress?: AssessmentProgress
): number {
  if (!progress) return 0;
  const now = Date.now();

  return questionIds.filter((questionId) => {
    const stat = progress.questionStats[questionId];
    if (!stat) return false;
    const old = stat.lastAnsweredAt
      ? now - new Date(stat.lastAnsweredAt).getTime() > 1000 * 60 * 60 * 24 * 10
      : false;
    return stat.markedForReview
      || stat.priority === "high"
      || stat.lastCorrect === false
      || stat.wrong >= 2
      || old;
  }).length;
}

function cloneProgress<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureStorageListener(): void {
  if (storageListenerReady || typeof window === "undefined") return;
  storageListenerReady = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    memoryProgress = null;
    window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT));
  });
}
