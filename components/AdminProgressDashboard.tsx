"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cloudSyncAvailable,
  fetchAdminProgressRows,
  getCurrentProfile,
  getCurrentUser,
  type AdminProgressRow,
  type CloudProfile
} from "@/lib/cloudProgress";

export function AdminProgressDashboard() {
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [rows, setRows] = useState<AdminProgressRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => [
      row.email,
      row.displayName,
      row.assessmentId
    ].join(" ").toLowerCase().includes(needle));
  }, [query, rows]);

  const totals = useMemo(() => {
    const users = new Set(rows.map((row) => row.userId)).size;
    const attempts = rows.reduce((sum, row) => sum + row.attempts, 0);
    const averageBest = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + row.bestScore, 0) / rows.length)
      : 0;
    return { users, attempts, averageBest };
  }, [rows]);

  async function load() {
    if (!cloudSyncAvailable()) return;
    setLoading(true);
    setError("");
    try {
      const user = await getCurrentUser();
      if (!user) {
        setProfile(null);
        setRows([]);
        return;
      }
      const currentProfile = await getCurrentProfile();
      setProfile(currentProfile);
      if (currentProfile?.role !== "admin") {
        setRows([]);
        return;
      }
      setRows(await fetchAdminProgressRows());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Fortschritt konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  if (!cloudSyncAvailable()) {
    return (
      <section className="card mt-5 p-5">
        <div className="eyebrow">Cloud Progress</div>
        <h2 className="mt-1 text-2xl font-black">Nicht eingerichtet</h2>
        <p className="mt-2 text-[var(--muted)]">
          Setze Supabase-ENV-Variablen, um Account-Sync und Admin-Fortschritt zu aktivieren.
        </p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="card mt-5 p-5">
        <div className="eyebrow">Cloud Progress</div>
        <h2 className="mt-1 text-2xl font-black">Login erforderlich</h2>
        <p className="mt-2 text-[var(--muted)]">Melde dich auf der Library-Seite mit deinem Admin-Account an.</p>
      </section>
    );
  }

  if (profile.role !== "admin") {
    return (
      <section className="card mt-5 p-5">
        <div className="eyebrow">Cloud Progress</div>
        <h2 className="mt-1 text-2xl font-black">Keine Admin-Rolle</h2>
        <p className="mt-2 text-[var(--muted)]">
          Dieser Supabase-Account ist als Student markiert. Setze `profiles.role = admin`, um Fortschritte aller Accounts zu sehen.
        </p>
      </section>
    );
  }

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">Cloud Progress</div>
          <h2 className="mt-1 text-2xl font-black">Fortschritt der Accounts</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Nur synchronisierte Accounts erscheinen hier.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-full lg:w-72"
            type="search"
            name="atlas-admin-progress-search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="User oder Assessment suchen"
          />
          <button className="btn-secondary" disabled={loading} onClick={load}>Aktualisieren</button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Stat label="Accounts" value={totals.users} />
        <Stat label="Versuche" value={totals.attempts} />
        <Stat label="Ø bester Score" value={`${totals.averageBest}%`} />
      </div>

      {error && <p className="mt-4 rounded-2xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Assessment</th>
              <th className="px-3 py-2">Best</th>
              <th className="px-3 py-2">Letzter</th>
              <th className="px-3 py-2">Versuche</th>
              <th className="px-3 py-2">Gesehen</th>
              <th className="px-3 py-2">Review</th>
              <th className="px-3 py-2">Aktualisiert</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr className="bg-[var(--surface-strong)]" key={`${row.userId}-${row.assessmentId}`}>
                <td className="rounded-l-2xl px-3 py-3">
                  <strong>{row.email}</strong>
                  {row.displayName && <div className="text-xs text-[var(--muted)]">{row.displayName}</div>}
                </td>
                <td className="px-3 py-3">{row.assessmentId}</td>
                <td className="px-3 py-3 font-black">{row.bestScore}%</td>
                <td className="px-3 py-3">{row.lastScore ?? "-"}%</td>
                <td className="px-3 py-3">{row.attempts}</td>
                <td className="px-3 py-3">{row.seenQuestions}</td>
                <td className="px-3 py-3">{row.reviewQuestions}</td>
                <td className="rounded-r-2xl px-3 py-3 text-[var(--muted)]">{new Date(row.updatedAt).toLocaleDateString("de-CH")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="py-5 text-sm text-[var(--muted)]">Noch keine synchronisierten Fortschritte vorhanden.</p>}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
      <div className="eyebrow">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
