"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { blockColor } from "@/lib/blockColors";
import {
  blocksForSemester,
  DOWNLOAD_SEMESTERS,
  formatFileSize,
  formatUploadDate,
  loadSummaryDownloads,
  SUMMARY_DOWNLOADS_CHANGED_EVENT,
  triggerSummaryDownload,
  type SemesterId,
  type SummaryDownload
} from "@/lib/summaryDownloads";

export function DownloadLibrary() {
  const [downloads, setDownloads] = useState<SummaryDownload[]>([]);
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState("");
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return downloads.filter((item) => {
      const haystack = [
        item.title,
        item.semester,
        item.blockTitle,
        item.description,
        item.version,
        item.fileName
      ].join(" ").toLowerCase();

      return (!needle || haystack.includes(needle))
        && (!semester || item.semester === semester)
        && (!blockId || item.blockId === blockId);
    });
  }, [blockId, downloads, query, semester]);

  const visibleSemesters = DOWNLOAD_SEMESTERS.filter((item) => !semester || item.id === semester);
  const blockOptions = DOWNLOAD_SEMESTERS.flatMap((item) => blocksForSemester(item.id));

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
    <main id="top" className="shell">
      <header className="glass library-hero rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">ATLAS Downloads</div>
            <h1 className="library-title mt-2 max-w-3xl text-4xl font-black leading-[1.02] md:text-6xl">
              Zusammenfassungen
            </h1>
            <p className="mt-3 max-w-2xl text-[var(--muted)]">
              Blockweise Lernunterlagen, sortiert nach Semester und sauber für den Download vorbereitet.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Dein Fortschritt bleibt getrennt. Downloads sind reine Lernunterlagen.
          </div>
        </div>
      </header>

      <section className="card mt-5 p-4">
        <div className="download-filters grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
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
          <select className="input" value={semester} onChange={(event) => {
            setSemester(event.target.value);
            setBlockId("");
          }}>
            <option value="">Alle Semester</option>
            {DOWNLOAD_SEMESTERS.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          <select className="input" value={blockId} onChange={(event) => setBlockId(event.target.value)}>
            <option value="">Alle Blöcke</option>
            {blockOptions
              .filter((block) => !semester || block.semester === semester)
              .map((block) => (
                <option key={block.id} value={block.id}>{block.semester} · {block.title}</option>
              ))}
          </select>
        </div>
      </section>

      {error && <div className="card mt-5 border-red-300 p-4 text-red-600">{error}</div>}
      {loading && <div className="card mt-5 p-5 text-[var(--muted)]">Zusammenfassungen werden geladen…</div>}

      {!loading && downloads.length === 0 && (
        <section className="card mt-5 p-8 text-center">
          <div className="eyebrow">Noch leer</div>
          <h2 className="mt-2 text-2xl font-black">Noch keine Zusammenfassungen hochgeladen</h2>
          <p className="mt-2 text-[var(--muted)]">Sobald im Admin-Bereich Dateien hinzugefügt wurden, erscheinen sie hier nach Semester und Block.</p>
        </section>
      )}

      {!loading && downloads.length > 0 && (
        <section className="mt-6 grid gap-8">
          {visibleSemesters.map((semesterItem) => (
            <div key={semesterItem.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Semester</div>
                  <h2 className="text-3xl font-black">{semesterItem.title}</h2>
                </div>
                <span className="pill">
                  {filtered.filter((item) => item.semester === semesterItem.id).length} Dateien
                </span>
              </div>

              <div className="grid gap-4">
                {blocksForSemester(semesterItem.id).map((block) => {
                  const blockDownloads = filtered
                    .filter((item) => item.semester === semesterItem.id && item.blockId === block.id)
                    .sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));

                  if (blockId && block.id !== blockId) return null;

                  return (
                    <details className="download-block card overflow-hidden" open key={block.id}>
                      <summary className="download-block-summary" style={{ "--download-accent": blockColor(block.title) } as CSSProperties}>
                        <span>
                          <span className="download-accent-dot" />
                          <strong>{block.title}</strong>
                        </span>
                        <span className="pill">{blockDownloads.length} Zusammenfassung{blockDownloads.length === 1 ? "" : "en"}</span>
                      </summary>

                      <div className="grid gap-3 p-4 pt-0">
                        {blockDownloads.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                            Keine Dateien in diesem Block.
                          </div>
                        ) : (
                          blockDownloads.map((item) => (
                            <article className="download-card" key={item.id}>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-xl font-black leading-tight">{item.title}</h3>
                                  {item.version && <span className="pill">{item.version}</span>}
                                </div>
                                {item.description && <p className="mt-2 text-sm text-[var(--muted)]">{item.description}</p>}
                                <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
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
                              <button className="btn-primary" disabled={downloadingId === item.id} onClick={() => void downloadFile(item)}>
                                {downloadingId === item.id ? "Lädt…" : "Download"}
                              </button>
                            </article>
                          ))
                        )}
                      </div>
                    </details>
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
