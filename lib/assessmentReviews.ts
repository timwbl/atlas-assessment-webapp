"use client";

import { getCurrentProfile, type CloudProfile } from "./cloudProgress";
import { isSupabaseConfigured, restRequest } from "./supabaseClient";

export type AssessmentReview = {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  lectureCode: string;
  userId: string;
  userEmail: string;
  displayName: string;
  rating: number;
  comment: string;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
};

type AssessmentReviewRow = {
  id: string;
  assessment_id: string;
  assessment_title: string;
  lecture_code: string;
  user_id: string;
  user_email: string;
  display_name: string | null;
  rating: number;
  comment: string | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
};

export const ASSESSMENT_REVIEWS_CHANGED_EVENT = "atlas-assessment-reviews-changed";

export function reviewsAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function currentReviewProfile(): Promise<CloudProfile | null> {
  if (!isSupabaseConfigured()) return null;
  return getCurrentProfile().catch(() => null);
}

export async function submitAssessmentReview(input: {
  assessmentId: string;
  assessmentTitle: string;
  lectureCode: string;
  rating: number;
  comment: string;
}): Promise<AssessmentReview> {
  const profile = await currentReviewProfile();
  if (!profile) throw new Error("Bitte logge dich ein, um eine Bewertung abzugeben.");

  const now = new Date().toISOString();
  const review: AssessmentReview = {
    id: `${profile.id}:${input.assessmentId}`,
    assessmentId: input.assessmentId,
    assessmentTitle: input.assessmentTitle,
    lectureCode: input.lectureCode,
    userId: profile.id,
    userEmail: profile.email,
    displayName: profile.display_name || "",
    rating: Math.max(1, Math.min(5, Math.round(input.rating))),
    comment: input.comment.trim(),
    approved: false,
    createdAt: now,
    updatedAt: now
  };

  const rows = await restRequest<AssessmentReviewRow[]>("assessment_reviews?on_conflict=user_id,assessment_id&select=*", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([toRow(review)])
  });

  notifyReviewsChanged();
  return rows[0] ? fromRow(rows[0]) : review;
}

export async function loadApprovedAssessmentReviews(assessmentId: string): Promise<AssessmentReview[]> {
  if (!isSupabaseConfigured()) return [];

  const rows = await restRequest<AssessmentReviewRow[]>(
    `assessment_reviews?select=*&assessment_id=eq.${encodeURIComponent(assessmentId)}&approved=eq.true&order=updated_at.desc`
  ).catch(() => []);
  return rows.map(fromRow);
}

export async function loadAdminAssessmentReviews(): Promise<AssessmentReview[]> {
  if (!isSupabaseConfigured()) return [];

  const rows = await restRequest<AssessmentReviewRow[]>(
    "assessment_reviews?select=*&order=updated_at.desc"
  );
  return rows.map(fromRow);
}

export async function setAssessmentReviewApproved(id: string, approved: boolean): Promise<void> {
  await restRequest(`assessment_reviews?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ approved, updated_at: new Date().toISOString() })
  });
  notifyReviewsChanged();
}

export async function deleteAssessmentReview(id: string): Promise<void> {
  await restRequest(`assessment_reviews?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  notifyReviewsChanged();
}

export function averageReviewRating(reviews: AssessmentReview[]): number | null {
  if (!reviews.length) return null;
  return Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10;
}

function notifyReviewsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ASSESSMENT_REVIEWS_CHANGED_EVENT));
}

function fromRow(row: AssessmentReviewRow): AssessmentReview {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    assessmentTitle: row.assessment_title,
    lectureCode: row.lecture_code,
    userId: row.user_id,
    userEmail: row.user_email,
    displayName: row.display_name || "",
    rating: row.rating,
    comment: row.comment || "",
    approved: row.approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRow(review: AssessmentReview): AssessmentReviewRow {
  return {
    id: review.id,
    assessment_id: review.assessmentId,
    assessment_title: review.assessmentTitle,
    lecture_code: review.lectureCode,
    user_id: review.userId,
    user_email: review.userEmail,
    display_name: review.displayName || null,
    rating: review.rating,
    comment: review.comment || null,
    approved: false,
    created_at: review.createdAt,
    updated_at: review.updatedAt
  };
}
