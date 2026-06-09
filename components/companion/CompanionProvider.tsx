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
  COMPANION_ENABLED_KEY,
  COMPANION_HIDE_EXAM_KEY,
  COMPANION_REDUCED_MOTION_KEY,
  loadCompanionPreferences,
  recordCompanionVisit,
  saveCompanionPreference
} from "./companionStorage";
import type {
  AriEventType,
  AriMood,
  AriReaction,
  CompanionPreferences
} from "./companion.types";

export const ARI_REACTIONS: Record<AriEventType, AriReaction> = {
  assessment_completed: {
    mood: "success",
    title: "Saubere Arbeit.",
    subtitle: "Assessment abgeschlossen.",
    autoReturnMs: 3800
  },
  daily_quest_completed: {
    mood: "success",
    title: "Mission abgeschlossen.",
    subtitle: "Guter kleiner Schritt.",
    autoReturnMs: 3800
  },
  review_item_corrected: {
    mood: "success",
    title: "Nebel gelichtet.",
    subtitle: "Ein alter Fehler sitzt jetzt besser.",
    autoReturnMs: 3800
  },
  assessment_analyzing: {
    mood: "thinking",
    title: "Ich schaue kurz nach.",
    subtitle: "Analyse läuft."
  },
  wrong_answer: {
    mood: "encourage",
    title: "Genau hier lohnt sich Review.",
    subtitle: "Nicht schlimm — jetzt wird es klarer.",
    autoReturnMs: 4200
  },
  low_confidence: {
    mood: "encourage",
    title: "Langsam ist hier besser als schnell.",
    subtitle: "Unsicherheit ist ein guter Marker.",
    autoReturnMs: 4200
  },
  many_errors_in_row: {
    mood: "encourage",
    title: "Kurze Pause oder gezieltes Review?",
    subtitle: "Ari bleibt ruhig.",
    autoReturnMs: 4200
  },
  new_focus_area: {
    mood: "focus",
    title: "Fokuspunkt erkannt.",
    subtitle: "Das lohnt sich fürs nächste Review.",
    autoReturnMs: 4200
  },
  wrong_confident_answer: {
    mood: "focus",
    title: "Achtung: sicheres Fehlkonzept.",
    subtitle: "Das ist besonders wertvoll fürs Lernen.",
    autoReturnMs: 4600
  },
  return_after_inactivity: {
    mood: "comeback_sleepy",
    title: "Willkommen zurück.",
    subtitle: "Dein Atlas ist noch da.",
    autoReturnMs: 4600
  }
};

type CompanionContextValue = CompanionPreferences & {
  mood: AriMood;
  reaction: AriReaction | null;
  isExamMode: boolean;
  triggerAriEvent: (eventType: AriEventType) => void;
  setAriMood: (mood: AriMood) => void;
  setCompanionEnabled: (enabled: boolean) => void;
  setHideInExamMode: (hidden: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setCompanionExamMode: (isExamMode: boolean) => void;
};

const CompanionContext = createContext<CompanionContextValue | null>(null);

export function CompanionProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<AriMood>("idle");
  const [reaction, setReaction] = useState<AriReaction | null>(null);
  const [companionEnabled, setEnabled] = useState(true);
  const [hideInExamMode, setHideExam] = useState(true);
  const [reducedMotion, setMotion] = useState(false);
  const [isExamMode, setExamMode] = useState(false);
  const returnTimer = useRef<number | null>(null);

  const clearReturnTimer = useCallback(() => {
    if (returnTimer.current !== null) {
      window.clearTimeout(returnTimer.current);
      returnTimer.current = null;
    }
  }, []);

  const setAriMood = useCallback((nextMood: AriMood) => {
    clearReturnTimer();
    setMood(nextMood);
    setReaction(null);
  }, [clearReturnTimer]);

  const triggerAriEvent = useCallback((eventType: AriEventType) => {
    const nextReaction = ARI_REACTIONS[eventType];
    clearReturnTimer();
    setMood(nextReaction.mood);
    setReaction(nextReaction);
    if (nextReaction.autoReturnMs) {
      returnTimer.current = window.setTimeout(() => {
        setMood("idle");
        setReaction(null);
        returnTimer.current = null;
      }, nextReaction.autoReturnMs);
    }
  }, [clearReturnTimer]);

  useEffect(() => {
    const preferences = loadCompanionPreferences();
    setEnabled(preferences.companionEnabled);
    setHideExam(preferences.hideInExamMode);
    setMotion(preferences.reducedMotion);
    const returningAfterInactivity = recordCompanionVisit();
    const openedDirectlyInExamMode = window.location.pathname.startsWith("/quiz/")
      && new URLSearchParams(window.location.search).get("mode") === "exam";
    if (preferences.companionEnabled && returningAfterInactivity && !openedDirectlyInExamMode) {
      triggerAriEvent("return_after_inactivity");
    }
    return clearReturnTimer;
  }, [clearReturnTimer, triggerAriEvent]);

  const setCompanionEnabled = useCallback((enabled: boolean) => {
    setEnabled(enabled);
    saveCompanionPreference(COMPANION_ENABLED_KEY, enabled);
    if (!enabled) setAriMood("idle");
  }, [setAriMood]);

  const setHideInExamMode = useCallback((hidden: boolean) => {
    setHideExam(hidden);
    saveCompanionPreference(COMPANION_HIDE_EXAM_KEY, hidden);
  }, []);

  const setReducedMotion = useCallback((reduced: boolean) => {
    setMotion(reduced);
    saveCompanionPreference(COMPANION_REDUCED_MOTION_KEY, reduced);
  }, []);

  const value = useMemo<CompanionContextValue>(() => ({
    mood,
    reaction,
    companionEnabled,
    hideInExamMode,
    reducedMotion,
    isExamMode,
    triggerAriEvent,
    setAriMood,
    setCompanionEnabled,
    setHideInExamMode,
    setReducedMotion,
    setCompanionExamMode: setExamMode
  }), [
    companionEnabled,
    hideInExamMode,
    isExamMode,
    mood,
    reaction,
    reducedMotion,
    setAriMood,
    setCompanionEnabled,
    setHideInExamMode,
    setReducedMotion,
    triggerAriEvent
  ]);

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

export function useCompanion(): CompanionContextValue {
  const context = useContext(CompanionContext);
  if (!context) throw new Error("useCompanion muss innerhalb des CompanionProvider verwendet werden.");
  return context;
}
