import type { LoadedAssessment } from "./types";

const DB_NAME = "atlas-assessment-cache";
const DB_VERSION = 1;
const STORE_NAME = "assessmentSets";
const ACTIVE_KEY = "active";

export async function readCachedAssessments(): Promise<LoadedAssessment[]> {
  if (typeof indexedDB === "undefined") return [];

  try {
    const db = await openDatabase();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(ACTIVE_KEY);
      request.onsuccess = () => {
        const value = request.result as { assessments?: LoadedAssessment[] } | undefined;
        resolve(Array.isArray(value?.assessments) ? value.assessments : []);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function writeCachedAssessments(assessments: LoadedAssessment[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({
        id: ACTIVE_KEY,
        assessments,
        cachedAt: new Date().toISOString()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Caching remains optional when storage is unavailable or full.
  }
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
