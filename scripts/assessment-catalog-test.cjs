const assert = require("node:assert/strict");
const path = require("node:path");
const {
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
  normalizeAssessmentSubject(undefined, { lectureCode: "KVC20", title: "Komplexverbindungen", block: "Block 8" }),
  "Chemie"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "KVP18", title: "Bewegungsapparat", block: "Block 8" }),
  "Physik"
);
assert.equal(
  normalizeAssessmentSubject(undefined, { lectureCode: "KV02", title: "Embryologie", block: "Block 9" }),
  "Anatomie"
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

console.log("Assessment catalog tests passed.");
