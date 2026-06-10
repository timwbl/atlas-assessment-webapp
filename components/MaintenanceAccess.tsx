"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function MaintenanceAccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") === "configuration"
      ? "Der Beta-Zugang ist noch nicht vollständig konfiguriert."
      : ""
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/maintenance/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Zugang konnte nicht geprüft werden.");

      const returnTo = safeReturnPath(searchParams.get("returnTo"));
      router.replace(returnTo);
      router.refresh();
    } catch (accessError) {
      setError(accessError instanceof Error ? accessError.message : "Zugang fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="maintenance-page">
      <section className="maintenance-card">
        <div className="maintenance-brand">
          <Image src="/atlas-logo.svg" alt="" width={38} height={38} />
          <span>ATLAS</span>
        </div>
        <div className="eyebrow">Beta-Zugang</div>
        <h1>ATLAS wird aktuell überarbeitet.</h1>
        <p>Die Seite befindet sich im Umbau. Zugriff ist nur für Beta-User möglich.</p>

        <form className="maintenance-form" onSubmit={submit}>
          <label htmlFor="beta-password">Beta-Passwort</label>
          <input
            id="beta-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Beta-Passwort"
            autoFocus
          />
          {error && <p className="maintenance-error">{error}</p>}
          <button className="btn-primary" disabled={busy || !password.trim()} type="submit">
            {busy ? "Zugang wird geprüft..." : "Beta öffnen"}
          </button>
        </form>
      </section>
    </main>
  );
}

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
