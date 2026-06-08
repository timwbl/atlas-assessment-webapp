"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  authRequest,
  getStoredSession,
  saveSession,
  toCloudSession,
  type AuthSessionResponse,
  type CloudUser
} from "@/lib/supabaseClient";
import { syncAllProgress, upsertCurrentProfile } from "@/lib/cloudProgress";

type ConfirmationState = "verifying" | "success" | "error";

export function EmailConfirmationClient() {
  const [state, setState] = useState<ConfirmationState>("verifying");
  const [message, setMessage] = useState("Deine E-Mail-Adresse wird sicher bestätigt.");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;

    async function confirmEmail() {
      try {
        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const errorDescription = query.get("error_description") || hash.get("error_description");
        if (errorDescription) throw new Error(errorDescription);

        const tokenHash = query.get("token_hash");
        const type = query.get("type") === "signup" ? "signup" : "email";
        const accessToken = hash.get("access_token");
        const existingSession = getStoredSession();

        if (!tokenHash && !accessToken && existingSession) {
          setEmail(existingSession.user.email || "");
          setState("success");
          setMessage("Danke, deine E-Mail-Adresse wurde bestätigt.");
          return;
        }

        let session: AuthSessionResponse;

        if (tokenHash) {
          session = await authRequest<AuthSessionResponse>("verify", {
            method: "POST",
            body: JSON.stringify({
              token_hash: tokenHash,
              type
            })
          });
        } else {
          if (!accessToken) {
            throw new Error("Der Bestätigungslink enthält keinen gültigen Token.");
          }
          const user = await authRequest<CloudUser>("user", { method: "GET" }, accessToken);
          const expiresAt = Number(hash.get("expires_at"))
            || Math.floor(Date.now() / 1000) + Number(hash.get("expires_in") || 3600);
          session = {
            access_token: accessToken,
            refresh_token: hash.get("refresh_token") || undefined,
            expires_at: expiresAt,
            user
          };
        }

        saveSession(toCloudSession(session));
        await upsertCurrentProfile(session.user);
        await syncAllProgress().catch(() => undefined);
        window.history.replaceState({}, document.title, "/auth/confirm");

        if (!active) return;
        setEmail(session.user.email || "");
        setState("success");
        setMessage("Danke, deine E-Mail-Adresse wurde bestätigt.");
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(friendlyConfirmationError(error));
      }
    }

    void confirmEmail();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="confirmation-page">
      <section className={`confirmation-card glass is-${state}`} aria-live="polite">
        <div className="confirmation-logo">
          <img src="/atlas-logo.svg" alt="" />
        </div>

        <div className={`confirmation-state-icon is-${state}`} aria-hidden="true">
          {state === "verifying" ? <span className="confirmation-spinner" /> : state === "success" ? "✓" : "!"}
        </div>

        <div className="eyebrow">ATLAS Account</div>
        <h1>
          {state === "verifying"
            ? "E-Mail wird bestätigt"
            : state === "success"
              ? "Adresse bestätigt"
              : "Bestätigung fehlgeschlagen"}
        </h1>
        <p>{message}</p>
        {state === "success" && email && <div className="confirmation-email">{email}</div>}

        {state === "success" && (
          <Link className="btn-primary confirmation-action" href="/">
            Zu den MC Übungsfragen
          </Link>
        )}
        {state === "error" && (
          <Link className="btn-primary confirmation-action" href="/">
            Zurück zu ATLAS
          </Link>
        )}

        <p className="confirmation-note">
          {state === "success"
            ? "Du bist jetzt angemeldet. Dein lokaler Fortschritt wird mit deinem Account synchronisiert."
            : state === "error"
              ? "Der Link ist möglicherweise abgelaufen oder wurde bereits verwendet. Fordere im Account-Menü eine neue Bestätigungsmail an."
              : "Bitte schliesse dieses Fenster nicht."}
        </p>
      </section>
    </main>
  );
}

function friendlyConfirmationError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Die E-Mail-Adresse konnte nicht bestätigt werden.";
  const normalized = message.toLowerCase();
  if (
    normalized.includes("expired")
    || normalized.includes("invalid")
    || normalized.includes("token")
  ) {
    return "Dieser Bestätigungslink ist ungültig oder abgelaufen.";
  }
  return message;
}
