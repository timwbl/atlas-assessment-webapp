import { NextResponse } from "next/server";
import { loadAssessmentSummaries } from "@/lib/serverAssessments";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { assessments: await loadAssessmentSummaries() },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
      }
    }
  );
}
