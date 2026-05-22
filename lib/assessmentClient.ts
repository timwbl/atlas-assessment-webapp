"use client";

import type { Assessment, LoadedAssessment } from "./types";

export async function loadAssessments(): Promise<LoadedAssessment[]> {
  const response = await fetch("/api/assessments", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Assessments konnten nicht geladen werden.");
  }

  const payload = await response.json() as { assessments?: LoadedAssessment[] };
  return payload.assessments || [];
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
