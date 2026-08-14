"use client";

import { createClient, type Provider, type Session } from "@supabase/supabase-js";
import { syncAllProgress, upsertCurrentProfile } from "./cloudProgress";
import {
  getPublicSiteUrl,
  getStoredSession,
  getSupabaseConfig,
  saveSession,
  setSessionPersistence,
  type CloudSession
} from "./supabaseClient";

export type AtlasOAuthProvider = Extract<Provider, "google">;

const OAUTH_STORAGE_KEY = "atlas-supabase-oauth-v1";
const OAUTH_RETURN_TO_KEY = "atlas-oauth-return-to-v1";

export const OAUTH_PROVIDERS: Array<{
  provider: AtlasOAuthProvider;
  label: string;
  mark: string;
}> = [
  { provider: "google", label: "Google", mark: "G" }
];

let oauthClient: ReturnType<typeof createClient> | null = null;

export function getOAuthRedirectUrl(): string {
  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL ist nicht konfiguriert.");
  return `${siteUrl}/auth/callback`;
}

export async function signInWithOAuthProvider(
  provider: AtlasOAuthProvider,
  remember = true
): Promise<void> {
  setSessionPersistence(remember);
  storeReturnTo();

  const { data, error } = await getOAuthClient().auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getOAuthRedirectUrl(),
      scopes: "email profile"
    }
  });

  if (error) throw error;
  if (!data.url) throw new Error("Der OAuth-Login konnte nicht gestartet werden.");
  window.location.assign(data.url);
}

export async function linkOAuthProvider(provider: AtlasOAuthProvider): Promise<void> {
  const session = getStoredSession();
  if (!session?.refresh_token) {
    throw new Error("Bitte melde dich erneut an, bevor du einen Anbieter verknüpfst.");
  }

  storeReturnTo();
  const client = getOAuthClient();
  const { error: sessionError } = await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token
  });
  if (sessionError) throw sessionError;

  const { data, error } = await client.auth.linkIdentity({
    provider,
    options: {
      redirectTo: getOAuthRedirectUrl(),
      scopes: "email profile"
    }
  });

  if (error) throw error;
  if (data?.url) window.location.assign(data.url);
}

export async function completeOAuthCallback(): Promise<{ email: string; returnTo: string }> {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const errorDescription = params.get("error_description") || hash.get("error_description");
  if (errorDescription) throw new Error(errorDescription);

  const code = params.get("code");
  if (!code) throw new Error("Der Anmeldelink enthält keinen gültigen OAuth-Code.");

  const { data, error } = await getOAuthClient().auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session) throw new Error("Die Anmeldung konnte keine gültige Session erstellen.");

  const cloudSession = toStoredCloudSession(data.session);
  saveSession(cloudSession);
  await upsertCurrentProfile(cloudSession.user);
  await syncAllProgress().catch(() => undefined);

  const returnTo = consumeReturnTo();
  window.history.replaceState({}, document.title, "/auth/callback");
  return { email: cloudSession.user.email || "", returnTo };
}

export async function clearOAuthClientSession(): Promise<void> {
  if (!oauthClient) return;
  await oauthClient.auth.signOut().catch(() => undefined);
}

function getOAuthClient() {
  if (oauthClient) return oauthClient;
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase ist noch nicht konfiguriert.");

  oauthClient = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storageKey: OAUTH_STORAGE_KEY
    }
  });
  return oauthClient;
}

function toStoredCloudSession(session: Session): CloudSession {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: session.user.id,
      email: session.user.email || undefined,
      user_metadata: session.user.user_metadata || {}
    }
  };
}

function storeReturnTo(): void {
  if (typeof window === "undefined") return;
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const safePath = path.startsWith("/auth/") ? "/" : path;
  window.sessionStorage.setItem(OAUTH_RETURN_TO_KEY, safePath || "/");
}

function consumeReturnTo(): string {
  if (typeof window === "undefined") return "/";
  const value = window.sessionStorage.getItem(OAUTH_RETURN_TO_KEY) || "/";
  window.sessionStorage.removeItem(OAUTH_RETURN_TO_KEY);
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
