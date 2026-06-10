"use client";

import { getCurrentProfile, type CloudProfile } from "./cloudProgress";
import { ensureSession, isSupabaseConfigured, restRequest } from "./supabaseClient";
import type { Assessment } from "./types";

export const ALTFRAGEN_TITLE = "Altfragen";
export const ALTFRAGEN_ACCESS_CHANGED_EVENT = "atlas-altfragen-access-changed";

const PASSWORD_KEY = "atlas-altfragen-password-access-v1";

export type AltfragenRequestStatus = "pending" | "approved" | "denied";

export type AltfragenAccessRequest = {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string;
  studyYear: number;
  status: AltfragenRequestStatus;
  createdAt: string;
  updatedAt: string;
};

type AltfragenAccessRequestRow = {
  id: string;
  user_id: string;
  user_email: string;
  display_name: string;
  study_year: number;
  status: AltfragenRequestStatus;
  created_at: string;
  updated_at: string;
};

export function isAltfragenBlock(block: string): boolean {
  return normalizeAltfragenText(block).includes("altfragen")
    || normalizeAltfragenText(block).includes("altfrage")
    || normalizeAltfragenText(block).includes("alte fragen");
}

export function isAltfragenAssessment(assessment: Assessment | null | undefined): boolean {
  return !!assessment && isAltfragenBlock(assessment.block);
}

export function altfragenPasswordConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_ALTFRAGEN_PASSWORD?.trim();
}

export function hasAltfragenPasswordAccess(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PASSWORD_KEY) === "true";
}

export function verifyAltfragenPassword(password: string): boolean {
  const configured = process.env.NEXT_PUBLIC_ALTFRAGEN_PASSWORD?.trim();
  const ok = !!configured && password.trim() === configured;
  if (ok && typeof window !== "undefined") {
    window.localStorage.setItem(PASSWORD_KEY, "true");
    notifyAltfragenAccessChanged();
  }
  return ok;
}

export async function canAccessAltfragen(): Promise<boolean> {
  if (hasAltfragenPasswordAccess()) return true;
  if (!isSupabaseConfigured()) return false;

  const profile = await getCurrentProfile().catch(() => null);
  if (!profile) return false;
  if (profile.role === "admin") return true;

  const request = await loadOwnAltfragenRequest(profile).catch(() => null);
  return request?.status === "approved";
}

export async function loadOwnAltfragenRequest(profile?: CloudProfile | null): Promise<AltfragenAccessRequest | null> {
  if (!isSupabaseConfigured()) return null;
  const currentProfile = profile || await getCurrentProfile();
  if (!currentProfile) return null;

  const rows = await restRequest<AltfragenAccessRequestRow[]>(
    `altfragen_access_requests?select=*&user_id=eq.${encodeURIComponent(currentProfile.id)}&limit=1`
  );
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function submitAltfragenAccessRequest(input: {
  displayName: string;
  studyYear: number;
}): Promise<AltfragenAccessRequest> {
  if (!isSupabaseConfigured()) throw new Error("Account-Freigaben sind noch nicht konfiguriert.");
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Bitte melde dich zuerst mit deinem Account an.");

  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Bitte gib deinen Namen ein.");
  const studyYear = Math.max(1, Math.min(6, Number(input.studyYear) || 1));

  const session = await ensureSession();
  if (!session) throw new Error("Bitte melde dich zuerst mit deinem Account an.");

  const response = await fetch("/api/altfragen/requests", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ displayName, studyYear })
  });
  const payload = await response.json().catch(() => null) as {
    request?: AltfragenAccessRequest;
    error?: string;
  } | null;
  if (!response.ok || !payload?.request) {
    throw new Error(payload?.error || `Anfrage konnte nicht gesendet werden (HTTP ${response.status}).`);
  }
  notifyAltfragenAccessChanged();
  return payload.request;
}

export async function loadAdminAltfragenRequests(): Promise<AltfragenAccessRequest[]> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return [];

  const rows = await restRequest<AltfragenAccessRequestRow[]>(
    "altfragen_access_requests?select=*&order=updated_at.desc"
  );
  return rows.map(fromRow);
}

export async function setAltfragenRequestStatus(id: string, status: AltfragenRequestStatus): Promise<void> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new Error("Nur Admins können Altfragen-Anfragen moderieren.");

  await restRequest(`altfragen_access_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, updated_at: new Date().toISOString() })
  });
  notifyAltfragenAccessChanged();
}

function notifyAltfragenAccessChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ALTFRAGEN_ACCESS_CHANGED_EVENT));
}

function fromRow(row: AltfragenAccessRequestRow): AltfragenAccessRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    displayName: row.display_name,
    studyYear: row.study_year,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeAltfragenText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
