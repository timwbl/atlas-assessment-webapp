export const MAINTENANCE_COOKIE = "atlas_beta_access";
export const MAINTENANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

export type MaintenanceStatus = {
  enabled: boolean;
  source: "database" | "environment";
  updatedAt?: string;
};

export function maintenanceEnabled(): boolean {
  return process.env.MAINTENANCE_MODE?.trim().toLowerCase() === "true";
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const config = publicSupabaseConfig();
  if (!config) return environmentStatus();

  try {
    const response = await fetch(
      `${config.url}/rest/v1/app_settings?select=value,updated_at&key=eq.maintenance_mode&limit=1`,
      {
        cache: "no-store",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(2200)
      }
    );
    if (!response.ok) return environmentStatus();
    const rows = await response.json() as Array<{ value?: unknown; updated_at?: string }>;
    if (!rows[0]) return environmentStatus();
    return {
      enabled: settingEnabled(rows[0].value),
      source: "database",
      updatedAt: rows[0].updated_at
    };
  } catch {
    return environmentStatus();
  }
}

export async function setMaintenanceStatus(
  enabled: boolean,
  accessToken: string
): Promise<MaintenanceStatus> {
  const config = publicSupabaseConfig();
  if (!config) throw new Error("Supabase ist für globale Einstellungen nicht konfiguriert.");
  if (!accessToken) throw new Error("Für diese Änderung fehlt eine gültige Admin-Autorisierung.");

  const updatedAt = new Date().toISOString();
  const response = await fetch(`${config.url}/rest/v1/app_settings?on_conflict=key`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify([{
      key: "maintenance_mode",
      value: { enabled },
      updated_at: updatedAt
    }])
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 404 || detail.includes("app_settings")) {
      throw new Error("Die Supabase-Tabelle app_settings fehlt. Führe zuerst das aktuelle ATLAS-Schema aus.");
    }
    throw new Error(detail || `Umbau-Modus konnte nicht gespeichert werden (HTTP ${response.status}).`);
  }

  return { enabled, source: "database", updatedAt };
}

export function maintenanceConfigured(): boolean {
  return !!process.env.BETA_ACCESS_PASSWORD?.trim()
    && !!process.env.MAINTENANCE_SESSION_SECRET?.trim();
}

export async function maintenanceAccessToken(): Promise<string> {
  const password = process.env.BETA_ACCESS_PASSWORD?.trim() || "";
  const secret = process.env.MAINTENANCE_SESSION_SECRET?.trim() || "";
  if (!password || !secret) return "";
  return sha256(`${secret}:${password}:atlas-maintenance-v1`);
}

export async function verifyMaintenancePassword(password: string): Promise<boolean> {
  const expectedPassword = process.env.BETA_ACCESS_PASSWORD?.trim() || "";
  if (!expectedPassword || !maintenanceConfigured()) return false;
  return timingSafeEqual(password.trim(), expectedPassword);
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function environmentStatus(): MaintenanceStatus {
  return {
    enabled: maintenanceEnabled(),
    source: "environment"
  };
}

function settingEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (value as { enabled?: unknown }).enabled === true;
}

function publicSupabaseConfig(): { url: string; anonKey: string } | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!rawUrl || !anonKey) return null;

  try {
    const parsed = new URL(rawUrl);
    const dashboardProject = parsed.pathname.match(/\/project\/([^/]+)/);
    const url = parsed.hostname === "supabase.com" && dashboardProject?.[1]
      ? `https://${dashboardProject[1]}.supabase.co`
      : parsed.origin;
    return { url: url.replace(/\/$/, ""), anonKey };
  } catch {
    return {
      url: rawUrl
        .replace(/\/auth\/v1\/?$/i, "")
        .replace(/\/rest\/v1\/?$/i, "")
        .replace(/\/$/, ""),
      anonKey
    };
  }
}
