"use client";

import { getCurrentProfile } from "./cloudProgress";
import {
  blocksForSemester,
  DOWNLOAD_SEMESTERS,
  semesterTitle,
  type SemesterId
} from "./summaryDownloads";
import { isSupabaseConfigured, restRequest } from "./supabaseClient";

export type BlockRecommendation = {
  id: string;
  semester: SemesterId;
  blockId: string;
  blockTitle: string;
  rating: number | null;
  comment: string;
  updatedAt: string;
};

type BlockRecommendationRow = {
  id: string;
  semester: SemesterId;
  block_id: string;
  block_title: string;
  rating: number | null;
  comment: string | null;
  updated_at: string;
};

export const BLOCK_RECOMMENDATIONS_CHANGED_EVENT = "atlas-block-recommendations-changed";

const STORAGE_KEY = "atlas-block-recommendations-v1";

export function recommendationId(semester: SemesterId, blockId: string): string {
  return `${semester}:${blockId}`;
}

export async function loadBlockRecommendations(): Promise<Record<string, BlockRecommendation>> {
  if (isSupabaseConfigured()) {
    try {
      const rows = await restRequest<BlockRecommendationRow[]>(
        "assessment_block_recommendations?select=id,semester,block_id,block_title,rating,comment,updated_at&order=semester.asc,block_id.asc"
      );
      return rows.reduce<Record<string, BlockRecommendation>>((acc, row) => {
        const item = fromRow(row);
        acc[item.id] = item;
        return acc;
      }, {});
    } catch {
      return readLocalRecommendations();
    }
  }

  return readLocalRecommendations();
}

export async function saveBlockRecommendation(recommendation: BlockRecommendation): Promise<BlockRecommendation> {
  const normalized = normalizeRecommendation(recommendation);

  if (isSupabaseConfigured()) {
    const profile = await getCurrentProfile().catch(() => null);
    if (profile?.role === "admin") {
      const rows = await restRequest<BlockRecommendationRow[]>("assessment_block_recommendations?on_conflict=id&select=*", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify([toRow(normalized)])
      });
      notifyRecommendationsChanged();
      return rows[0] ? fromRow(rows[0]) : normalized;
    }
  }

  const items = readLocalRecommendations();
  items[normalized.id] = normalized;
  writeLocalRecommendations(items);
  notifyRecommendationsChanged();
  return normalized;
}

export function emptyRecommendation(semester: SemesterId, blockId: string, blockTitle: string): BlockRecommendation {
  return {
    id: recommendationId(semester, blockId),
    semester,
    blockId,
    blockTitle,
    rating: null,
    comment: "",
    updatedAt: new Date().toISOString()
  };
}

export function blockRecommendationSummary(recommendation?: BlockRecommendation): string {
  if (!recommendation?.rating && !recommendation?.comment.trim()) {
    return "Noch keine Empfehlung";
  }

  const parts = [];
  if (recommendation.rating) parts.push(`${recommendation.rating}/10`);
  if (recommendation.comment.trim()) parts.push(recommendation.comment.trim());
  return parts.join(" · ");
}

export function allRecommendationBlocks() {
  return DOWNLOAD_SEMESTERS.flatMap((semester) => (
    blocksForSemester(semester.id).map((block) => ({
      semester: semester.id,
      semesterTitle: semesterTitle(semester.id),
      blockId: block.id,
      blockTitle: block.title
    }))
  ));
}

function readLocalRecommendations(): Record<string, BlockRecommendation> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, BlockRecommendation>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalRecommendations(items: Record<string, BlockRecommendation>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function notifyRecommendationsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BLOCK_RECOMMENDATIONS_CHANGED_EVENT));
}

function normalizeRecommendation(recommendation: BlockRecommendation): BlockRecommendation {
  const rating = recommendation.rating ? Math.round(Number(recommendation.rating)) : null;
  return {
    ...recommendation,
    rating: rating ? Math.max(1, Math.min(10, rating)) : null,
    comment: recommendation.comment.trim(),
    updatedAt: new Date().toISOString()
  };
}

function fromRow(row: BlockRecommendationRow): BlockRecommendation {
  return normalizeRecommendation({
    id: row.id,
    semester: row.semester,
    blockId: row.block_id,
    blockTitle: row.block_title,
    rating: row.rating,
    comment: row.comment || "",
    updatedAt: row.updated_at
  });
}

function toRow(recommendation: BlockRecommendation): BlockRecommendationRow {
  return {
    id: recommendation.id,
    semester: recommendation.semester,
    block_id: recommendation.blockId,
    block_title: recommendation.blockTitle,
    rating: recommendation.rating,
    comment: recommendation.comment || null,
    updated_at: recommendation.updatedAt
  };
}
