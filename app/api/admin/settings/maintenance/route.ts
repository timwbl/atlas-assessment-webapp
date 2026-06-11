import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  bearerBelongsToAdmin,
  verifyAdminSessionToken
} from "@/lib/adminSession";
import {
  getMaintenanceStatus,
  normalizeSupabaseServerKey,
  validateSupabaseServerKey,
  setMaintenanceStatus
} from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) {
    return NextResponse.json({ error: "Admin-Zugang erforderlich." }, { status: 401 });
  }
  const status = await getMaintenanceStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" }
  });
}

export async function PATCH(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.replace(/^Bearer\s+/i, "").trim() || "";
  const accountAdmin = await bearerBelongsToAdmin(authorization).catch(() => false);
  const sessionAdmin = verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value
  );
  if (!accountAdmin && !sessionAdmin) {
    return NextResponse.json({ error: "Admin-Zugang erforderlich." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  const serviceRoleKey = normalizeSupabaseServerKey(
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  if (!accountAdmin && !serviceRoleKey) {
    return NextResponse.json({
      error: "Für den lokalen Passwort-Admin muss SUPABASE_SECRET_KEY serverseitig gesetzt sein. Alternativ mit dem Supabase-Admin-Account anmelden."
    }, { status: 503 });
  }
  const keyError = accountAdmin ? null : validateSupabaseServerKey(serviceRoleKey);
  if (keyError) {
    return NextResponse.json({ error: keyError }, { status: 503 });
  }

  try {
    const status = await setMaintenanceStatus(body.enabled, accountAdmin
      ? { userAccessToken: bearer }
      : { secretApiKey: serviceRoleKey }
    );
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Umbau-Modus konnte nicht gespeichert werden."
    }, { status: 500 });
  }
}

async function isAdminRequest(request: NextRequest): Promise<boolean> {
  if (verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) return true;
  return bearerBelongsToAdmin(request.headers.get("authorization")).catch(() => false);
}
