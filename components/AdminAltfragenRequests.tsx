"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ALTFRAGEN_ACCESS_CHANGED_EVENT,
  loadAdminAltfragenRequests,
  setAltfragenRequestStatus,
  type AltfragenAccessRequest
} from "@/lib/altfragenAccess";

export function AdminAltfragenRequests() {
  const [requests, setRequests] = useState<AltfragenAccessRequest[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void refresh();

    function onChange() {
      void refresh();
    }

    window.addEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, onChange);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((request) => [
      request.displayName,
      request.userEmail,
      request.status,
      `${request.studyYear}`
    ].join(" ").toLowerCase().includes(needle));
  }, [query, requests]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setRequests(await loadAdminAltfragenRequests());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Altfragen-Anfragen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: "approved" | "denied" | "pending") {
    setError("");
    try {
      await setAltfragenRequestStatus(id, status);
      await refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status konnte nicht geändert werden.");
    }
  }

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">Altfragen Zugriff</div>
          <h2 className="mt-1 text-2xl font-black">Freigabe-Anfragen</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">User können Altfragen erst nach deiner Freigabe öffnen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-full lg:w-72"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Anfragen suchen"
          />
          <button className="btn-secondary" disabled={loading} onClick={() => void refresh()}>Aktualisieren</button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-2xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-3">
        {filtered.map((request) => (
          <article className="admin-review-row" key={request.id}>
            <div className="min-w-0">
              <div className="eyebrow">{statusLabel(request.status)} · {request.studyYear}. Studienjahr</div>
              <h3 className="mt-1 font-black">{request.displayName}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{request.userEmail}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Aktualisiert: {new Date(request.updatedAt).toLocaleString("de-CH")}
              </p>
            </div>
            <div className="admin-review-actions">
              <button className={request.status === "approved" ? "btn-secondary" : "btn-primary"} onClick={() => void setStatus(request.id, "approved")}>
                Freigeben
              </button>
              <button className={request.status === "denied" ? "btn-secondary" : "btn-danger"} onClick={() => void setStatus(request.id, "denied")}>
                Ablehnen
              </button>
              {request.status !== "pending" && (
                <button className="btn-secondary" onClick={() => void setStatus(request.id, "pending")}>Zurück auf offen</button>
              )}
            </div>
          </article>
        ))}
        {!filtered.length && <p className="py-4 text-sm text-[var(--muted)]">Noch keine Altfragen-Anfragen vorhanden.</p>}
      </div>
    </section>
  );
}

function statusLabel(status: AltfragenAccessRequest["status"]): string {
  if (status === "approved") return "Freigegeben";
  if (status === "denied") return "Abgelehnt";
  return "Ausstehend";
}
