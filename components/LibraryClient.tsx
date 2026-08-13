"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AssessmentCard } from "./AssessmentCard";
import { AtlasPageLoading } from "./AtlasPageLoading";
import { AtlasIcon, type AtlasIconName } from "./AtlasIcon";
import { BlockReadinessCard } from "./BlockReadinessCard";
import { PrivacyNotice } from "./PrivacyNotice";
import { ProgressTools } from "./ProgressTools";
import { AtlasDropdown } from "./ui/AtlasDropdown";
import { loadAssessmentSummaries } from "@/lib/assessmentClient";
import { blockColor } from "@/lib/blockColors";
import {
  availableAssessmentSubjects,
  compareAssessmentsByNumber,
  getAssessmentSubject,
} from "@/lib/assessmentCatalog";
import {
  blocksForSemester,
  DOWNLOAD_SEMESTERS,
  getSummaryBlock,
  semesterTitle,
  type SummaryBlock,
  type SemesterId
} from "@/lib/summaryDownloads";
import {
  clearAssessmentLibrarySelection,
  loadAssessmentLibrarySelection,
  saveAssessmentLibrarySelection
} from "@/lib/librarySelection";
import { getAllProgress, PROGRESS_CHANGED_EVENT } from "@/lib/progressStore";
import { readinessProgressId } from "@/lib/blockReadiness";
import {
  examsForSemester,
  isAltfragenValue,
  isThreeDContent,
  legacySemesterId,
  normalizedBlockId,
  selectedBlockIds,
  semesterConfig,
  settingsForSemester,
  studyProfileForLegacyId,
  studySemesterForLegacyId,
  type ExamId
} from "@/lib/studyProgram";
import type {
  AssessmentProgress,
  AssessmentSummary,
  LoadedAssessmentSummary
} from "@/lib/types";
import { useUserStudyContext } from "./study/UserStudyProvider";

const EXERCISES_PER_PAGE = 8;

export function LibraryClient() {
  const { hydrated, settings, updateSettings } = useUserStudyContext();
  const [loaded, setLoaded] = useState<LoadedAssessmentSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, AssessmentProgress>>({});
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState<SemesterId | "">("");
  const [blockId, setBlockId] = useState("");
  const [tag, setTag] = useState("");
  const [subject, setSubject] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedSelection = loadAssessmentLibrarySelection();
    if (savedSelection) {
      setSemester(savedSelection.semester);
      setBlockId(savedSelection.blockId);
    }

    void loadAssessmentSummaries()
      .then(setLoaded)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Laden fehlgeschlagen."));
    setProgress(getAllProgress());
  }, []);

  useEffect(() => {
    if (!hydrated || !settings.studyYear || !settings.semester) return;
    const preferredSemester = legacySemesterId(settings.semester, settings.studyYear);
    if (!preferredSemester) return;
    setSemester(preferredSemester);
    setBlockId((current) => {
      const selected = current ? getSummaryBlock(current) : null;
      return selected?.semester === preferredSemester ? current : "";
    });
  }, [hydrated, settings.semester, settings.studyYear]);

  useEffect(() => {
    function updateProgress() {
      setProgress(getAllProgress());
    }

    window.addEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
  }, []);

  function resetToMainSelection() {
    clearAssessmentLibrarySelection();
    setSemester("");
    setBlockId("");
    setTag("");
    setSubject("");
    setQuery("");
    setPage(1);
  }

  function selectSemester(nextSemester: SemesterId) {
    setSemester(nextSemester);
    setBlockId("");
    setTag("");
    setSubject("");
    setQuery("");
    setPage(1);
    clearAssessmentLibrarySelection();
    const nextStudyProfile = studyProfileForLegacyId(nextSemester);
    if (nextStudyProfile) updateSettings(settingsForSemester(settings, nextStudyProfile.semester, nextStudyProfile.studyYear));
  }

  const deferredQuery = useDeferredValue(query);
  const assessments = useMemo(
    () => loaded
      .map((item) => item.assessment)
      .filter((assessment): assessment is AssessmentSummary => (
        !!assessment
        && !isAltfragenValue(assessment.block)
        && !isThreeDContent(assessment)
      )),
    [loaded]
  );
  const invalid = useMemo(
    () => loaded.filter((item) => !item.assessment && item.errors.length),
    [loaded]
  );

  const blockOptions = useMemo(() => {
    const profileBlockIds = selectedBlockIds(settings);
    return semester
      ? blocksForSemester(semester).filter((block) => {
      if (isAltfragenValue(block.title) || isThreeDContent(block.title)) return false;
      if (!settings.studyYear || !settings.semester) return true;
      const blockIdFromTitle = block.canonicalBlockId || normalizedBlockId(block.title);
      if (!blockIdFromTitle) return settings.semester === "fs" && normalizeText(block.title).includes("prufungssimulation");
      return profileBlockIds.includes(blockIdFromTitle);
    })
      : [];
  }, [semester, settings]);
  const selectedBlock = blockId ? getSummaryBlock(blockId) : null;
  const blockCards = useMemo(() => {
    return blockOptions.map((block) => {
      const matching = assessments.filter((assessment) => assessmentMatchesSummaryBlock(assessment, block));
      const questionCount = matching.reduce((sum, assessment) => sum + assessment.questionCount, 0);
      return {
        block,
        accent: blockColor(block.canonicalBlockId || block.title),
        exerciseCount: matching.length,
        icon: blockIcon(block.title),
        questionCount
      };
    });
  }, [assessments, blockOptions]);

  useEffect(() => {
    if (blockId && !blockOptions.some((block) => block.id === blockId)) {
      setBlockId("");
      setTag("");
      setSubject("");
      setPage(1);
    }
  }, [blockId, blockOptions]);

  const blockAssessments = useMemo(() => {
    if (!selectedBlock) return [];
    return assessments.filter((assessment) => assessmentMatchesSummaryBlock(assessment, selectedBlock));
  }, [assessments, selectedBlock]);

  const studySemester = studySemesterForLegacyId(semester);
  const studyProfile = studyProfileForLegacyId(semester);
  const examConfig = semesterConfig(studySemester, studyProfile?.studyYear || settings.studyYear);
  const selectedExam = settings.examPreparation.mode === "singleExam"
    ? settings.examPreparation.selectedExams[0]
    : null;

  function setExamFilter(exam: ExamId | null) {
    if (!studyProfile) return;
    updateSettings({
      ...settingsForSemester(settings, studyProfile.semester, studyProfile.studyYear),
      examPreparation: exam
        ? { mode: "singleExam", selectedExams: [exam] }
        : { mode: "semester", selectedExams: examsForSemester(studyProfile.semester, studyProfile.studyYear) }
    });
    setBlockId("");
    setTag("");
    setSubject("");
    setPage(1);
    clearAssessmentLibrarySelection();
  }

  const subjects = availableAssessmentSubjects(blockAssessments);

  const filtered = useMemo(() => {
    if (!selectedBlock) return [];
    const needle = deferredQuery.trim().toLowerCase();
    return blockAssessments.filter((assessment) => {
      const haystack = [
        assessment.title,
        assessment.lectureCode,
        assessment.block,
        getAssessmentSubject(assessment),
        assessment.sourceSummary,
        ...assessment.tags
      ].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!tag || assessment.tags.includes(tag))
        && (!subject || getAssessmentSubject(assessment) === subject);
    });
  }, [blockAssessments, deferredQuery, selectedBlock, subject, tag]);
  const sortedAssessments = useMemo(
    () => [...filtered].sort(compareAssessmentsByNumber),
    [filtered]
  );
  const pageCount = Math.max(1, Math.ceil(sortedAssessments.length / EXERCISES_PER_PAGE));
  const activePage = Math.min(page, pageCount);
  const pageStart = (activePage - 1) * EXERCISES_PER_PAGE;
  const pageEnd = Math.min(pageStart + EXERCISES_PER_PAGE, sortedAssessments.length);
  const visibleAssessments = sortedAssessments.slice(pageStart, pageEnd);
  const selectedBlockKey = selectedBlock ? selectedBlock.canonicalBlockId || normalizedBlockId(selectedBlock.title) : null;
  const blockQuestionCount = blockAssessments.reduce((sum, assessment) => sum + assessment.questionCount, 0);
  const loadingCatalog = hydrated && loaded.length === 0 && !error;

  useEffect(() => {
    setPage(1);
  }, [blockId, deferredQuery, subject, tag]);

  if (loadingCatalog) return <AtlasPageLoading title="Übungen werden geladen" />;

  return (
    <main id="top" className="shell library-shell exercise-library-shell">
      <header className="glass library-hero atlas-library-hero rounded-[28px] p-6 md:p-8">
        <div className="library-hero-inner">
          <div>
            <div className="eyebrow">ATLAS Übungen</div>
            <h1 className="library-title mt-2 max-w-3xl text-4xl font-black leading-[1.02] md:text-6xl">
              Übungen
            </h1>
            <p className="mt-3 max-w-2xl text-[var(--muted)]">
              Öffne einen Block und trainiere die passenden MC-Fragen für dein aktuelles Semester.
            </p>
          </div>
          <ProgressTools onImported={() => setProgress(getAllProgress())} />
        </div>
      </header>

      <div className="library-privacy-row mt-5">
        <PrivacyNotice />
      </div>

      <section className="exercise-control-panel">
        <div className="exercise-control-copy">
          <div className="eyebrow">Lernphase</div>
          <h2>{semester ? semesterTitle(semester) : "Semester wählen"}</h2>
          <p>Die Blockkarten zeigen nur Inhalte, die zu deiner aktuellen Auswahl passen.</p>
        </div>
        <div className="exercise-control-actions">
          <div className="exercise-semester-tabs" aria-label="Semester auswählen">
            {DOWNLOAD_SEMESTERS.map((item) => (
              <button
                className={semester === item.id ? "is-active" : ""}
                key={item.id}
                onClick={() => selectSemester(item.id)}
                type="button"
              >
                {item.title}
              </button>
            ))}
          </div>
          {(semester || blockId) && (
            <button className="exercise-reset-button" type="button" onClick={resetToMainSelection}>
              Zurücksetzen
            </button>
          )}
          {examConfig && settings.studyYear === studyProfile?.studyYear && (
            <div className="study-filter-chips study-filter-chips--library" aria-label="Prüfungsfilter">
              <button className={!selectedExam ? "is-active" : ""} onClick={() => setExamFilter(null)} type="button">
                Alle
              </button>
              {examConfig.defaultExamGroup.map((exam) => (
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
        </div>
      </section>

      {semester && (
        <section className="library-block-showcase">
          <div className="library-section-head">
            <div>
              <div className="eyebrow">{semesterTitle(semester)}</div>
              <h2>Block öffnen</h2>
            </div>
            <span className="pill">{blockCards.length} Blöcke</span>
          </div>
          <div className="exercise-block-grid">
            {blockCards.map((item) => (
              <button
                className={blockId === item.block.id ? "exercise-block-card is-active" : "exercise-block-card"}
                key={item.block.id}
                style={{ "--block-picker-accent": item.accent } as CSSProperties}
                onClick={() => {
                  setBlockId(item.block.id);
                  setTag("");
                  setSubject("");
                  setPage(1);
                  saveAssessmentLibrarySelection(item.block.semester, item.block.id);
                }}
                type="button"
              >
                <span className="exercise-block-icon">
                  <AtlasIcon name={item.icon} />
                </span>
                <span className="exercise-block-copy">
                  <strong>{item.block.title}</strong>
                  <small>{item.questionCount} Fragen</small>
                  {item.block.subtitle && <small>{item.block.subtitle}</small>}
                </span>
                <span className="exercise-block-meta">
                  <b>{item.exerciseCount}</b>
                  <small>Übungen</small>
                </span>
                <span className="exercise-block-foot">
                  <span>Öffnen</span>
                  <span aria-hidden="true">→</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedBlock && (
        <section className="exercise-filter-panel">
          <div className="exercise-filter-grid">
            <label>
              <span>Suche</span>
              <input
                className="input"
                type="search"
                name="atlas-assessment-library-search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Übung suchen"
              />
            </label>
            <label>
              <span>Fach</span>
              <AtlasDropdown
                ariaLabel="Fach filtern"
                value={subject}
                onChange={setSubject}
                options={[
                  { value: "", label: "Alle Fächer" },
                  ...subjects.map((item) => ({ value: item, label: item }))
                ]}
              />
            </label>
            {(query || tag || subject) && (
              <button className="exercise-reset-button" type="button" onClick={() => {
                setQuery("");
                setTag("");
                setSubject("");
                setPage(1);
              }}>
                Filter löschen
              </button>
            )}
          </div>
        </section>
      )}

      {error && <div className="card mt-5 border-red-300 p-4 text-red-600">{error}</div>}

      {invalid.length > 0 && (
        <section className="card library-panel mt-5 p-4">
          <h2 className="font-black">Validierungsfehler</h2>
          <div className="mt-3 grid gap-2">
            {invalid.map((item) => (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20" key={item.file}>
                <strong>{item.file}</strong>: {item.errors.join(" ")}
              </div>
            ))}
          </div>
        </section>
      )}

      {!semester && (
        <section className="card library-empty-card mt-5 p-8 text-center">
          <div className="eyebrow">Start</div>
          <h2 className="mt-2 text-2xl font-black">Bitte wähle ein Semester</h2>
          <p className="mt-2 text-[var(--muted)]">Danach kannst du den passenden Block auswählen.</p>
        </section>
      )}

      {selectedBlock && (
        <section className="library-results-section mt-6 grid gap-5">
          <div>
            <div className="library-section-head">
              <div>
                <div className="eyebrow">{semester ? semesterTitle(semester) : ""}</div>
                <h2>{selectedBlock.title}</h2>
              </div>
              <span className="pill">{filtered.length} Übungen</span>
            </div>

            {selectedBlockKey && blockQuestionCount > 0 && (
              <BlockReadinessCard
                blockId={selectedBlockKey}
                progress={progress[readinessProgressId(selectedBlockKey)]}
                questionCount={blockQuestionCount}
              />
            )}

            {filtered.length === 0 ? (
              <div className="card mt-4 p-8 text-center">
                <div className="eyebrow">{selectedBlock.title}</div>
                <h3 className="mt-2 text-2xl font-black">Keine passenden Fragen gefunden</h3>
                <p className="mt-2 text-[var(--muted)]">Für diesen Block sind aktuell keine MC-Übungen hinterlegt oder deine Filter sind zu eng.</p>
              </div>
            ) : (
              <>
                <div className="library-assessment-grid mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {visibleAssessments.map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      assessment={assessment}
                      progress={progress[assessment.id]}
                    />
                  ))}
                </div>
                {pageCount > 1 && (
                  <nav className="atlas-pagination" aria-label="Übungen Seiten">
                    <span>
                      {pageStart + 1}-{pageEnd} von {sortedAssessments.length} Übungen
                    </span>
                    <div>
                      <button
                        disabled={activePage <= 1}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        type="button"
                      >
                        Zurück
                      </button>
                      <strong>{activePage} / {pageCount}</strong>
                      <button
                        disabled={activePage >= pageCount}
                        onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                        type="button"
                      >
                        Weiter
                      </button>
                    </div>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function assessmentMatchesSummaryBlock(assessment: AssessmentSummary, block: SummaryBlock): boolean {
  const canonicalBlockId = block.canonicalBlockId || normalizedBlockId(block.title);
  if (canonicalBlockId?.startsWith("j2-")) {
    return normalizedBlockId([
      assessment.block,
      assessment.title,
      assessment.lectureCode
    ].join(" ")) === canonicalBlockId;
  }
  return blockMatches(assessment.block, block.title, block.matchTerms || []);
}

function blockMatches(assessmentBlock: string, selectedBlockTitle: string, matchTerms: string[] = []): boolean {
  const normalizedAssessment = normalizeText(assessmentBlock);
  const normalizedSelected = normalizeText(selectedBlockTitle);
  const normalizedTerms = matchTerms.map(normalizeText);
  if (normalizedTerms.some((term) => term && normalizedAssessment.includes(term))) return true;
  if (normalizedSelected.includes("prufungssimulationen") || normalizedSelected.includes("pruefungssimulationen")) {
    return normalizedAssessment.includes("prufungssimulationen") || normalizedAssessment.includes("pruefungssimulationen");
  }

  if (normalizedSelected.includes("altfragen") || normalizedSelected.includes("altfrage")) {
    return normalizedAssessment.includes("altfragen")
      || normalizedAssessment.includes("altfrage")
      || normalizedAssessment.includes("alte fragen");
  }

  const assessmentNumber = String(assessmentBlock || "").match(/\d+/)?.[0] || "";
  const selectedNumber = selectedBlockTitle.match(/\d+/)?.[0] || "";
  return !!assessmentNumber && assessmentNumber === selectedNumber;
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function blockIcon(title: string): AtlasIconName {
  const normalized = normalizeText(title);
  const number = title.match(/\d+/)?.[0] || "";
  if (normalized.includes("prufungssimulation") || normalized.includes("pruefungssimulation")) return "target";
  if (normalized.includes("herz") || normalized.includes("atmung")) return "heart";
  if (normalized.includes("verdauung") || normalized.includes("metabolismus")) return "cells";
  if (normalized.includes("niere") || normalized.includes("elektrolyt")) return "pulse";
  if (normalized.includes("blut") || normalized.includes("abwehr")) return "shield";
  if (normalized.includes("endokrinologie") || normalized.includes("reproduktion")) return "dna";
  if (normalized.includes("zns") || normalized.includes("sinnesorgane")) return "brain";

  const icons: Record<string, AtlasIconName> = {
    "1": "heart",
    "2": "cells",
    "3": "atom",
    "4": "pulse",
    "5": "ethics",
    "6": "planetary",
    "7": "psychosocial",
    "8": "movement",
    "9": "development"
  };

  return icons[number] || "book";
}
