"use client";

import type { Assessment, LoadedAssessment } from "./types";
import { readCachedAssessments, writeCachedAssessments } from "./assessmentCache";

export async function loadAssessments(): Promise<LoadedAssessment[]> {
  try {
    const response = await fetch("/api/assessments", { cache: "no-store" });
    if (!response.ok) throw new Error("Assessments konnten nicht geladen werden.");
    const payload = await response.json() as { assessments?: LoadedAssessment[] };
    const assessments = payload.assessments || [];
    void writeCachedAssessments(assessments);
    return assessments;
  } catch (error) {
    const cached = await readCachedAssessments();
    if (cached.length) return cached;
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
  const assessments = await loadActiveAssessments();
  return assessments.find((assessment) => assessment.id === id) || null;
}
