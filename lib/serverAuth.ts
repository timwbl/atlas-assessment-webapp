import type { Assessment } from "./types";

type CloudUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type CloudProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "student" | "admin";
};

type AltfragenRequestRow = {
  status: "pending" | "approved" | "denied";
};

export type AuthenticatedRequest = {
  token: string;
  user: CloudUser;
  profile: CloudProfile;
};

export async function authenticateRequest(request: Request): Promise<AuthenticatedRequest | null> {
  const token = bearerToken(request);
  if (!token) return null;

  const user = await supabaseAuthRequest<CloudUser>("user", token).catch(() => null);
  if (!user?.id) return null;

  const profiles = await supabaseServerRestRequest<CloudProfile[]>(
    `profiles?select=id,email,display_name,role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    token
  ).catch(() => []);
  const profile = profiles[0];
  if (!profile) return null;

  return { token, user, profile };
}

export async function canExportAssessment(auth: AuthenticatedRequest, assessment: Assessment): Promise<boolean> {
  if (!isAltfragenBlock(assessment.block)) return true;
  if (auth.profile.role === "admin") return true;

  const rows = await supabaseServerRestRequest<AltfragenRequestRow[]>(
    `altfragen_access_requests?select=status&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    auth.token
  ).catch(() => []);

  return rows[0]?.status === "approved";
}

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

async function supabaseAuthRequest<T>(path: string, token: string): Promise<T> {
  const config = supabaseConfig();
  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`
    }
  });
  return parseResponse<T>(response);
}

export async function supabaseServerRestRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const config = supabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }
  if (!response.ok) {
    const record = isRecord(data) ? data : {};
    const message = [
      record.message,
      record.msg,
      record.error_description,
      record.error,
      typeof data === "string" ? data : ""
    ].find((value): value is string => typeof value === "string" && !!value.trim());
    throw new Error(message || `HTTP ${response.status}`);
  }
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function supabaseConfig(): { url: string; anonKey: string } {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const url = normalizeSupabaseUrl(rawUrl);
  if (!url || !anonKey) throw new Error("Supabase ist nicht konfiguriert.");
  return { url, anonKey };
}

function normalizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    const dashboardProject = parsed.pathname.match(/\/project\/([^/]+)/);
    if (parsed.hostname === "supabase.com" && dashboardProject?.[1]) {
      return `https://${dashboardProject[1]}.supabase.co`;
    }
    return parsed.origin.replace(/\/$/, "");
  } catch {
    return rawUrl
      .replace(/\/auth\/v1\/?$/i, "")
      .replace(/\/rest\/v1\/?$/i, "")
      .replace(/\/$/, "");
  }
}

function isAltfragenBlock(block: string): boolean {
  const value = String(block || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return value.includes("altfragen") || value.includes("altfrage") || value.includes("alte fragen");
}
