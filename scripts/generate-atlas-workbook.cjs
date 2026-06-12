const fs = require("node:fs");
const path = require("node:path");
const PDFDocument = require("pdfkit");

const outputPath = process.argv[2] || path.join(process.cwd(), "ATLAS_Corporate_Arbeitsvorlage.pdf");
const logoPath = path.join(process.cwd(), "public", "icons", "atlas-192.png");

const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const COLORS = {
  ink: "#17191C",
  muted: "#6D737C",
  line: "#DFE3E8",
  paper: "#F7F8FA",
  white: "#FFFFFF",
  blue: "#087DFF",
  blueSoft: "#EAF3FF",
  green: "#26B96F",
  greenSoft: "#EAF8F0",
  amber: "#F39A28",
  red: "#E65050",
  graphite: "#272A2F"
};

const doc = new PDFDocument({
  size: "A4",
  margin: 0,
  bufferPages: true,
  info: {
    Title: "ATLAS Corporate Design Arbeitsvorlage",
    Author: "Tim Weibel",
    Subject: "ATLAS Arbeits- und Projektdokument",
    Keywords: "ATLAS, Corporate Design, Arbeitsvorlage, Projektplanung",
    Creator: "ATLAS"
  }
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
doc.pipe(fs.createWriteStream(outputPath));

function setFont(size, color = COLORS.ink, weight = "regular") {
  doc.font(weight === "bold" ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(color);
}

function roundedCard(x, y, width, height, options = {}) {
  doc.save();
  doc.roundedRect(x, y, width, height, options.radius ?? 14);
  doc.fillAndStroke(options.fill ?? COLORS.white, options.stroke ?? COLORS.line);
  doc.restore();
}

function line(x1, y1, x2, y2, color = COLORS.line, width = 1) {
  doc.save().strokeColor(color).lineWidth(width).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
}

function logo(x, y, size = 44) {
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, x, y, { width: size, height: size });
  } else {
    doc.save().roundedRect(x, y, size, size, size * 0.28).fill(COLORS.blue);
    setFont(size * 0.52, COLORS.white, "bold");
    doc.text("A", x, y + size * 0.18, { width: size, align: "center" });
    doc.restore();
  }
}

function brandHeader(section) {
  logo(PAGE.margin, 34, 34);
  setFont(14, COLORS.ink, "bold");
  doc.text("ATLAS", PAGE.margin + 44, 40);
  setFont(8.5, COLORS.muted, "bold");
  doc.text(section.toUpperCase(), PAGE.margin + 44, 57, { characterSpacing: 0.7 });
  line(PAGE.margin, 86, PAGE.width - PAGE.margin, 86);
}

function footer(pageNumber, totalPages) {
  line(PAGE.margin, PAGE.height - 45, PAGE.width - PAGE.margin, PAGE.height - 45);
  setFont(8.5, COLORS.muted);
  doc.text("ATLAS · Corporate Arbeitsvorlage · © Tim Weibel", PAGE.margin, PAGE.height - 32);
  doc.text(`${pageNumber} / ${totalPages}`, PAGE.width - PAGE.margin - 55, PAGE.height - 32, {
    width: 55,
    align: "right"
  });
}

function sectionTitle(eyebrow, title, subtitle, y = 116) {
  setFont(9, COLORS.blue, "bold");
  doc.text(eyebrow.toUpperCase(), PAGE.margin, y, { characterSpacing: 0.8 });
  setFont(27, COLORS.ink, "bold");
  doc.text(title, PAGE.margin, y + 18, { width: PAGE.width - PAGE.margin * 2, lineGap: 2 });
  if (subtitle) {
    setFont(11.5, COLORS.muted);
    doc.text(subtitle, PAGE.margin, y + 58, {
      width: PAGE.width - PAGE.margin * 2,
      lineGap: 4
    });
  }
}

function field(label, x, y, width, height = 50) {
  setFont(8.5, COLORS.muted, "bold");
  doc.text(label.toUpperCase(), x, y);
  roundedCard(x, y + 15, width, height, { radius: 10, fill: COLORS.white });
}

function checkbox(x, y, label) {
  doc.save().roundedRect(x, y, 14, 14, 3).strokeColor(COLORS.line).lineWidth(1).stroke().restore();
  setFont(10.5, COLORS.ink);
  doc.text(label, x + 23, y + 1, { width: 190 });
}

// Page 1: Cover
doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.paper);
doc.save().circle(PAGE.width - 46, 74, 178).fill(COLORS.blueSoft).restore();
doc.save().circle(PAGE.width - 6, 18, 88).fill(COLORS.blue).restore();

logo(PAGE.margin, 54, 56);
setFont(16, COLORS.ink, "bold");
doc.text("ATLAS", PAGE.margin + 72, 65);
setFont(9, COLORS.muted, "bold");
doc.text("STUDY OS", PAGE.margin + 72, 88, { characterSpacing: 1.1 });

setFont(10, COLORS.blue, "bold");
doc.text("CORPORATE WORKBOOK", PAGE.margin, 236, { characterSpacing: 1.1 });
setFont(39, COLORS.ink, "bold");
doc.text("ATLAS\nArbeitsdokument", PAGE.margin, 264, {
  width: 430,
  lineGap: 3
});
setFont(15, COLORS.muted);
doc.text("Eine ruhige Vorlage für Projekte, Entscheidungen,\nInhalte und nächste Schritte.", PAGE.margin, 372, {
  width: 420,
  lineGap: 7
});

roundedCard(PAGE.margin, 520, PAGE.width - PAGE.margin * 2, 150, {
  radius: 18,
  fill: COLORS.white,
  stroke: "#E3E8EF"
});
field("Projekt / Thema", PAGE.margin + 22, 544, 451, 40);
field("Verantwortlich", PAGE.margin + 22, 612, 215, 34);
field("Datum / Version", PAGE.margin + 258, 612, 215, 34);

setFont(9, COLORS.muted);
doc.text("Klar denken. Gezielt lernen. Verlässlich weiterarbeiten.", PAGE.margin, 748);

// Page 2: Corporate design reference
doc.addPage();
brandHeader("Corporate Design");
sectionTitle(
  "Designsystem",
  "Visuelle Leitplanken",
  "ATLAS wirkt ruhig, präzise und hochwertig. Inhalte stehen immer vor Dekoration."
);

setFont(13, COLORS.ink, "bold");
doc.text("Farbpalette", PAGE.margin, 215);
const swatches = [
  ["ATLAS Blue", COLORS.blue, "#087DFF"],
  ["Graphite", COLORS.graphite, "#272A2F"],
  ["Paper", COLORS.paper, "#F7F8FA"],
  ["Success", COLORS.green, "#26B96F"],
  ["Attention", COLORS.amber, "#F39A28"]
];
swatches.forEach(([name, color, hex], index) => {
  const x = PAGE.margin + (index % 3) * 166;
  const y = 245 + Math.floor(index / 3) * 88;
  roundedCard(x, y, 150, 68, { radius: 12, fill: COLORS.white });
  doc.save().roundedRect(x + 10, y + 10, 42, 48, 9).fill(color).restore();
  setFont(9.5, COLORS.ink, "bold");
  doc.text(name, x + 61, y + 18, { width: 80 });
  setFont(8.5, COLORS.muted);
  doc.text(hex, x + 61, y + 38, { width: 80 });
});

setFont(13, COLORS.ink, "bold");
doc.text("Gestaltungsprinzipien", PAGE.margin, 430);
const principles = [
  ["01", "Klarheit", "Eine Hauptaussage pro Fläche. Keine unnötige visuelle Konkurrenz."],
  ["02", "Lesbarkeit", "Grosszügige Abstände, starke Hierarchie und kurze, präzise Texte."],
  ["03", "Ruhe", "Neutrale Flächen, dezente Linien und Blau nur als gezielter Akzent."],
  ["04", "Funktion", "Jedes Element hilft bei Orientierung, Entscheidung oder Lernfortschritt."]
];
principles.forEach(([number, title, copy], index) => {
  const y = 463 + index * 64;
  setFont(10, COLORS.blue, "bold");
  doc.text(number, PAGE.margin, y);
  setFont(11.5, COLORS.ink, "bold");
  doc.text(title, PAGE.margin + 38, y);
  setFont(9.5, COLORS.muted);
  doc.text(copy, PAGE.margin + 132, y, { width: 365, lineGap: 2 });
  if (index < principles.length - 1) line(PAGE.margin + 38, y + 45, PAGE.width - PAGE.margin, y + 45);
});

// Page 3: Brief
doc.addPage();
brandHeader("Projektbriefing");
sectionTitle(
  "Arbeitsgrundlage",
  "Projekt in einem Satz",
  "Definiere zuerst das gewünschte Ergebnis. Details folgen erst danach."
);
field("Projektziel", PAGE.margin, 218, 499, 66);
field("Ausgangslage / Problem", PAGE.margin, 316, 499, 82);
field("Zielgruppe", PAGE.margin, 430, 240, 52);
field("Erfolgskriterium", PAGE.margin + 259, 430, 240, 52);

setFont(13, COLORS.ink, "bold");
doc.text("Rahmenbedingungen", PAGE.margin, 524);
roundedCard(PAGE.margin, 550, 499, 148, { radius: 14, fill: COLORS.white });
checkbox(PAGE.margin + 20, 575, "Bestehende Funktionen erhalten");
checkbox(PAGE.margin + 260, 575, "Mobile und Desktop prüfen");
checkbox(PAGE.margin + 20, 614, "Daten rückwärtskompatibel");
checkbox(PAGE.margin + 260, 614, "Fehlerfälle berücksichtigen");
checkbox(PAGE.margin + 20, 653, "ATLAS Designsystem einhalten");
checkbox(PAGE.margin + 260, 653, "Build und Tests erfolgreich");

// Page 4: Execution and decisions
doc.addPage();
brandHeader("Umsetzung");
sectionTitle(
  "Arbeitsplan",
  "Prioritäten und Entscheidungen",
  "Wenige klare Schritte sind wertvoller als eine lange unsortierte Aufgabenliste."
);

const columns = [
  { label: "JETZT", color: COLORS.blue, x: PAGE.margin },
  { label: "DANACH", color: COLORS.green, x: PAGE.margin + 171 },
  { label: "SPÄTER", color: COLORS.amber, x: PAGE.margin + 342 }
];
columns.forEach(({ label, color, x }) => {
  roundedCard(x, 224, 157, 218, { radius: 14, fill: COLORS.white });
  doc.save().roundedRect(x, 224, 157, 36, 14).fill(color).restore();
  setFont(9, COLORS.white, "bold");
  doc.text(label, x + 14, 237, { characterSpacing: 0.7 });
  for (let row = 0; row < 5; row += 1) {
    checkbox(x + 14, 278 + row * 31, "");
    line(x + 38, 292 + row * 31, x + 140, 292 + row * 31);
  }
});

setFont(13, COLORS.ink, "bold");
doc.text("Entscheidungslog", PAGE.margin, 486);
roundedCard(PAGE.margin, 512, 499, 202, { radius: 14, fill: COLORS.white });
const decisionColumns = [PAGE.margin + 16, PAGE.margin + 102, PAGE.margin + 325];
setFont(8.5, COLORS.muted, "bold");
doc.text("DATUM", decisionColumns[0], 530);
doc.text("ENTSCHEIDUNG", decisionColumns[1], 530);
doc.text("WARUM", decisionColumns[2], 530);
for (let row = 0; row < 4; row += 1) {
  const y = 556 + row * 39;
  line(PAGE.margin + 16, y + 23, PAGE.width - PAGE.margin - 16, y + 23);
  line(PAGE.margin + 86, y - 8, PAGE.margin + 86, y + 23);
  line(PAGE.margin + 309, y - 8, PAGE.margin + 309, y + 23);
}

// Page 5: Notes
doc.addPage();
brandHeader("Notizen");
sectionTitle(
  "Freie Arbeitsfläche",
  "Gedanken, Skizzen und offene Punkte",
  "Genügend Raum für das, was während der Arbeit erst sichtbar wird."
);

roundedCard(PAGE.margin, 218, 499, 515, { radius: 16, fill: COLORS.white });
for (let y = 258; y <= 700; y += 29) {
  line(PAGE.margin + 22, y, PAGE.width - PAGE.margin - 22, y, "#E8EBEF", 0.8);
}
doc.save().strokeColor(COLORS.blue).lineWidth(2).moveTo(PAGE.margin + 20, 240).lineTo(PAGE.margin + 20, 711).stroke().restore();

const pageRange = doc.bufferedPageRange();
for (let index = 0; index < pageRange.count; index += 1) {
  doc.switchToPage(pageRange.start + index);
  footer(index + 1, pageRange.count);
}

doc.end();

doc.on("end", () => {
  console.log(outputPath);
});
