"use client";

import type {
  Assessment,
  AssessmentProgress,
  QuizAttempt,
  QuizResultRow,
  QuestionStat
} from "./types";

const STORAGE_KEY = "atlas-assessment-progress-v1";

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

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, AssessmentProgress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(value: Record<string, AssessmentProgress>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function getProgress(assessmentId: string): AssessmentProgress {
  return readAll()[assessmentId] || emptyProgress(assessmentId);
}

export function getAllProgress(): Record<string, AssessmentProgress> {
  return readAll();
}

export function saveProgress(progress: AssessmentProgress): void {
  const all = readAll();
  all[progress.assessmentId] = progress;
  writeAll(all);
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
