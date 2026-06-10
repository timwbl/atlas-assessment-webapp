"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { COMPANION_ENABLED_KEY } from "../companion/companionStorage";

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

  const loadSettings = useCallback(async () => {
    const local = readLocalSettings();
    let next = local;
    try {
      const user = await getCurrentUser();
      const remote = normalizeStudySettings(user?.user_metadata?.atlas_study_settings, local.ariEnabled);
      const remoteConfigured = !!remote.studyYear || !!remote.semester;
      if (user && remoteConfigured) {
        next = remote;
        saveLocalSettings(next);
      } else if (user && (!!local.studyYear || !!local.semester)) {
        void updateCurrentUserStudySettings(local).catch(() => undefined);
      }
    } catch {
      // Local settings remain authoritative while offline.
    }

    setSettings(next);
    setHydrated(true);
    if (!next.studyYear && !readBoolean(ONBOARDING_DISMISSED_KEY)) {
      setOnboardingOpen(true);
      return;
    }
    evaluateSemesterPrompt(next, setSuggestedSemester, setSemesterPromptOpen);
  }, []);

  useEffect(() => {
    void loadSettings();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, loadSettings);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, loadSettings);
  }, [loadSettings]);

  const updateSettings = useCallback((nextValue: UserStudySettings) => {
    const next = normalizeStudySettings(nextValue, false);
    setSettings(next);
    saveLocalSettings(next);
    if (next.studyYear) {
      safeRemove(ONBOARDING_DISMISSED_KEY);
      setOnboardingOpen(false);
    }
    const period = semesterPeriod();
    if (period && next.semester === period.semester) {
      saveSemesterPrompt({ lastSemesterPromptShown: period.id, lastConfirmedSemester: next.semester });
      setSemesterPromptOpen(false);
    }
    void updateCurrentUserStudySettings(next).catch(() => undefined);
  }, []);

  const selectSemester = useCallback((semester: StudySemester) => {
    updateSettings(settingsForSemester(settings, semester));
    const period = semesterPeriod();
    if (period) saveSemesterPrompt({ lastSemesterPromptShown: period.id, lastConfirmedSemester: semester });
    setSemesterPromptOpen(false);
  }, [settings, updateSettings]);

  const dismissOnboarding = useCallback(() => {
    safeSet(ONBOARDING_DISMISSED_KEY, "true");
    setOnboardingOpen(false);
  }, []);

  const keepCurrentSemester = useCallback(() => {
    const period = semesterPeriod();
    if (period) {
      saveSemesterPrompt({
        lastSemesterPromptShown: period.id,
        lastConfirmedSemester: settings.semester || undefined
      });
    }
    setSemesterPromptOpen(false);
  }, [settings.semester]);

  const value = useMemo<StudyContextValue>(() => ({
    settings,
    hydrated,
    onboardingOpen,
    profileEditorOpen,
    semesterPromptOpen,
    suggestedSemester,
    updateSettings,
    selectSemester,
    setProfileEditorOpen,
    dismissOnboarding,
    keepCurrentSemester
  }), [
    dismissOnboarding,
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

function readLocalSettings(): UserStudySettings {
  if (typeof window === "undefined") return defaultStudySettings(false);
  try {
    const explicitAri = window.localStorage.getItem(COMPANION_ENABLED_KEY);
    const ariFallback = explicitAri === "true";
    return normalizeStudySettings(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "null"), ariFallback);
  } catch {
    return defaultStudySettings(false);
  }
}

function saveLocalSettings(settings: UserStudySettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings remain available in memory.
  }
}

function evaluateSemesterPrompt(
  settings: UserStudySettings,
  setSuggested: (semester: StudySemester | null) => void,
  setOpen: (open: boolean) => void
): void {
  if (settings.studyYear !== "year1" || !settings.semester) return;
  const period = semesterPeriod();
  if (!period || period.semester === settings.semester) return;
  const prompt = readSemesterPrompt();
  if (prompt.lastSemesterPromptShown === period.id) return;
  setSuggested(period.semester);
  setOpen(true);
}

function readSemesterPrompt(): SemesterPromptState {
  try {
    return JSON.parse(window.localStorage.getItem(SEMESTER_PROMPT_KEY) || "{}") as SemesterPromptState;
  } catch {
    return {};
  }
}

function saveSemesterPrompt(value: SemesterPromptState): void {
  safeSet(SEMESTER_PROMPT_KEY, JSON.stringify(value));
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
