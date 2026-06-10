"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALTFRAGEN_ACCESS_CHANGED_EVENT,
  loadAdminAltfragenRequests,
  setAltfragenRequestStatus,
  type AltfragenAccessRequest,
  type AltfragenRequestStatus
} from "@/lib/altfragenAccess";

type SortMode = "newest" | "status" | "name";

export function AdminAltfragenRequests() {
  const [requests, setRequests] = useState<AltfragenAccessRequest[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatusFilter] = useState<AltfragenRequestStatus | "all">("all");
  const [studyYear, setStudyYear] = useState("all");
  const [period, setPeriod] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!requests.length) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const requestId = hash.startsWith("altfragen-request-")
      ? hash.replace("altfragen-request-", "")
      : "";
    if (requestId && requests.some((request) => request.id === requestId)) {
      setSelectedId(requestId);
    }
  }, [requests]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff = period === "all" ? 0 : Date.now() - Number(period) * 86_400_000;
    return requests
      .filter((request) => status === "all" || request.status === status)
      .filter((request) => studyYear === "all" || request.studyYear === Number(studyYear))
      .filter((request) => !cutoff || new Date(request.updatedAt).getTime() >= cutoff)
      .filter((request) => !needle || [
        request.displayName,
        request.userEmail,
        request.status,
        request.id,
        `${request.studyYear}. Studienjahr`
      ].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === "name") return a.displayName.localeCompare(b.displayName, "de");
        if (sort === "status") return statusWeight(a.status) - statusWeight(b.status)
          || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [period, query, requests, sort, status, studyYear]);

  const selected = requests.find((request) => request.id === selectedId) || null;
  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter((item) => item.status === "pending").length,
    approved: requests.filter((item) => item.status === "approved").length,
    denied: requests.filter((item) => item.status === "denied").length
  }), [requests]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const next = await loadAdminAltfragenRequests();
      setRequests(next);
      setSelectedId((current) => current || next[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Altfragen-Anfragen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, nextStatus: AltfragenRequestStatus) {
    setBusyId(id);
    setError("");
    try {
      await setAltfragenRequestStatus(id, nextStatus);
      setRequests((current) => current.map((item) => (
        item.id === id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item
      )));
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status konnte nicht geändert werden.");
    } finally {
      setBusyId("");
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  return (
    <div id="altfragen-requests">
      <section className="card admin-panel">
        <div className="admin-section-heading">
          <div>
            <div className="eyebrow">Zugriffsverwaltung</div>
            <h2>Altfragen-Anfragen</h2>
            <p>Freigaben prüfen, Kontaktangaben kopieren und Status direkt verwalten.</p>
          </div>
          <button className="btn-secondary" disabled={loading} onClick={() => void refresh()} type="button">
            {loading ? "Lädt…" : "Aktualisieren"}
          </button>
        </div>

        <div className="admin-request-counts">
          <Count label="Alle" value={counts.all} active={status === "all"} onClick={() => setStatusFilter("all")} />
          <Count label="Neu" value={counts.pending} active={status === "pending"} onClick={() => setStatusFilter("pending")} />
          <Count label="Erledigt" value={counts.approved} active={status === "approved"} onClick={() => setStatusFilter("approved")} />
          <Count label="Abgelehnt" value={counts.denied} active={status === "denied"} onClick={() => setStatusFilter("denied")} />
        </div>

        <div className="admin-filter-grid">
          <label className="admin-filter-search">
            <span>Suche</span>
            <input
              className="input"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, E-Mail oder Request-ID"
            />
          </label>
          <label>
            <span>Studienjahr</span>
            <select className="input" value={studyYear} onChange={(event) => setStudyYear(event.target.value)}>
              <option value="all">Alle</option>
              {Array.from({ length: 6 }, (_, index) => index + 1).map((year) => (
                <option key={year} value={year}>{year}. Studienjahr</option>
              ))}
            </select>
          </label>
          <label>
            <span>Zeitraum</span>
            <select className="input" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="all">Gesamter Zeitraum</option>
              <option value="7">Letzte 7 Tage</option>
              <option value="30">Letzte 30 Tage</option>
            </select>
          </label>
          <label>
            <span>Sortierung</span>
            <select className="input" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="newest">Neueste zuerst</option>
              <option value="status">Status</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="admin-alert admin-alert--error">
          <span>{error}</span>
          <button type="button" onClick={() => void refresh()}>Erneut versuchen</button>
        </div>
      )}

      {loading ? (
        <div className="admin-loading card" aria-label="Anfragen werden geladen"><span /><span /><span /></div>
      ) : (
        <div className="admin-request-layout">
          <section className="card admin-request-list" aria-label="Altfragen-Anfragen">
            {filtered.map((request) => (
              <button
                className={selectedId === request.id ? "is-active" : ""}
                id={`altfragen-request-${request.id}`}
                key={request.id}
                onClick={() => setSelectedId(request.id)}
                type="button"
              >
                <div>
                  <StatusBadge status={request.status} />
                  <span>{formatRelativeDate(request.updatedAt)}</span>
                </div>
                <strong>{request.displayName}</strong>
                <small>{request.userEmail}</small>
                <small>{request.studyYear}. Studienjahr · {shortId(request.id)}</small>
              </button>
            ))}
            {!filtered.length && (
              <div className="admin-empty-state">
                <h3>Keine Anfragen gefunden</h3>
                <p>Für die gewählten Filter gibt es aktuell keine Einträge.</p>
              </div>
            )}
          </section>

          <section className="card admin-request-detail">
            {selected ? (
              <>
                <div className="admin-request-detail-header">
                  <div>
                    <StatusBadge status={selected.status} />
                    <h2>{selected.displayName}</h2>
                    <p>{selected.studyYear}. Studienjahr</p>
                  </div>
                  <a className="btn-secondary" href={`mailto:${selected.userEmail}`}>E-Mail öffnen</a>
                </div>

                <dl className="admin-detail-list">
                  <Detail label="E-Mail" value={selected.userEmail} onCopy={() => void copy(selected.userEmail, "E-Mail")} copied={copied === "E-Mail"} />
                  <Detail label="Request-ID" value={selected.id} onCopy={() => void copy(selected.id, "ID")} copied={copied === "ID"} />
                  <Detail label="Eingegangen" value={formatDate(selected.createdAt)} />
                  <Detail label="Letzte Änderung" value={formatDate(selected.updatedAt)} />
                </dl>

                <div className="admin-detail-note">
                  <strong>Verfügbare Angaben</strong>
                  <p>
                    Das aktuelle Datenmodell speichert Name, E-Mail und Studienjahr. Semester, Prüfung, Block,
                    Nachricht und Uploads werden bewusst nicht erfunden und erst nach einer späteren Schema-Erweiterung angezeigt.
                  </p>
                </div>

                <div className="admin-detail-actions">
                  <button
                    className="btn-primary"
                    disabled={busyId === selected.id || selected.status === "approved"}
                    onClick={() => void updateStatus(selected.id, "approved")}
                    type="button"
                  >
                    Als erledigt freigeben
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={busyId === selected.id || selected.status === "pending"}
                    onClick={() => void updateStatus(selected.id, "pending")}
                    type="button"
                  >
                    Wieder öffnen
                  </button>
                  <button
                    className="btn-danger"
                    disabled={busyId === selected.id || selected.status === "denied"}
                    onClick={() => void updateStatus(selected.id, "denied")}
                    type="button"
                  >
                    Ablehnen
                  </button>
                </div>
              </>
            ) : (
              <div className="admin-empty-state">
                <h3>Anfrage auswählen</h3>
                <p>Wähle links eine Anfrage, um alle verfügbaren Angaben und Aktionen zu sehen.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Count(props: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button className={props.active ? "is-active" : ""} onClick={props.onClick} type="button">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: AltfragenRequestStatus }) {
  return <span className={`admin-status-badge admin-status-badge--${status}`}>{statusLabel(status)}</span>;
}

function Detail(props: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>
        <span>{props.value}</span>
        {props.onCopy && <button type="button" onClick={props.onCopy}>{props.copied ? "Kopiert" : "Kopieren"}</button>}
      </dd>
    </div>
  );
}

function statusLabel(status: AltfragenRequestStatus): string {
  if (status === "approved") return "Erledigt";
  if (status === "denied") return "Abgelehnt";
  return "Neu";
}

function statusWeight(status: AltfragenRequestStatus): number {
  if (status === "pending") return 0;
  if (status === "approved") return 1;
  return 2;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatRelativeDate(value: string): string {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Heute";
  if (days === 1) return "Gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return new Date(value).toLocaleDateString("de-CH");
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
