import { NextResponse } from "next/server";
import {
  MAINTENANCE_COOKIE,
  MAINTENANCE_COOKIE_MAX_AGE,
  maintenanceAccessToken,
  maintenanceConfigured,
  maintenanceEnabled,
  verifyMaintenancePassword
} from "@/lib/maintenance";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!maintenanceEnabled()) {
    return NextResponse.json({ ok: true, maintenanceDisabled: true });
  }
  if (!maintenanceConfigured()) {
    return NextResponse.json(
      { error: "Der Beta-Zugang ist serverseitig noch nicht vollständig konfiguriert." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!await verifyMaintenancePassword(password)) {
    return NextResponse.json({ error: "Das Beta-Passwort ist nicht korrekt." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: MAINTENANCE_COOKIE,
    value: await maintenanceAccessToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAINTENANCE_COOKIE_MAX_AGE
  });
  return response;
}
