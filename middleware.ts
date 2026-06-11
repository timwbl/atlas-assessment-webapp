import { NextRequest, NextResponse } from "next/server";
import {
  MAINTENANCE_COOKIE,
  getMaintenanceStatus,
  maintenanceAccessToken,
  maintenanceConfigured,
  maintenanceEnabled
} from "./lib/maintenance";

const PUBLIC_MAINTENANCE_PATHS = new Set(["/maintenance", "/auth/confirm"]);
const ADMIN_SESSION_COOKIE = "atlas-admin-session";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isMaintenanceBypassPath(pathname)) return NextResponse.next();
  if (await hasValidAdminSession(request)) return NextResponse.next();

  const status = await getMaintenanceStatus();
  if (!status.enabled) return NextResponse.next();

  // The legacy ENV mode keeps its optional beta-cookie bypass. The global
  // database toggle intentionally blocks all public content.
  if (status.source === "environment" && maintenanceEnabled() && maintenanceConfigured()) {
    const expected = await maintenanceAccessToken();
    const received = request.cookies.get(MAINTENANCE_COOKIE)?.value || "";
    if (received && received === expected) return NextResponse.next();
  }

  return maintenanceRedirect(request);
}

function isMaintenanceBypassPath(pathname: string): boolean {
  return PUBLIC_MAINTENANCE_PATHS.has(pathname)
    || pathname.startsWith("/admin")
    || pathname.startsWith("/api/admin")
    || pathname.startsWith("/api/maintenance");
}

async function hasValidAdminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  const secret = process.env.ADMIN_SESSION_SECRET?.trim()
    || process.env.MAINTENANCE_SESSION_SECRET?.trim()
    || process.env.ATLAS_ADMIN_PASSWORD?.trim()
    || process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim()
    || "";
  if (!token || !secret) return false;

  const [payload, signature] = token.split(".");
  const expiresAt = Number(payload);
  if (!payload || !signature || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = base64Url(new Uint8Array(digest));
  return timingSafeTextEqual(signature, expected);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeTextEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function maintenanceRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|atlas-logo.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"
  ]
};
