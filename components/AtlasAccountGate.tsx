"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { FormEvent, type ReactNode, useEffect, useState } from "react";
import {
  cloudSyncAvailable,
  getCurrentUser,
  resendSignupConfirmation,
  signInWithPassword,
  signUpWithPassword,
  syncAllProgress
} from "@/lib/cloudProgress";
import { OAUTH_PROVIDERS, signInWithOAuthProvider } from "@/lib/supabaseOAuth";
import {
  AUTH_SESSION_CHANGED_EVENT,
  getStoredSession,
  shouldRememberSession,
  type CloudUser
} from "@/lib/supabaseClient";

type Mode = "welcome" | "signin" | "signup" | "check-email";

const PUBLIC_PATHS = [
  "/auth/callback",
  "/auth/confirm",
  "/datenschutz",
  "/nutzungsbedingungen",
  "/maintenance",
  "/admin"
];

export function AtlasAccountGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<CloudUser | null>(null);

  useEffect(() => {
    if (isPublicPath) {
      setChecked(true);
      return;
    }

    let active = true;
    async function checkSession() {
      const storedUser = getStoredSession()?.user || null;
      if (storedUser && active) {
        setUser(storedUser);
        setChecked(true);
      }
      const currentUser = cloudSyncAvailable() ? await getCurrentUser() : null;
      if (!active) return;
      // Keep a cached, still stored session during temporary network failures.
      // Invalid Supabase sessions are removed by getCurrentUser itself.
      setUser(currentUser || getStoredSession()?.user || null);
      setChecked(true);
    }
    void checkSession();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, checkSession);
    return () => {
      active = false;
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, checkSession);
    };
  }, [isPublicPath]);

  if (isPublicPath) return children;
  if (!checked) return <AccountGateLoading />;
  if (!user) return <AccountRequired onAuthenticated={setUser} />;
  return children;
}

function AccountGateLoading() {
  return (
    <main className="account-gate account-gate--loading" aria-label="Anmeldung wird geprüft">
      <div className="account-gate-spinner"><Image alt="" height={64} src="/atlas-loader-logo.svg" width={64} priority /></div>
      <p>Anmeldung wird geprüft …</p>
    </main>
  );
}

function AccountRequired({ onAuthenticated }: { onAuthenticated: (user: CloudUser) => void }) {
  const [mode, setMode] = useState<Mode>("welcome");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => setRemember(shouldRememberSession()), []);

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

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (mode === "signup") {
        const result = await signUpWithPassword(email.trim(), password, name.trim(), remember);
        if (result.requiresEmailConfirmation) {
          setMode("check-email");
          return;
        }
        if (result.user) {
          await syncAllProgress().catch(() => undefined);
          onAuthenticated(result.user);
        }
        return;
      }

      const signedInUser = await signInWithPassword(email.trim(), password, remember);
      await syncAllProgress().catch(() => undefined);
      onAuthenticated(signedInUser);
    });
  }

  return (
    <main className="account-gate">
      <section className="account-gate-card" aria-labelledby="account-gate-title">
        <div className="account-gate-brand">
          <span className="account-gate-logo"><Image alt="ATLAS" height={58} src="/atlas-logo.svg" width={58} priority /></span>
          <div><strong>ATLAS</strong><small>Lernen für die Uni</small></div>
        </div>

        {mode === "welcome" ? (
          <div className="account-gate-welcome">
            <div className="eyebrow">ATLAS Lernplattform</div>
            <h1 id="account-gate-title">Willkommen bei ATLAS.</h1>
            <p>Hier findest du Übungsfragen, Zusammenfassungen und weitere Unterlagen für das Studium.</p>
            <div className="account-gate-benefits" aria-label="Inhalte in ATLAS">
              <div><span aria-hidden="true">✓</span><strong>Übungsfragen und Schnellquiz nach Block</strong></div>
              <div><span aria-hidden="true">✓</span><strong>Zusammenfassungen und Downloads</strong></div>
              <div><span aria-hidden="true">✓</span><strong>Altfragen nach persönlicher Freigabe</strong></div>
            </div>
            <button className="btn-primary account-gate-main-action" onClick={() => setMode("signup")} type="button">Account erstellen</button>
            <button className="btn-secondary account-gate-main-action" onClick={() => setMode("signin")} type="button">Ich habe bereits ein Konto</button>
          </div>
        ) : mode === "check-email" ? (
          <div className="account-gate-confirmation">
            <div className="eyebrow">Fast geschafft</div>
            <h1 id="account-gate-title">Bestätige deine E-Mail</h1>
            <p>Wir haben einen Bestätigungslink an <strong>{email.trim()}</strong> gesendet. Danach kannst du ATLAS vollständig nutzen.</p>
            <button className="btn-primary" disabled={busy} onClick={() => void run(() => resendSignupConfirmation(email.trim()))} type="button">
              {busy ? "Wird gesendet …" : "Bestätigung erneut senden"}
            </button>
            <button className="auth-text-button" onClick={() => { setMode("signin"); setStatus(""); }} type="button">Zur Anmeldung</button>
            {status && <p className="account-status">{status}</p>}
          </div>
        ) : (
          <>
            <div className="account-gate-heading">
              <div className="eyebrow">Persönlicher Lernbereich</div>
              <h1 id="account-gate-title">{mode === "signin" ? "Willkommen zurück" : "Dein ATLAS Account"}</h1>
              <p>{mode === "signin" ? "Melde dich an, um mit deinem Lernfortschritt weiterzumachen." : "Erstelle ein Konto, damit dein Fortschritt sicher deinem Profil zugeordnet wird."}</p>
            </div>

            <button className="account-gate-back" onClick={() => { setMode("welcome"); setStatus(""); }} type="button">← Zurück</button>

            <div className="auth-tabs" role="tablist" aria-label="Account Aktion">
              <button className={mode === "signin" ? "is-active" : ""} onClick={() => { setMode("signin"); setStatus(""); }} type="button">Anmelden</button>
              <button className={mode === "signup" ? "is-active" : ""} onClick={() => { setMode("signup"); setStatus(""); }} type="button">Registrieren</button>
            </div>

            <div className="auth-provider-grid">
              {OAUTH_PROVIDERS.map((provider) => (
                <button className="auth-provider-button" disabled={busy} key={provider.provider} onClick={() => void run(() => signInWithOAuthProvider(provider.provider, remember))} type="button">
                  <span>{provider.mark}</span><strong>Mit {provider.label} fortfahren</strong>
                </button>
              ))}
            </div>
            <div className="auth-divider"><span>oder mit E-Mail</span></div>

            <form className="auth-form account-gate-form" onSubmit={submit}>
              {mode === "signup" && <label><span>Name</span><input className="input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Vorname Nachname" required /></label>}
              <label><span>E-Mail</span><input className="input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required /></label>
              <label><span>Passwort</span><input className="input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Passwort" required /></label>
              <label className="auth-remember-row"><input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" /><span aria-hidden="true" className="auth-checkbox" /><span className="auth-remember-copy"><strong>Eingeloggt bleiben</strong><small>Auf diesem Gerät angemeldet bleiben.</small></span></label>
              <button className="btn-primary auth-submit" disabled={busy || !email.trim() || !password || (mode === "signup" && !name.trim())} type="submit">{busy ? "Bitte warten …" : mode === "signup" ? "Account erstellen" : "Anmelden"}</button>
              {mode === "signin" && <button className="auth-text-button" disabled={busy || !email.trim()} onClick={() => void run(() => resendSignupConfirmation(email.trim()))} type="button">Bestätigungsmail erneut senden</button>}
              {status && <p className="account-status">{status}</p>}
            </form>
          </>
        )}

        <footer><a href="/datenschutz">Datenschutz</a><span>·</span><a href="/nutzungsbedingungen">Nutzungsbedingungen</a></footer>
      </section>
    </main>
  );
}

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Anmeldung fehlgeschlagen.";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-Mail oder Passwort ist nicht korrekt.";
  if (normalized.includes("already registered")) return "Für diese E-Mail existiert bereits ein Account.";
  if (normalized.includes("email not confirmed")) return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  if (normalized.includes("password") && normalized.includes("weak")) return "Bitte wähle ein längeres Passwort.";
  return message;
}
