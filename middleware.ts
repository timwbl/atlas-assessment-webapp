import { NextRequest, NextResponse } from "next/server";
import {
  MAINTENANCE_COOKIE,
  maintenanceAccessToken,
  maintenanceConfigured,
  maintenanceEnabled
} from "./lib/maintenance";

const PUBLIC_MAINTENANCE_PATHS = new Set([
  "/maintenance",
  "/api/maintenance/access",
  "/auth/confirm"
]);

export async function middleware(request: NextRequest) {
  if (!maintenanceEnabled()) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  if (PUBLIC_MAINTENANCE_PATHS.has(pathname)) return NextResponse.next();

  if (!maintenanceConfigured()) {
    return maintenanceRedirect(request, "configuration");
  }

  const expected = await maintenanceAccessToken();
  const received = request.cookies.get(MAINTENANCE_COOKIE)?.value || "";
  if (received && received === expected) return NextResponse.next();

  return maintenanceRedirect(request);
}

function maintenanceRedirect(request: NextRequest, error?: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|atlas-logo.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)"
  ]
};
