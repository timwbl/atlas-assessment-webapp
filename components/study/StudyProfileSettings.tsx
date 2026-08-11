"use client";

import { useEffect, useState } from "react";
import { AtlasDropdown } from "../ui/AtlasDropdown";
import {
  STUDY_YEARS,
  examsForSemester,
  semesterConfig,
  type ExamId,
  type StudySemester,
  type StudyYear,
  type UserStudySettings
} from "@/lib/studyProgram";
import { useUserStudyContext } from "./UserStudyProvider";

export function StudyProfileSettings({
  showHeader = true,
  title = "Lernprofil",
  description = "ATLAS zeigt dir bevorzugt die Inhalte, die zu deiner aktuellen Lernphase passen.",
  onDone,
  submitLabel = "Einstellungen speichern"
}: {
  showHeader?: boolean;
  title?: string;
  description?: string;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const { settings, updateSettings } = useUserStudyContext();
  const [draft, setDraft] = useState<UserStudySettings>(settings);

  useEffect(() => setDraft(settings), [settings]);

  function setYear(studyYear: StudyYear | null) {
    setDraft({
      ...draft,
      studyYear,
      semester: null,
      examPreparation: { mode: "semester", selectedExams: [] }
    });
  }

  function setSemester(semester: StudySemester) {
    setDraft({
      ...draft,
      studyYear: "year1",
      semester,
      examPreparation: {
        mode: "semester",
        selectedExams: examsForSemester(semester)
      }
    });
  }

  function setExam(exam: ExamId | "all") {
    if (!draft.semester) return;
    setDraft({
      ...draft,
      examPreparation: exam === "all"
        ? { mode: "semester", selectedExams: examsForSemester(draft.semester) }
        : { mode: "singleExam", selectedExams: [exam] }
    });
  }

  const semester = semesterConfig(draft.semester);
  const selectedExam = draft.examPreparation.mode === "singleExam"
    ? draft.examPreparation.selectedExams[0]
    : "all";

  return (
    <div className="study-profile-editor">
      {showHeader && (
        <div>
          <p className="eyebrow">Profileinstellungen</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      )}

      <label className="study-field">
        <span>Studienjahr</span>
        <AtlasDropdown
          ariaLabel="Studienjahr auswählen"
          value={draft.studyYear || ""}
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

      {draft.studyYear === "year1" && (
        <>
          <fieldset className="study-field">
            <legend>Semester / Lernphase</legend>
            <div className="study-choice-grid">
              {(["hs", "fs"] as StudySemester[]).map((value) => {
                const config = semesterConfig(value);
                return (
                  <button
                    className={draft.semester === value ? "study-choice is-active" : "study-choice"}
                    key={value}
                    onClick={() => setSemester(value)}
                    type="button"
                  >
                    <strong>{config?.label}</strong>
                    <span>{config?.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {semester && (
            <fieldset className="study-field">
              <legend>Prüfungsvorbereitung</legend>
              <div className="study-filter-chips">
                <button
                  className={selectedExam === "all" ? "is-active" : ""}
                  onClick={() => setExam("all")}
                  type="button"
                >
                  Alle
                </button>
                {semester.defaultExamGroup.map((exam) => (
                  <button
                    className={selectedExam === exam ? "is-active" : ""}
                    key={exam}
                    onClick={() => setExam(exam)}
                    type="button"
                  >
                    {exam}
                  </button>
                ))}
              </div>
              <p className="study-field-note">
                „Alle“ verbindet die Prüfungen semesterweise. Einzelne eMCs wirken nur als Inhaltsfilter.
              </p>
            </fieldset>
          )}
        </>
      )}

      {draft.studyYear && draft.studyYear !== "year1" && (
        <div className="study-placeholder" role="status">
          <strong>{STUDY_YEARS.find((year) => year.id === draft.studyYear)?.label}</strong>
          <span>Diese Inhalte werden später ergänzt. Bis dahin bleiben alle vorhandenen Inhalte erreichbar.</span>
        </div>
      )}

      <button
        className="btn-primary study-save-button"
        onClick={() => {
          updateSettings(draft);
          onDone?.();
        }}
        type="button"
      >
        {submitLabel}
      </button>
    </div>
  );
}
