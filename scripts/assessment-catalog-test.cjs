const assert = require("node:assert/strict");
const path = require("node:path");
const {
  assessmentMatchesLibraryBlock,
  compareAssessmentsByNumber,
  normalizeAssessmentSubject,
  parseAssessmentSortKey
} = require(path.resolve(process.argv[2]));

function assessment(lectureCode, title = lectureCode) {
  return {
    id: `assessment-${lectureCode || title}`,
    lectureCode,
    title,
    block: "Block 8",
    sourceSummary: ""
  };
}

const sorted = [
  assessment("KV11"),
  assessment("KV02"),
  assessment("", "Ohne Nummer"),
  assessment("KV10"),
  assessment("KV01"),
  assessment("KV09")
].sort(compareAssessmentsByNumber);

assert.deepEqual(
  sorted.map((item) => item.lectureCode || item.title),
  ["KV01", "KV02", "KV09", "KV10", "KV11", "Ohne Nummer"]
);

assert.deepEqual(parseAssessmentSortKey(assessment("KVP18/19")), {
  group: "KVP",
  number: 18,
  title: "KVP18/19",
  recognized: true
});
assert.equal(parseAssessmentSortKey(assessment("SV01")).number, 1);
assert.equal(parseAssessmentSortKey(assessment("FP01")).group, "FP");
assert.equal(parseAssessmentSortKey(assessment("", "Nicht nummeriert")).recognized, false);

assert.equal(
  normalizeAssessmentSubject("Histologie", { lectureCode: "KV01", block: "Block 8" }),
  "Histologie"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "KVB33", title: "ANS", block: "Block 8" }),
  "Biochemie"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "KVBS03", title: "Normalverteilung", block: "Block 2" }),
  "Public Health / Epidemiologie"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "KVC20", title: "Komplexverbindungen", block: "Block 8" }),
  "Chemie"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "KVP18", title: "Bewegungsapparat", block: "Block 8" }),
  "Physik"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "KV02", title: "Embryologie", block: "Block 9" }),
  "Embryologie"
);
assert.equal(
  normalizeAssessmentSubject("Anatomie", { lectureCode: "KV02", title: "Embryologie", block: "Block 9" }),
  "Embryologie"
);
assert.equal(
  normalizeAssessmentSubject(undefined, {
    lectureCode: "KV01/02",
    title: "Zelluläre Prozesse der Muskelfunktion: Skelettmuskel",
    sourceSummary: "Mikroanatomie und Erregungs-Kontraktions-Kopplung",
    block: "Block 8"
  }),
  "Physiologie"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "X1", title: "Unbekannter Inhalt", block: "Block 9" }),
  "Sonstiges"
);

// Distinguish year-one blocks from equally numbered year-two blocks.
for (let n = 1; n <= 4; n += 1) {
  const first = { title: `Block ${n}` };
  const second = { title: `Block ${n}`, canonicalBlockId: `j2-block${n}` };
  assert.equal(assessmentMatchesLibraryBlock({ block: `Block ${n}` }, first), true);
  assert.equal(assessmentMatchesLibraryBlock({ block: `J2 Block ${n}` }, first), false);
  assert.equal(assessmentMatchesLibraryBlock({ block: `Block ${n}` }, second), false);
  assert.equal(assessmentMatchesLibraryBlock({ block: `J2 Block ${n}` }, second), true);
}
assert.equal(assessmentMatchesLibraryBlock({ block: "J2 Block 1" }, { title: "Block 2" }), false);
assert.equal(assessmentMatchesLibraryBlock({ block: "Block 3" }, { title: "Block 2" }), false);
assert.equal(assessmentMatchesLibraryBlock({ block: "Prüfungssimulationen MC1" }, { title: "Prüfungssimulationen", matchTerms: ["prüfungssimulationen"] }), true);
assert.equal(assessmentMatchesLibraryBlock({ block: "Alte Fragen MC2" }, { title: "Altfragen", matchTerms: ["alte fragen"] }), true);
assert.equal(assessmentMatchesLibraryBlock({ block: "Altfragen", title: "Altfragen Block 1" }, { title: "Block 1" }), false);
assert.equal(assessmentMatchesLibraryBlock({ block: "Altfragen", title: "Altfragen Block 1" }, { title: "Altfragen" }), true);
console.log("Assessment catalog tests passed, including study-year and altfragen isolation.");
