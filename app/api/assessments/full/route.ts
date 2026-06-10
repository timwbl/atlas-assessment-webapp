import { NextResponse } from "next/server";
import { loadAssessmentFiles } from "@/lib/serverAssessments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const assessments = await loadAssessmentFiles();

  return NextResponse.json(
    { assessments },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );
}
