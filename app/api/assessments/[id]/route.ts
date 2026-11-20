import { NextResponse } from "next/server";
import { loadServerAssessmentById } from "@/lib/serverAssessments";
import { mc1Catalog } from "@/lib/mc1Altfragen";
import { authenticateRequest, canAccessAltfragen } from "@/lib/serverAuth";
import { loadMc1Assessment } from "@/lib/serverMc1Altfragen";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const id = decodeURIComponent((await context.params).id);
  if (mc1Catalog(id)) {
    const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
    const auth = await authenticateRequest(request);
    if (!auth) return NextResponse.json({ error: "Bitte melde dich mit deinem ATLAS-Konto an." }, { status: 401, headers });
    if (!await canAccessAltfragen(auth)) {
      return NextResponse.json({ error: "Die Altfragen-Freigabe fehlt." }, { status: 403, headers });
    }
    try {
      const assessment = await loadMc1Assessment(id);
      return assessment ? NextResponse.json({ assessment }, { headers })
        : NextResponse.json({ error: "Katalog nicht gefunden." }, { status: 404, headers });
    } catch {
      return NextResponse.json({ error: "Der MC1-Katalog ist zurzeit nicht verfügbar." }, { status: 503, headers });
    }
  }

  const assessment = await loadServerAssessmentById(id);

  if (!assessment) {
    return NextResponse.json(
      { error: "Assessment nicht gefunden." },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { assessment },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
      }
    }
  );
}
