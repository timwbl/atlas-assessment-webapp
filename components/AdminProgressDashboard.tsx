"use client";

import { useEffect, useMemo, useState } from "react";
import { AtlasDropdown } from "./ui/AtlasDropdown";
import {
  cloudSyncAvailable,
  setCloseCircle,
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
  const [year, setYear] = useState("all");
  const [circle, setCircle] = useState("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
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
      if (year !== "all" && String(profile.studyYear || "unknown") !== year) return false;
      if (circle !== "all" && profile.closeCircle !== (circle === "yes")) return false;
      if (role !== "all" && profile.role !== role) return false;
      return !needle || [
        profile.email,
        profile.displayName,
        profile.id
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [profiles, query, role, year, circle]);

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
      setError(loadError instanceof Error ? loadError.message : "Nutzer:innen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleCircle(profile: AdminProfileRow) {
    setSaving(profile.id);
    setError("");
    setNotice("");
    try {
      await setCloseCircle(profile.id, !profile.closeCircle);
      setProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, closeCircle: !profile.closeCircle } : item));
      setNotice(`${profile.displayName || profile.email}: ${profile.closeCircle ? "aus dem Close Circle entfernt" : "zum Close Circle hinzugefügt"}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Änderung fehlgeschlagen.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="admin-loading card" aria-label="Nutzer:innen werden geladen"><span /><span /><span /></div>;
  }

  return (
    <div>
      <section className="card admin-panel">
        <div className="admin-section-heading">
          <div>
            <div className="eyebrow">Accounts & Fortschritt</div>
            <h2>Nutzer:innenübersicht</h2>
            <p>Nur die für den operativen Support nötigen Account- und Lernfortschrittsdaten werden angezeigt.</p>
          </div>
          <button className="btn-secondary" onClick={() => void load()} type="button">Aktualisieren</button>
        </div>

        <div className="admin-stat-grid admin-stat-grid--compact">
          <MiniStat label="Accounts" value={totals.accounts} />
          <MiniStat label="Administrator:innen" value={totals.admins} />
          <MiniStat label="Aktiv in 7 Tagen" value={totals.active} />
          <MiniStat label="Versuche" value={totals.attempts} />
        </div>

        <div className="admin-filter-grid admin-filter-grid--users">
          <label className="admin-filter-search">
            <span>Person suchen</span>
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
            <AtlasDropdown
              ariaLabel="Rolle filtern"
              value={role}
              onChange={(value) => setRole(value as typeof role)}
              options={[
                { value: "all", label: "Alle Rollen" },
                { value: "student", label: "User" },
                { value: "admin", label: "Admin" }
              ]}
            />
          </label>
          <label><span>Studienjahr</span><AtlasDropdown ariaLabel="Studienjahr filtern" value={year} onChange={setYear} options={[
            { value: "all", label: "Alle Studienjahre" },
            ...[1, 2, 3, 4, 5, 6].map((year) => ({ value: String(year), label: `${year}. Studienjahr` })),
            { value: "unknown", label: "Ohne Angabe" }
          ]} /></label>
          <label><span>Close Circle</span><AtlasDropdown ariaLabel="Close Circle filtern" value={circle} onChange={setCircle} options={[
            { value: "all", label: "Alle Personen" }, { value: "yes", label: "Im Close Circle" }, { value: "no", label: "Nicht im Close Circle" }
          ]} /></label>
        </div>
        <div className="admin-year-legend" aria-label="Farben der Studienjahre">
          {[1, 2, 3, 4, 5, 6].map((year) => <span key={year}><i className={`study-year-color study-year-color--${year}`} />{year}. Jahr</span>)}
          <span><i className="study-year-color study-year-color--unknown" />Ohne Angabe</span>
        </div>
        <p>{filteredProfiles.length} von {profiles.length} Personen · Close Circle erhält Zugang während des Wartungsmodus.</p>
        {notice && <p role="status">{notice}</p>}
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
                <div title={profile.studyYear ? `${profile.studyYear}. Studienjahr` : "Studienjahr nicht angegeben"} className={`admin-user-avatar study-year-color study-year-color--${profile.studyYear || "unknown"}`}>{initials(profile.displayName || profile.email)}</div>
                <div>
                  <strong>{profile.displayName || "Name nicht hinterlegt"}</strong>
                  <span>{profile.email}</span>
                  <small>{profile.studyYear ? `${profile.studyYear}. Studienjahr` : "Studienjahr nicht angegeben"}</small>
                </div>
              </div>
              <div className="admin-circle-control">
                <button type="button" className={profile.closeCircle ? "btn-secondary is-close-circle" : "btn-secondary"}
                  aria-label={`${profile.displayName || profile.email}: Close Circle ${profile.closeCircle ? "entfernen" : "hinzufügen"}`}
                  aria-pressed={profile.closeCircle} disabled={saving !== null} onClick={() => void toggleCircle(profile)}>
                  {saving === profile.id ? "Speichert …" : profile.closeCircle ? "Close Circle entfernen" : "+ Close Circle"}
                </button>
              </div>
              <div><span>Rolle</span><strong>{profile.role === "admin" ? "Admin" : "User"}</strong></div>
              <div><span>Übungen</span><strong>{progress.length}</strong></div>
              <div><span>Versuche</span><strong>{attempts}</strong></div>
              <div><span>Bester Score</span><strong>{best === null ? "–" : `${best}%`}</strong></div>
              <div><span>Letzte Aktivität</span><strong>{formatLastSeen(profile.lastSeenAt)}</strong></div>
            </article>
          );
        })}
        {!filteredProfiles.length && (
          <div className="admin-empty-state">
            <h3>Keine Nutzer:innen gefunden</h3>
            <p>Passe Suche oder Filter an.</p>
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
