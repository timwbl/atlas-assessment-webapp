import type { CompanionPreferences } from "./companion.types";

export const COMPANION_ENABLED_KEY = "atlas:companion:enabled";
export const COMPANION_HIDE_EXAM_KEY = "atlas:companion:hide-in-exam-mode";
export const COMPANION_REDUCED_MOTION_KEY = "atlas:companion:reduced-motion";
export const COMPANION_LAST_SEEN_KEY = "atlas:companion:last-seen";

const INACTIVITY_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export function getDefaultCompanionPreferences(): CompanionPreferences {
  return {
    companionEnabled: true,
    hideInExamMode: true,
    reducedMotion: prefersReducedMotion()
  };
}

export function loadCompanionPreferences(): CompanionPreferences {
  const defaults = getDefaultCompanionPreferences();
  return {
    companionEnabled: readBoolean(COMPANION_ENABLED_KEY, defaults.companionEnabled),
    hideInExamMode: readBoolean(COMPANION_HIDE_EXAM_KEY, defaults.hideInExamMode),
    reducedMotion: readBoolean(COMPANION_REDUCED_MOTION_KEY, defaults.reducedMotion)
  };
}

export function saveCompanionPreference(
  key: typeof COMPANION_ENABLED_KEY | typeof COMPANION_HIDE_EXAM_KEY | typeof COMPANION_REDUCED_MOTION_KEY,
  value: boolean
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Companion preferences are optional and must never interrupt ATLAS.
  }
}

export function recordCompanionVisit(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  try {
    const previous = Number(window.localStorage.getItem(COMPANION_LAST_SEEN_KEY));
    window.localStorage.setItem(COMPANION_LAST_SEEN_KEY, String(now));
    return Number.isFinite(previous)
      && previous > 0
      && now - previous > INACTIVITY_THRESHOLD_MS;
  } catch {
    return false;
  }
}

function readBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
