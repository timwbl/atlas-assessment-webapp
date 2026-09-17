import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/serverAuth";
import { hasPriorityAccess, MEMBER_SESSION_COOKIE } from "@/lib/memberAccess";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request).catch(() => null);
  const response = NextResponse.json(auth ? {
    role: auth.profile.role,
    closeCircle: auth.profile.close_circle,
    priority: hasPriorityAccess(auth.profile)
  } : { error: "Bitte melde dich an." }, {
    status: auth ? 200 : 401,
    headers: { "Cache-Control": "no-store" }
  });
  response.cookies.set(MEMBER_SESSION_COOKIE, auth && hasPriorityAccess(auth.profile) ? auth.token : "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: auth && hasPriorityAccess(auth.profile) ? 3600 : 0
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(MEMBER_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
