"use client";

import { useState } from "react";
import { ensureSession } from "@/lib/supabaseClient";

export function AdminMc1CatalogImport({ onImported }: { onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload() {
    if (!file) return;
    setMessage("");
    setError("");
    setSaving(true);
    try {
      const session = await ensureSession();
      if (!session) throw new Error("Bitte melde dich mit deinem Admin-Konto an.");
      const response = await fetch("/api/altfragen/kataloge", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: file,
      });
      const payload = await response.json().catch(() => null) as {
        error?: string; catalogCount?: number; questionCount?: number;
      } | null;
      if (!response.ok || !payload?.catalogCount) {
        throw new Error(payload?.error || "Der Import ist fehlgeschlagen.");
      }
      setMessage(`${payload.catalogCount} Kataloge mit ${payload.questionCount} Fragen gespeichert.`);
      onImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Import ist fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card admin-panel mb-4" aria-label="MC1-Altfragen importieren">
      <h2>MC1-Altfragen importieren</h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label>
          <span className="eyebrow">Katalogdatei</span>
          <input type="file" accept=".json,application/json" className="input mt-1"
            onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button className="btn-primary" type="button" disabled={!file || saving} onClick={() => void upload()}>
          {saving ? "Importiert …" : "Kataloge importieren"}
        </button>
      </div>
      {message && <p className="mt-2" role="status">{message}</p>}
      {error && <p className="mt-2 admin-alert admin-alert--error" role="alert">{error}</p>}
    </section>
  );
}
