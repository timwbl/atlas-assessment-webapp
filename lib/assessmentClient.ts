"use client";

import type {
  Assessment,
  LoadedAssessment,
  LoadedAssessmentSummary
} from "./types";
import { validateAssessment } from "./assessmentValidator";
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

export type ActiveAssessmentLoadResult = {
  assessments: Assessment[];
  skipped: Array<{ file: string; errors: string[] }>;
};

export async function loadAssessments(): Promise<LoadedAssessment[]> {
  fullListRequest ||= requestAssessmentList();
  return fullListRequest;
}

async function requestAssessmentList(): Promise<LoadedAssessment[]> {
  try {
    const response = await fetch("/api/assessments/full", {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) throw new Error("Assessments konnten nicht geladen werden.");
    const payload = await response.json() as { assessments?: unknown };
    const assessments = normalizeLoadedAssessments(payload.assessments);
    if (
      Array.isArray(payload.assessments)
      && payload.assessments.length
      && !assessments.some((item) => item.assessment)
    ) {
      throw new Error("Der Assessment-Katalog enthielt keine vollständigen Fragedaten.");
    }
    void writeCachedAssessments(assessments);
    return assessments;
  } catch (error) {
    const cached = normalizeLoadedAssessments(await readCachedAssessments());
    if (cached.some((item) => item.assessment)) return cached;

    const recovered = await recoverAssessmentListFromDetails();
    if (recovered.some((item) => item.assessment)) {
      void writeCachedAssessments(recovered);
      return recovered;
    }

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
  return (await loadActiveAssessmentsWithDiagnostics()).assessments;
}

export async function loadActiveAssessmentsWithDiagnostics(): Promise<ActiveAssessmentLoadResult> {
  const loaded = await loadAssessments();
  return {
    assessments: loaded
      .map((item) => item.assessment)
      .filter((assessment): assessment is Assessment => !!assessment),
    skipped: loaded
      .filter((item) => !item.assessment && item.errors.length > 0)
      .map((item) => ({ file: item.file, errors: item.errors }))
  };
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
    const payload = await response.json() as { assessment?: unknown };
    const result = validateAssessment(payload.assessment);
    const assessment = result.ok ? result.value : null;
    if (!assessment) {
      throw new Error("Assessment-Daten sind unvollständig oder beschädigt.");
    }
    if (assessment) void writeCachedAssessment(assessment);
    return assessment;
  } catch (error) {
    if (cached) {
      const cachedResult = validateAssessment(cached);
      if (cachedResult.ok) return cachedResult.value;
    }

    const legacyCache = normalizeLoadedAssessments(await readCachedAssessments());
    const legacyAssessment = legacyCache
      .map((item) => item.assessment)
      .find((assessment) => assessment?.id === id) || null;
    if (legacyAssessment) return legacyAssessment;
    throw error;
  }
}

function normalizeLoadedAssessments(value: unknown): LoadedAssessment[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index): LoadedAssessment => {
    const record = isRecord(item) ? item : {};
    const file = typeof record.file === "string" && record.file.trim()
      ? record.file
      : `assessment-${index + 1}.json`;
    const rawAssessment = "assessment" in record ? record.assessment : item;

    if (rawAssessment === null) {
      return {
        file,
        assessment: null,
        errors: stringList(record.errors),
        warnings: stringList(record.warnings)
      };
    }

    const result = validateAssessment(rawAssessment);
    if (!result.ok) {
      return {
        file,
        assessment: null,
        errors: result.errors.length
          ? result.errors
          : ["Assessment-Daten sind unvollständig."],
        warnings: []
      };
    }

    return {
      file,
      assessment: result.value.active === false ? null : result.value,
      errors: result.value.active === false ? ["Assessment ist deaktiviert."] : [],
      warnings: [
        ...stringList(record.warnings),
        ...result.warnings
      ]
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function recoverAssessmentListFromDetails(): Promise<LoadedAssessment[]> {
  try {
    const summaries = await requestAssessmentSummaries();
    const active = summaries.filter((item) => item.assessment?.active !== false && item.assessment?.id);
    const recovered: LoadedAssessment[] = [];

    for (let index = 0; index < active.length; index += 8) {
      const batch = active.slice(index, index + 8);
      const results = await Promise.all(batch.map(async (item): Promise<LoadedAssessment> => {
        try {
          const id = item.assessment?.id || "";
          const response = await fetch(`/api/assessments/${encodeURIComponent(id)}`, {
            cache: "no-store",
            headers: {
              Accept: "application/json"
            }
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json() as { assessment?: unknown };
          const result = validateAssessment(payload.assessment);
          if (!result.ok) {
            return { file: item.file, assessment: null, errors: result.errors, warnings: [] };
          }
          return {
            file: item.file,
            assessment: result.value,
            errors: [],
            warnings: result.warnings
          };
        } catch (detailError) {
          return {
            file: item.file,
            assessment: null,
            errors: [
              detailError instanceof Error
                ? detailError.message
                : "Assessment konnte nicht einzeln wiederhergestellt werden."
            ],
            warnings: []
          };
        }
      }));
      recovered.push(...results);
    }

    return recovered;
  } catch {
    return [];
  }
}
