"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signInWithPassword } from "@/lib/cloudProgress";
import { syncMemberSession } from "@/lib/memberSession";
import { signInWithOAuthProvider } from "@/lib/supabaseOAuth";
import { safeReturnPath } from "@/lib/memberAccess";
import Image from "next/image";

export function MaintenanceScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function enter() {
    window.location.replace(safeReturnPath(new URLSearchParams(window.location.search).get("returnTo")));
  }
  useEffect(() => {
    let active = true;
    void syncMemberSession().then((member) => { if (active && member?.priority) enter(); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signInWithPassword(email.trim(), password);
      const member = await syncMemberSession();
      if (!member?.priority) throw new Error("Während des Umbaus ist der Zugang für Admins und den Close Circle geöffnet.");
      enter();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.");
    } finally { setBusy(false); }
  }
  return (
    <main className="maintenance-page">
      <section className="maintenance-screen" aria-labelledby="maintenance-title">
        <div className="maintenance-logo">
          <Image
            src="/atlas-logo.svg"
            alt="ATLAS"
            width={144}
            height={144}
            priority
          />
        </div>
        <p className="eyebrow">ATLAS Study OS</p>
        <h1 id="maintenance-title">ATLAS befindet sich aktuell im Umbau.</h1>
        <p className="maintenance-message">
          Wir verbessern gerade die Plattform, damit dein Lernen noch strukturierter,
          schneller und präziser wird.
        </p>
        <div className="maintenance-loader" aria-label="Umbau läuft" role="status">
          <span />
        </div>
        <p className="maintenance-subtext">Bitte versuche es später nochmals.</p>
        <details className="maintenance-member-login">
          <summary>Zugang für Close Circle & Admins</summary>
          <button className="btn-secondary" disabled={busy} type="button" onClick={() => {
            setBusy(true);
            void signInWithOAuthProvider("google").catch((error) => {
              setError(error instanceof Error ? error.message : "Google-Anmeldung fehlgeschlagen.");
              setBusy(false);
            });
          }}>Mit Google anmelden</button>
          <form onSubmit={login}>
            <label>E-Mail<input className="input" autoComplete="username" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Passwort<input className="input" autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <button className="btn-primary" disabled={busy} type="submit">{busy ? "Prüft Zugang …" : "Anmelden"}</button>
            {error && <p role="alert">{error}</p>}
          </form>
        </details>
      </section>
    </main>
  );
}
