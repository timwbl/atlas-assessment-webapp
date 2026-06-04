import { NextResponse } from "next/server";
import { renderAssessmentPdf } from "./assessmentPdf";
import { canExportAssessment, authenticateRequest } from "./serverAuth";
import { loadServerAssessmentById } from "./serverAssessments";

type ExportKind = "questions" | "solutions";

export async function handleAssessmentPdfExport(request: Request, id: string, kind: ExportKind): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Bitte melde dich an, um PDFs zu exportieren." }, { status: 401 });
  }

  const assessment = await loadServerAssessmentById(id);
  if (!assessment) {
    return NextResponse.json({ error: "Assessment wurde nicht gefunden." }, { status: 404 });
  }

  if (!await canExportAssessment(auth, assessment)) {
    return NextResponse.json({ error: "Du hast keinen Zugriff auf dieses Assessment." }, { status: 403 });
  }

  try {
    const pdf = await renderAssessmentPdf(assessment, kind);
    const fileName = `${fileSafe(assessment.lectureCode || assessment.title)}-${kind === "questions" ? "fragen" : "loesungen"}.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "PDF konnte nicht erstellt werden."
    }, { status: 500 });
  }
}

function fileSafe(value: string): string {
  return String(value || "atlas-assessment")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "atlas-assessment";
}
