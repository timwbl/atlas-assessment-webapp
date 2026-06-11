"use client";

import { useEffect, useState } from "react";
import { getStoredSession } from "@/lib/supabaseClient";
import type { MaintenanceStatus } from "@/lib/maintenance";

export function AdminSystemSettings() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings/maintenance", {
        cache: "no-store",
        headers: authorizationHeaders()
      });
      const payload = await response.json().catch(() => null) as (MaintenanceStatus & { error?: string }) | null;
      if (!response.ok) throw new Error(payload?.error || "Systemstatus konnte nicht geladen werden.");
      setStatus(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Systemstatus konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function updateMode(enabled: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings/maintenance", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authorizationHeaders()
        },
        body: JSON.stringify({ enabled })
      });
      const payload = await response.json().catch(() => null) as (MaintenanceStatus & { error?: string }) | null;
      if (!response.ok) throw new Error(payload?.error || "Umbau-Modus konnte nicht gespeichert werden.");
      setStatus(payload);
      setNotice(enabled
        ? "Umbau-Modus ist aktiv. Öffentliche ATLAS-Bereiche sind ab sofort gesperrt."
        : "Umbau-Modus ist inaktiv. Die öffentliche App ist wieder erreichbar."
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Umbau-Modus konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  const enabled = status?.enabled === true;

  return (
    <div className="admin-system-settings">
      <section className="card admin-panel admin-maintenance-panel">
        <div className="admin-section-heading">
          <div>
            <div className="eyebrow">Globale Verfügbarkeit</div>
            <h2>ATLAS Umbau-Modus</h2>
          </div>
          <span className={`admin-status-badge ${enabled ? "admin-status-badge--denied" : "admin-status-badge--success"}`}>
            {loading ? "Prüft…" : enabled ? "Aktiv" : "Inaktiv"}
          </span>
        </div>

        <div className="admin-maintenance-setting">
          <div>
            <strong>Öffentliche App sperren</strong>
            <p>
              Bei aktivem Modus sehen normale Nutzer ausschliesslich den ATLAS-Wartungsbildschirm.
              Adminbereich und Admin-APIs bleiben erreichbar.
            </p>
          </div>
          <label className="admin-switch">
            <input
              aria-label="ATLAS Umbau-Modus"
              checked={enabled}
              disabled={loading || saving || !status}
              onChange={(event) => void updateMode(event.target.checked)}
              role="switch"
              type="checkbox"
            />
            <span aria-hidden="true" />
          </label>
        </div>

        <div className="admin-maintenance-meta">
          <span>Quelle</span>
          <strong>{status?.source === "database" ? "Supabase · global persistent" : "Environment-Fallback"}</strong>
          {status?.updatedAt && <small>Zuletzt geändert: {formatDate(status.updatedAt)}</small>}
        </div>

        {status?.source === "environment" && !loading && (
          <div className="admin-alert admin-alert--warning">
            Die globale Supabase-Einstellung ist noch nicht verfügbar. Führe
            <code>supabase/maintenance-mode.sql</code> aus, bevor du den Toggle produktiv verwendest.
          </div>
        )}
        {notice && <div className="admin-alert admin-alert--success">{notice}</div>}
        {error && (
          <div className="admin-alert admin-alert--warning">
            <span>{error}</span>
            <button onClick={() => void loadStatus()} type="button">Erneut versuchen</button>
          </div>
        )}
      </section>

      <section className="card admin-panel">
        <div className="admin-section-heading">
          <div>
            <div className="eyebrow">Zugriffsschutz</div>
            <h2>Was bleibt erreichbar?</h2>
          </div>
        </div>
        <div className="admin-system-grid">
          <div><strong>Öffentliche Inhalte</strong><span>Dashboard, Assessments, Downloads und direkte URLs werden gesperrt.</span></div>
          <div><strong>Adminbereich</strong><span><code>/admin</code> bleibt für Login und Steuerung verfügbar.</span></div>
          <div><strong>Admin-Session</strong><span>Angemeldete Admins können weiterhin alle Verwaltungsbereiche verwenden.</span></div>
        </div>
      </section>
    </div>
  );
}

function authorizationHeaders(): Record<string, string> {
  const token = getStoredSession()?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
