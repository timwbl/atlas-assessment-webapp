import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit/js/pdfkit.standalone";
import { analyzeAssessmentResults } from "./assessmentAnalysis";
import { formatBlockLabel } from "./blockLabels";
import { evaluateQuestion, scorePercent } from "./score";
import type {
  Assessment,
  AssessmentQuestion,
  QuizAttempt,
  QuizResultRow,
  StoredQuestionResult,
  UserAnswer
} from "./types";

type ExportPdfKind = "questions" | "solutions";
type PdfKind = ExportPdfKind | "review";
type FontFace = "regular" | "bold";

const colors = {
  accent: "#0a84ff",
  text: "#1d1d1f",
  muted: "#6e6e73",
  soft: "#f3f7fb",
  line: "#d9e2ee",
  success: "#18753b",
  successSoft: "#edf8f0",
  warning: "#9a5b00",
  warningSoft: "#fff7e7",
  danger: "#b4232b",
  dangerSoft: "#fff0f1"
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

export async function renderAssessmentPdf(assessment: Assessment, kind: ExportPdfKind): Promise<Buffer> {
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

export async function renderAssessmentReviewPdf(
  assessment: Assessment,
  attempt: QuizAttempt
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `ATLAS Assessment Review - ${assessment.title}`,
        Author: "ATLAS Assessment",
        Subject: "Abgeschlossenes Assessment mit Antworten und Lernanalyse"
      }
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    registerFonts(doc);
    doc.y = page.contentTop;

    const rows = buildReviewRows(assessment, attempt);
    const analysis = analyzeAssessmentResults(assessment, rows);
    renderReviewDocument(doc, assessment, attempt, rows, analysis);
    renderPageChrome(doc, assessment, "review");
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

function renderReviewDocument(
  doc: PDFKit.PDFDocument,
  assessment: Assessment,
  attempt: QuizAttempt,
  rows: QuizResultRow[],
  analysis: ReturnType<typeof analyzeAssessmentResults>
): void {
  drawReviewCover(doc, assessment, attempt, rows);

  rows.forEach((row, index) => {
    const height = estimateReviewQuestionHeight(doc, row);
    keepTogetherOrStartPage(
      doc,
      height,
      introHeight(doc, row.question) + firstOptionsHeight(doc, row.question, 2) + 34
    );
    drawReviewQuestionBlock(doc, assessment, row, index);
  });

  drawReviewConclusion(doc, analysis);
}

function drawReviewCover(
  doc: PDFKit.PDFDocument,
  assessment: Assessment,
  attempt: QuizAttempt,
  rows: QuizResultRow[]
): void {
  setFont(doc, "bold", 8.8);
  doc.fillColor(colors.accent).text("ATLAS ASSESSMENT REVIEW", page.marginX, doc.y, {
    width: contentWidth()
  });
  doc.y += 9;

  setFont(doc, "bold", 21);
  doc.fillColor(colors.text).text(cleanText(assessment.title), page.marginX, doc.y, {
    width: contentWidth(),
    lineGap: 3
  });
  doc.y += 12;

  const completedAt = safeDate(attempt.completedAt);
  setFont(doc, "regular", 9.5);
  doc.fillColor(colors.muted).text(cleanText([
    formatBlockLabel(assessment.block),
    assessment.lectureCode,
    `${rows.length} Fragen`,
    completedAt
  ].filter(Boolean).join(" · ")), page.marginX, doc.y, {
    width: contentWidth(),
    lineGap: 2
  });

  doc.y += 17;
  drawReviewScoreBox(doc, rows);

  if (assessment.sourceSummary?.trim()) {
    doc.y += 13;
    drawInfoBox(doc, assessment.sourceSummary);
  }

  doc.y += 18;
  drawRule(doc, colors.accent, 1.2);
  doc.y += 18;
}

function drawReviewScoreBox(doc: PDFKit.PDFDocument, rows: QuizResultRow[]): void {
  const score = scorePercent(rows);
  const correct = rows.filter((row) => row.status === "correct").length;
  const partial = rows.filter((row) => row.status === "partial").length;
  const incorrect = rows.filter((row) => row.status === "incorrect").length;
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  const maxPoints = rows.reduce((sum, row) => sum + row.maxPoints, 0);
  const labels = [
    ["Score", `${score} %`],
    ["Punkte", `${formatPoints(points)} / ${formatPoints(maxPoints)}`],
    ["Richtig", String(correct)],
    ["Teilrichtig", String(partial)],
    ["Falsch", String(incorrect)]
  ];
  const x = page.marginX;
  const y = doc.y;
  const width = contentWidth();
  const height = 56;
  const itemWidth = width / labels.length;

  doc.save().roundedRect(x, y, width, height, 10).fill(colors.soft).restore();

  labels.forEach(([label, value], index) => {
    const itemX = x + itemWidth * index;
    if (index > 0) {
      doc.save()
        .strokeColor(colors.line)
        .lineWidth(0.5)
        .moveTo(itemX, y + 10)
        .lineTo(itemX, y + height - 10)
        .stroke()
        .restore();
    }
    setFont(doc, "regular", 7.8);
    doc.fillColor(colors.muted).text(label, itemX + 9, y + 10, {
      width: itemWidth - 18,
      align: "center",
      lineBreak: false
    });
    setFont(doc, "bold", 12);
    doc.fillColor(colors.text).text(value, itemX + 7, y + 28, {
      width: itemWidth - 14,
      align: "center",
      lineBreak: false
    });
  });

  doc.y = y + height;
}

function drawReviewQuestionBlock(
  doc: PDFKit.PDFDocument,
  assessment: Assessment,
  row: QuizResultRow,
  index: number
): void {
  const status = reviewStatus(row);
  const topY = doc.y;

  setFont(doc, "bold", 8.8);
  doc.fillColor(status.color).text(
    `Frage ${index + 1} · ${row.question.type === "KPRIM" ? "K-prim" : "Typ A"} · Level ${row.question.difficulty} · ${status.label}`,
    page.marginX,
    topY,
    { width: contentWidth() }
  );
  doc.y += 7;

  setFont(doc, "bold", 11.4);
  doc.fillColor(colors.text).text(cleanText(row.question.stem), page.marginX, doc.y, {
    width: contentWidth(),
    lineGap: 3
  });
  doc.y += 11;

  row.question.options.forEach((option, optionIndex) => {
    const optionId = stableOptionId(option);
    const selected = row.question.type === "A"
      ? row.answer.selected === optionId
      : row.answer.kprim?.[optionId];
    const marker = row.question.type === "A"
      ? typeAReviewMarker(Boolean(selected), option.correct)
      : `Dein Entscheid: ${typeof selected === "boolean" ? decisionLabel(selected) : "offen"} · Lösung: ${decisionLabel(option.correct)}`;
    const tone = row.question.type === "A"
      ? option.correct
        ? "success"
        : selected
          ? "danger"
          : "neutral"
      : selected === option.correct
        ? "success"
        : "danger";

    drawReviewOption(doc, displayLabel(optionIndex), option.text, marker, tone);
  });

  const objective = assessment.learningObjectives.find(
    (item) => item.id === row.question.learningObjectiveId
  )?.text;
  if (row.question.explanation?.trim() || row.question.trap?.trim() || objective) {
    doc.y += 5;
    drawReviewExplanation(doc, row.question.explanation, row.question.trap, objective);
  }

  doc.y += 16;
  drawRule(doc, colors.line, 0.7);
  doc.y += 18;
}

function drawReviewOption(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  marker: string,
  tone: "success" | "danger" | "neutral"
): void {
  const x = page.marginX + 9;
  const width = contentWidth() - 18;
  const padding = 9;
  const labelW = 23;
  const markerW = 128;
  const gap = 7;
  const textX = x + padding + labelW + gap;
  const textW = width - padding * 2 - labelW - markerW - gap * 2;
  const markerX = x + width - padding - markerW;
  const body = cleanText(value);
  const note = cleanText(marker);

  setFont(doc, "regular", 9.4);
  const bodyHeight = doc.heightOfString(body, { width: textW, lineGap: 2 });
  setFont(doc, "bold", 7.7);
  const markerHeight = doc.heightOfString(note, { width: markerW, lineGap: 1 });
  const height = Math.max(34, Math.max(bodyHeight, markerHeight) + padding * 2);
  ensurePageSpace(doc, height + 4);

  const y = doc.y;
  const palette = tone === "success"
    ? { fill: colors.successSoft, stroke: colors.success, text: colors.success }
    : tone === "danger"
      ? { fill: colors.dangerSoft, stroke: colors.danger, text: colors.danger }
      : { fill: "#ffffff", stroke: colors.line, text: colors.muted };

  doc.save()
    .roundedRect(x, y, width, height, 7)
    .fillAndStroke(palette.fill, palette.stroke)
    .restore();

  setFont(doc, "bold", 9.5);
  doc.fillColor(colors.text).text(`${label}.`, x + padding, y + padding, {
    width: labelW,
    lineBreak: false
  });
  setFont(doc, "regular", 9.4);
  doc.fillColor(colors.text).text(body, textX, y + padding, {
    width: textW,
    lineGap: 2
  });
  setFont(doc, "bold", 7.7);
  doc.fillColor(palette.text).text(note, markerX, y + padding + 1, {
    width: markerW,
    align: "right",
    lineGap: 1
  });
  doc.y = y + height + 4;
}

function drawReviewExplanation(
  doc: PDFKit.PDFDocument,
  explanation?: string,
  trap?: string,
  objective?: string
): void {
  const entries = [
    explanation?.trim() ? ["Begründung", explanation] : null,
    trap?.trim() ? ["Typische Falle", trap] : null,
    objective?.trim() ? ["Lernziel", objective] : null
  ].filter(Boolean) as Array<[string, string]>;
  if (!entries.length) return;

  const text = entries.map(([label, value]) => `${label}: ${cleanText(value)}`).join("\n");
  setFont(doc, "regular", 8.9);
  const padding = 11;
  const height = doc.heightOfString(text, {
    width: contentWidth() - padding * 2,
    lineGap: 2
  }) + padding * 2;
  ensurePageSpace(doc, height);
  const y = doc.y;

  doc.save()
    .roundedRect(page.marginX, y, contentWidth(), height, 8)
    .fill(colors.soft)
    .restore();
  doc.fillColor(colors.muted).text(text, page.marginX + padding, y + padding, {
    width: contentWidth() - padding * 2,
    lineGap: 2
  });
  doc.y = y + height;
}

function drawReviewConclusion(
  doc: PDFKit.PDFDocument,
  analysis: ReturnType<typeof analyzeAssessmentResults>
): void {
  ensurePageSpace(doc, 150);
  doc.y += 2;
  setFont(doc, "bold", 17);
  doc.fillColor(colors.text).text("Lernfokus", page.marginX, doc.y, {
    width: contentWidth()
  });
  doc.y += 9;
  setFont(doc, "regular", 9.5);
  doc.fillColor(colors.muted).text(cleanText(analysis.summary), page.marginX, doc.y, {
    width: contentWidth(),
    lineGap: 2
  });
  doc.y += 16;

  analysis.weaknesses.slice(0, 5).forEach((weakness) => {
    const value = `${priorityLabel(weakness.priority)}: ${weakness.topic}\n${weakness.reason}\nEmpfehlung: ${weakness.recommendedAction}`;
    setFont(doc, "regular", 9);
    const height = doc.heightOfString(cleanText(value), {
      width: contentWidth() - 22,
      lineGap: 2
    }) + 18;
    ensurePageSpace(doc, height + 7);
    const y = doc.y;
    const color = weakness.priority === "high"
      ? colors.danger
      : weakness.priority === "medium"
        ? colors.warning
        : colors.accent;
    doc.save()
      .roundedRect(page.marginX, y, contentWidth(), height, 7)
      .fill(colors.soft)
      .restore();
    doc.save()
      .strokeColor(color)
      .lineWidth(3)
      .moveTo(page.marginX + 1.5, y + 7)
      .lineTo(page.marginX + 1.5, y + height - 7)
      .stroke()
      .restore();
    doc.fillColor(colors.text).text(cleanText(value), page.marginX + 12, y + 9, {
      width: contentWidth() - 22,
      lineGap: 2
    });
    doc.y = y + height + 7;
  });

  if (analysis.errorPatterns.length) {
    ensurePageSpace(doc, 72);
    doc.y += 5;
    setFont(doc, "bold", 11);
    doc.fillColor(colors.text).text("Wiederkehrende Fehlermuster", page.marginX, doc.y, {
      width: contentWidth()
    });
    doc.y += 8;
    analysis.errorPatterns.forEach((pattern) => {
      const questions = pattern.exampleQuestionNumbers.length
        ? ` (Fragen ${pattern.exampleQuestionNumbers.join(", ")})`
        : "";
      const value = `${pattern.pattern}${questions}\nStrategie: ${pattern.correctionStrategy}`;
      setFont(doc, "regular", 9.2);
      const height = doc.heightOfString(cleanText(value), {
        width: contentWidth() - 12,
        lineGap: 2
      }) + 8;
      ensurePageSpace(doc, height);
      doc.fillColor(colors.muted).text(cleanText(value), page.marginX + 12, doc.y, {
        width: contentWidth() - 12,
        lineGap: 2
      });
      doc.y += 8;
    });
  }

  if (analysis.nextStudySteps.length) {
    ensurePageSpace(doc, 60);
    doc.y += 5;
    setFont(doc, "bold", 11);
    doc.fillColor(colors.text).text("Nächste Lernschritte", page.marginX, doc.y, {
      width: contentWidth()
    });
    doc.y += 8;
    analysis.nextStudySteps.forEach((step, index) => {
      setFont(doc, "regular", 9.2);
      const value = `${index + 1}. ${cleanText(step)}`;
      const height = doc.heightOfString(value, { width: contentWidth() - 12, lineGap: 2 }) + 6;
      ensurePageSpace(doc, height);
      doc.fillColor(colors.muted).text(value, page.marginX + 12, doc.y, {
        width: contentWidth() - 12,
        lineGap: 2
      });
      doc.y += 6;
    });
  }
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
  const productLabel = kind === "review" ? "ATLAS Assessment Review" : "ATLAS Assessment";
  const metaLabel = truncateText(
    [productLabel, formatBlockLabel(assessment.block), assessment.lectureCode].filter(Boolean).join(" · "),
    68
  );
  const headerRight = truncateText(
    [
      assessment.lectureCode,
      kind === "solutions" ? "Lösungen" : kind === "review" ? "Review" : assessment.title
    ].filter(Boolean).join(" · "),
    62
  );

  for (let offset = 0; offset < totalPages; offset += 1) {
    const pageIndex = range.start + offset;
    doc.switchToPage(pageIndex);
    const oldPosition = { x: doc.x, y: doc.y };

    setFont(doc, "bold", 8.5);
    drawFixedText(doc, productLabel, page.marginX, page.headerTop, "left");

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

function estimateReviewQuestionHeight(doc: PDFKit.PDFDocument, row: QuizResultRow): number {
  let height = introHeight(doc, row.question) + 14;
  row.question.options.forEach((option) => {
    const optionId = stableOptionId(option);
    const selected = row.question.type === "A"
      ? row.answer.selected === optionId
      : row.answer.kprim?.[optionId];
    const marker = row.question.type === "A"
      ? typeAReviewMarker(Boolean(selected), option.correct)
      : `Dein Entscheid: ${typeof selected === "boolean" ? decisionLabel(selected) : "offen"} · Lösung: ${decisionLabel(option.correct)}`;
    height += reviewOptionHeight(doc, option.text, marker);
  });
  if (row.question.explanation?.trim()) {
    setFont(doc, "regular", 8.9);
    height += doc.heightOfString(cleanText(row.question.explanation), {
      width: contentWidth() - 22,
      lineGap: 2
    }) + 28;
  }
  return height + 42;
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

function reviewOptionHeight(doc: PDFKit.PDFDocument, value: string, marker: string): number {
  const width = contentWidth() - 18;
  const padding = 9;
  const labelW = 23;
  const markerW = 128;
  const gap = 7;
  const textW = width - padding * 2 - labelW - markerW - gap * 2;
  setFont(doc, "regular", 9.4);
  const bodyHeight = doc.heightOfString(cleanText(value), { width: textW, lineGap: 2 });
  setFont(doc, "bold", 7.7);
  const markerHeight = doc.heightOfString(cleanText(marker), { width: markerW, lineGap: 1 });
  return Math.max(34, Math.max(bodyHeight, markerHeight) + padding * 2) + 4;
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

function buildReviewRows(assessment: Assessment, attempt: QuizAttempt): QuizResultRow[] {
  const results = new Map(
    (attempt.questionResults || []).map((result) => [result.questionId, result])
  );

  return assessment.questions.map((question) => {
    const stored = results.get(question.id);
    const orderedQuestion = reorderQuestion(question, stored);
    const answer = sanitizeStoredAnswer(
      stored?.answer || attempt.answers?.[question.id] || {},
      orderedQuestion
    );
    const evaluation = evaluateQuestion(orderedQuestion, answer);
    return {
      question: orderedQuestion,
      answer,
      correct: evaluation.status === "correct",
      ...evaluation
    };
  });
}

function reorderQuestion(
  question: AssessmentQuestion,
  stored?: StoredQuestionResult
): AssessmentQuestion {
  if (!stored?.optionOrder?.length) return question;
  const options = new Map(question.options.map((option) => [stableOptionId(option), option]));
  const ordered = stored.optionOrder
    .map((id) => options.get(id))
    .filter(Boolean) as AssessmentQuestion["options"];
  const seen = new Set(ordered.map(stableOptionId));
  question.options.forEach((option) => {
    if (!seen.has(stableOptionId(option))) ordered.push(option);
  });
  return { ...question, options: ordered };
}

function sanitizeStoredAnswer(answer: UserAnswer, question: AssessmentQuestion): UserAnswer {
  const validIds = new Set(question.options.map(stableOptionId));
  if (question.type === "A") {
    return typeof answer.selected === "string" && validIds.has(answer.selected)
      ? { selected: answer.selected }
      : {};
  }

  const source = answer.kprim || {};
  return {
    kprim: question.options.reduce<Record<string, boolean>>((acc, option) => {
      const id = stableOptionId(option);
      if (typeof source[id] === "boolean") acc[id] = source[id];
      return acc;
    }, {})
  };
}

function stableOptionId(option: AssessmentQuestion["options"][number]): string {
  return option.originalId || option.id;
}

function typeAReviewMarker(selected: boolean, correct: boolean): string {
  if (selected && correct) return "Deine Antwort · richtig";
  if (selected) return "Deine Antwort · falsch";
  if (correct) return "Richtige Antwort";
  return "";
}

function decisionLabel(value: boolean): string {
  return value ? "richtig" : "falsch";
}

function reviewStatus(row: QuizResultRow): { label: string; color: string } {
  if (row.status === "correct") return { label: "Richtig", color: colors.success };
  if (row.status === "partial") return {
    label: `Teilrichtig · ${formatPoints(row.points)} Punkte`,
    color: colors.warning
  };
  return { label: "Falsch", color: colors.danger };
}

function priorityLabel(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "Hohe Priorität";
  if (priority === "medium") return "Mittlere Priorität";
  return "Niedrige Priorität";
}

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function safeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Zurich"
  }).format(date);
}
