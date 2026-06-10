import { NextResponse } from "next/server";
import {
  authenticateRequest,
  supabaseServerRestRequest
} from "@/lib/serverAuth";
import { sendAltfragenRequestNotification } from "@/lib/notifications/sendAltfragenRequestNotification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AltfragenRequestRow = {
  id: string;
  user_id: string;
  user_email: string;
  display_name: string;
  study_year: number;
  status: "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
};

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Bitte melde dich zuerst mit deinem Account an." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) {
    return NextResponse.json({ error: "Die Anfrage ist unerwartet gross." }, { status: 413 });
  }

  const input = await parseInput(request);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const existing = await supabaseServerRestRequest<AltfragenRequestRow[]>(
    `altfragen_access_requests?select=*&user_id=eq.${encodeURIComponent(auth.user.id)}&limit=1`,
    auth.token
  ).catch(() => []);
  const now = new Date().toISOString();
  const rows = await supabaseServerRestRequest<AltfragenRequestRow[]>(
    "altfragen_access_requests?on_conflict=user_id&select=*",
    auth.token,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{
        id: auth.user.id,
        user_id: auth.user.id,
        user_email: auth.profile.email || auth.user.email || "",
        display_name: input.displayName,
        study_year: input.studyYear,
        status: "pending",
        updated_at: now
      }])
    }
  );
  const saved = rows[0];
  if (!saved) {
    return NextResponse.json({ error: "Anfrage wurde gespeichert, konnte aber nicht zurückgelesen werden." }, { status: 500 });
  }

  let notificationSent = false;
  if (shouldNotify(existing[0])) {
    const studyContext = notificationStudyContext(auth.user.user_metadata);
    try {
      await sendAltfragenRequestNotification({
        id: saved.id,
        displayName: saved.display_name,
        userEmail: saved.user_email,
        studyYear: saved.study_year,
        semester: studyContext.semester,
        examOrBlock: studyContext.exams,
        createdAt: saved.updated_at
      });
      notificationSent = true;
      console.info(`Admin notification sent for altfragen request ${saved.id}`);
    } catch (error) {
      console.error("Failed to send admin notification", {
        requestId: saved.id,
        message: error instanceof Error ? error.message : "Unbekannter Mailfehler"
      });
    }
  }

  return NextResponse.json({
    request: fromRow(saved),
    notificationSent
  }, { status: 201 });
}

async function parseInput(request: Request): Promise<
  { ok: true; displayName: string; studyYear: number }
  | { ok: false; error: string }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, error: "Die Anfrage ist ungültig." };
  }
  if (!isRecord(raw)) return { ok: false, error: "Die Anfrage ist ungültig." };

  const displayName = typeof raw.displayName === "string" ? raw.displayName.trim() : "";
  if (!displayName) return { ok: false, error: "Bitte gib deinen Namen ein." };
  if (displayName.length > 120) return { ok: false, error: "Der Name ist zu lang." };

  const studyYear = Number(raw.studyYear);
  if (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 6) {
    return { ok: false, error: "Bitte wähle ein gültiges Studienjahr." };
  }
  return { ok: true, displayName, studyYear };
}

function notificationStudyContext(metadata?: Record<string, unknown>): {
  semester: string | null;
  exams: string | null;
} {
  const settings = isRecord(metadata?.atlas_study_settings)
    ? metadata.atlas_study_settings
    : {};
  const semester = settings.semester === "hs"
    ? "1. Semester (HS)"
    : settings.semester === "fs"
      ? "2. Semester (FS)"
      : null;
  const preparation = isRecord(settings.examPreparation) ? settings.examPreparation : {};
  const exams = Array.isArray(preparation.selectedExams)
    ? preparation.selectedExams
      .filter((value): value is string => typeof value === "string" && /^eMC[1-4]$/.test(value))
      .join(" + ")
    : "";
  return { semester, exams: exams || null };
}

function shouldNotify(existing?: AltfragenRequestRow): boolean {
  if (!existing || existing.status !== "pending") return true;
  const lastUpdate = new Date(existing.updated_at).getTime();
  return !Number.isFinite(lastUpdate) || Date.now() - lastUpdate >= 5 * 60 * 1000;
}

function fromRow(row: AltfragenRequestRow) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
