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

type AuthMode = "signin" | "signup" | "name";

export function AccountMenu() {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [profileChecked, setProfileChecked] = useState(false);
  const [name, setName] = useState("");
  const [authName, setAuthName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<CloudUser | null>(null);
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(window.localStorage.getItem(NAME_KEY) || "");
    if (cloudSyncAvailable()) void refreshUser();
    else setProfileChecked(true);
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        if (authMode !== "name") setAuthOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [authMode]);

  useEffect(() => {
    if (authOpen && (authMode === "signup" || authMode === "name")) {
      window.setTimeout(() => nameInputRef.current?.focus(), 60);
    }
  }, [authMode, authOpen]);

  useEffect(() => {
    if (!user || !profileChecked || profile?.display_name?.trim()) return;
    setAuthMode("name");
    setAuthName(name.trim());
    setAuthOpen(true);
    setOpen(false);
  }, [name, profile, profileChecked, user]);

  const displayName = profile?.display_name?.trim() || name.trim();
  const initials = displayName
    ? displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "A";
  const requiresName = !!user && profileChecked && !profile?.display_name?.trim();

  async function refreshUser() {
    setProfileChecked(false);
    const currentUser = await getCurrentUser();
    const currentProfile = currentUser ? await getCurrentProfile() : null;
    setUser(currentUser);
    setProfile(currentProfile);
    setProfileChecked(true);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  function openAuth(mode: AuthMode) {
    setStatus("");
    setAuthMode(mode);
    setAuthOpen(true);
    setOpen(false);
    if (mode === "name") setAuthName(displayName);
  }

  async function login() {
    await run(async () => {
      await signInWithPassword(email.trim(), password);
      await refreshUser();
      const merged = await syncAllProgress();
      setStatus(`${Object.keys(merged).length} Fortschritte synchronisiert.`);
      setAuthOpen(false);
    });
  }

  async function createAccount() {
    await run(async () => {
      const cleanName = authName.trim();
      if (!cleanName) throw new Error("Bitte gib deinen Namen ein.");
      if (!email.trim() || !password) throw new Error("Bitte gib E-Mail und Passwort ein.");

      await signUpWithPassword(email.trim(), password, cleanName);
      let currentUser = await getCurrentUser();

      if (!currentUser) {
        await signInWithPassword(email.trim(), password);
        currentUser = await getCurrentUser();
      }

      if (!currentUser) {
        throw new Error("Supabase verlangt noch eine E-Mail-Bestätigung. Bitte deaktiviere Confirm email im Supabase Dashboard und bestätige bestehende Accounts einmalig per SQL.");
      }

      setName(cleanName);
      window.localStorage.setItem(NAME_KEY, cleanName);
      await updateCurrentProfileName(cleanName);
      await refreshUser();
      const merged = await syncAllProgress();
      setStatus(`Account erstellt · ${Object.keys(merged).length} Fortschritte synchronisiert.`);
      setAuthOpen(false);
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
      setProfileChecked(true);
      setAuthOpen(false);
      setStatus("Abgemeldet. Lokaler Fortschritt bleibt erhalten.");
    });
  }

  async function saveName() {
    await run(async () => {
      const nextName = authName.trim();
      if (!nextName) throw new Error("Bitte gib deinen Namen ein.");
      setName(nextName);
      window.localStorage.setItem(NAME_KEY, nextName);
      if (user && cloudSyncAvailable()) {
        const updated = await updateCurrentProfileName(nextName);
        setProfile(updated);
      }
      setAuthOpen(false);
    });
  }

  return (
    <>
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
                <p className="account-email">{user?.email || "Fortschritt lokal gespeichert"}</p>
              </div>
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
                <button type="button" className="account-menu-row" onClick={() => openAuth("name")}>
                  Name bearbeiten
                </button>
                <button type="button" className="btn-primary" disabled={busy} onClick={syncNow}>Jetzt synchronisieren</button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={logout}>Abmelden</button>
              </div>
            )}

            {cloudSyncAvailable() && !user && (
              <div className="grid gap-2">
                <button type="button" className="btn-primary" onClick={() => openAuth("signin")}>Anmelden</button>
                <button type="button" className="btn-secondary" onClick={() => openAuth("signup")}>Registrieren</button>
                <p className="account-note">Mit Account wird dein Fortschritt zwischen Geräten synchronisiert.</p>
              </div>
            )}

            {status && <p className="account-status">{status}</p>}
          </div>
        )}
      </div>

      {authOpen && (
        <div className="auth-modal-backdrop" role="presentation" onMouseDown={() => {
          if (!requiresName) setAuthOpen(false);
        }}>
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-label={authMode === "signup" ? "Registrieren" : authMode === "name" ? "Name ergänzen" : "Anmelden"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {!requiresName && (
              <button className="auth-modal-close" type="button" aria-label="Schliessen" onClick={() => setAuthOpen(false)}>
                ×
              </button>
            )}

            <div className="auth-modal-mark">
              <img alt="" src="/atlas-logo.svg" />
            </div>

            <div className="auth-modal-copy">
              <div className="eyebrow">ATLAS Account</div>
              <h2>{authMode === "signup" ? "Account erstellen" : authMode === "name" ? "Wie dürfen wir dich nennen?" : "Willkommen zurück"}</h2>
              <p>
                {authMode === "signup"
                  ? "Erstelle deinen Account und synchronisiere deinen Lernfortschritt."
                  : authMode === "name"
                    ? "Bitte ergänze deinen Namen, damit Freigaben und Feedback sauber zugeordnet werden können."
                    : "Melde dich an, um deinen Fortschritt und Freigaben zu synchronisieren."}
              </p>
            </div>

            {authMode !== "name" && (
              <div className="auth-tabs" role="tablist" aria-label="Account Aktion">
                <button className={authMode === "signin" ? "is-active" : ""} type="button" onClick={() => setAuthMode("signin")}>
                  Anmelden
                </button>
                <button className={authMode === "signup" ? "is-active" : ""} type="button" onClick={() => setAuthMode("signup")}>
                  Registrieren
                </button>
              </div>
            )}

            <div className="auth-form">
              {(authMode === "signup" || authMode === "name") && (
                <label>
                  <span>Name</span>
                  <input
                    ref={nameInputRef}
                    className="input"
                    name="atlas-auth-name"
                    autoComplete="name"
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="Vorname Nachname"
                  />
                </label>
              )}

              {authMode !== "name" && (
                <>
                  <label>
                    <span>E-Mail</span>
                    <input
                      className="input"
                      type="email"
                      name="atlas-account-email"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@example.com"
                    />
                  </label>
                  <label>
                    <span>Passwort</span>
                    <input
                      className="input"
                      type="password"
                      name="atlas-account-password"
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void (authMode === "signup" ? createAccount() : login());
                      }}
                      placeholder="Passwort"
                    />
                  </label>
                </>
              )}

              {authMode === "name" ? (
                <button className="btn-primary auth-submit" disabled={busy || !authName.trim()} type="button" onClick={() => void saveName()}>
                  {busy ? "Speichert..." : "Name speichern"}
                </button>
              ) : authMode === "signup" ? (
                <button className="btn-primary auth-submit" disabled={busy || !authName.trim() || !email || !password} type="button" onClick={() => void createAccount()}>
                  {busy ? "Erstellt..." : "Registrieren"}
                </button>
              ) : (
                <button className="btn-primary auth-submit" disabled={busy || !email || !password} type="button" onClick={() => void login()}>
                  {busy ? "Meldet an..." : "Anmelden"}
                </button>
              )}

              {status && <p className="account-status">{status}</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Aktion fehlgeschlagen.";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) return "E-Mail oder Passwort ist nicht korrekt.";
  if (normalized.includes("user already registered") || normalized.includes("already registered")) return "Für diese E-Mail existiert bereits ein Account. Bitte melde dich an.";
  if (normalized.includes("password") && normalized.includes("weak")) return "Das Passwort ist zu schwach. Bitte wähle ein längeres Passwort.";
  if (normalized.includes("email not confirmed")) return "Supabase hat diesen Account noch nicht freigegeben. Schalte im Supabase Dashboard `Confirm email` aus und bestätige bestehende Accounts einmalig per SQL.";
  if (normalized.includes("e-mail") && normalized.includes("bestätigung")) return message;
  if (normalized.includes("http 400")) return "Supabase hat die Anmeldung abgelehnt. Häufige Ursache: `Confirm email` ist noch aktiv oder der Account wurde noch nicht bestätigt.";

  return message;
}
