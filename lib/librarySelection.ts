"use client";

import {
  blocksForSemester,
  DOWNLOAD_SEMESTERS,
  type SemesterId
} from "./summaryDownloads";
import type { Assessment } from "./types";

const STORAGE_KEY = "atlas-assessment-library-selection-v1";

export type AssessmentLibrarySelection = {
  semester: SemesterId;
  blockId: string;
  updatedAt: string;
};

export function loadAssessmentLibrarySelection(): AssessmentLibrarySelection | null {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Partial<AssessmentLibrarySelection> | null;
    if (!parsed?.semester || !parsed.blockId) return null;
    const blockExists = blocksForSemester(parsed.semester).some((block) => block.id === parsed.blockId);
    if (!blockExists) return null;
    return {
      semester: parsed.semester,
      blockId: parsed.blockId,
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function saveAssessmentLibrarySelection(semester: SemesterId, blockId: string): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    semester,
    blockId,
    updatedAt: new Date().toISOString()
  }));
}

export function clearAssessmentLibrarySelection(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function rememberAssessmentLibrarySelectionFromAssessment(assessment: Assessment): void {
  const match = findAssessmentLibraryBlock(assessment.block);
  if (match) saveAssessmentLibrarySelection(match.semester, match.blockId);
}

function findAssessmentLibraryBlock(assessmentBlock: string): { semester: SemesterId; blockId: string } | null {
  for (const semester of DOWNLOAD_SEMESTERS) {
    const block = blocksForSemester(semester.id).find((item) => blockMatches(assessmentBlock, item.title, item.matchTerms || []));
    if (block) return { semester: semester.id, blockId: block.id };
  }
  return null;
}

function blockMatches(assessmentBlock: string, selectedBlockTitle: string, matchTerms: string[]): boolean {
  const normalizedAssessment = normalizeText(assessmentBlock);
  const normalizedSelected = normalizeText(selectedBlockTitle);
  const normalizedTerms = matchTerms.map(normalizeText);

  if (
    normalizedAssessment === normalizedSelected
    || normalizedTerms.some((term) => term && normalizedAssessment.includes(term))
  ) {
    return true;
  }

  const assessmentNumber = String(assessmentBlock || "").match(/\d+/)?.[0] || "";
  const selectedNumber = selectedBlockTitle.match(/\d+/)?.[0] || "";
  return !!assessmentNumber && assessmentNumber === selectedNumber;
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
