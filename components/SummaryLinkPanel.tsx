"use client";

import { useEffect, useMemo, useState } from "react";
import { AtlasIcon } from "./AtlasIcon";
import { openSummaryDownload, loadSummaryDownloads, type SummaryDownload } from "@/lib/summaryDownloads";
import {
  createDraftSummaryLink,
  findCandidateSummaries,
  pageRangeLabel,
  resolveSummaryLink,
  saveSummaryLink,
  summaryLinkLabel,
  type ResolvedSummaryLink,
  type SummaryLink
} from "@/lib/summaryLinks";
import type { Assessment } from "@/lib/types";

type Props = {
  assessment: Assessment;
};

export function SummaryLinkPanel({ assessment }: Props) {
  const [resolved, setResolved] = useState<ResolvedSummaryLink | null>(null);
  const [downloads, setDownloads] = useState<SummaryDownload[]>([]);
  const [editing, setEditing] = useState(false);
  const [selectedSummaryId, setSelectedSummaryId] = useState("");
  const [pageStart, setPageStart] = useState("");
  const [pageEnd, setPageEnd] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([resolveSummaryLink(assessment), loadSummaryDownloads()])
      .then(([nextResolved, nextDownloads]) => {
        if (!active) return;
        setResolved(nextResolved);
        setDownloads(nextDownloads);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [assessment]);

  const candidates = useMemo(() => {
    const preferred = findCandidateSummaries(assessment, downloads);
    const preferredIds = new Set(preferred.map((item) => item.id));
    return [
      ...preferred,
      ...downloads.filter((item) => !preferredIds.has(item.id)).slice(0, 12)
    ];
  }, [assessment, downloads]);

  useEffect(() => {
    const nextSummary = resolved?.summary || candidates[0];
    setSelectedSummaryId(nextSummary?.id || "");
    setPageStart(resolved?.pageStart ? String(resolved.pageStart) : "");
    setPageEnd(resolved?.pageEnd ? String(resolved.pageEnd) : "");
    setSectionTitle(resolved?.sectionTitle || assessment.title);
  }, [assessment.title, candidates, resolved]);

  const selectedSummary = candidates.find((item) => item.id === selectedSummaryId) || resolved?.summary || candidates[0];

  async function openLinkedSummary() {
    if (!resolved) return;
    setBusy(true);
    setMessage("");
    try {
      await openSummaryDownload(resolved.summary, { page: resolved.pageStart });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Zusammenfassung konnte nicht geöffnet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLink() {
    if (!selectedSummary) {
      setMessage("Bitte wähle zuerst eine Zusammenfassung aus.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const draft = createDraftSummaryLink(assessment, selectedSummary, resolved?.link);
      const next: SummaryLink = {
        ...draft,
        summaryId: selectedSummary.id,
        blockId: selectedSummary.blockId,
        pageStart: Number(pageStart) || undefined,
        pageEnd: Number(pageEnd) || undefined,
        sectionTitle
      };
      const saved = await saveSummaryLink(next);
      const nextResolved: ResolvedSummaryLink = {
        summary: selectedSummary,
        link: saved,
        exact: !!saved.pageStart,
        pageStart: saved.pageStart,
        pageEnd: saved.pageEnd,
        sectionTitle: saved.sectionTitle,
        source: "manual"
      };
      setResolved(nextResolved);
      setEditing(false);
      setMessage("Verknüpfung gespeichert.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Verknüpfung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  if (!resolved && !candidates.length) return null;

  return (
    <section className="summary-link-panel" aria-label="Zusammenfassung zur Vorlesung">
      <div className="summary-link-panel-main">
        <span className="summary-link-panel-icon" aria-hidden="true">
          <AtlasIcon name="book" />
        </span>
        <div>
          <span className="summary-link-panel-label">Zusammenfassung</span>
          <strong>{resolved ? summaryLinkLabel(resolved) : "Seite verknüpfen"}</strong>
          <p>
            {resolved?.exact
              ? `${resolved.summary.title} · ${pageRangeLabel(resolved)}`
              : "Block-Zusammenfassung gefunden. Hinterlege eine Seite, damit ATLAS direkt dorthin springt."}
          </p>
        </div>
      </div>

      <div className="summary-link-panel-actions">
        {resolved && (
          <button type="button" className="summary-link-button" onClick={openLinkedSummary} disabled={busy}>
            Öffnen
          </button>
        )}
        <button type="button" className="summary-link-ghost" onClick={() => setEditing((value) => !value)}>
          {editing ? "Schliessen" : resolved?.exact ? "Bearbeiten" : "Seite setzen"}
        </button>
      </div>

      {editing && (
        <div className="summary-link-editor">
          <div className="summary-link-summary-list" role="listbox" aria-label="Zusammenfassung auswählen">
            {candidates.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === selectedSummaryId ? "is-selected" : ""}
                onClick={() => setSelectedSummaryId(item.id)}
              >
                <span>{item.blockTitle}</span>
                <strong>{item.title}</strong>
              </button>
            ))}
          </div>

          <div className="summary-link-fields">
            <label>
              <span>Startseite</span>
              <input
                inputMode="numeric"
                min="1"
                type="number"
                value={pageStart}
                onChange={(event) => setPageStart(event.target.value)}
                placeholder="z. B. 42"
              />
            </label>
            <label>
              <span>Bis Seite</span>
              <input
                inputMode="numeric"
                min="1"
                type="number"
                value={pageEnd}
                onChange={(event) => setPageEnd(event.target.value)}
                placeholder="optional"
              />
            </label>
            <label>
              <span>Abschnitt</span>
              <input
                type="text"
                value={sectionTitle}
                onChange={(event) => setSectionTitle(event.target.value)}
                placeholder={assessment.title}
              />
            </label>
            <button type="button" className="summary-link-save" onClick={saveLink} disabled={busy}>
              Speichern
            </button>
          </div>
        </div>
      )}

      {message && <p className="summary-link-message">{message}</p>}
    </section>
  );
}

export function SummaryLinkButton({ assessment }: Props) {
  const [resolved, setResolved] = useState<ResolvedSummaryLink | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void resolveSummaryLink(assessment)
      .then((next) => {
        if (active) setResolved(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [assessment]);

  if (!resolved) return null;

  return (
    <button
      type="button"
      className="summary-link-quiz-button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void openSummaryDownload(resolved.summary, { page: resolved.pageStart })
          .finally(() => setBusy(false));
      }}
    >
      <AtlasIcon name="book" />
      <span>{resolved.exact ? pageRangeLabel(resolved) : "Stoff"}</span>
    </button>
  );
}
