"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  canUseSummaryStorage,
  COPYRIGHT_OWNER,
  deleteSummaryDownload,
  downloadBlocksForSemester,
  DOWNLOAD_SEMESTERS,
  fileToDataUrl,
  formatFileSize,
  formatUploadDate,
  getSummaryBlock,
  loadSummaryDownloadFile,
  loadSummaryDownloads,
  MAX_SUMMARY_FILE_SIZE,
  saveSummaryDownload,
  semesterTitle,
  storageModeLabel,
  SUMMARY_DOWNLOADS_CHANGED_EVENT,
  triggerSummaryDownload,
  uploadSummaryFileToStorage,
  validateSummaryFile,
  type SemesterId,
  type SummaryDownload
} from "@/lib/summaryDownloads";

type Draft = {
  id: string;
  title: string;
  semester: SemesterId;
  blockId: string;
  description: string;
  version: string;
  file: File | null;
};

const emptyDraft = (): Draft => {
  const semester: SemesterId = "HS2025";
  return {
    id: "",
    title: "",
    semester,
    blockId: downloadBlocksForSemester(semester)[0]?.id || "",
    description: "",
    version: "",
    file: null
  };
};

export function AdminDownloadsManager() {
  const [downloads, setDownloads] = useState<SummaryDownload[]>([]);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [editing, setEditing] = useState<SummaryDownload | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void refresh();

    function onChange() {
      void refresh();
    }

    window.addEventListener(SUMMARY_DOWNLOADS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SUMMARY_DOWNLOADS_CHANGED_EVENT, onChange);
  }, []);

  const blockOptions = useMemo(() => downloadBlocksForSemester(draft.semester), [draft.semester]);

  async function refresh() {
    setDownloads(await loadSummaryDownloads());
  }

  function resetForm() {
    setDraft(emptyDraft());
    setEditing(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function edit(item: SummaryDownload) {
    setEditing(item);
    setDraft({
      id: item.id,
      title: item.title,
      semester: item.semester,
      blockId: item.blockId,
      description: item.description,
      version: item.version,
      file: null
    });
    setError("");
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const title = draft.title.trim();
      if (!title) throw new Error("Bitte gib einen Titel ein.");
      const block = getSummaryBlock(draft.blockId);
      if (!block) throw new Error("Bitte wähle einen Block aus.");
      if (!editing && !draft.file) throw new Error("Bitte wähle eine Datei aus.");

      const summaryId = editing?.id || crypto.randomUUID();
      let fileData = editing?.fileData;
      let filePath = editing?.filePath;
      let downloadUrl = editing?.downloadUrl;
      let fileName = editing?.fileName || "";
      let fileType = editing?.fileType || "";
      let fileSize = editing?.fileSize || 0;

      if (draft.file) {
        const fileError = validateSummaryFile(draft.file);
        if (fileError) throw new Error(fileError);
        fileName = draft.file.name;
        fileType = draft.file.type || "application/octet-stream";
        fileSize = draft.file.size;
        if (await canUseSummaryStorage()) {
          const uploaded = await uploadSummaryFileToStorage(draft.file, summaryId);
          filePath = uploaded.filePath;
          downloadUrl = uploaded.downloadUrl;
          fileData = undefined;
        } else {
          fileData = await fileToDataUrl(draft.file);
          filePath = undefined;
          downloadUrl = undefined;
        }
      } else if (editing && !fileData) {
        const complete = await loadSummaryDownloadFile(editing.id);
        fileData = complete?.fileData;
        filePath = complete?.filePath;
        downloadUrl = complete?.downloadUrl;
      }

      if (!fileData && !filePath && !downloadUrl) {
        throw new Error("Die bestehende Datei konnte nicht geladen werden. Bitte lade sie erneut hoch.");
      }

      const now = new Date().toISOString();
      const summary: SummaryDownload = {
        id: summaryId,
        title,
        semester: draft.semester,
        blockId: block.id,
        blockTitle: block.title,
        description: draft.description.trim(),
        version: draft.version.trim(),
        fileName,
        fileType,
        fileSize,
        uploadDate: editing?.uploadDate || now,
        copyrightOwner: COPYRIGHT_OWNER,
        fileData,
        filePath,
        downloadUrl,
        createdAt: editing?.createdAt || now,
        updatedAt: now
      };

      await saveSummaryDownload(summary);
      await refresh();
      resetForm();
      setMessage("Zusammenfassung gespeichert. © Tim Weibel wurde in den App-Metadaten hinterlegt.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: SummaryDownload) {
    if (!confirm(`"${item.title}" wirklich löschen?`)) return;
    await deleteSummaryDownload(item.id);
    await refresh();
    if (editing?.id === item.id) resetForm();
  }

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="eyebrow">Admin Downloads</div>
          <h2 className="mt-1 text-2xl font-black">Zusammenfassungen verwalten</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Dateien werden Block-Zusammenfassungen zugeordnet, nicht einzelnen Vorlesungen. Speicher: {storageModeLabel()}
          </p>
        </div>
        <a className="btn-secondary inline-flex items-center" href="/downloads">Downloadbereich öffnen</a>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
          <h3 className="font-black">{editing ? "Zusammenfassung bearbeiten" : "Neue Zusammenfassung"}</h3>
          <div className="mt-4 grid gap-3">
            <label>
              <span className="eyebrow">Titel</span>
              <input className="input mt-2" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="eyebrow">Semester</span>
                <select
                  className="input mt-2"
                  value={draft.semester}
                  onChange={(event) => {
                    const semester = event.target.value as SemesterId;
                    setDraft({ ...draft, semester, blockId: downloadBlocksForSemester(semester)[0]?.id || "" });
                  }}
                >
                  {DOWNLOAD_SEMESTERS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              <label>
                <span className="eyebrow">Block</span>
                <select className="input mt-2" value={draft.blockId} onChange={(event) => setDraft({ ...draft, blockId: event.target.value })}>
                  {blockOptions.map((block) => <option key={block.id} value={block.id}>{block.title}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span className="eyebrow">Beschreibung optional</span>
              <textarea className="input mt-2 min-h-24 py-3" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </label>
            <label>
              <span className="eyebrow">Version optional</span>
              <input className="input mt-2" placeholder="z. B. v1.0 oder 26.05.2026" value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value })} />
            </label>
            <label>
              <span className="eyebrow">Datei {editing ? "optional ersetzen" : "hochladen"}</span>
              <input
                ref={fileInputRef}
                className="input mt-2 py-2"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.zip"
                onChange={(event) => setDraft({ ...draft, file: event.target.files?.[0] || null })}
              />
              <span className="mt-2 block text-xs text-[var(--muted)]">Maximal {formatFileSize(MAX_SUMMARY_FILE_SIZE)}. Copyright wird als App-Metadatum erzwungen.</span>
            </label>

            {error && <p className="rounded-2xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
            {message && <p className="rounded-2xl border border-green-300 bg-green-500/10 p-3 text-sm text-green-700">{message}</p>}

            <div className="grid gap-2 md:grid-cols-2">
              <button className="btn-primary" disabled={saving} onClick={() => void save()}>
                {saving ? "Speichert…" : editing ? "Änderungen speichern" : "Datei speichern"}
              </button>
              <button className="btn-secondary" onClick={resetForm}>Reset</button>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-strong)] p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-black">Hochgeladene Dateien</h3>
            <span className="pill">{downloads.length}</span>
          </div>

          <div className="mt-4 grid max-h-[620px] gap-3 overflow-y-auto pr-1">
            {downloads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                Noch keine Zusammenfassungen hochgeladen.
              </div>
            ) : (
              downloads.map((item) => (
                <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="eyebrow">{semesterTitle(item.semester)} · {item.blockTitle}</div>
                      <h4 className="mt-1 font-black leading-tight">{item.title}</h4>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {item.fileName} · {formatFileSize(item.fileSize)} · {formatUploadDate(item.uploadDate)} · © {item.copyrightOwner}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <button className="btn-secondary" onClick={() => edit(item)}>Bearbeiten</button>
                    <button className="btn-secondary" onClick={() => void triggerSummaryDownload(item)}>Testdownload</button>
                    <button className="btn-danger" onClick={() => void remove(item)}>Löschen</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
