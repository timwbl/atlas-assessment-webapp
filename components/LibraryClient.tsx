"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AltfragenAccessPanel } from "./AltfragenAccessPanel";
import { AssessmentCard } from "./AssessmentCard";
import { PrivacyNotice } from "./PrivacyNotice";
import { ProgressTools } from "./ProgressTools";
import { ALTFRAGEN_ACCESS_CHANGED_EVENT, canAccessAltfragen, isAltfragenBlock } from "@/lib/altfragenAccess";
import { loadAssessments } from "@/lib/assessmentClient";
import { collectAssessmentTags } from "@/lib/assessmentValidator";
import { blockColor } from "@/lib/blockColors";
import {
  blocksForSemester,
  DOWNLOAD_SEMESTERS,
  getSummaryBlock,
  semesterTitle,
  type SemesterId
} from "@/lib/summaryDownloads";
import {
  clearAssessmentLibrarySelection,
  loadAssessmentLibrarySelection,
  saveAssessmentLibrarySelection
} from "@/lib/librarySelection";
import { getAllProgress, PROGRESS_CHANGED_EVENT } from "@/lib/progressStore";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import type { Assessment, AssessmentProgress, LoadedAssessment } from "@/lib/types";

export function LibraryClient() {
  const [loaded, setLoaded] = useState<LoadedAssessment[]>([]);
  const [progress, setProgress] = useState<Record<string, AssessmentProgress>>({});
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState<SemesterId | "">("");
  const [blockId, setBlockId] = useState("");
  const [code, setCode] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [altfragenAccess, setAltfragenAccess] = useState(false);

  useEffect(() => {
    const savedSelection = loadAssessmentLibrarySelection();
    if (savedSelection) {
      setSemester(savedSelection.semester);
      setBlockId(savedSelection.blockId);
    }

    void loadAssessments()
      .then(setLoaded)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Laden fehlgeschlagen."));
    setProgress(getAllProgress());
    void refreshAltfragenAccess();
  }, []);

  useEffect(() => {
    function updateProgress() {
      setProgress(getAllProgress());
    }

    window.addEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
  }, []);

  useEffect(() => {
    function updateAltfragenAccess() {
      void refreshAltfragenAccess();
    }

    window.addEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, updateAltfragenAccess);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, updateAltfragenAccess);
    window.addEventListener("storage", updateAltfragenAccess);
    return () => {
      window.removeEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, updateAltfragenAccess);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, updateAltfragenAccess);
      window.removeEventListener("storage", updateAltfragenAccess);
    };
  }, []);

  async function refreshAltfragenAccess() {
    setAltfragenAccess(await canAccessAltfragen().catch(() => false));
  }

  function resetToMainSelection() {
    clearAssessmentLibrarySelection();
    setSemester("");
    setBlockId("");
    setCode("");
    setTag("");
    setQuery("");
  }

  const assessments = loaded.map((item) => item.assessment).filter(Boolean) as Assessment[];
  const invalid = loaded.filter((item) => !item.assessment && item.errors.length);

  const blockOptions = semester ? blocksForSemester(semester) : [];
  const selectedBlock = blockId ? getSummaryBlock(blockId) : null;
  const selectedAltfragen = selectedBlock ? isAltfragenBlock(selectedBlock.title) : false;
  const altfragenLocked = selectedAltfragen && !altfragenAccess;

  const blockAssessments = useMemo(() => {
    if (!selectedBlock || altfragenLocked) return [];
    return assessments.filter((assessment) => blockMatches(assessment.block, selectedBlock.title));
  }, [altfragenLocked, assessments, selectedBlock]);

  const codes = [...new Set(blockAssessments.map((assessment) => assessment.lectureCode))]
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" }));
  const tags = [...new Set(blockAssessments.flatMap(collectAssessmentTags))]
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));

  const filtered = useMemo(() => {
    if (!selectedBlock) return [];
    const needle = query.trim().toLowerCase();
    return blockAssessments.filter((assessment) => {
      const haystack = [
        assessment.title,
        assessment.lectureCode,
        assessment.block,
        assessment.sourceSummary,
        ...collectAssessmentTags(assessment)
      ].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!code || assessment.lectureCode === code)
        && (!tag || collectAssessmentTags(assessment).includes(tag));
    });
  }, [blockAssessments, code, query, selectedBlock, tag]);

  return (
    <main id="top" className="shell">
      <header className="glass library-hero rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">ATLAS Assessment Library</div>
            <h1 className="library-title mt-2 max-w-3xl text-4xl font-black leading-[1.02] md:text-6xl">
              MC Übungsfragen
            </h1>
            <p className="mt-3 max-w-2xl text-[var(--muted)]">
              Wähle zuerst ein Semester und danach einen Block, um die passenden MC-Fragen zu öffnen.
            </p>
          </div>
          <ProgressTools onImported={() => setProgress(getAllProgress())} />
        </div>
      </header>

      <div className="mt-5">
        <PrivacyNotice />
      </div>

      <section className="semester-picker-card mt-5">
        <div className="min-w-0">
          <div className="eyebrow">Auswahl</div>
          <h2 className="mt-1 text-2xl font-black">Semester auswählen</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Die Fragen werden erst nach Semester- und Blockauswahl angezeigt.</p>
        </div>
        <div className="semester-picker-actions">
          <label className="semester-picker-control">
            <span>Semester</span>
            <select
              value={semester}
              onChange={(event) => {
                const nextSemester = event.target.value as SemesterId | "";
                setSemester(nextSemester);
                setBlockId("");
                setCode("");
                setTag("");
                clearAssessmentLibrarySelection();
              }}
            >
              <option value="">Bitte auswählen</option>
              {DOWNLOAD_SEMESTERS.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </label>
          {(semester || blockId) && (
            <button className="semester-reset-button" type="button" onClick={resetToMainSelection} title="Zur Hauptauswahl" aria-label="Zur Hauptauswahl">
              ↺
            </button>
          )}
        </div>
      </section>

      {semester && (
        <section className="card mt-5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="eyebrow">{semesterTitle(semester)}</div>
              <h2 className="mt-1 text-2xl font-black">Block auswählen</h2>
            </div>
            <span className="pill">{blockOptions.length} Blöcke</span>
          </div>
          <div className="block-picker-grid mt-4">
            {blockOptions.map((item) => (
              <button
                className={blockId === item.id ? "block-picker-card is-active" : "block-picker-card"}
                key={item.id}
                style={{ "--block-picker-accent": blockColor(item.title) } as CSSProperties}
                onClick={() => {
                  setBlockId(item.id);
                  setCode("");
                  setTag("");
                  saveAssessmentLibrarySelection(item.semester, item.id);
                }}
                type="button"
              >
                <span className="block-picker-dot" />
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-5 p-4">
        <div className="assessment-filters grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
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
            disabled={!selectedBlock || altfragenLocked}
            placeholder="Suchen nach Titel, Code, Tag"
          />
          <select className="input" value={code} disabled={!selectedBlock || altfragenLocked} onChange={(event) => setCode(event.target.value)}>
            <option value="">Alle Codes</option>
            {codes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="input" value={tag} disabled={!selectedBlock || altfragenLocked} onChange={(event) => setTag(event.target.value)}>
            <option value="">Alle Tags</option>
            {tags.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </section>

      {error && <div className="card mt-5 border-red-300 p-4 text-red-600">{error}</div>}

      {invalid.length > 0 && (
        <section className="card mt-5 p-4">
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
        <section className="card mt-5 p-8 text-center">
          <div className="eyebrow">Start</div>
          <h2 className="mt-2 text-2xl font-black">Bitte wähle ein Semester</h2>
          <p className="mt-2 text-[var(--muted)]">Danach kannst du den passenden Block auswählen.</p>
        </section>
      )}

      {semester && !selectedBlock && (
        <section className="card mt-5 p-8 text-center">
          <div className="eyebrow">{semesterTitle(semester)}</div>
          <h2 className="mt-2 text-2xl font-black">Bitte wähle einen Block</h2>
          <p className="mt-2 text-[var(--muted)]">Erst danach werden die MC-Fragen angezeigt.</p>
        </section>
      )}

      {selectedBlock && (
        <section className="mt-6 grid gap-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="eyebrow">{semester ? semesterTitle(semester) : ""}</div>
                <h2 className="text-3xl font-black">{selectedBlock.title}</h2>
              </div>
              <span className="pill">{altfragenLocked ? "Geschützt" : `${filtered.length} Assessments`}</span>
            </div>

            {altfragenLocked ? (
              <AltfragenAccessPanel onUnlocked={() => void refreshAltfragenAccess()} />
            ) : filtered.length === 0 ? (
              <div className="card mt-4 p-8 text-center">
                <div className="eyebrow">{selectedBlock.title}</div>
                <h3 className="mt-2 text-2xl font-black">Keine passenden Fragen gefunden</h3>
                <p className="mt-2 text-[var(--muted)]">Für diesen Block sind aktuell keine MC-Assessments hinterlegt oder deine Filter sind zu eng.</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((assessment) => (
                  <AssessmentCard
                    key={assessment.id}
                    assessment={assessment}
                    progress={progress[assessment.id]}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function blockMatches(assessmentBlock: string, selectedBlockTitle: string): boolean {
  const normalizedAssessment = normalizeText(assessmentBlock);
  const normalizedSelected = normalizeText(selectedBlockTitle);
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
