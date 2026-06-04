import { handleAssessmentPdfExport } from "@/lib/assessmentPdfRoute";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleAssessmentPdfExport(request, id, "solutions");
}
