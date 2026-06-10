import { NextResponse } from "next/server";
import { loadServerAssessmentById } from "@/lib/serverAssessments";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const assessment = await loadServerAssessmentById(decodeURIComponent(id));

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
