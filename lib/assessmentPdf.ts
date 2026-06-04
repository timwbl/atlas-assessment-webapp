import PDFDocument from "pdfkit/js/pdfkit.standalone";
import type { Assessment, AssessmentQuestion } from "./types";
import { formatBlockLabel } from "./blockLabels";

type PdfKind = "questions" | "solutions";

const accent = "#0a84ff";
const text = "#1d1d1f";
const muted = "#6e6e73";
const line = "#d8d8dc";

export async function renderAssessmentPdf(assessment: Assessment, kind: PdfKind): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 54,
      bufferPages: true,
      info: {
        Title: kind === "questions" ? assessment.title : `Lösungen - ${assessment.title}`,
        Author: "ATLAS Assessment",
        Subject: "ATLAS Assessment PDF"
      }
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawTitle(doc, assessment, kind);
    assessment.questions.forEach((question, index) => {
      if (kind === "questions") drawQuestion(doc, question, index);
      else drawSolution(doc, question, index);
    });
    drawFooters(doc);
    doc.end();
  });
}

function drawTitle(doc: PDFKit.PDFDocument, assessment: Assessment, kind: PdfKind): void {
  const title = kind === "questions" ? assessment.title : `Lösungen - ${assessment.title}`;

  doc
    .fillColor(accent)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("ATLAS Assessment", { characterSpacing: 0.5 });

  doc.moveDown(0.45);
  doc
    .fillColor(text)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(title, { lineGap: 2 });

  doc.moveDown(0.5);
  doc
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(10)
    .text([
      formatBlockLabel(assessment.block),
      assessment.lectureCode,
      `${assessment.questions.length} Fragen`,
      new Date().toLocaleDateString("de-CH")
    ].filter(Boolean).join(" · "));

  if (assessment.sourceSummary) {
    doc.moveDown(0.7);
    doc
      .fillColor(muted)
      .fontSize(10)
      .text(assessment.sourceSummary, { lineGap: 2 });
  }

  doc.moveDown(1);
  horizontalRule(doc, accent);
  doc.moveDown(1);
}

function drawQuestion(doc: PDFKit.PDFDocument, question: AssessmentQuestion, index: number): void {
  ensureSpace(doc, estimatedQuestionHeight(doc, question));
  drawQuestionHead(doc, question, index);

  doc.moveDown(0.45);
  question.options.forEach((option, optionIndex) => {
    drawOptionLine(doc, displayLabel(optionIndex), option.text);
    doc.moveDown(0.22);
  });

  doc.moveDown(0.7);
}

function drawSolution(doc: PDFKit.PDFDocument, question: AssessmentQuestion, index: number): void {
  ensureSpace(doc, estimatedQuestionHeight(doc, question) + 36);
  drawQuestionHead(doc, question, index);

  doc.moveDown(0.55);
  doc
    .fillColor(accent)
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text("Richtige Lösung");

  doc.moveDown(0.25);
  if (question.type === "A") {
    const correctIndex = question.options.findIndex((option) => option.correct);
    const correct = question.options[correctIndex];
    if (correct) drawOptionLine(doc, displayLabel(correctIndex), correct.text);
    else drawOptionLine(doc, "", "Keine korrekte Antwort hinterlegt.");
  } else {
    question.options.forEach((option, optionIndex) => {
      drawOptionLine(doc, displayLabel(optionIndex), `${option.correct ? "richtig" : "falsch"} - ${option.text}`);
      doc.moveDown(0.18);
    });
  }

  if (question.explanation) {
    doc.moveDown(0.45);
    doc
      .fillColor(muted)
      .font("Helvetica")
      .fontSize(10)
      .text(question.explanation, { lineGap: 2 });
  }

  doc.moveDown(0.85);
}

function drawQuestionHead(doc: PDFKit.PDFDocument, question: AssessmentQuestion, index: number): void {
  doc
    .fillColor(muted)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(`Frage ${index + 1} · ${question.type === "KPRIM" ? "K-prim" : "Typ A"} · Level ${question.difficulty}`);

  doc.moveDown(0.35);
  doc
    .fillColor(text)
    .font("Helvetica-Bold")
    .fontSize(12.5)
    .text(question.stem, { lineGap: 3 });
}

function drawOptionLine(doc: PDFKit.PDFDocument, label: string, body: string): void {
  const labelX = doc.page.margins.left + 12;
  const textX = labelX + 24;
  const startY = doc.y;
  const width = doc.page.width - doc.page.margins.right - textX;

  doc
    .fillColor(text)
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text(label ? `${label}.` : "", labelX, startY, { width: 20, lineBreak: false });

  doc
    .fillColor(text)
    .font("Helvetica")
    .fontSize(10.5)
    .text(body, textX, startY, { width, lineGap: 2 });
}

function estimatedQuestionHeight(doc: PDFKit.PDFDocument, question: AssessmentQuestion): number {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const stemHeight = doc.heightOfString(question.stem, { width: usableWidth, lineGap: 3 });
  const optionWidth = usableWidth - 36;
  const optionsHeight = question.options.reduce((sum, option, index) => (
    sum + doc.heightOfString(`${displayLabel(index)}. ${option.text}`, { width: optionWidth, lineGap: 2 }) + 6
  ), 0);
  return 54 + stemHeight + optionsHeight;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + Math.min(needed, 430) > bottom) {
    doc.addPage();
  }
}

function horizontalRule(doc: PDFKit.PDFDocument, color: string): void {
  const y = doc.y;
  doc
    .save()
    .strokeColor(color)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
    .restore();
}

function drawFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const pageNumber = index + 1;
    const footerY = doc.page.height - 34;
    doc
      .fillColor(muted)
      .font("Helvetica")
      .fontSize(8)
      .text("ATLAS Assessment", doc.page.margins.left, footerY, { lineBreak: false });
    doc
      .text(`Seite ${pageNumber} / ${range.count}`, doc.page.width - doc.page.margins.right - 80, footerY, {
        width: 80,
        align: "right",
        lineBreak: false
      });
  }
}

function displayLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
