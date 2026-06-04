"use client";

import { isSupabaseConfigured, restRequest } from "./supabaseClient";

const PRESENCE_KEY = "atlas-online-presence-session-v1";
const ACTIVE_WINDOW_MS = 75_000;

type PresenceRow = {
  session_id: string;
  path: string;
  user_agent: string;
  last_seen_at: string;
};

export function getPresenceSessionId(): string {
  if (typeof window === "undefined") return "server";

  const existing = window.sessionStorage.getItem(PRESENCE_KEY);
  if (existing) return existing;

  const next = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `presence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(PRESENCE_KEY, next);
  return next;
}

export async function heartbeatPresence(): Promise<number> {
  if (!isSupabaseConfigured() || typeof window === "undefined") return 1;

  const now = new Date().toISOString();
  await restRequest<PresenceRow[]>("online_presence?on_conflict=session_id&select=session_id,last_seen_at", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{
      session_id: getPresenceSessionId(),
      path: window.location.pathname || "/",
      user_agent: window.navigator.userAgent.slice(0, 240),
      last_seen_at: now
    }])
  });

  return countOnlinePresence();
}

export async function countOnlinePresence(): Promise<number> {
  if (!isSupabaseConfigured()) return 1;

  const threshold = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const rows = await restRequest<Array<Pick<PresenceRow, "session_id">>>(
    `online_presence?select=session_id&last_seen_at=gte.${encodeURIComponent(threshold)}`
  );

  return Math.max(1, rows.length);
}
