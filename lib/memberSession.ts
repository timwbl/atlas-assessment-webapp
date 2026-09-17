"use client";
import { ensureSession } from "./supabaseClient";

export type MemberStatus = { role: "admin" | "student"; closeCircle: boolean; priority: boolean };
export async function syncMemberSession(): Promise<MemberStatus | null> {
  const session = await ensureSession();
  if (!session) {
    await fetch("/api/maintenance/member", { method: "DELETE" });
    return null;
  }
  const response = await fetch("/api/maintenance/member", {
    method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store"
  });
  if (!response.ok) return null;
  return response.json();
}
