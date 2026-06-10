import { NextResponse } from "next/server";
import { loadAssessmentFiles, loadAssessmentSummaries } from "@/lib/serverAssessments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const summary = new URL(request.url).searchParams.get("summary") === "1";
  const assessments = summary
    ? await loadAssessmentSummaries()
    : await loadAssessmentFiles();

  return NextResponse.json(
    { assessments },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
      }
    }
  );
}
