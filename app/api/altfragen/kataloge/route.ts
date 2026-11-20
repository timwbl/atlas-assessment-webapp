import { NextResponse } from "next/server";
import { summarizeAssessment } from "@/lib/assessmentSummary";
import { authenticateRequest, canAccessAltfragen } from "@/lib/serverAuth";
import { loadMc1Catalogs, saveMc1Catalogs, validateMc1Catalogs } from "@/lib/serverMc1Altfragen";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const MAX_IMPORT_BYTES = 512 * 1024;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: HEADERS });
}

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return error("Bitte melde dich mit deinem ATLAS-Konto an.", 401);
  if (!await canAccessAltfragen(auth)) return error("Die Altfragen-Freigabe fehlt.", 403);
  try {
    const catalogs = await loadMc1Catalogs();
    const assessments = catalogs.map((assessment) => ({
      file: `${assessment.id}.json`,
      assessment: summarizeAssessment(assessment),
      errors: [],
      warnings: [],
    }));
    return NextResponse.json({ assessments }, { headers: HEADERS });
  } catch {
    return error("Die geschützten MC1-Kataloge sind zurzeit nicht verfügbar.", 503);
  }
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return error("Bitte melde dich mit deinem ATLAS-Konto an.", 401);
  if (auth.profile.role !== "admin") return error("Der Import ist für Admin-Konten vorgesehen.", 403);
  if (Number(request.headers.get("content-length") || 0) > MAX_IMPORT_BYTES) {
    return error("Die Importdatei ist zu gross.", 413);
  }
  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_IMPORT_BYTES) return error("Die Importdatei ist zu gross.", 413);
  let catalogs;
  try {
    catalogs = validateMc1Catalogs(JSON.parse(body));
  } catch (cause) {
    return error(cause instanceof SyntaxError ? "Die Importdatei enthält kein gültiges JSON."
      : cause instanceof Error ? cause.message : "Die Importdatei ist ungültig.", 400);
  }
  try {
    if (!await saveMc1Catalogs(catalogs)) {
      return error("Es liegt bereits eine andere MC1-Sammlung vor.", 409);
    }
    return NextResponse.json({
      catalogCount: catalogs.length,
      questionCount: catalogs.reduce((total, catalog) => total + catalog.questions.length, 0),
    }, { headers: HEADERS });
  } catch {
    return error("Der geschützte Speicher ist zurzeit nicht verfügbar.", 503);
  }
}
