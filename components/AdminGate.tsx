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
    <main className="shell">
      <Link className="btn-secondary inline-flex items-center" href="/">Zur Library</Link>
      <section className="glass admin-login-card mx-auto mt-8 max-w-xl">
        <div className="admin-kicker">GESCHÜTZTER BEREICH</div>
        <h1>ATLAS Admin</h1>
        <p className="mt-3 text-[var(--muted)]">
          Admin-Accounts werden automatisch erkannt. Der alternative Zugang wird serverseitig geprüft und nicht mehr im Browser ausgeliefert.
        </p>
        <div className="mt-5 grid gap-3">
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void login();
            }}
            placeholder="Admin-Passwort"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary" disabled={checkingAccount || !password} onClick={() => void login()}>
            {checkingAccount ? "Adminstatus wird geprüft…" : "Admin Mode aktivieren"}
          </button>
        </div>
      </section>
    </main>
  );
}
