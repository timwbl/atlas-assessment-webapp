"use client";

import {
  authRequest,
  ensureSession,
  getEmailConfirmationRedirectUrl,
  getStoredSession,
  isInvalidSessionError,
  isSupabaseConfigured,
  restRequest,
  saveSession,
  setSessionPersistence,
  toCloudSession,
  type AuthSessionResponse,
  type CloudUser
} from "./supabaseClient";
import {
  getAllProgress,
  getProgress,
  mergeProgress,
  mergeProgressMap,
  saveAllProgress,
  saveProgress
} from "./progressStore";
import type { AssessmentProgress } from "./types";
import type { UserStudySettings } from "./studyProgram";

export type CloudProfile = {
  id: string;
  email: string;
  display_name: string | null;
  role: "student" | "admin";
  created_at: string;
  last_seen_at: string | null;
};

export type AdminProgressRow = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  assessmentId: string;
  bestScore: number;
  lastScore: number | null;
  attempts: number;
  seenQuestions: number;
  reviewQuestions: number;
  lastAttemptAt: string | null;
  updatedAt: string;
};

export type SignUpResult = {
  user: CloudUser | null;
  requiresEmailConfirmation: boolean;
};

type ProgressRecord = {
  user_id: string;
  assessment_id: string;
  progress: AssessmentProgress;
  updated_at: string;
};

export function cloudSyncAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function getCurrentUser(): Promise<CloudUser | null> {
  const session = await ensureSession();
  if (!session) return null;

  try {
    const user = await authRequest<CloudUser>("user", { method: "GET" }, session.access_token);
    return user;
  } catch (error) {
    if (isInvalidSessionError(error)) saveSession(null);
    return null;
  }
}

export async function signInWithPassword(email: string, password: string, remember = true): Promise<CloudUser> {
  setSessionPersistence(remember);
  const response = await authRequest<AuthSessionResponse>("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  const session = toCloudSession(response);
  saveSession(session, remember);
  await upsertCurrentProfile(session.user).catch(() => undefined);
  return session.user;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string,
  remember = true
): Promise<SignUpResult> {
  const name = displayName.trim();
  if (!name) throw new Error("Bitte gib deinen Namen ein.");
  setSessionPersistence(remember);
  const redirectTo = getEmailConfirmationRedirectUrl();

  const response = await authRequest<Partial<AuthSessionResponse> & { user?: CloudUser }>(
    `signup?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: { name }
    })
    }
  );

  if (response.access_token && response.user) {
    const session = toCloudSession(response as AuthSessionResponse);
    saveSession(session);
    await upsertCurrentProfile({ ...session.user, user_metadata: { ...(session.user.user_metadata || {}), name } });
    return { user: session.user, requiresEmailConfirmation: false };
  }

  return {
    user: response.user || null,
    requiresEmailConfirmation: true
  };
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  const redirectTo = getEmailConfirmationRedirectUrl();
  await authRequest(
    `resend?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: "POST",
      body: JSON.stringify({
        type: "signup",
        email
      })
    }
  );
}

export async function signOut(): Promise<void> {
  const session = getStoredSession();
  if (session) {
    await authRequest("logout", { method: "POST" }, session.access_token).catch(() => undefined);
  }
  saveSession(null);
}

export async function upsertCurrentProfile(user: CloudUser): Promise<CloudProfile> {
  const metadataName = typeof user.user_metadata?.name === "string"
    ? user.user_metadata.name.trim()
    : "";
  const select = "id,email,display_name,role,created_at,last_seen_at";
  const existing = await restRequest<CloudProfile[]>(
    `profiles?select=${select}&id=eq.${encodeURIComponent(user.id)}&limit=1`
  );

  const current = existing[0];
  const profile: Record<string, string> = {
    email: user.email || "",
    last_seen_at: new Date().toISOString()
  };
  if (!current?.display_name?.trim() && metadataName) profile.display_name = metadataName;

  const data = current
    ? await restRequest<CloudProfile[]>(
      `profiles?id=eq.${encodeURIComponent(user.id)}&select=${select}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(profile)
      }
    )
    : await restRequest<CloudProfile[]>(
      `profiles?select=${select}`,
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{ id: user.id, ...profile }])
      }
    );
  if (!data[0]) throw new Error("Profil konnte nicht gespeichert werden.");
  return data[0];
}

export async function updateCurrentProfileName(displayName: string): Promise<CloudProfile> {
  const name = displayName.trim();
  if (!name) throw new Error("Bitte gib deinen Namen ein.");
  const session = await ensureSession();
  if (!session) throw new Error("Nicht angemeldet.");

  const updatedUser = await authRequest<CloudUser>("user", {
    method: "PUT",
    body: JSON.stringify({ data: { name } })
  }, session.access_token);
  saveSession({ ...session, user: updatedUser });

  const data = await restRequest<CloudProfile[]>("profiles?on_conflict=id&select=id,email,display_name,role,created_at,last_seen_at", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{
      id: updatedUser.id,
      email: updatedUser.email || "",
      display_name: name,
      last_seen_at: new Date().toISOString()
    }])
  });
  if (!data[0]) throw new Error("Name konnte nicht gespeichert werden.");
  return data[0];
}

export async function updateCurrentUserStudySettings(settings: UserStudySettings): Promise<CloudUser | null> {
  const session = await ensureSession();
  if (!session) return null;
  const updatedUser = await authRequest<CloudUser>("user", {
    method: "PUT",
    body: JSON.stringify({ data: { atlas_study_settings: settings } })
  }, session.access_token);
  saveSession({ ...session, user: updatedUser });
  return updatedUser;
}

export async function getCurrentProfile(currentUser?: CloudUser): Promise<CloudProfile | null> {
  const user = currentUser || await getCurrentUser();
  if (!user) return null;
  const rows = await restRequest<CloudProfile[]>(
    `profiles?select=id,email,display_name,role,created_at,last_seen_at&id=eq.${encodeURIComponent(user.id)}`
  );
  return rows[0] || upsertCurrentProfile(user);
}

export async function pullCloudProgress(): Promise<Record<string, AssessmentProgress>> {
  const user = await getCurrentUser();
  if (!user) return {};

  const rows = await restRequest<Array<Pick<ProgressRecord, "assessment_id" | "progress">>>(
    `user_progress?select=assessment_id,progress,updated_at&user_id=eq.${encodeURIComponent(user.id)}`
  );

  return rows.reduce<Record<string, AssessmentProgress>>((acc, record) => {
    acc[record.assessment_id] = record.progress;
    return acc;
  }, {});
}

async function pullCloudAssessmentProgress(
  userId: string,
  assessmentId: string
): Promise<AssessmentProgress | null> {
  const rows = await restRequest<Array<Pick<ProgressRecord, "progress">>>(
    `user_progress?select=progress&user_id=eq.${encodeURIComponent(userId)}&assessment_id=eq.${encodeURIComponent(assessmentId)}&limit=1`
  );
  return rows[0]?.progress || null;
}

export async function syncAllProgress(): Promise<Record<string, AssessmentProgress>> {
  const user = await getCurrentUser();
  if (!user) return getAllProgress();

  const remote = await pullCloudProgress();
  const merged = mergeProgressMap(remote);
  await pushAllProgress(merged);
  return merged;
}

export async function pushAllProgress(progress = getAllProgress()): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const rows = Object.values(progress).map((item) => ({
    user_id: user.id,
    assessment_id: item.assessmentId,
    progress: item,
    updated_at: new Date().toISOString()
  }));

  if (!rows.length) return;
  await restRequest("user_progress?on_conflict=user_id,assessment_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows)
  });
}

export async function syncAssessmentProgress(assessmentId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const local = getProgress(assessmentId);
  const remote = await pullCloudAssessmentProgress(user.id, assessmentId);
  const merged = remote ? mergeProgress(local, remote) : local;
  saveProgress(merged);
  await pushAllProgress({ [assessmentId]: merged });
}

export async function resetCloudProgress(assessmentId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await restRequest(
    `user_progress?user_id=eq.${encodeURIComponent(user.id)}&assessment_id=eq.${encodeURIComponent(assessmentId)}`,
    { method: "DELETE" }
  );
}

export async function fetchAdminProgressRows(): Promise<AdminProgressRow[]> {
  const rows = await restRequest<Array<ProgressRecord & {
    profiles?: { email?: string; display_name?: string | null; role?: string } | null;
  }>>("user_progress?select=user_id,assessment_id,progress,updated_at,profiles(email,display_name,role)&order=updated_at.desc");

  return rows.map((record) => {
    const stats = Object.values(record.progress.questionStats || {});
    return {
      userId: record.user_id,
      email: record.profiles?.email || record.user_id,
      displayName: record.profiles?.display_name || "",
      role: record.profiles?.role || "student",
      assessmentId: record.assessment_id,
      bestScore: record.progress.bestScore || 0,
      lastScore: record.progress.lastScore,
      attempts: record.progress.attempts.length,
      seenQuestions: stats.filter((stat) => stat.seen > 0).length,
      reviewQuestions: stats.filter((stat) => stat.markedForReview || stat.lastCorrect === false || stat.wrong >= 2).length,
      lastAttemptAt: record.progress.lastAttemptAt || null,
      updatedAt: record.updated_at
    };
  });
}

export async function replaceLocalProgressFromCloud(): Promise<Record<string, AssessmentProgress>> {
  const remote = await pullCloudProgress();
  saveAllProgress(remote);
  return remote;
}
