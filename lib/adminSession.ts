import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "atlas-admin-session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;

function configuredAdminPassword(): string {
  return process.env.ATLAS_ADMIN_PASSWORD?.trim()
    || process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim()
    || "";
}

function sessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim()
    || process.env.MAINTENANCE_SESSION_SECRET?.trim()
    || configuredAdminPassword()
    || "";
}

export function adminPasswordConfigured(): boolean {
  return !!configuredAdminPassword();
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = configuredAdminPassword();
  if (!expected || !candidate) return false;
  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  return expectedBuffer.length === candidateBuffer.length
    && timingSafeEqual(expectedBuffer, candidateBuffer);
}

export function createAdminSessionToken(now = Date.now()): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET ist nicht konfiguriert.");
  const expiresAt = Math.floor(now / 1000) + SESSION_LIFETIME_SECONDS;
  const payload = String(expiresAt);
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined, now = Date.now()): boolean {
  const secret = sessionSecret();
  if (!secret || !token) return false;
  const [payload, signature] = token.split(".");
  const expiresAt = Number(payload);
  if (!payload || !signature || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length
    && timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function adminSessionMaxAge(): number {
  return SESSION_LIFETIME_SECONDS;
}

export async function bearerBelongsToAdmin(authorization: string | null): Promise<boolean> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!token || !url || !anonKey) return false;

  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!userResponse.ok) return false;
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return false;

  const profileResponse = await fetch(
    `${url}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}&limit=1`,
    {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      cache: "no-store"
    }
  );
  if (!profileResponse.ok) return false;
  const profiles = await profileResponse.json() as Array<{ role?: string }>;
  return profiles[0]?.role === "admin";
}
