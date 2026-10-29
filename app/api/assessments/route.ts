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
        // Legacy clients vary this response by ?summary=1. Do not let a CDN
        // reuse a full-list response as a summary (or the other way around).
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "Netlify-CDN-Cache-Control": "no-store",
        "Netlify-Vary": "query=summary"
      }
    }
  );
}
