"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminEditor } from "./AdminEditor";

export function AdminGate() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");

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
          Dieser Bereich ist nur für lokale Bearbeitung und JSON-Export gedacht.
          Es gibt keine Server-Authentifizierung und keine Datenbank.
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
          <button className="btn-primary" onClick={login}>Admin Mode aktivieren</button>
        </div>
      </section>
    </main>
  );
}
