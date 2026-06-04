import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import { formatBlockLabel } from "./blockLabels";
import type { Assessment, AssessmentQuestion } from "./types";

type PdfKind = "questions" | "solutions";
type FontFace = "regular" | "bold";

const colors = {
  accent: "#0a84ff",
  text: "#1d1d1f",
  muted: "#6e6e73",
  soft: "#f3f7fb",
  line: "#d9e2ee"
};

const page = {
  width: 595.28,
  height: 841.89,
  marginX: 48,
  headerTop: 28,
  headerHeight: 34,
  contentTop: 78,
  contentBottom: 755,
  footerY: 806
};

const fonts: Record<FontFace, string> = {
  regular: "NotoSans",
  bold: "NotoSansBold"
};

export async function renderAssessmentPdf(assessment: Assessment, kind: PdfKind): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      bufferPages: true,
      autoFirstPage: true,
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

    registerFonts(doc);
    doc.y = page.contentTop;

    if (kind === "questions") {
      renderQuestionDocument(doc, assessment);
    } else {
      renderSolutionsDocument(doc, assessment);
    }

    renderPageChrome(doc, assessment, kind);
    doc.end();
  });
}

function renderQuestionDocument(doc: PDFKit.PDFDocument, assessment: Assessment): void {
  drawCoverTitle(doc, assessment, assessment.title);

  assessment.questions.forEach((question, index) => {
    const height = estimateQuestionBlockHeight(doc, question, "questions");
    keepTogetherOrStartPage(doc, height, introHeight(doc, question) + firstOptionsHeight(doc, question, 2));
    drawQuestionBlock(doc, question, index, "questions");
  });
}

function renderSolutionsDocument(doc: PDFKit.PDFDocument, assessment: Assessment): void {
  drawCoverTitle(doc, assessment, `Lösungen - ${assessment.title}`);

  assessment.questions.forEach((question, index) => {
    const height = estimateQuestionBlockHeight(doc, question, "solutions");
    keepTogetherOrStartPage(doc, height, introHeight(doc, question) + 48);
    drawQuestionBlock(doc, question, index, "solutions");
  });
}

function drawCoverTitle(doc: PDFKit.PDFDocument, assessment: Assessment, title: string): void {
  setFont(doc, "bold", 21);
  doc
    .fillColor(colors.text)
    .text(cleanText(title), page.marginX, doc.y, {
      width: contentWidth(),
      lineGap: 3
    });

  doc.y += 12;
  setFont(doc, "regular", 9.5);
  doc
    .fillColor(colors.muted)
    .text(cleanText([
      formatBlockLabel(assessment.block),
      assessment.lectureCode,
      `${assessment.questions.length} Fragen`,
      new Date().toLocaleDateString("de-CH")
    ].filter(Boolean).join(" · ")), page.marginX, doc.y, {
      width: contentWidth(),
      lineGap: 2
    });

  if (assessment.sourceSummary?.trim()) {
    doc.y += 14;
    drawInfoBox(doc, assessment.sourceSummary);
  }

  doc.y += 18;
  drawRule(doc, colors.accent, 1.2);
  doc.y += 18;
}

function drawInfoBox(doc: PDFKit.PDFDocument, value: string): void {
  const textValue = cleanText(value);
  const boxX = page.marginX;
  const boxW = contentWidth();
  const padding = 13;
  setFont(doc, "regular", 9.5);
  const textHeight = doc.heightOfString(textValue, { width: boxW - padding * 2, lineGap: 2 });
  const boxH = textHeight + padding * 2;
  ensurePageSpace(doc, boxH + 6);

  doc
    .save()
    .roundedRect(boxX, doc.y, boxW, boxH, 10)
    .fill(colors.soft)
    .restore();

  doc
    .fillColor(colors.muted)
    .text(textValue, boxX + padding, doc.y + padding - 1, {
      width: boxW - padding * 2,
      lineGap: 2
    });
  doc.y += boxH;
}

function drawQuestionBlock(
  doc: PDFKit.PDFDocument,
  question: AssessmentQuestion,
  index: number,
  kind: PdfKind
): void {
  drawQuestionIntro(doc, question, index);

  if (kind === "questions") {
    question.options.forEach((option, optionIndex) => {
      drawOption(doc, displayLabel(optionIndex), option.text);
    });
  } else {
    drawSolutionContent(doc, question);
  }

  doc.y += 18;
  drawRule(doc, colors.line, 0.7);
  doc.y += 18;
}

function drawQuestionIntro(doc: PDFKit.PDFDocument, question: AssessmentQuestion, index: number): void {
  const needed = introHeight(doc, question);
  ensurePageSpace(doc, needed);

  setFont(doc, "bold", 8.8);
  doc
    .fillColor(colors.accent)
    .text(`Frage ${index + 1} · ${question.type === "KPRIM" ? "K-prim" : "Typ A"} · Level ${question.difficulty}`, page.marginX, doc.y, {
      width: contentWidth()
    });

  doc.y += 6;
  setFont(doc, "bold", 11.6);
  doc
    .fillColor(colors.text)
    .text(cleanText(question.stem), page.marginX, doc.y, {
      width: contentWidth(),
      lineGap: 3
    });

  doc.y += 11;
}

function drawSolutionContent(doc: PDFKit.PDFDocument, question: AssessmentQuestion): void {
  setFont(doc, "bold", 9.5);
  doc.fillColor(colors.text).text("Richtige Lösung", page.marginX, doc.y, { width: contentWidth() });
  doc.y += 8;

  if (question.type === "A") {
    const correctIndex = question.options.findIndex((option) => option.correct);
    const correct = question.options[correctIndex];
    if (correct) {
      drawOption(doc, displayLabel(correctIndex), correct.text, true);
    } else {
      drawOption(doc, "", "Keine korrekte Antwort hinterlegt.", true);
    }
  } else {
    question.options.forEach((option, optionIndex) => {
      drawOption(doc, displayLabel(optionIndex), `${option.correct ? "richtig" : "falsch"} - ${option.text}`, true);
    });
  }

  if (question.explanation?.trim()) {
    const explanation = cleanText(question.explanation);
    setFont(doc, "regular", 9.5);
    const height = doc.heightOfString(explanation, { width: contentWidth(), lineGap: 2 });
    ensurePageSpace(doc, height + 10);
    doc.y += 5;
    doc
      .fillColor(colors.muted)
      .text(explanation, page.marginX, doc.y, {
        width: contentWidth(),
        lineGap: 2
      });
    doc.y += 4;
  }
}

function drawOption(doc: PDFKit.PDFDocument, label: string, value: string, emphasized = false): void {
  const labelW = 26;
  const gap = 7;
  const x = page.marginX + 12;
  const textX = x + labelW + gap;
  const width = page.width - page.marginX - textX;
  const body = cleanText(value);

  setFont(doc, "regular", emphasized ? 10 : 9.8);
  const bodyHeight = Math.max(15, doc.heightOfString(body, { width, lineGap: 2 }));
  const rowHeight = bodyHeight + 6;
  ensurePageSpace(doc, rowHeight);

  const y = doc.y;
  setFont(doc, "bold", 9.8);
  doc
    .fillColor(emphasized ? colors.accent : colors.text)
    .text(label ? `${label}.` : "", x, y + 1, {
      width: labelW,
      lineBreak: false
    });

  setFont(doc, "regular", emphasized ? 10 : 9.8);
  doc
    .fillColor(colors.text)
    .text(body, textX, y, {
      width,
      lineGap: 2
    });

  doc.y = y + rowHeight;
}

function renderPageChrome(doc: PDFKit.PDFDocument, assessment: Assessment, kind: PdfKind): void {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  const metaLabel = truncateText(
    ["ATLAS Assessment", formatBlockLabel(assessment.block), assessment.lectureCode].filter(Boolean).join(" · "),
    68
  );
  const headerRight = truncateText(
    [assessment.lectureCode, kind === "solutions" ? "Lösungen" : assessment.title].filter(Boolean).join(" · "),
    62
  );

  for (let offset = 0; offset < totalPages; offset += 1) {
    const pageIndex = range.start + offset;
    doc.switchToPage(pageIndex);
    const oldPosition = { x: doc.x, y: doc.y };

    setFont(doc, "bold", 8.5);
    drawFixedText(doc, "ATLAS Assessment", page.marginX, page.headerTop, "left");

    setFont(doc, "regular", 8);
    drawFixedText(doc, headerRight, page.width - page.marginX, page.headerTop, "right");

    doc
      .save()
      .strokeColor(colors.line)
      .lineWidth(0.45)
      .moveTo(page.marginX, page.headerTop + page.headerHeight)
      .lineTo(page.width - page.marginX, page.headerTop + page.headerHeight)
      .stroke()
      .restore();

    setFont(doc, "regular", 8);
    drawFixedText(doc, metaLabel, page.marginX, page.footerY, "left");
    drawFixedText(doc, `Seite ${offset + 1} / ${totalPages}`, page.width - page.marginX, page.footerY, "right");

    doc.x = oldPosition.x;
    doc.y = oldPosition.y;
  }
}

function keepTogetherOrStartPage(doc: PDFKit.PDFDocument, totalHeight: number, minimumHeight: number): void {
  const remaining = remainingHeight(doc);
  if (totalHeight <= remaining) return;
  if (minimumHeight > remaining) addContentPage(doc);
}

function ensurePageSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (needed > remainingHeight(doc)) addContentPage(doc);
}

function addContentPage(doc: PDFKit.PDFDocument): void {
  doc.addPage({ margins: { top: 0, right: 0, bottom: 0, left: 0 } });
  doc.y = page.contentTop;
}

function estimateQuestionBlockHeight(doc: PDFKit.PDFDocument, question: AssessmentQuestion, kind: PdfKind): number {
  let height = introHeight(doc, question);

  if (kind === "questions") {
    height += question.options.reduce((sum, option) => sum + optionHeight(doc, option.text), 0);
  } else if (question.type === "A") {
    const correct = question.options.find((option) => option.correct);
    height += 28 + optionHeight(doc, correct?.text || "Keine korrekte Antwort hinterlegt.");
  } else {
    height += 28 + question.options.reduce((sum, option) => (
      sum + optionHeight(doc, `${option.correct ? "richtig" : "falsch"} - ${option.text}`)
    ), 0);
  }

  if (kind === "solutions" && question.explanation?.trim()) {
    setFont(doc, "regular", 9.5);
    height += doc.heightOfString(cleanText(question.explanation), { width: contentWidth(), lineGap: 2 }) + 15;
  }

  return height + 38;
}

function introHeight(doc: PDFKit.PDFDocument, question: AssessmentQuestion): number {
  setFont(doc, "bold", 11.6);
  return 30 + doc.heightOfString(cleanText(question.stem), { width: contentWidth(), lineGap: 3 });
}

function firstOptionsHeight(doc: PDFKit.PDFDocument, question: AssessmentQuestion, count: number): number {
  const firstOptions = question.options.slice(0, count);
  if (!firstOptions.length) return 18;
  return firstOptions.reduce((sum, option) => sum + optionHeight(doc, option.text), 0);
}

function optionHeight(doc: PDFKit.PDFDocument, value: string): number {
  const labelW = 26;
  const gap = 7;
  const textX = page.marginX + 12 + labelW + gap;
  const width = page.width - page.marginX - textX;
  setFont(doc, "regular", 9.8);
  return Math.max(15, doc.heightOfString(cleanText(value), { width, lineGap: 2 })) + 6;
}

function drawRule(doc: PDFKit.PDFDocument, color: string, width: number): void {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(width)
    .moveTo(page.marginX, doc.y)
    .lineTo(page.width - page.marginX, doc.y)
    .stroke()
    .restore();
}

function registerFonts(doc: PDFKit.PDFDocument): void {
  doc.registerFont(fonts.regular, fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf")));
  doc.registerFont(fonts.bold, fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "NotoSans-Bold.ttf")));
}

function setFont(doc: PDFKit.PDFDocument, face: FontFace, size: number): void {
  doc.font(fonts[face]).fontSize(size);
}

function drawFixedText(doc: PDFKit.PDFDocument, value: string, x: number, y: number, align: "left" | "right"): void {
  const textValue = cleanText(value).replace(/\s+/g, " ");
  const measuredWidth = doc.widthOfString(textValue);
  const drawX = align === "right" ? x - measuredWidth : x;
  const oldPosition = { x: doc.x, y: doc.y };

  doc.fillColor(colors.muted);
  (doc as unknown as {
    _fragment: (text: string, x: number, y: number, options: Record<string, unknown>) => void;
  })._fragment(textValue, drawX, y, {
    textWidth: measuredWidth,
    lineWidth: measuredWidth,
    wordCount: Math.max(1, textValue.trim().split(/\s+/).length),
    fill: true
  });
  doc.x = oldPosition.x;
  doc.y = oldPosition.y;
}

function remainingHeight(doc: PDFKit.PDFDocument): number {
  return page.contentBottom - doc.y;
}

function contentWidth(): number {
  return page.width - page.marginX * 2;
}

function cleanText(value: string): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u2192\u27f6\u2794\u21d2]/g, "=>")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  const textValue = cleanText(value).replace(/\s+/g, " ");
  if (textValue.length <= maxLength) return textValue;
  return `${textValue.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function displayLabel(index: number): string {
  return String.fromCharCode(65 + index);
}
