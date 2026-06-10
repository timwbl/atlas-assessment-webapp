"use client";

import type { Assessment, QuestionReviewStatus } from "./types";

const STORAGE_KEY = "atlas:admin:question-quality-reviews:v1";
export const ADMIN_QUESTION_TARGET_KEY = "atlas:admin:question-target";

export type StoredQuestionQualityReview = {
  reviewStatus: QuestionReviewStatus;
  reviewedFlags: string[];
  updatedAt: string;
};

type ReviewMap = Record<string, StoredQuestionQualityReview>;

export function qualityReviewKey(assessmentId: string, questionId: string): string {
  return `${assessmentId}:${questionId}`;
}

export function loadQuestionQualityReviews(): ReviewMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as ReviewMap;
  } catch {
    return {};
  }
}

export function saveQuestionQualityReview(
  assessmentId: string,
  questionId: string,
  review: Pick<StoredQuestionQualityReview, "reviewStatus" | "reviewedFlags">
): StoredQuestionQualityReview {
  const all = loadQuestionQualityReviews();
  const saved = { ...review, updatedAt: new Date().toISOString() };
  all[qualityReviewKey(assessmentId, questionId)] = saved;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return saved;
}

export function setAdminQuestionTarget(assessmentId: string, questionId: string): void {
  window.sessionStorage.setItem(ADMIN_QUESTION_TARGET_KEY, JSON.stringify({ assessmentId, questionId }));
}

export function consumeAdminQuestionTarget(): { assessmentId: string; questionId: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(ADMIN_QUESTION_TARGET_KEY);
  window.sessionStorage.removeItem(ADMIN_QUESTION_TARGET_KEY);
  try {
    const value = JSON.parse(raw || "null") as { assessmentId?: string; questionId?: string } | null;
    return value?.assessmentId && value.questionId
      ? { assessmentId: value.assessmentId, questionId: value.questionId }
      : null;
  } catch {
    return null;
  }
}

export function applyStoredQuestionQualityReviews(assessment: Assessment): Assessment {
  const reviews = loadQuestionQualityReviews();
  return {
    ...assessment,
    questions: assessment.questions.map((question) => {
      const review = reviews[qualityReviewKey(assessment.id, question.id)];
      if (!review) return question;
      return {
        ...question,
        reviewStatus: review.reviewStatus,
        reviewedQualityFlags: review.reviewedFlags
      };
    })
  };
}
