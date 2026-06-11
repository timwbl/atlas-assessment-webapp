"use client";

import { useEffect } from "react";
import { semesterConfig } from "@/lib/studyProgram";
import { useCompanion } from "../companion/CompanionProvider";
import { StudyProfileSettings } from "./StudyProfileSettings";
import { useUserStudyContext } from "./UserStudyProvider";

export function StudyPrompts() {
  const {
    hydrated,
    onboardingOpen,
    profileEditorOpen,
    semesterPromptOpen,
    suggestedSemester,
    settings,
    authenticated,
    dismissOnboarding,
    keepCurrentSemester,
    selectSemester,
    setProfileEditorOpen
  } = useUserStudyContext();
  const { companionEnabled, setCompanionEnabled } = useCompanion();

  useEffect(() => {
    if (hydrated && companionEnabled !== settings.ariEnabled) {
      setCompanionEnabled(settings.ariEnabled);
    }
  }, [companionEnabled, hydrated, setCompanionEnabled, settings.ariEnabled]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (profileEditorOpen) setProfileEditorOpen(false);
      else if (semesterPromptOpen) keepCurrentSemester();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [keepCurrentSemester, profileEditorOpen, semesterPromptOpen, setProfileEditorOpen]);

  if (!hydrated) return null;

  return (
    <>
      {((authenticated && onboardingOpen) || profileEditorOpen) && (
        <div className="study-modal-backdrop" role="presentation">
          <section className="study-modal" aria-label="Lernprofil einrichten" aria-modal="true" role="dialog">
            {profileEditorOpen && (
              <button
                aria-label="Schliessen"
                className="auth-modal-close"
                onClick={() => setProfileEditorOpen(false)}
                type="button"
              >
                ×
              </button>
            )}
            <StudyProfileSettings
              description={authenticated && onboardingOpen
                ? "Wähle deine aktuelle Lernphase. Du kannst dies später jederzeit im Benutzerfenster ändern."
                : undefined}
              onDone={() => setProfileEditorOpen(false)}
              title={authenticated && onboardingOpen ? "ATLAS einrichten" : "Lernprofil"}
            />
            {authenticated && onboardingOpen && (
              <button className="auth-text-button" onClick={dismissOnboarding} type="button">
                Später einrichten · vorerst alle Inhalte anzeigen
              </button>
            )}
          </section>
        </div>
      )}

      {authenticated && semesterPromptOpen && suggestedSemester && !onboardingOpen && !profileEditorOpen && (
        <div className="study-modal-backdrop" role="presentation">
          <section className="study-modal semester-change-modal" aria-label="Semester wechseln" aria-modal="true" role="dialog">
            <p className="eyebrow">Lernphase</p>
            <h2>Neues Semester?</h2>
            <p>
              ATLAS hat erkannt, dass wahrscheinlich ein neues Semester begonnen hat. Welche Inhalte möchtest du aktuell lernen?
            </p>
            <div className="semester-change-options">
              {(["hs", "fs"] as const).map((semester) => {
                const config = semesterConfig(semester);
                return (
                  <button
                    className={suggestedSemester === semester ? "is-suggested" : ""}
                    key={semester}
                    onClick={() => selectSemester(semester)}
                    type="button"
                  >
                    <strong>{config?.label}</strong>
                    <span>{config?.shortLabel}</span>
                    {suggestedSemester === semester && <small>Wahrscheinlich aktuell</small>}
                  </button>
                );
              })}
            </div>
            <button className="btn-secondary" onClick={keepCurrentSemester} type="button">
              Aktuelle Auswahl behalten
            </button>
          </section>
        </div>
      )}
    </>
  );
}
