import { NextResponse } from "next/server";
import { loadAssessmentFiles } from "@/lib/serverAssessments";

export const dynamic = "force-dynamic";

export async function GET() {
  const assessments = await loadAssessmentFiles();
  return NextResponse.json({ assessments });
}
