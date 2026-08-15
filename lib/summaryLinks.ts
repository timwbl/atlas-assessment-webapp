"use client";

import type { Assessment } from "./types";
import {
  DOWNLOAD_SEMESTERS,
  getSummaryBlock,
  isAltfragenDocument,
  loadSummaryDownloads,
  type SummaryDownload
} from "./summaryDownloads";
import { isSupabaseConfigured, restRequest } from "./supabaseClient";

export type SummaryLink = {
  id: string;
  assessmentId: string;
  lectureCode: string;
  assessmentTitle: string;
  summaryId: string;
  blockId: string;
  pageStart?: number;
  pageEnd?: number;
  sectionTitle?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedSummaryLink = {
  summary: SummaryDownload;
  link?: SummaryLink;
  exact: boolean;
  pageStart?: number;
  pageEnd?: number;
  sectionTitle?: string;
  source: "manual" | "block";
};

type SummaryLinkRow = {
  id: string;
  assessment_id: string;
  lecture_code: string;
  assessment_title: string;
  summary_id: string;
  block_id: string;
  page_start?: number | null;
  page_end?: number | null;
  section_title?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

const STORAGE_KEY = "atlas-summary-links-v1";

export function summaryLinkId(assessment: Assessment): string {
  return assessment.id;
}

export async function resolveSummaryLink(assessment: Assessment): Promise<ResolvedSummaryLink | null> {
  const [downloads, links] = await Promise.all([
    loadSummaryDownloads(),
    loadSummaryLinks()
  ]);
  const usableDownloads = downloads.filter((download) => !isAltfragenDocument(download));
  const manual = findManualLink(assessment, links);
  const manualSummary = manual
    ? usableDownloads.find((download) => download.id === manual.summaryId)
      || usableDownloads.find((download) => download.blockId === manual.blockId)
    : null;

  if (manual && manualSummary) {
    return {
      summary: manualSummary,
      link: manual,
      exact: !!manual.pageStart,
      pageStart: manual.pageStart,
      pageEnd: manual.pageEnd,
      sectionTitle: manual.sectionTitle,
      source: "manual"
    };
  }

  const fallback = findBestSummaryForAssessment(assessment, usableDownloads);
  if (!fallback) return null;
  return {
    summary: fallback,
    exact: false,
    source: "block"
  };
}

export async function loadSummaryLinks(): Promise<SummaryLink[]> {
  const localLinks = readLocalLinks();
  if (!isSupabaseConfigured()) return localLinks;

  try {
    const rows = await restRequest<SummaryLinkRow[]>(
      "summary_links?select=*&order=updated_at.desc"
    );
    return mergeLinks(rows.map(fromRow), localLinks);
  } catch {
    return localLinks;
  }
}

export async function saveSummaryLink(link: SummaryLink): Promise<SummaryLink> {
  const now = new Date().toISOString();
  const normalized: SummaryLink = {
    ...link,
    pageStart: normalizePage(link.pageStart),
    pageEnd: normalizePage(link.pageEnd),
    sectionTitle: link.sectionTitle?.trim() || undefined,
    note: link.note?.trim() || undefined,
    createdAt: link.createdAt || now,
    updatedAt: now
  };

  if (isSupabaseConfigured()) {
    try {
      const rows = await restRequest<SummaryLinkRow[]>("summary_links?on_conflict=id&select=*", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(toRow(normalized))
      });
      const saved = rows[0] ? fromRow(rows[0]) : normalized;
      upsertLocalLink(saved);
      notifySummaryLinksChanged();
      return saved;
    } catch {
      // Local fallback keeps the link usable while the shared Supabase table or admin policy is not ready.
    }
  }

  upsertLocalLink(normalized);
  notifySummaryLinksChanged();
  return normalized;
}

export function createDraftSummaryLink(assessment: Assessment, summary: SummaryDownload, existing?: SummaryLink): SummaryLink {
  const now = new Date().toISOString();
  return {
    id: existing?.id || summaryLinkId(assessment),
    assessmentId: assessment.id,
    lectureCode: assessment.lectureCode,
    assessmentTitle: assessment.title,
    summaryId: summary.id,
    blockId: summary.blockId,
    pageStart: existing?.pageStart,
    pageEnd: existing?.pageEnd,
    sectionTitle: existing?.sectionTitle || assessment.title,
    note: existing?.note,
    createdAt: existing?.createdAt || now,
    updatedAt: existing?.updatedAt || now
  };
}

export function pageRangeLabel(link: Pick<ResolvedSummaryLink, "pageStart" | "pageEnd">): string {
  if (!link.pageStart) return "Block-Zusammenfassung";
  if (link.pageEnd && link.pageEnd > link.pageStart) return `S. ${link.pageStart}-${link.pageEnd}`;
  return `S. ${link.pageStart}`;
}

export function summaryLinkLabel(resolved: ResolvedSummaryLink): string {
  return resolved.exact ? `Zusammenfassung ${pageRangeLabel(resolved)}` : "Zusammenfassung";
}

export function findCandidateSummaries(assessment: Assessment, downloads: SummaryDownload[]): SummaryDownload[] {
  const candidates = candidateBlockIds(assessment);
  const scored = downloads
    .filter((download) => !isAltfragenDocument(download))
    .map((download) => ({ download, score: scoreSummaryCandidate(download, assessment, candidates) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.download.uploadDate.localeCompare(a.download.uploadDate));

  return scored.map((item) => item.download);
}

function findBestSummaryForAssessment(assessment: Assessment, downloads: SummaryDownload[]): SummaryDownload | null {
  return findCandidateSummaries(assessment, downloads)[0] || null;
}

function findManualLink(assessment: Assessment, links: SummaryLink[]): SummaryLink | null {
  return links.find((link) => link.assessmentId === assessment.id)
    || links.find((link) => (
      normalizeToken(link.lectureCode) === normalizeToken(assessment.lectureCode)
      && normalizeToken(link.assessmentTitle) === normalizeToken(assessment.title)
    ))
    || null;
}

function scoreSummaryCandidate(download: SummaryDownload, assessment: Assessment, blockIds: Set<string>): number {
  let score = 0;
  if (blockIds.has(download.blockId)) score += 80;
  const block = getSummaryBlock(download.blockId);
  const blockNumber = extractBlockNumber(assessment.block) || extractBlockNumber(assessment.id);
  if (blockNumber && extractBlockNumber(download.blockId) === blockNumber) score += 20;
  if (block?.subtitle && normalizeToken(assessment.sourceSummary).includes(normalizeToken(block.subtitle).slice(0, 16))) score += 6;
  if (normalizeToken(download.title).includes(normalizeToken(assessment.title).slice(0, 10))) score += 12;
  if (normalizeToken(download.description).includes(normalizeToken(assessment.lectureCode))) score += 16;
  return score;
}

function candidateBlockIds(assessment: Assessment): Set<string> {
  const ids = new Set<string>();
  const rawValues = [assessment.block, assessment.id, assessment.lectureCode, assessment.sourceSummary].map(String);
  const blockNumber = rawValues.map(extractBlockNumber).find(Boolean);
  if (blockNumber) {
    for (const semester of DOWNLOAD_SEMESTERS) {
      ids.add(`${semester.id}-block-${blockNumber}`);
    }
  }

  for (const value of rawValues) {
    const normalized = normalizeToken(value);
    for (const semester of DOWNLOAD_SEMESTERS) {
      if (normalized.includes(normalizeToken(semester.id))) {
        ids.add(`${semester.id}-block-${blockNumber || ""}`);
      }
    }
  }

  return ids;
}

function extractBlockNumber(value: unknown): number | null {
  const match = String(value || "").match(/(?:block|j2-block|alt-block)[\s_-]*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function normalizePage(value?: number): number | undefined {
  const next = Math.floor(Number(value) || 0);
  return next > 0 ? next : undefined;
}

function normalizeToken(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mergeLinks(remote: SummaryLink[], local: SummaryLink[]): SummaryLink[] {
  const merged = new Map(remote.map((link) => [link.id, link]));
  for (const link of local) merged.set(link.id, link);
  return [...merged.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function readLocalLinks(): SummaryLink[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as SummaryLink[];
    return Array.isArray(parsed) ? parsed.map(normalizeLink).filter(Boolean) as SummaryLink[] : [];
  } catch {
    return [];
  }
}

function writeLocalLinks(links: SummaryLink[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(links.map(normalizeLink).filter(Boolean)));
}

function upsertLocalLink(link: SummaryLink): void {
  const links = readLocalLinks();
  writeLocalLinks([link, ...links.filter((item) => item.id !== link.id)]);
}

function normalizeLink(value: SummaryLink): SummaryLink | null {
  if (!value?.id || !value.assessmentId || !value.summaryId) return null;
  const now = new Date().toISOString();
  return {
    ...value,
    pageStart: normalizePage(value.pageStart),
    pageEnd: normalizePage(value.pageEnd),
    createdAt: value.createdAt || now,
    updatedAt: value.updatedAt || now
  };
}

function fromRow(row: SummaryLinkRow): SummaryLink {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    lectureCode: row.lecture_code,
    assessmentTitle: row.assessment_title,
    summaryId: row.summary_id,
    blockId: row.block_id,
    pageStart: row.page_start || undefined,
    pageEnd: row.page_end || undefined,
    sectionTitle: row.section_title || undefined,
    note: row.note || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRow(link: SummaryLink): SummaryLinkRow {
  return {
    id: link.id,
    assessment_id: link.assessmentId,
    lecture_code: link.lectureCode,
    assessment_title: link.assessmentTitle,
    summary_id: link.summaryId,
    block_id: link.blockId,
    page_start: link.pageStart || null,
    page_end: link.pageEnd || null,
    section_title: link.sectionTitle || null,
    note: link.note || null,
    created_at: link.createdAt,
    updated_at: link.updatedAt
  };
}

function notifySummaryLinksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("atlas-summary-links-changed"));
}
