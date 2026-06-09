export const MAINTENANCE_COOKIE = "atlas_beta_access";
export const MAINTENANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 14;

export function maintenanceEnabled(): boolean {
  return process.env.MAINTENANCE_MODE?.trim().toLowerCase() === "true";
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
