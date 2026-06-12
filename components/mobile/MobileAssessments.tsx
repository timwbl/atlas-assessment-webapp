"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatBlockLabel } from "@/lib/blockLabels";
import { useMobileLearningData } from "./useMobileLearningData";
import {
  examsForSemester,
  normalizedBlockId,
  semesterConfig,
  semesterHeading,
  settingsForSemester,
  type ExamId
} from "@/lib/studyProgram";
import { useUserStudyContext } from "@/components/study/UserStudyProvider";
import {
  ASSESSMENT_SUBJECTS,
  compareAssessmentsByNumber,
  getAssessmentSubject
} from "@/lib/assessmentCatalog";

export function MobileAssessments() {
  const data = useMobileLearningData();
  const { settings, updateSettings } = useUserStudyContext();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.assessments.filter((assessment) => !needle || [
      assessment.title,
      assessment.lectureCode,
      assessment.block
    ].join(" ").toLowerCase().includes(needle));
  }, [data.assessments, query]);
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    filtered.forEach((assessment) => {
      const blockId = normalizedBlockId(assessment.block) || "other";
      const current = groups.get(blockId) || [];
      current.push(assessment);
      groups.set(blockId, current);
    });
    groups.forEach((assessments) => assessments.sort((left, right) => {
      const subjectDifference = ASSESSMENT_SUBJECTS.indexOf(getAssessmentSubject(left))
        - ASSESSMENT_SUBJECTS.indexOf(getAssessmentSubject(right));
      return subjectDifference || compareAssessmentsByNumber(left, right);
    }));
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "de", { numeric: true }));
  }, [filtered]);
  const currentSemester = semesterConfig(settings.semester);
  const selectedExam = settings.examPreparation.mode === "singleExam"
    ? settings.examPreparation.selectedExams[0]
    : null;

  function setExamFilter(exam: ExamId | null) {
    if (!settings.semester) return;
    updateSettings({
      ...settingsForSemester(settings, settings.semester),
      examPreparation: exam
        ? { mode: "singleExam", selectedExams: [exam] }
        : { mode: "semester", selectedExams: examsForSemester(settings.semester) }
    });
  }

  return (
    <main className="mobile-action-page mobile-only" id="top">
      <header className="mobile-action-header">
        <p className="eyebrow">Assessments</p>
        <h1>Fragen auswählen</h1>
        <p>{semesterHeading(settings)} · nach Titel, KV oder Block suchen.</p>
      </header>
      <nav className="mobile-library-tabs" aria-label="Fragenbereiche">
        <Link className="is-active" href="/assessments">Assessments</Link>
        <Link href="/altfragen">Altfragen</Link>
      </nav>
      {settings.studyYear === "year1" && currentSemester && (
        <div className="study-filter-chips mobile-exam-filters" aria-label="Prüfungsfilter">
          <button className={!selectedExam ? "is-active" : ""} onClick={() => setExamFilter(null)} type="button">
            Alle
          </button>
          {currentSemester.defaultExamGroup.map((exam) => (
            <button
              className={selectedExam === exam ? "is-active" : ""}
              key={exam}
              onClick={() => setExamFilter(exam)}
              type="button"
            >
              {exam}
            </button>
          ))}
        </div>
      )}
      <input
        autoComplete="off"
        className="mobile-assessment-search"
        inputMode="search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Assessment suchen"
        type="search"
        value={query}
      />
      <section className="mobile-assessment-list">
        {data.loading && <MobileAssessmentSkeleton />}
        {!data.loading && data.error && (
          <div className="mobile-data-error" role="alert">
            Der Fragenkatalog ist gerade nicht erreichbar. Bereits geladene Assessments bleiben offline verfügbar.
          </div>
        )}
        {grouped.map(([blockId, assessments]) => (
          <section className="mobile-assessment-group" key={blockId}>
            <div className="mobile-assessment-group-head">
              <div>
                <span>Block</span>
                <strong>{formatBlockLabel(assessments[0]?.block || blockId)}</strong>
              </div>
              {blockId !== "other" && (
                <Link href={`/blocks/${blockId}/fast-quiz`} prefetch={false}>Fast Quiz</Link>
              )}
            </div>
            {assessments.map((assessment) => {
              const progress = data.progress[assessment.id];
              const seen = Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length;
              return (
                <Link className="mobile-assessment-row" href={`/assessment/${assessment.id}`} key={assessment.id} prefetch={false}>
                  <div>
                    <span>{getAssessmentSubject(assessment)} · {assessment.lectureCode}</span>
                    <strong>{assessment.title}</strong>
                    <small>{assessment.questionCount} Fragen · {seen} gesehen</small>
                  </div>
                  <b aria-hidden="true">›</b>
                </Link>
              );
            })}
          </section>
        ))}
        {!data.loading && !data.error && filtered.length === 0 && (
          <div className="mobile-empty-state">
            {query ? "Keine Assessments passen zu deiner Suche." : "Noch keine Assessments verfügbar."}
          </div>
        )}
      </section>
    </main>
  );
}

function MobileAssessmentSkeleton() {
  return (
    <div className="mobile-list-skeleton" aria-label="Assessments werden geladen" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}
