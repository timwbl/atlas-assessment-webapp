"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AltfragenAccessPanel } from "./AltfragenAccessPanel";
import { AtlasIcon, type AtlasIconName } from "./AtlasIcon";
import { AtlasDropdown } from "./ui/AtlasDropdown";
import { useUserStudyContext } from "./study/UserStudyProvider";
import {
  ALTFRAGEN_ACCESS_CHANGED_EVENT,
  canAccessAltfragen
} from "@/lib/altfragenAccess";
import { loadAssessmentSummaries } from "@/lib/assessmentClient";
import { formatBlockLabel } from "@/lib/blockLabels";
import { blockColor } from "@/lib/blockColors";
import { getAllProgress, PROGRESS_CHANGED_EVENT } from "@/lib/progressStore";
import {
  altfragenDocumentBlocks,
  DOWNLOAD_SEMESTERS,
  formatFileSize,
  formatUploadDate,
  loadAltfragenDocuments,
  semesterTitle,
  SUMMARY_DOWNLOADS_CHANGED_EVENT,
  triggerSummaryDownload,
  type AltfragenDocument
} from "@/lib/summaryDownloads";
import {
  blockIdForContent,
  examForBlock,
  examForContent,
  examsForSemester,
  isAltfragenValue,
  isThreeDContent,
  type ExamId
} from "@/lib/studyProgram";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import type {
  AssessmentProgress,
  AssessmentSummary,
  LoadedAssessmentSummary
} from "@/lib/types";

type Scope = "all" | "current" | ExamId;

export function AltfragenLibrary() {
  const { settings } = useUserStudyContext();
  const [loaded, setLoaded] = useState<LoadedAssessmentSummary[]>([]);
  const [documents, setDocuments] = useState<AltfragenDocument[]>([]);
  const [progress, setProgress] = useState<Record<string, AssessmentProgress>>({});
  const [access, setAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [scope, setScope] = useState<Scope>("current");
  const [blockId, setBlockId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");

  useEffect(() => {
    void loadAssessmentSummaries()
      .then(setLoaded)
      .catch((loadError: unknown) => setError(
        loadError instanceof Error ? loadError.message : "Altfragen konnten nicht geladen werden."
      ));
    setProgress(getAllProgress());

    function updateProgress() {
      setProgress(getAllProgress());
    }

    window.addEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
  }, []);

  useEffect(() => {
    if (!access) {
      setDocuments([]);
      setDocumentsLoading(false);
      return;
    }

    async function refreshDocuments() {
      setDocumentsLoading(true);
      try {
        setDocuments(await loadAltfragenDocuments());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Altfragen-Dokumente konnten nicht geladen werden.");
      } finally {
        setDocumentsLoading(false);
      }
    }

    void refreshDocuments();
    window.addEventListener(SUMMARY_DOWNLOADS_CHANGED_EVENT, refreshDocuments);
    return () => window.removeEventListener(SUMMARY_DOWNLOADS_CHANGED_EVENT, refreshDocuments);
  }, [access]);

  useEffect(() => {
    async function refreshAccess() {
      setCheckingAccess(true);
      setAccess(await canAccessAltfragen().catch(() => false));
      setCheckingAccess(false);
    }

    void refreshAccess();
    window.addEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, refreshAccess);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshAccess);
    window.addEventListener("storage", refreshAccess);
    return () => {
      window.removeEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, refreshAccess);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshAccess);
      window.removeEventListener("storage", refreshAccess);
    };
  }, []);

  const assessments = useMemo(
    () => loaded
      .map((item) => item.assessment)
      .filter((assessment): assessment is AssessmentSummary => (
        !!assessment
        && isAltfragenValue(assessment.block)
        && !isThreeDContent(assessment)
      )),
    [loaded]
  );

  const currentExams = useMemo(
    () => settings.studyYear === "year1" ? examsForSemester(settings.semester) : [],
    [settings.semester, settings.studyYear]
  );
  const blockOptions = useMemo(
    () => [...new Set([
      ...assessments.map(blockIdForContent),
      ...documents.flatMap((item) => altfragenDocumentBlocks(item).map((block) => blockIdForContent(block.title)))
    ].filter((value): value is string => !!value))]
      .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))),
    [assessments, documents]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assessments.filter((assessment) => {
      const exam = examForContent(assessment);
      const assessmentBlock = blockIdForContent(assessment);
      const scopeMatches = scope === "all"
        || (scope === "current" && (currentExams.length === 0 || (!!exam && currentExams.includes(exam))))
        || scope === exam;
      const queryMatches = !needle || [
        assessment.title,
        assessment.lectureCode,
        assessment.sourceSummary,
        ...assessment.tags
      ].join(" ").toLowerCase().includes(needle);
      return scopeMatches
        && queryMatches
        && (!blockId || assessmentBlock === blockId);
    });
  }, [assessments, blockId, currentExams, query, scope]);
  const filteredDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((document) => {
      const documentBlocks = altfragenDocumentBlocks(document);
      const documentBlockIds = documentBlocks
        .map((block) => blockIdForContent(block.title))
        .filter((value): value is string => !!value);
      const exams = documentBlocks
        .map((block) => examForBlock(block.title))
        .filter((value): value is ExamId => !!value);
      const scopeMatches = scope === "all"
        || (scope === "current" && (currentExams.length === 0 || exams.some((exam) => currentExams.includes(exam))))
        || (scope !== "current" && exams.includes(scope));
      const queryMatches = !needle || [
        document.title,
        document.description,
        document.fileName,
        document.blockTitle,
        semesterTitle(document.semester)
      ].join(" ").toLowerCase().includes(needle);
      return scopeMatches
        && queryMatches
        && (!blockId || documentBlockIds.includes(blockId));
    });
  }, [blockId, currentExams, documents, query, scope]);

  async function downloadDocument(document: AltfragenDocument) {
    setDownloadingId(document.id);
    setError("");
    try {
      await triggerSummaryDownload(document);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Download nicht verfügbar.");
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <main className="shell atlas-subpage-shell altfragen-library-shell" id="top">
      <header className="glass library-hero atlas-subpage-hero altfragen-page-head rounded-[28px] p-6 md:p-8">
        <p className="eyebrow">Prüfungsnahes Training</p>
        <h1 className="library-title mt-2 max-w-3xl text-4xl font-black leading-[1.02] md:text-6xl">
          Altfragen
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Separater Fragenpool für prüfungsnahe Wiederholung. Filtere nach aktueller Lernphase, eMC oder Block.
        </p>
      </header>
      <nav className="mobile-library-tabs mobile-only" aria-label="Fragenbereiche">
        <Link href="/assessments">Übungen</Link>
        <Link className="is-active" href="/altfragen">Altfragen</Link>
      </nav>

      {checkingAccess ? (
        <section className="card mt-5 p-5 text-[var(--muted)]">Zugriff wird geprüft…</section>
      ) : !access ? (
        <div className="mt-5">
          <AltfragenAccessPanel onUnlocked={() => setAccess(true)} />
        </div>
      ) : (
        <>
          <section className="card mt-5 p-4">
            <div className="study-filter-chips altfragen-scope-tabs" aria-label="Altfragen filtern">
              <button className={scope === "all" ? "is-active" : ""} onClick={() => setScope("all")} type="button">
                Alle Altfragen
              </button>
              <button className={scope === "current" ? "is-active" : ""} onClick={() => setScope("current")} type="button">
                Aktuelles Semester
              </button>
              {(["eMC1", "eMC2", "eMC3", "eMC4"] as ExamId[]).map((exam) => (
                <button className={scope === exam ? "is-active" : ""} key={exam} onClick={() => setScope(exam)} type="button">
                  {exam}
                </button>
              ))}
            </div>
            <div className="assessment-filters mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <input
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                className="input"
                inputMode="search"
                name="atlas-altfragen-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Altfragen suchen"
                spellCheck={false}
                type="search"
                value={query}
              />
              <AtlasDropdown
                ariaLabel="Block filtern"
                value={blockId}
                onChange={setBlockId}
                options={[
                  { value: "", label: "Alle Blöcke" },
                  ...blockOptions.map((value) => ({
                    value,
                    label: `Block ${value.replace(/\D/g, "")}`
                  }))
                ]}
              />
            </div>
          </section>

          {error && <div className="card mt-5 border-red-300 p-4 text-red-600">{error}</div>}

          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Auswahl</p>
                <h2 className="text-3xl font-black">{scopeLabel(scope)}</h2>
              </div>
              <span className="pill">{filtered.length} Übungen</span>
            </div>
            {filtered.length ? (
              <div className="altfragen-card-grid">
                {filtered.map((assessment) => (
                  <AltfragenAssessmentCard
                    assessment={assessment}
                    key={assessment.id}
                    progress={progress[assessment.id]}
                  />
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <h3 className="text-2xl font-black">Keine passenden Altfragen</h3>
                <p className="mt-2 text-[var(--muted)]">
                  Für diese Auswahl sind aktuell keine korrekt zugeordneten Altfragen vorhanden.
                </p>
              </div>
            )}
          </section>

          <section className="altfragen-documents-section">
            <div className="altfragen-documents-head">
              <div>
                <p className="eyebrow">Dokumentbibliothek</p>
                <h2>Weitere Altfragen</h2>
                <p>
                  Originaldokumente und zusätzliche Altfragen, die noch nicht als interaktive Übung vorliegen.
                </p>
              </div>
              <span className="pill">{filteredDocuments.length} Dokumente</span>
            </div>

            {documentsLoading ? (
              <div className="card altfragen-documents-loading">Dokumente werden geladen…</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="card altfragen-documents-empty">
                <h3>Noch keine passenden Dokumente</h3>
                <p>
                  Sobald zusätzliche Altfragen hochgeladen wurden, erscheinen sie hier nach Semester und Block.
                </p>
              </div>
            ) : (
              <div className="altfragen-document-semesters">
                {DOWNLOAD_SEMESTERS.map((semester) => {
                  const semesterDocuments = filteredDocuments.filter((document) => document.semester === semester.id);
                  if (!semesterDocuments.length) return null;
                  return (
                    <section className="altfragen-document-semester" key={semester.id}>
                      <div className="altfragen-document-semester-head">
                        <div>
                          <div className="eyebrow">Semester</div>
                          <h3>{semester.title}</h3>
                        </div>
                        <span className="pill">{semesterDocuments.length} Datei{semesterDocuments.length === 1 ? "" : "en"}</span>
                      </div>
                      <div className="altfragen-document-grid">
                        {semesterDocuments.map((document) => (
                          <article
                            className="altfragen-document-card"
                            key={document.id}
                            style={{ "--download-accent": blockColor(altfragenDocumentBlocks(document)[0]?.title || document.blockTitle) } as CSSProperties}
                          >
                            <div className="altfragen-document-icon" aria-hidden="true">
                              <span>{fileTypeLabel(document)}</span>
                            </div>
                            <div className="altfragen-document-copy">
                              <div className="altfragen-document-tags">
                                <span className="download-accent-dot" />
                                {altfragenDocumentBlocks(document).map((block) => (
                                  <span className="pill" key={block.id}>{block.title}</span>
                                ))}
                                {document.version && <span className="pill">{document.version}</span>}
                              </div>
                              <h4>{document.title}</h4>
                              {document.description && (
                                <p>{document.description}</p>
                              )}
                              <small>
                                {fileTypeLabel(document)} · {formatFileSize(document.fileSize)} · {formatUploadDate(document.uploadDate)}
                              </small>
                            </div>
                            <button
                              className="altfragen-document-download"
                              disabled={downloadingId === document.id}
                              onClick={() => void downloadDocument(document)}
                              type="button"
                            >
                              {downloadingId === document.id ? "Lädt…" : "Download"}
                            </button>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function fileTypeLabel(document: AltfragenDocument): string {
  return document.fileName.split(".").pop()?.toUpperCase() || document.fileType || "Datei";
}

function AltfragenAssessmentCard({ assessment, progress }: { assessment: AssessmentSummary; progress?: AssessmentProgress }) {
  const seen = Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length;
  const percent = assessment.questionCount ? Math.round((seen / assessment.questionCount) * 100) : 0;
  const accent = blockColor(assessment.block);
  const blockLabel = formatBlockLabel(assessment.block);
  const exam = examForContent(assessment);
  const icon = blockIcon(assessment.block);
  const title = cleanAltfragenTitle(assessment.title, blockLabel);

  return (
    <Link
      className="altfragen-practice-card"
      href={`/assessment/${assessment.id}?origin=altfragen`}
      prefetch={false}
      style={{ "--altfragen-accent": accent } as CSSProperties}
    >
      <div className="altfragen-practice-top">
        <span className="altfragen-practice-icon">
          <AtlasIcon name={icon} />
        </span>
        <span className="altfragen-practice-percent">{percent}%</span>
      </div>

      <div className="altfragen-practice-copy">
        <p className="eyebrow">Altfragen · {blockLabel}</p>
        <h3>{title}</h3>
        <p>{assessment.subject || "Prüfungsnahe Wiederholung"}</p>
      </div>

      <div className="altfragen-practice-progress" aria-label={`${percent}% gesehen`}>
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>

      <div className="altfragen-practice-footer">
        <span>{assessment.questionCount} Fragen</span>
        {exam ? <span>{exam}</span> : null}
        <strong>Öffnen <span aria-hidden="true">→</span></strong>
      </div>
    </Link>
  );
}

function cleanAltfragenTitle(title: string, blockLabel: string): string {
  const cleaned = title
    .replace(/^Altfragen\s*/i, "")
    .replace(/^Block\s*(\d+)/i, "Block $1")
    .trim();
  return cleaned || blockLabel;
}

function blockIcon(title: string): AtlasIconName {
  const normalized = normalizeText(title);
  const number = title.match(/\d+/)?.[0] || "";
  if (normalized.includes("prufungssimulation") || normalized.includes("pruefungssimulation")) return "target";

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

  return icons[number] || "archive";
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function scopeLabel(scope: Scope): string {
  if (scope === "all") return "Alle Altfragen";
  if (scope === "current") return "Aktuelles Semester";
  return scope;
}
