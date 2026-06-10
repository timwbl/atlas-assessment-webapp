"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cloudSyncAvailable,
  fetchAdminProfiles,
  fetchAdminProgressRows,
  getCurrentProfile,
  type AdminProfileRow,
  type AdminProgressRow
} from "@/lib/cloudProgress";

export function AdminProgressDashboard() {
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([]);
  const [rows, setRows] = useState<AdminProgressRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | "student" | "admin">("all");

  useEffect(() => {
    void load();
  }, []);

  const progressByUser = useMemo(() => rows.reduce<Record<string, AdminProgressRow[]>>((acc, row) => {
    (acc[row.userId] ||= []).push(row);
    return acc;
  }, {}), [rows]);

  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (role !== "all" && profile.role !== role) return false;
      return !needle || [
        profile.email,
        profile.displayName,
        profile.id
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [profiles, query, role]);

  const totals = useMemo(() => {
    const attempts = rows.reduce((sum, row) => sum + row.attempts, 0);
    const activeCutoff = Date.now() - 7 * 86_400_000;
    return {
      accounts: profiles.length,
      admins: profiles.filter((item) => item.role === "admin").length,
      active: profiles.filter((item) => item.lastSeenAt && new Date(item.lastSeenAt).getTime() >= activeCutoff).length,
      attempts
    };
  }, [profiles, rows]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!cloudSyncAvailable()) throw new Error("Supabase ist noch nicht eingerichtet.");
      const current = await getCurrentProfile();
      if (current?.role !== "admin") throw new Error("Für diese Ansicht ist ein Admin-Account erforderlich.");
      const [nextProfiles, nextRows] = await Promise.all([fetchAdminProfiles(), fetchAdminProgressRows()]);
      setProfiles(nextProfiles);
      setRows(nextRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nutzer konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="admin-loading card" aria-label="Nutzer werden geladen"><span /><span /><span /></div>;
  }

  return (
    <div>
      <section className="card admin-panel">
        <div className="admin-section-heading">
          <div>
            <div className="eyebrow">Accounts & Fortschritt</div>
            <h2>Nutzerübersicht</h2>
            <p>Nur die für den operativen Support nötigen Account- und Lernfortschrittsdaten werden angezeigt.</p>
          </div>
          <button className="btn-secondary" onClick={() => void load()} type="button">Aktualisieren</button>
        </div>

        <div className="admin-stat-grid admin-stat-grid--compact">
          <MiniStat label="Accounts" value={totals.accounts} />
          <MiniStat label="Admins" value={totals.admins} />
          <MiniStat label="Aktiv in 7 Tagen" value={totals.active} />
          <MiniStat label="Versuche" value={totals.attempts} />
        </div>

        <div className="admin-filter-grid admin-filter-grid--users">
          <label className="admin-filter-search">
            <span>Suche</span>
            <input
              className="input"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, E-Mail oder User-ID"
            />
          </label>
          <label>
            <span>Rolle</span>
            <select className="input" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
              <option value="all">Alle Rollen</option>
              <option value="student">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="admin-alert admin-alert--error">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>Erneut versuchen</button>
        </div>
      )}

      <section className="card admin-user-list">
        {filteredProfiles.map((profile) => {
          const progress = progressByUser[profile.id] || [];
          const attempts = progress.reduce((sum, row) => sum + row.attempts, 0);
          const best = progress.length
            ? Math.max(...progress.map((row) => row.bestScore))
            : null;
          return (
            <article key={profile.id}>
              <div className="admin-user-identity">
                <div className="admin-user-avatar">{initials(profile.displayName || profile.email)}</div>
                <div>
                  <strong>{profile.displayName || "Name nicht hinterlegt"}</strong>
                  <span>{profile.email}</span>
                </div>
              </div>
              <div><span>Rolle</span><strong>{profile.role === "admin" ? "Admin" : "User"}</strong></div>
              <div><span>Assessments</span><strong>{progress.length}</strong></div>
              <div><span>Versuche</span><strong>{attempts}</strong></div>
              <div><span>Bester Score</span><strong>{best === null ? "–" : `${best}%`}</strong></div>
              <div><span>Letzte Aktivität</span><strong>{formatLastSeen(profile.lastSeenAt)}</strong></div>
            </article>
          );
        })}
        {!filteredProfiles.length && (
          <div className="admin-empty-state">
            <h3>Keine Nutzer gefunden</h3>
            <p>Passe Suche oder Rollenfilter an.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-mini-stat">
      <span>{label}</span>
      <strong>{value.toLocaleString("de-CH")}</strong>
    </div>
  );
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

function formatLastSeen(value: string | null): string {
  if (!value) return "Noch nie";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
