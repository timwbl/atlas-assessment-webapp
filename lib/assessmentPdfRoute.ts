import { NextResponse } from "next/server";
import { renderAssessmentPdf, renderAssessmentReviewPdf } from "./assessmentPdf";
import { canExportAssessment, authenticateRequest } from "./serverAuth";
import { loadServerAssessmentById } from "./serverAssessments";
import type { QuizAttempt, UserAnswer } from "./types";

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
    const body = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(body).set(pdf);
    const fileName = `${fileSafe(assessment.lectureCode || assessment.title)}-${kind === "questions" ? "fragen" : "loesungen"}.pdf`;
    return new Response(body, {
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

export async function handleAssessmentReviewPdfExport(request: Request, id: string): Promise<Response> {
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

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2_000_000) {
    return NextResponse.json({ error: "Die Review-Daten sind unerwartet gross." }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Die Review-Daten sind ungültig." }, { status: 400 });
  }

  const attempt = parseAttempt(raw, assessment.id);
  if (!attempt) {
    return NextResponse.json({ error: "Der abgeschlossene Versuch ist unvollständig oder ungültig." }, { status: 400 });
  }

  try {
    const pdf = await renderAssessmentReviewPdf(assessment, attempt);
    const body = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(body).set(pdf);
    const date = validDatePart(attempt.completedAt);
    const fileName = `atlas-review_${fileSafe(assessment.title)}_${date}.pdf`;
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Review-PDF konnte nicht erstellt werden."
    }, { status: 500 });
  }
}

function parseAttempt(raw: unknown, assessmentId: string): QuizAttempt | null {
  if (!isRecord(raw) || !isRecord(raw.attempt)) return null;
  const value = raw.attempt;
  if (
    value.assessmentId !== assessmentId
    || typeof value.id !== "string"
    || typeof value.completedAt !== "string"
    || Number.isNaN(new Date(value.completedAt).getTime())
    || !isRecord(value.answers)
  ) {
    return null;
  }

  const answers = Object.entries(value.answers).reduce<Record<string, UserAnswer>>((acc, [questionId, answer]) => {
    const parsed = parseAnswer(answer);
    if (parsed) acc[questionId] = parsed;
    return acc;
  }, {});
  const questionResults = Array.isArray(value.questionResults)
    ? value.questionResults
      .filter(isRecord)
      .filter((result) => typeof result.questionId === "string")
      .slice(0, 500)
      .map((result) => ({
        questionId: String(result.questionId),
        answer: parseAnswer(result.answer) || {},
        optionOrder: Array.isArray(result.optionOrder)
          ? result.optionOrder.filter((item): item is string => typeof item === "string").slice(0, 20)
          : [],
        status: result.status === "correct" || result.status === "partial" ? result.status : "incorrect",
        points: typeof result.points === "number" ? result.points : 0,
        maxPoints: typeof result.maxPoints === "number" ? result.maxPoints : 1,
        correctStatements: typeof result.correctStatements === "number" ? result.correctStatements : undefined,
        totalStatements: typeof result.totalStatements === "number" ? result.totalStatements : undefined
      }))
    : undefined;

  return {
    id: value.id,
    assessmentId,
    mode: value.mode === "training" || value.mode === "review" ? value.mode : "exam",
    score: typeof value.score === "number" ? value.score : 0,
    correct: typeof value.correct === "number" ? value.correct : 0,
    total: typeof value.total === "number" ? value.total : Object.keys(answers).length,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : value.completedAt,
    completedAt: value.completedAt,
    answers,
    wrongQuestionIds: Array.isArray(value.wrongQuestionIds)
      ? value.wrongQuestionIds.filter((item): item is string => typeof item === "string")
      : [],
    questionResults
  };
}

function parseAnswer(raw: unknown): UserAnswer | null {
  if (!isRecord(raw)) return null;
  const answer: UserAnswer = {};
  if (typeof raw.selected === "string") answer.selected = raw.selected;
  if (isRecord(raw.kprim)) {
    answer.kprim = Object.entries(raw.kprim).reduce<Record<string, boolean>>((acc, [key, value]) => {
      if (typeof value === "boolean") acc[key] = value;
      return acc;
    }, {});
  }
  return answer;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

function validDatePart(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}
