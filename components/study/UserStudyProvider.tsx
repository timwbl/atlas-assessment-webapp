"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  defaultStudySettings,
  normalizeStudySettings,
  semesterPeriod,
  settingsForSemester,
  type StudySemester,
  type UserStudySettings
} from "@/lib/studyProgram";
import {
  getCurrentUser,
  updateCurrentUserStudySettings
} from "@/lib/cloudProgress";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import {
  COMPANION_ENABLED_KEY,
  saveCompanionPreference
} from "../companion/companionStorage";

const SETTINGS_KEY = "atlas:user-study-settings:v1";
const ONBOARDING_DISMISSED_KEY = "atlas:user-study-onboarding-dismissed:v1";
const SEMESTER_PROMPT_KEY = "atlas:semester-prompt:v1";

type SemesterPromptState = {
  lastSemesterPromptShown?: string;
  lastConfirmedSemester?: StudySemester;
};

type StudyContextValue = {
  settings: UserStudySettings;
  hydrated: boolean;
  onboardingOpen: boolean;
  profileEditorOpen: boolean;
  semesterPromptOpen: boolean;
  suggestedSemester: StudySemester | null;
  authenticated: boolean;
  updateSettings: (next: UserStudySettings) => void;
  selectSemester: (semester: StudySemester) => void;
  setProfileEditorOpen: (open: boolean) => void;
  dismissOnboarding: () => void;
  keepCurrentSemester: () => void;
};

const UserStudyContext = createContext<StudyContextValue | null>(null);

export function UserStudyProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(() => defaultStudySettings(false));
  const [hydrated, setHydrated] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [semesterPromptOpen, setSemesterPromptOpen] = useState(false);
  const [suggestedSemester, setSuggestedSemester] = useState<StudySemester | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const loadGeneration = useRef(0);

  const loadSettings = useCallback(async () => {
    const generation = loadGeneration.current + 1;
    loadGeneration.current = generation;
    setOnboardingOpen(false);
    setSemesterPromptOpen(false);
    setSuggestedSemester(null);

    const guestLocal = readLocalSettings();
    let next = guestLocal;
    let userId: string | null = null;
    try {
      const user = await getCurrentUser();
      userId = user?.id || null;
      if (user) {
        const accountLocal = readLocalSettings(user.id);
        const remote = normalizeStudySettings(
          user.user_metadata?.atlas_study_settings,
          accountLocal.ariEnabled
        );
        const hasRemoteSettings = isRecord(user.user_metadata?.atlas_study_settings);
        const hasAccountLocalSettings = localSettingsExist(user.id);
        if (hasRemoteSettings) {
          next = remote;
          saveLocalSettings(next, user.id);
        } else if (hasAccountLocalSettings) {
          next = accountLocal;
          void updateCurrentUserStudySettings(accountLocal).catch(() => undefined);
        } else {
          next = defaultStudySettings(false);
        }
      }
    } catch {
      // Local settings remain authoritative while offline.
    }

    if (generation !== loadGeneration.current) return;
    setSettings(next);
    setAuthenticated(!!userId);
    setCurrentUserId(userId);
    setHydrated(true);

    // Guests can configure their profile manually, but never receive recurring
    // automatic profile or semester prompts.
    if (!userId) return;

    if (!next.studyYear && !readBoolean(onboardingDismissedKey(userId))) {
      setOnboardingOpen(true);
      return;
    }
    evaluateSemesterPrompt(next, userId, setSuggestedSemester, setSemesterPromptOpen);
  }, []);

  useEffect(() => {
    void loadSettings();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, loadSettings);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, loadSettings);
  }, [loadSettings]);

  const updateSettings = useCallback((nextValue: UserStudySettings) => {
    const next = normalizeStudySettings(nextValue, false);
    setSettings(next);
    saveLocalSettings(next, currentUserId);
    saveCompanionPreference(COMPANION_ENABLED_KEY, next.ariEnabled);
    if (next.studyYear) {
      if (currentUserId) safeRemove(onboardingDismissedKey(currentUserId));
      setOnboardingOpen(false);
    }
    const period = semesterPeriod();
    if (currentUserId && period && next.semester === period.semester) {
      saveSemesterPrompt(currentUserId, {
        lastSemesterPromptShown: period.id,
        lastConfirmedSemester: next.semester
      });
      setSemesterPromptOpen(false);
    }
    void updateCurrentUserStudySettings(next).catch(() => undefined);
  }, [currentUserId]);

  const selectSemester = useCallback((semester: StudySemester) => {
    updateSettings(settingsForSemester(settings, semester));
    const period = semesterPeriod();
    if (currentUserId && period) {
      saveSemesterPrompt(currentUserId, {
        lastSemesterPromptShown: period.id,
        lastConfirmedSemester: semester
      });
    }
    setSemesterPromptOpen(false);
  }, [currentUserId, settings, updateSettings]);

  const dismissOnboarding = useCallback(() => {
    if (currentUserId) safeSet(onboardingDismissedKey(currentUserId), "true");
    setOnboardingOpen(false);
  }, [currentUserId]);

  const keepCurrentSemester = useCallback(() => {
    const period = semesterPeriod();
    if (currentUserId && period) {
      saveSemesterPrompt(currentUserId, {
        lastSemesterPromptShown: period.id,
        lastConfirmedSemester: settings.semester || undefined
      });
    }
    setSemesterPromptOpen(false);
  }, [currentUserId, settings.semester]);

  const value = useMemo<StudyContextValue>(() => ({
    settings,
    hydrated,
    onboardingOpen,
    profileEditorOpen,
    semesterPromptOpen,
    suggestedSemester,
    authenticated,
    updateSettings,
    selectSemester,
    setProfileEditorOpen,
    dismissOnboarding,
    keepCurrentSemester
  }), [
    dismissOnboarding,
    authenticated,
    hydrated,
    keepCurrentSemester,
    onboardingOpen,
    profileEditorOpen,
    selectSemester,
    semesterPromptOpen,
    settings,
    suggestedSemester,
    updateSettings
  ]);

  return <UserStudyContext.Provider value={value}>{children}</UserStudyContext.Provider>;
}

export function useUserStudyContext(): StudyContextValue {
  const context = useContext(UserStudyContext);
  if (!context) throw new Error("useUserStudyContext muss innerhalb des UserStudyProvider verwendet werden.");
  return context;
}

function readLocalSettings(userId: string | null = null): UserStudySettings {
  if (typeof window === "undefined") return defaultStudySettings(false);
  try {
    const explicitAri = window.localStorage.getItem(COMPANION_ENABLED_KEY);
    const ariFallback = explicitAri === "true";
    return normalizeStudySettings(
      JSON.parse(window.localStorage.getItem(settingsKey(userId)) || "null"),
      ariFallback
    );
  } catch {
    return defaultStudySettings(false);
  }
}

function saveLocalSettings(settings: UserStudySettings, userId: string | null = null): void {
  try {
    window.localStorage.setItem(settingsKey(userId), JSON.stringify(settings));
  } catch {
    // Settings remain available in memory.
  }
}

function settingsKey(userId: string | null): string {
  return userId ? `${SETTINGS_KEY}:${userId}` : SETTINGS_KEY;
}

function localSettingsExist(userId: string): boolean {
  try {
    return window.localStorage.getItem(settingsKey(userId)) !== null;
  } catch {
    return false;
  }
}

function evaluateSemesterPrompt(
  settings: UserStudySettings,
  userId: string,
  setSuggested: (semester: StudySemester | null) => void,
  setOpen: (open: boolean) => void
): void {
  if (settings.studyYear !== "year1" || !settings.semester) return;
  const period = semesterPeriod();
  if (!period || period.semester === settings.semester) return;
  const prompt = readSemesterPrompt(userId);
  if (prompt.lastSemesterPromptShown === period.id) return;
  setSuggested(period.semester);
  setOpen(true);
}

function readSemesterPrompt(userId: string): SemesterPromptState {
  try {
    return JSON.parse(window.localStorage.getItem(semesterPromptKey(userId)) || "{}") as SemesterPromptState;
  } catch {
    return {};
  }
}

function saveSemesterPrompt(userId: string, value: SemesterPromptState): void {
  safeSet(semesterPromptKey(userId), JSON.stringify(value));
}

function onboardingDismissedKey(userId: string): string {
  return `${ONBOARDING_DISMISSED_KEY}:${userId}`;
}

function semesterPromptKey(userId: string): string {
  return `${SEMESTER_PROMPT_KEY}:${userId}`;
}

function readBoolean(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Profile settings remain usable in memory when storage is unavailable.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Profile settings remain usable in memory when storage is unavailable.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
