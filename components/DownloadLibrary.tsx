"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AtlasIcon, type AtlasIconName } from "./AtlasIcon";
import { AtlasDropdown } from "./ui/AtlasDropdown";
import { useUserStudyContext } from "./study/UserStudyProvider";
import { blockColor } from "@/lib/blockColors";
import {
  downloadBlocksForSemester,
  DOWNLOAD_SEMESTERS,
  formatFileSize,
  formatUploadDate,
  loadSummaryDownloads,
  semesterTitle,
  SUMMARY_DOWNLOADS_CHANGED_EVENT,
  triggerSummaryDownload,
  type SemesterId,
  type SummaryDownload
} from "@/lib/summaryDownloads";
import {
  examLabel,
  legacySemesterId,
  normalizedBlockId,
  selectedBlockIds,
  semesterConfig,
  studyProfileForLegacyId,
  studySemesterForLegacyId,
  type ExamId
} from "@/lib/studyProgram";

export function DownloadLibrary() {
  const { hydrated, settings } = useUserStudyContext();
  const [downloads, setDownloads] = useState<SummaryDownload[]>([]);
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState<SemesterId | "">("");
  const [blockId, setBlockId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  useEffect(() => {
    void refresh();

    function onChange() {
      void refresh();
    }

    window.addEventListener(SUMMARY_DOWNLOADS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SUMMARY_DOWNLOADS_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!hydrated || !settings.studyYear || !settings.semester) return;
    const preferredSemester = legacySemesterId(settings.semester, settings.studyYear);
    if (!preferredSemester) return;
    setSemester(preferredSemester);
    setBlockId((current) => current.startsWith(`${preferredSemester}-`) ? current : "");
  }, [hydrated, settings.semester, settings.studyYear]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setDownloads(await loadSummaryDownloads());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Zusammenfassungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  const studySemester = studySemesterForLegacyId(semester);
  const studyProfile = studyProfileForLegacyId(semester);
  const examConfig = semesterConfig(studySemester, studyProfile?.studyYear || settings.studyYear);
  const [localExam, setLocalExam] = useState<ExamId | null>(null);
  const selectedExam = localExam;
  const profileSemesterId = settings.studyYear && settings.semester
    ? legacySemesterId(settings.semester, settings.studyYear)
    : null;
  const localExamBlockIds = useMemo(
    () => selectedExam && examConfig
      ? new Set(examConfig.exams[selectedExam]?.blocks || [])
      : null,
    [examConfig, selectedExam]
  );
  const visibleSemesters = semester ? DOWNLOAD_SEMESTERS.filter((item) => item.id === semester) : [];
  const blockOptions = useMemo(() => {
    const profileBlockIds = selectedBlockIds(settings);
    return semester
      ? downloadBlocksForSemester(semester).filter((block) => {
        const profileBlockId = block.canonicalBlockId || normalizedBlockId(block.title);
        if (localExamBlockIds && profileBlockId) return localExamBlockIds.has(profileBlockId);
        if (!settings.studyYear || !settings.semester || semester !== profileSemesterId) return true;
        return !!profileBlockId && profileBlockIds.includes(profileBlockId);
      })
      : [];
  }, [localExamBlockIds, profileSemesterId, semester, settings]);
  const filtered = useMemo(() => {
    if (!semester) return [];

    const needle = query.trim().toLowerCase();
    const allowedBlockIds = new Set(blockOptions.map((block) => block.id));
    return downloads.filter((item) => {
      const haystack = [
        item.title,
        item.semester,
        item.blockTitle,
        item.description,
        item.version,
        item.fileName
      ].join(" ").toLowerCase();

      return item.semester === semester
        && allowedBlockIds.has(item.blockId)
        && (!needle || haystack.includes(needle))
        && (!blockId || item.blockId === blockId);
    });
  }, [blockId, blockOptions, downloads, query, semester]);

  useEffect(() => {
    if (blockId && !blockOptions.some((block) => block.id === blockId)) setBlockId("");
  }, [blockId, blockOptions]);

  function setExamFilter(exam: ExamId | null) {
    setLocalExam(exam);
    setBlockId("");
  }

  useEffect(() => {
    setLocalExam(null);
  }, [semester]);

  async function downloadFile(item: SummaryDownload) {
    setDownloadingId(item.id);
    setError("");
    try {
      await triggerSummaryDownload(item);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Download nicht verfügbar.");
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <main id="top" className="shell library-shell summary-library-shell">
      <header className="summary-page-head">
        <div>
          <div className="eyebrow">ATLAS Zusammenfassungen</div>
          <h1>Zusammenfassungen</h1>
          <p>Wähle Fachsemester, Prüfung und Block. ATLAS zeigt dir nur die passenden Lernunterlagen.</p>
        </div>
        <aside className="summary-page-note">
          <strong>Hinweis</strong>
          <span>Zusammenfassungen sind reine Lernunterlagen und verändern deinen Lernfortschritt nicht.</span>
        </aside>
      </header>

      <section className="summary-control-card" aria-label="Zusammenfassungen filtern">
        <div className="summary-control-head">
          <div>
            <strong>Auswahl</strong>
            <span>{semester ? semesterTitle(semester) : "Noch kein Fachsemester gewählt"}</span>
          </div>
          {examConfig && (
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
                  {examLabel(exam)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="summary-control-grid">
          <label className="summary-control-field">
            <span>Fachsemester</span>
            <AtlasDropdown
              ariaLabel="Fachsemester auswählen"
              value={semester}
              onChange={(nextSemester) => {
                setSemester(nextSemester);
                setBlockId("");
              }}
              options={[
                { value: "", label: "Bitte auswählen" },
                ...DOWNLOAD_SEMESTERS.map((item) => ({ value: item.id, label: item.title }))
              ]}
            />
          </label>
          <label className="summary-control-field summary-control-field--wide">
            <span>Suche</span>
            <input
              className="input"
              type="search"
              name="atlas-summary-download-search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zusammenfassung suchen"
            />
          </label>
          <label className="summary-control-field">
            <span>Block</span>
            <AtlasDropdown
              ariaLabel="Block auswählen"
              value={blockId}
              disabled={!semester}
              onChange={setBlockId}
              options={[
                { value: "", label: "Alle Blöcke" },
                ...blockOptions.map((block) => ({ value: block.id, label: block.title }))
              ]}
            />
          </label>
        </div>
      </section>

      {error && <div className="card mt-5 border-red-300 p-4 text-red-600">{error}</div>}
      {loading && <div className="card library-empty-card mt-5 p-5 text-[var(--muted)]">Zusammenfassungen werden geladen…</div>}

      {!loading && downloads.length === 0 && (
        <section className="card library-empty-card summary-empty-card mt-5 p-8 text-center">
          <div className="eyebrow">Noch leer</div>
          <h2 className="mt-2 text-2xl font-black">Noch keine Zusammenfassungen hochgeladen</h2>
          <p className="mt-2 text-[var(--muted)]">Sobald im Admin-Bereich Dateien hinzugefügt wurden, erscheinen sie hier nach Fachsemester und Block.</p>
        </section>
      )}

      {!loading && downloads.length > 0 && !semester && (
        <section className="card library-empty-card summary-empty-card mt-5 p-8 text-center">
          <div className="eyebrow">Bereit</div>
          <h2 className="mt-2 text-2xl font-black">Bitte wähle ein Fachsemester</h2>
          <p className="mt-2 text-[var(--muted)]">Danach erscheinen nur die Blöcke und Zusammenfassungen des ausgewählten Fachsemesters.</p>
        </section>
      )}

      {!loading && downloads.length > 0 && semester && (
        <section className="library-results-section mt-6 grid gap-8">
          {visibleSemesters.map((semesterItem) => (
            <div key={semesterItem.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Fachsemester</div>
                  <h2 className="text-3xl font-black">{semesterTitle(semesterItem.id)}</h2>
                </div>
                <span className="pill">
                  {filtered.filter((item) => item.semester === semesterItem.id).length} Dateien
                </span>
              </div>

              <div className="summary-download-grid">
                {blockOptions.map((block) => {
                  const blockDownloads = filtered
                    .filter((item) => item.semester === semesterItem.id && item.blockId === block.id)
                    .sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));

                  if (blockId && block.id !== blockId) return null;

                  return (
                    <section
                      className="summary-block-card"
                      key={block.id}
                      style={{ "--download-accent": blockColor(block.canonicalBlockId || block.title) } as CSSProperties}
                    >
                      <div className="summary-block-card-head">
                        <span className="summary-block-icon" aria-hidden="true">
                          <AtlasIcon name={summaryBlockIcon(block.title, block.subtitle)} />
                        </span>
                        <div className="min-w-0">
                          <h3>{block.title}</h3>
                          {block.subtitle && <p>{block.subtitle}</p>}
                        </div>
                        <span className="summary-block-count">{blockDownloads.length} Datei{blockDownloads.length === 1 ? "" : "en"}</span>
                      </div>

                      <div className="summary-file-list">
                        {blockDownloads.length === 0 ? (
                          <div className="summary-file-empty">
                            Keine Dateien in diesem Block.
                          </div>
                        ) : (
                          blockDownloads.map((item) => (
                            <article className="summary-file-card" key={item.id}>
                              <span className="summary-file-icon" aria-hidden="true">
                                <AtlasIcon name="book" />
                              </span>
                              <div className="min-w-0">
                                <div className="summary-file-title-row">
                                  <h4>{item.title}</h4>
                                  {item.version && <span>{item.version}</span>}
                                </div>
                                {item.description && <p className="summary-file-description">{item.description}</p>}
                                <div className="summary-file-meta">
                                  <span>{item.fileName}</span>
                                  <span>·</span>
                                  <span>{fileTypeLabel(item)}</span>
                                  <span>·</span>
                                  <span>{formatFileSize(item.fileSize)}</span>
                                  <span>·</span>
                                  <span>{formatUploadDate(item.uploadDate)}</span>
                                  <span>·</span>
                                  <span>© {item.copyrightOwner}</span>
                                </div>
                              </div>
                              <button
                                className="summary-file-button"
                                disabled={downloadingId === item.id}
                                onClick={() => void downloadFile(item)}
                                title={downloadingId === item.id ? "Download läuft" : "Herunterladen"}
                                type="button"
                              >
                                <AtlasIcon name="download" />
                                <span>{downloadingId === item.id ? "Lädt" : "Laden"}</span>
                              </button>
                            </article>
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function fileTypeLabel(item: SummaryDownload): string {
  const extension = item.fileName.split(".").pop()?.toUpperCase();
  if (extension) return extension;
  return item.fileType || "Datei";
}

function summaryBlockIcon(title: string, subtitle?: string): AtlasIconName {
  const normalized = normalizeText(`${title} ${subtitle || ""}`);
  const number = title.match(/\d+/)?.[0] || "";
  if (normalized.includes("herz") || normalized.includes("atmung") || normalized.includes("gasaustausch")) return "cardio";
  if (normalized.includes("verdauung") || normalized.includes("metabolismus")) return "metabolism";
  if (normalized.includes("niere") || normalized.includes("elektrolyt") || normalized.includes("saure")) return "kidney";
  if (normalized.includes("blut") || normalized.includes("abwehr") || normalized.includes("immun")) return "blood";
  if (normalized.includes("endokrinologie") || normalized.includes("endokrin") || normalized.includes("reproduktion")) return "endocrine";
  if (normalized.includes("zns") || normalized.includes("sinnesorgane") || normalized.includes("verhalten")) return "neuro";
  const fallback: Record<string, AtlasIconName> = {
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
  return fallback[number] || "book";
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
