"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminEditor } from "./AdminEditor";
import { getCurrentProfile } from "@/lib/cloudProgress";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";

export function AdminGate() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [checkingAccount, setCheckingAccount] = useState(true);

  useEffect(() => {
    async function checkAdminAccount() {
      setCheckingAccount(true);
      const profile = await getCurrentProfile().catch(() => null);
      if (profile?.role === "admin") {
        setUnlocked(true);
        setError("");
      }
      setCheckingAccount(false);
    }

    void checkAdminAccount();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, checkAdminAccount);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, checkAdminAccount);
  }, []);

  function login() {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";
    if (!expected) {
      setError("NEXT_PUBLIC_ADMIN_PASSWORD ist nicht gesetzt.");
      return;
    }
    if (password === expected) {
      setUnlocked(true);
      setError("");
    } else {
      setError("Passwort stimmt nicht.");
    }
  }

  if (unlocked) return <AdminEditor />;

  return (
    <main className="shell">
      <Link className="btn-secondary inline-flex items-center" href="/">Zur Library</Link>
      <section className="glass mx-auto mt-8 max-w-xl rounded-[28px] p-6">
        <div className="eyebrow text-amber-600">Versteckter Bereich</div>
        <h1 className="mt-2 text-4xl font-black">Admin Login</h1>
        <p className="mt-3 text-[var(--muted)]">
          Eingeloggte ATLAS-Admins werden automatisch erkannt. Alternativ bleibt der lokale Adminzugang verfügbar.
        </p>
        <div className="mt-5 grid gap-3">
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") login();
            }}
            placeholder="Admin-Passwort"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary" disabled={checkingAccount} onClick={login}>
            {checkingAccount ? "Adminstatus wird geprüft…" : "Admin Mode aktivieren"}
          </button>
        </div>
      </section>
    </main>
  );
}
