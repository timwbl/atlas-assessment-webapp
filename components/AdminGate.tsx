"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminWorkspace } from "./admin/AdminWorkspace";
import { getCurrentProfile } from "@/lib/cloudProgress";
import { AUTH_SESSION_CHANGED_EVENT, getStoredSession } from "@/lib/supabaseClient";

export function AdminGate() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [checkingAccount, setCheckingAccount] = useState(true);

  useEffect(() => {
    async function checkAdminAccount() {
      setCheckingAccount(true);
      try {
        const existing = await fetch("/api/admin/access", { cache: "no-store" });
        if (existing.ok) {
          setUnlocked(true);
          setError("");
          return;
        }

        const profile = await getCurrentProfile().catch(() => null);
        const token = getStoredSession()?.access_token;
        if (profile?.role === "admin" && token) {
          const response = await fetch("/api/admin/access", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: "{}"
          });
          if (response.ok) {
            setUnlocked(true);
            setError("");
          }
        }
      } finally {
        setCheckingAccount(false);
      }
    }

    void checkAdminAccount();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, checkAdminAccount);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, checkAdminAccount);
  }, []);

  async function login() {
    setCheckingAccount(true);
    setError("");
    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Admin-Zugang abgelehnt.");
      setUnlocked(true);
      setPassword("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Admin-Zugang abgelehnt.");
    } finally {
      setCheckingAccount(false);
    }
  }

  if (unlocked) return <AdminWorkspace />;

  return (
    <main className="shell admin-login-page">
      <Link className="btn-secondary inline-flex items-center" href="/">Zur App</Link>
      <section className="glass admin-login-card mx-auto mt-8 max-w-xl">
        <h1>ATLAS Admin</h1>
        <p className="mt-3 text-[var(--muted)]">
          Mit einem Admin-Konto öffnet sich die Verwaltung automatisch. Alternativ kannst du das Admin-Passwort eingeben.
        </p>
        <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); void login(); }}>
          <label className="grid gap-1">
            Admin-Passwort
            <input
              autoComplete="current-password"
              className="input"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button className="btn-primary" disabled={checkingAccount || !password} type="submit">
            {checkingAccount ? "Adminstatus wird geprüft …" : "Verwaltung öffnen"}
          </button>
        </form>
      </section>
    </main>
  );
}
