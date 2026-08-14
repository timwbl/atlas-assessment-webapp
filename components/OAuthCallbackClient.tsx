"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { completeOAuthCallback } from "@/lib/supabaseOAuth";

type OAuthCallbackState = "verifying" | "success" | "error";

export function OAuthCallbackClient() {
  const [state, setState] = useState<OAuthCallbackState>("verifying");
  const [message, setMessage] = useState("Deine Anmeldung wird sicher abgeschlossen.");
  const [email, setEmail] = useState("");
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    let active = true;

    async function finishOAuthLogin() {
      try {
        const result = await completeOAuthCallback();
        if (!active) return;
        setEmail(result.email);
        setReturnTo(result.returnTo);
        setState("success");
        setMessage("Du bist jetzt mit ATLAS angemeldet.");
        window.setTimeout(() => {
          window.location.assign(result.returnTo);
        }, 900);
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(friendlyOAuthError(error));
      }
    }

    void finishOAuthLogin();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="confirmation-page">
      <section className={`confirmation-card glass is-${state}`} aria-live="polite">
        <div className="confirmation-logo">
          <Image src="/atlas-logo.svg" alt="" width={43} height={43} />
        </div>

        <div className={`confirmation-state-icon is-${state}`} aria-hidden="true">
          {state === "verifying" ? <span className="confirmation-spinner" /> : state === "success" ? "✓" : "!"}
        </div>

        <div className="eyebrow">ATLAS Account</div>
        <h1>
          {state === "verifying"
            ? "Anmeldung wird abgeschlossen"
            : state === "success"
              ? "Angemeldet"
              : "Anmeldung fehlgeschlagen"}
        </h1>
        <p>{message}</p>
        {state === "success" && email && <div className="confirmation-email">{email}</div>}

        {state === "success" && (
          <Link className="btn-primary confirmation-action" href={returnTo}>
            Weiter zu ATLAS
          </Link>
        )}
        {state === "error" && (
          <Link className="btn-primary confirmation-action" href="/">
            Zurück zu ATLAS
          </Link>
        )}

        <p className="confirmation-note">
          {state === "success"
            ? "Dein lokaler Fortschritt wird mit deinem Account synchronisiert."
            : state === "error"
              ? "Der Anbieter ist möglicherweise noch nicht in Supabase aktiviert oder der Link wurde abgebrochen."
              : "Bitte schliesse dieses Fenster nicht."}
        </p>
      </section>
    </main>
  );
}

function friendlyOAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Die Anmeldung konnte nicht abgeschlossen werden.";
  const normalized = message.toLowerCase();
  if (normalized.includes("provider") || normalized.includes("unsupported")) {
    return "Dieser Anbieter ist in Supabase noch nicht aktiviert.";
  }
  if (normalized.includes("cancel") || normalized.includes("access_denied")) {
    return "Die Anmeldung wurde abgebrochen.";
  }
  return message;
}
