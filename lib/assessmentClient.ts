"use client";

import type {
  Assessment,
  LoadedAssessment,
  LoadedAssessmentSummary
} from "./types";
import {
  readCachedAssessment,
  readCachedAssessments,
  readCachedAssessmentSummaries,
  writeCachedAssessment,
  writeCachedAssessments,
  writeCachedAssessmentSummaries
} from "./assessmentCache";

let fullListRequest: Promise<LoadedAssessment[]> | null = null;
let summaryListRequest: Promise<LoadedAssessmentSummary[]> | null = null;
const assessmentRequests = new Map<string, Promise<Assessment | null>>();

export async function loadAssessments(): Promise<LoadedAssessment[]> {
  fullListRequest ||= requestAssessmentList();
  return fullListRequest;
}

async function requestAssessmentList(): Promise<LoadedAssessment[]> {
  try {
    const response = await fetch("/api/assessments");
    if (!response.ok) throw new Error("Assessments konnten nicht geladen werden.");
    const payload = await response.json() as { assessments?: LoadedAssessment[] };
    const assessments = payload.assessments || [];
    void writeCachedAssessments(assessments);
    return assessments;
  } catch (error) {
    const cached = await readCachedAssessments();
    if (cached.length) return cached;
    fullListRequest = null;
    throw error;
  }
}

export async function loadAssessmentSummaries(): Promise<LoadedAssessmentSummary[]> {
  summaryListRequest ||= requestAssessmentSummaries();
  return summaryListRequest;
}

async function requestAssessmentSummaries(): Promise<LoadedAssessmentSummary[]> {
  const cached = await readCachedAssessmentSummaries();

  try {
    const response = await fetch("/api/assessments?summary=1");
    if (!response.ok) throw new Error("Assessment-Katalog konnte nicht geladen werden.");
    const payload = await response.json() as { assessments?: LoadedAssessmentSummary[] };
    const assessments = payload.assessments || [];
    void writeCachedAssessmentSummaries(assessments);
    return assessments;
  } catch (error) {
    if (cached.length) return cached;
    summaryListRequest = null;
    throw error;
  }
}

export async function loadActiveAssessments(): Promise<Assessment[]> {
  const loaded = await loadAssessments();
  return loaded
    .map((item) => item.assessment)
    .filter(Boolean) as Assessment[];
}

export async function loadAssessmentById(id: string): Promise<Assessment | null> {
  const existing = assessmentRequests.get(id);
  if (existing) return existing;

  const request = requestAssessmentById(id);
  assessmentRequests.set(id, request);
  try {
    return await request;
  } finally {
    assessmentRequests.delete(id);
  }
}

async function requestAssessmentById(id: string): Promise<Assessment | null> {
  const cached = await readCachedAssessment(id);

  try {
    const response = await fetch(`/api/assessments/${encodeURIComponent(id)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("Assessment konnte nicht geladen werden.");
    const payload = await response.json() as { assessment?: Assessment };
    const assessment = payload.assessment || null;
    if (assessment) void writeCachedAssessment(assessment);
    return assessment;
  } catch (error) {
    if (cached) return cached;

    const legacyCache = await readCachedAssessments();
    const legacyAssessment = legacyCache
      .map((item) => item.assessment)
      .find((assessment) => assessment?.id === id) || null;
    if (legacyAssessment) return legacyAssessment;
    throw error;
  }
}
