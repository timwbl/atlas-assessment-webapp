"use client";

import { useEffect, useRef, useState } from "react";
import { AtlasIcon } from "./AtlasIcon";
import { AtlasDropdown } from "./ui/AtlasDropdown";
import {
  cloudSyncAvailable,
  getCurrentProfile,
  getCurrentUser,
  updateCurrentProfileName,
  type CloudProfile
} from "@/lib/cloudProgress";
import { AUTH_SESSION_CHANGED_EVENT, type CloudUser } from "@/lib/supabaseClient";
import {
  STUDY_YEARS,
  examsForSemester,
  semesterConfig,
  semesterHeading,
  type ExamId,
  type StudySemester,
  type StudyYear,
  type UserStudySettings
} from "@/lib/studyProgram";
import { useUserStudyContext } from "./study/UserStudyProvider";

const NAME_KEY = "atlas-user-display-name";
const PROFILE_NAME_CHANGED_EVENT = "atlas-profile-name-changed";

export function SettingsPageClient() {
  const { settings, updateSettings } = useUserStudyContext();
  const [user, setUser] = useState<CloudUser | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftSettings, setDraftSettings] = useState<UserStudySettings>(settings);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDisplayName(window.localStorage.getItem(NAME_KEY) || "");
    void refreshProfile();

    function onSessionChange() {
      void refreshProfile();
    }

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChange);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onSessionChange);
  }, []);

  useEffect(() => {
    if (!editingProfile) setDraftSettings(settings);
  }, [editingProfile, settings]);

  useEffect(() => {
    if (editingProfile) window.setTimeout(() => nameInputRef.current?.focus(), 80);
  }, [editingProfile]);

  async function refreshProfile() {
    if (!cloudSyncAvailable()) return;
    const currentUser = await getCurrentUser().catch(() => null);
    setUser(currentUser);
    if (!currentUser) {
      setProfile(null);
      return;
    }
    const currentProfile = await getCurrentProfile(currentUser).catch(() => null);
    setProfile(currentProfile);
    const cloudName = currentProfile?.display_name?.trim();
    if (cloudName) {
      setDisplayName(cloudName);
      setDraftName(cloudName);
      window.localStorage.setItem(NAME_KEY, cloudName);
    }
  }

  async function saveProfileChanges() {
    const nextName = draftName.trim() || resolvedName;

    setBusy(true);
    setStatus("");
    try {
      setDisplayName(nextName);
      window.localStorage.setItem(NAME_KEY, nextName);
      window.dispatchEvent(new CustomEvent(PROFILE_NAME_CHANGED_EVENT, { detail: nextName }));
      if (user && cloudSyncAvailable()) {
        const updated = await updateCurrentProfileName(nextName);
        setProfile(updated);
      }
      updateSettings(draftSettings);
      setEditingProfile(false);
      setStatus("Änderungen gespeichert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Änderungen konnten nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  function openEditor() {
    setDraftName(resolvedName);
    setDraftSettings(settings);
    setEditingProfile(true);
    setStatus("");
  }

  function setYear(studyYear: StudyYear | null) {
    setDraftSettings({
      ...draftSettings,
      studyYear,
      semester: null,
      examPreparation: { mode: "semester", selectedExams: [] }
    });
  }

  function setSemester(semester: StudySemester) {
    setDraftSettings({
      ...draftSettings,
      studyYear: "year1",
      semester,
      examPreparation: {
        mode: "semester",
        selectedExams: examsForSemester(semester)
      }
    });
  }

  function setExam(exam: ExamId | "all") {
    if (!draftSettings.semester) return;
    setDraftSettings({
      ...draftSettings,
      examPreparation: exam === "all"
        ? { mode: "semester", selectedExams: examsForSemester(draftSettings.semester) }
        : { mode: "singleExam", selectedExams: [exam] }
    });
  }

  const resolvedName = profile?.display_name?.trim() || displayName.trim() || "Gastprofil";
  const initials = resolvedName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const email = user?.email || "Fortschritt lokal auf diesem Gerät";
  const activeSemester = semesterConfig(settings.semester);
  const draftSemester = semesterConfig(draftSettings.semester);
  const selectedExam = draftSettings.examPreparation.mode === "singleExam"
    ? draftSettings.examPreparation.selectedExams[0]
    : "all";
  const activeExamLabel = settings.semester
    ? settings.examPreparation.mode === "singleExam"
      ? settings.examPreparation.selectedExams[0] || "Nicht festgelegt"
      : `Alle (${examsForSemester(settings.semester).join(", ")})`
    : "Nicht festgelegt";

  return (
    <main className="shell settings-page-shell">
      <section className="settings-page-hero">
        <div>
          <p className="eyebrow">Profileinstellungen</p>
          <h1>Mein Profil</h1>
          <p>Persönliche Angaben, Lernphase und ATLAS-Präferenzen.</p>
        </div>
      </section>

      <section className="settings-profile-card" aria-label="Profil">
        <div className="settings-profile-avatar">{initials || "A"}</div>
        <div className="settings-profile-copy">
          <strong>{resolvedName}</strong>
          <span>{email}</span>
          <small>{semesterHeading(settings)}</small>
        </div>
        <button
          className="btn-secondary settings-profile-edit"
          onClick={() => {
            if (editingProfile) {
              setEditingProfile(false);
              setStatus("");
              return;
            }
            openEditor();
          }}
          type="button"
        >
          <AtlasIcon name="pencil" />
          {editingProfile ? "Schliessen" : "Bearbeiten"}
        </button>
        {status && <p className="settings-status">{status}</p>}
      </section>

      <section className="settings-page-card" aria-label="Lernprofil">
        <div className="settings-section-head">
          <div>
            <h2>Lernprofil</h2>
            <p>ATLAS filtert Übungen, Fortschritt und Lernphase anhand dieser Auswahl.</p>
          </div>
        </div>
        {!editingProfile ? (
          <div className="settings-summary-list">
            <div className="settings-summary-row">
              <span>Studienjahr</span>
              <strong>{STUDY_YEARS.find((year) => year.id === settings.studyYear)?.label || "Nicht festgelegt"}</strong>
            </div>
            <div className="settings-summary-row">
              <span>Semester / Lernphase</span>
              <strong>{activeSemester ? `${activeSemester.label} · ${activeSemester.shortLabel}` : "Nicht festgelegt"}</strong>
            </div>
            <div className="settings-summary-row">
              <span>Prüfungsvorbereitung</span>
              <strong>{activeExamLabel}</strong>
            </div>
          </div>
        ) : (
          <div className="settings-edit-submenu" aria-label="Lernprofil bearbeiten">
            <div className="settings-submenu-head">
              <h3>Profil bearbeiten</h3>
              <p>Ändere hier Name, Studienjahr, Semester und Prüfungsfilter.</p>
            </div>

            <label className="settings-edit-field">
              <span>Profilname</span>
              <input
                className="input"
                ref={nameInputRef}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveProfileChanges();
                }}
                placeholder="Vorname Nachname"
              />
            </label>

            <label className="settings-edit-field">
              <span>Studienjahr</span>
              <AtlasDropdown
                ariaLabel="Studienjahr auswählen"
                value={draftSettings.studyYear || ""}
                onChange={(value) => setYear((value || null) as StudyYear | null)}
                options={[
                  { value: "", label: "Noch nicht festgelegt" },
                  ...STUDY_YEARS.map((year) => ({
                    value: year.id,
                    label: `${year.label}${year.available ? "" : " · Inhalte folgen"}`
                  }))
                ]}
              />
            </label>

            {draftSettings.studyYear === "year1" && (
              <>
                <div className="settings-edit-field">
                  <span>Semester / Lernphase</span>
                  <div className="settings-option-list">
                    {(["hs", "fs"] as StudySemester[]).map((value) => {
                      const config = semesterConfig(value);
                      const active = draftSettings.semester === value;
                      return (
                        <button
                          className={active ? "settings-option-row is-selected" : "settings-option-row"}
                          key={value}
                          onClick={() => setSemester(value)}
                          type="button"
                        >
                          <span>
                            <strong>{config?.label}</strong>
                            <small>{config?.shortLabel}</small>
                          </span>
                          <em>{active ? "Ausgewählt" : "Wählen"}</em>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {draftSemester && (
                  <div className="settings-edit-field">
                    <span>Prüfungsvorbereitung</span>
                    <div className="settings-option-list settings-option-list--compact">
                      <button
                        className={selectedExam === "all" ? "settings-option-row is-selected" : "settings-option-row"}
                        onClick={() => setExam("all")}
                        type="button"
                      >
                        <span>
                          <strong>Alle Prüfungen</strong>
                          <small>{draftSemester.defaultExamGroup.join(", ")}</small>
                        </span>
                        <em>{selectedExam === "all" ? "Ausgewählt" : "Wählen"}</em>
                      </button>
                      {draftSemester.defaultExamGroup.map((exam) => (
                        <button
                          className={selectedExam === exam ? "settings-option-row is-selected" : "settings-option-row"}
                          key={exam}
                          onClick={() => setExam(exam)}
                          type="button"
                        >
                          <span>
                            <strong>{exam}</strong>
                            <small>Nur Inhalte dieser Prüfung anzeigen</small>
                          </span>
                          <em>{selectedExam === exam ? "Ausgewählt" : "Wählen"}</em>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="settings-edit-actions">
              <button className="btn-secondary" disabled={busy} onClick={() => setEditingProfile(false)} type="button">
                Abbrechen
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => void saveProfileChanges()} type="button">
                {busy ? "Speichert..." : "Änderungen speichern"}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
