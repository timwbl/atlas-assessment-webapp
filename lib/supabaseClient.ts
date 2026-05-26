"use client";

export type CloudUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type CloudSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: CloudUser;
};

const SESSION_KEY = "atlas-supabase-session-v1";

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const value = rawUrl?.trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    const dashboardProject = parsed.pathname.match(/\/project\/([^/]+)/);
    if (parsed.hostname === "supabase.com" && dashboardProject?.[1]) {
      return `https://${dashboardProject[1]}.supabase.co`;
    }
    return parsed.origin.replace(/\/$/, "");
  } catch {
    return value
      .replace(/\/auth\/v1\/?$/i, "")
      .replace(/\/rest\/v1\/?$/i, "")
      .replace(/\/$/, "");
  }
}

export function getStoredSession(): CloudSession | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null") as CloudSession | null;
    return parsed?.access_token && parsed.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: CloudSession | null): void {
  if (typeof window === "undefined") return;
  if (!session) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function authRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const config = requireConfig();
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  return parseResponse<T>(response);
}

export async function restRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const config = requireConfig();
  const session = token ? null : await ensureSession();
  const bearer = token || session?.access_token;
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(init.headers || {})
    }
  });
  return parseResponse<T>(response);
}

export async function storageRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const config = requireConfig();
  const session = token ? null : await ensureSession();
  const bearer = token || session?.access_token;
  const response = await fetch(`${config.url}/storage/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(init.headers || {})
    }
  });
  return parseResponse<T>(response);
}

export function publicStorageUrl(bucket: string, path: string): string {
  const config = requireConfig();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

export async function ensureSession(): Promise<CloudSession | null> {
  const session = getStoredSession();
  if (!session) return null;

  const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
  if (!expiresAtMs || expiresAtMs > Date.now() + 60_000) return session;
  if (!session.refresh_token) return session;

  try {
    const refreshed = await authRequest<AuthSessionResponse>("token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const next = toCloudSession(refreshed);
    saveSession(next);
    return next;
  } catch {
    saveSession(null);
    return null;
  }
}

export function toCloudSession(response: AuthSessionResponse): CloudSession {
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    expires_at: response.expires_at,
    user: response.user
  };
}

export type AuthSessionResponse = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: CloudUser;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = typeof data?.message === "string"
      ? data.message
      : typeof data?.error_description === "string"
        ? data.error_description
        : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

function requireConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase ist noch nicht konfiguriert.");
  return config;
}
