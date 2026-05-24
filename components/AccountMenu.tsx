"use client";

import { useEffect, useRef, useState } from "react";
import {
  cloudSyncAvailable,
  getCurrentProfile,
  getCurrentUser,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  syncAllProgress,
  updateCurrentProfileName,
  type CloudProfile
} from "@/lib/cloudProgress";
import { getAllProgress } from "@/lib/progressStore";
import type { CloudUser } from "@/lib/supabaseClient";

const NAME_KEY = "atlas-user-display-name";

export function AccountMenu() {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [user, setUser] = useState<CloudUser | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(window.localStorage.getItem(NAME_KEY) || "");
    if (cloudSyncAvailable()) void refreshUser();
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setEditingName(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setEditingName(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const displayName = name.trim() || profile?.display_name?.trim() || "";
  const initials = displayName
    ? displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "A";

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
      setStatus(`${Object.keys(merged).length} Fortschritte synchronisiert.`);
    });
  }

  async function createAccount() {
    await run(async () => {
      const created = await signUpWithPassword(email.trim(), password);
      await refreshUser();
      if (created) {
        const merged = await syncAllProgress();
        setStatus(`Account erstellt · ${Object.keys(merged).length} Fortschritte synchronisiert.`);
      } else {
        setStatus("Account erstellt. Du kannst dich jetzt einloggen.");
      }
    });
  }

  async function syncNow() {
    await run(async () => {
      const merged = await syncAllProgress();
      setStatus(`${Object.keys(merged).length} Fortschritte synchronisiert.`);
    });
  }

  async function logout() {
    await run(async () => {
      await signOut();
      setUser(null);
      setProfile(null);
      setStatus("Abgemeldet. Lokaler Fortschritt bleibt erhalten.");
    });
  }

  async function saveName() {
    const nextName = draftName.trim();
    setName(nextName);
    window.localStorage.setItem(NAME_KEY, nextName);
    setEditingName(false);
    if (user && cloudSyncAvailable()) {
      await updateCurrentProfileName(nextName).then(setProfile).catch(() => undefined);
    }
  }

  function startNameEdit() {
    setDraftName(displayName);
    setEditingName(true);
  }

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        type="button"
        className="account-avatar"
        aria-label="Account-Menü öffnen"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{initials}</span>
      </button>

      {open && (
        <div className="account-popover" role="dialog" aria-label="Account-Menü">
          <div className="account-popover-head">
            <div className="account-avatar is-large"><span>{initials}</span></div>
            <div className="min-w-0">
              <div className="eyebrow">Account</div>
              <strong className="account-name">{displayName || "Gast"}</strong>
              <p className="account-email">{user?.email || "Nur lokaler Fortschritt"}</p>
            </div>
          </div>

          <div className="mt-4">
            {editingName ? (
              <div className="grid gap-2">
                <input
                  ref={nameInputRef}
                  className="input"
                  name="atlas-display-name"
                  autoComplete="name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void saveName();
                    if (event.key === "Escape") setEditingName(false);
                  }}
                  placeholder="Name"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="btn-primary" onClick={() => void saveName()}>Speichern</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingName(false)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <button type="button" className="account-menu-row" onClick={startNameEdit}>
                {displayName ? "Name bearbeiten" : "Name hinzufügen"}
              </button>
            )}
          </div>

          <div className="account-divider" />

          {!cloudSyncAvailable() && (
            <p className="account-note">Account-Sync ist noch nicht konfiguriert. Dein Fortschritt bleibt lokal.</p>
          )}

          {cloudSyncAvailable() && user && (
            <div className="grid gap-2">
              <p className="account-note">
                {Object.keys(getAllProgress()).length} lokale Assessments · Rolle: {profile?.role === "admin" ? "Admin" : "Student"}
              </p>
              <button type="button" className="btn-primary" disabled={busy} onClick={syncNow}>Jetzt synchronisieren</button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={logout}>Abmelden</button>
            </div>
          )}

          {cloudSyncAvailable() && !user && (
            <div className="grid gap-2">
              <input
                className="input"
                type="email"
                name="atlas-account-email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-Mail"
              />
              <input
                className="input"
                type="password"
                name="atlas-account-password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passwort"
              />
              <button type="button" className="btn-primary" disabled={busy || !email || !password} onClick={login}>Einloggen</button>
              <button type="button" className="btn-secondary" disabled={busy || !email || !password} onClick={createAccount}>Account erstellen</button>
            </div>
          )}

          {status && <p className="account-status">{status}</p>}
        </div>
      )}
    </div>
  );
}
