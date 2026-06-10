import type {
  Assessment,
  LoadedAssessment,
  LoadedAssessmentSummary
} from "./types";

const DB_NAME = "atlas-assessment-cache";
const DB_VERSION = 2;
const STORE_NAME = "assessmentSets";
const FULL_LIST_KEY = "full-list";
const SUMMARY_LIST_KEY = "summary-list";

export async function readCachedAssessments(): Promise<LoadedAssessment[]> {
  return readCacheEntry<LoadedAssessment[]>(FULL_LIST_KEY, []);
}

export async function readCachedAssessmentSummaries(): Promise<LoadedAssessmentSummary[]> {
  return readCacheEntry<LoadedAssessmentSummary[]>(SUMMARY_LIST_KEY, []);
}

export async function readCachedAssessment(id: string): Promise<Assessment | null> {
  return readCacheEntry<Assessment | null>(assessmentKey(id), null);
}

export async function writeCachedAssessments(assessments: LoadedAssessment[]): Promise<void> {
  await writeCacheEntry(FULL_LIST_KEY, assessments);
  await Promise.all(
    assessments
      .map((item) => item.assessment)
      .filter((assessment): assessment is Assessment => !!assessment)
      .map((assessment) => writeCachedAssessment(assessment))
  );
}

export async function writeCachedAssessmentSummaries(assessments: LoadedAssessmentSummary[]): Promise<void> {
  await writeCacheEntry(SUMMARY_LIST_KEY, assessments);
}

export async function writeCachedAssessment(assessment: Assessment): Promise<void> {
  await writeCacheEntry(assessmentKey(assessment.id), assessment);
}

async function readCacheEntry<T>(id: string, fallback: T): Promise<T> {
  if (typeof indexedDB === "undefined") return fallback;

  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result?.value as T | undefined) ?? fallback);
      request.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

async function writeCacheEntry(id: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({
        id,
        value,
        cachedAt: new Date().toISOString()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Offline caching is opportunistic and must never block learning.
  }
}

function assessmentKey(id: string): string {
  return `assessment:${id}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
