import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminPasswordConfigured,
  adminSessionMaxAge,
  bearerBelongsToAdmin,
  createAdminSessionToken,
  verifyAdminPassword,
  verifyAdminSessionToken
} from "@/lib/adminSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const valid = verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  return NextResponse.json({ authenticated: valid }, {
    status: valid ? 200 : 401,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  const accountAdmin = await bearerBelongsToAdmin(request.headers.get("authorization")).catch(() => false);
  const passwordAdmin = adminPasswordConfigured() && verifyAdminPassword(body.password || "");

  if (!accountAdmin && !passwordAdmin) {
    return NextResponse.json(
      { error: adminPasswordConfigured() ? "Admin-Zugang abgelehnt." : "Lokales Admin-Passwort ist nicht konfiguriert." },
      { status: adminPasswordConfigured() ? 401 : 503 }
    );
  }

  let token: string;
  try {
    token = createAdminSessionToken();
  } catch (error) {
    if (accountAdmin) {
      return NextResponse.json(
        { authenticated: true, persistent: false },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin-Session konnte nicht erstellt werden." },
      { status: 503 }
    );
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: adminSessionMaxAge()
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
  return response;
}
