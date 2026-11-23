"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { AtlasIcon } from "@/components/AtlasIcon";
import { useUserStudyContext } from "@/components/study/UserStudyProvider";
import { AtlasDropdown } from "@/components/ui/AtlasDropdown";
import { compareAssessmentsByNumber, getAssessmentSubject } from "@/lib/assessmentCatalog";
import { blockColor } from "@/lib/blockColors";
import { formatBlockLabel } from "@/lib/blockLabels";
import { DOWNLOAD_SEMESTERS, type SemesterId } from "@/lib/summaryDownloads";
import {
  blockIdForContent,
  examLabel,
  legacySemesterId,
  matchesStudyProfile,
  semesterConfig,
  settingsForSemester,
  studyProfileForLegacyId,
  type ExamId
} from "@/lib/studyProgram";
import { useMobileLearningData } from "./useMobileLearningData";

export function MobileAssessments() {
  const data = useMobileLearningData();
  const { allAssessments } = data;
  const { contentSettings: settings, isAdmin } = useUserStudyContext();
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<SemesterId | "" | null>(null);
  const [block, setBlock] = useState("");
  const [exam, setExam] = useState<ExamId | null>(null);
  const deferredQuery = useDeferredValue(query);
  const profileSemester = legacySemesterId(settings.semester, settings.studyYear) ?? "";
  const semesterOptions = DOWNLOAD_SEMESTERS.filter(({ id }) => (
    isAdmin || !settings.studyYear || studyProfileForLegacyId(id)?.studyYear === settings.studyYear
  ));
  const semester = selection === "" || semesterOptions.some(({ id }) => id === selection)
    ? selection ?? profileSemester
    : profileSemester;
  const appliedSettings = useMemo(() => {
    const semesterProfile = studyProfileForLegacyId(semester);
    if (selection === null || !semesterProfile) {
      return selection === "" ? { ...settings, semester: null } : settings;
    }
    return settingsForSemester(settings, semesterProfile.semester, semesterProfile.studyYear);
  }, [selection, semester, settings]);
  const examConfig = semesterConfig(appliedSettings.semester, appliedSettings.studyYear);
  const selectedExam = exam && examConfig?.defaultExamGroup.includes(exam) ? exam : null;

  const grouped = useMemo(() => {
    const examBlocks = selectedExam && examConfig ? examConfig.exams[selectedExam]?.blocks : null;
    const groups = new Map<string, typeof allAssessments>();
    allAssessments.forEach((assessment) => {
      if (!matchesStudyProfile(assessment, appliedSettings)) return;
      const blockId = blockIdForContent(assessment) || "other";
      if (examBlocks && !examBlocks.includes(blockId)) return;
      const group = groups.get(blockId) ?? [];
      group.push(assessment);
      groups.set(blockId, group);
    });
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "de", { numeric: true }));
  }, [allAssessments, appliedSettings, examConfig, selectedExam]);
  const visibleGroups = useMemo(() => {
    const needle = searchText(deferredQuery);
    return grouped
      .filter(([blockId]) => !block || blockId === block)
      .map(([blockId, assessments]) => ({
        blockId,
        label: formatBlockLabel(assessments[0].block),
        assessments: assessments.filter((assessment) => !needle || searchText([
          assessment.title, assessment.lectureCode, getAssessmentSubject(assessment),
          formatBlockLabel(assessment.block), ...assessment.tags
        ].join(" ")).includes(needle)).sort(compareAssessmentsByNumber)
      }))
      .filter((group) => group.assessments.length);
  }, [grouped, block, deferredQuery]);
  const resultCount = visibleGroups.reduce((sum, group) => sum + group.assessments.length, 0);

  return (
    <main className="mobile-action-page mobile-only mobile-exercise-page" id="top">
      <header className="mobile-action-header"><h1>Übungen</h1></header>
      <nav className="mobile-library-tabs" aria-label="Fragenbereiche">
        <Link aria-current="page" className="is-active" href="/assessments">Übungen</Link>
        <Link href="/altfragen">Altfragen</Link>
      </nav>

      <div className="mobile-exercise-filters">
        <label className="mobile-exercise-search">
          <span>Übung suchen</span>
          <input
            autoComplete="off"
            className="mobile-assessment-search"
            inputMode="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Thema, Fach oder KV"
            type="search"
            value={query}
          />
        </label>
        <div className="mobile-exercise-field">
          <span>Fachsemester</span>
          <AtlasDropdown
            ariaLabel="Fachsemester auswählen"
            onChange={(next) => {
              setSelection(next === profileSemester ? null : next);
              setBlock("");
              setExam(null);
            }}
            options={[
              ...(!settings.studyYear || isAdmin ? [{ value: "" as const, label: "Alle Fachsemester" }] : []),
              ...semesterOptions.map(({ id, title, order }) => ({ value: id, label: title, shortLabel: `${order}. Semester` }))
            ]}
            value={semester}
          />
        </div>
        <div className="mobile-exercise-field">
          <span>Block</span>
          <AtlasDropdown
            ariaLabel="Block auswählen"
            disabled={!grouped.length}
            onChange={setBlock}
            options={[
              { value: "", label: "Alle Blöcke" },
              ...grouped.map(([id, items]) => ({ value: id, label: formatBlockLabel(items[0].block) }))
            ]}
            value={block}
          />
        </div>
        {examConfig && examConfig.defaultExamGroup.length > 1 && (
          <div className="study-filter-chips mobile-exam-filters" aria-label="Prüfungsfilter" role="group">
            <button aria-pressed={!selectedExam} className={!selectedExam ? "is-active" : ""} onClick={() => { setExam(null); setBlock(""); }} type="button">Alle Prüfungen</button>
            {examConfig.defaultExamGroup.map((value) => (
              <button
                aria-pressed={selectedExam === value}
                className={selectedExam === value ? "is-active" : ""}
                key={value}
                onClick={() => { setExam(value); setBlock(""); }}
                type="button"
              >
                {examLabel(value)}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="mobile-assessment-list" aria-label="Übungskatalog">
        {data.loading ? <p role="status" className="mobile-exercise-count">Übungen werden geladen …</p> : (
          <p role="status" className="mobile-exercise-count">{resultCount} {resultCount === 1 ? "Übung" : "Übungen"}</p>
        )}
        {!data.loading && data.error && (
          <p className="mobile-data-error" role="alert">Der Fragenkatalog ist gerade nicht erreichbar.</p>
        )}
        {visibleGroups.map(({ blockId, label, assessments }) => (
          <section className="mobile-assessment-group" key={blockId}>
            <header className="mobile-assessment-group-head">
              <h2><i aria-hidden="true" style={{ backgroundColor: blockColor(blockId) }} />{label}</h2>
              {blockId !== "other" && <Link href={`/blocks/${blockId}/fast-quiz`} prefetch={false}>Schnellquiz</Link>}
            </header>
            {assessments.map((assessment) => {
              const stats = data.progress[assessment.id]?.questionStats || {};
              const seen = Object.values(stats).filter((item) => item.seen > 0).length;
              return (
                <Link className="mobile-assessment-row" href={`/assessment/${assessment.id}`} key={assessment.id} prefetch={false}>
                  <div>
                    <span>{assessment.lectureCode} · {getAssessmentSubject(assessment)}</span>
                    <strong>{assessment.title}</strong>
                    <small>{assessment.questionCount} Fragen{seen > 0 ? ` · ${seen} gesehen` : ""}</small>
                  </div>
                  <AtlasIcon name="chevronRight" />
                </Link>
              );
            })}
          </section>
        ))}
        {!data.loading && !data.error && resultCount === 0 && (
          <div className="mobile-empty-state">
            {query || block ? "Keine Übungen passen zu deiner Auswahl." : "Für diese Auswahl sind noch keine Übungen verfügbar."}
            {(query || block) && <button className="btn-secondary" onClick={() => { setQuery(""); setBlock(""); }} type="button">Suche und Block zurücksetzen</button>}
          </div>
        )}
      </section>
    </main>
  );
}

function searchText(value: string) {
  return value.trim().toLocaleLowerCase("de-CH").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
