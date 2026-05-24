"use client";

import { useEffect, useState } from "react";
import {
  cloudSyncAvailable,
  getCurrentProfile,
  getCurrentUser,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  syncAllProgress,
  type CloudProfile
} from "@/lib/cloudProgress";
import { getAllProgress } from "@/lib/progressStore";
import type { CloudUser } from "@/lib/supabaseClient";

type Props = {
  onSynced?: () => void;
};

export function AccountSyncPanel({ onSynced }: Props) {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cloudSyncAvailable()) return;
    void refreshUser();
  }, []);

  if (!cloudSyncAvailable()) {
    return (
      <section className="card p-4 text-sm text-[var(--muted)]">
        <strong className="text-[var(--text)]">Optionaler Account-Sync:</strong>{" "}
        Noch nicht eingerichtet. Ohne Supabase-Konfiguration bleibt der Fortschritt nur lokal in diesem Browser.
      </section>
    );
  }

  async function refreshUser() {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    setProfile(currentUser ? await getCurrentProfile() : null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    await run(async () => {
      await signInWithPassword(email.trim(), password);
      await refreshUser();
      const merged = await syncAllProgress();
      onSynced?.();
      setStatus(`${Object.keys(merged).length} Assessment-Fortschritte synchronisiert.`);
    });
  }

  async function createAccount() {
    await run(async () => {
      const created = await signUpWithPassword(email.trim(), password);
      await refreshUser();
      if (created) {
        const merged = await syncAllProgress();
        onSynced?.();
        setStatus(`Account erstellt und ${Object.keys(merged).length} Assessment-Fortschritte synchronisiert.`);
      } else {
        setStatus("Account erstellt. Du kannst dich jetzt einloggen.");
      }
    });
  }

  async function syncNow() {
    await run(async () => {
      const merged = await syncAllProgress();
      onSynced?.();
      setStatus(`${Object.keys(merged).length} Assessment-Fortschritte synchronisiert.`);
    });
  }

  async function logout() {
    await run(async () => {
      await signOut();
      setUser(null);
      setProfile(null);
      setStatus("Abgemeldet. Lokaler Fortschritt bleibt auf diesem Gerät.");
    });
  }

  if (user) {
    const localCount = Object.keys(getAllProgress()).length;

    return (
      <section className="card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="eyebrow">Account Sync</div>
            <h2 className="mt-1 text-xl font-black">{user.email}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {localCount} lokale Assessments · Rolle: {profile?.role === "admin" ? "Admin" : "Student"}
            </p>
          </div>
          <div className="account-actions flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={syncNow}>Jetzt synchronisieren</button>
            <button className="btn-secondary" disabled={busy} onClick={logout}>Abmelden</button>
          </div>
        </div>
        {status && <p className="mt-3 text-sm text-[var(--muted)]">{status}</p>}
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">Optionaler Account</div>
          <h2 className="mt-1 text-xl font-black">Fortschritt synchronisieren</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ohne Login bleibt alles lokal. Mit Login wird dein Fortschritt zwischen Geräten gespeichert.
          </p>
        </div>
        <div className="account-login-grid grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-Mail" />
          <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Passwort" />
          <button className="btn-primary" disabled={busy || !email || !password} onClick={login}>Einloggen</button>
          <button className="btn-secondary" disabled={busy || !email || !password} onClick={createAccount}>Account erstellen</button>
        </div>
      </div>
      {status && <p className="mt-3 text-sm text-[var(--muted)]">{status}</p>}
    </section>
  );
}
