const assert = require("node:assert/strict");
const path = require("node:path");
const {
  assessmentMatchesLibraryBlock,
  compareAssessmentsByNumber,
  normalizeAssessmentSubject,
  parseAssessmentSortKey
} = require(path.resolve(process.argv[2]));
const {
  matchesStudyProfile,
  normalizeStudySettings,
  selectedBlockIds,
  studySettingsForContent
} = require(path.join(path.dirname(path.resolve(process.argv[2])), "studyProgram.js"));

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
// A saved year-two profile must not hide any available semester for an admin.
const savedStudySettings = normalizeStudySettings({
  studyYear: "year2",
  semester: "hs",
  examPreparation: { mode: "singleExam", selectedExams: ["eMC1"] },
  ariEnabled: true
});
const adminSettings = studySettingsForContent(savedStudySettings, true);
const studentSettings = studySettingsForContent(savedStudySettings, false);
const catalogBlocks = ["Block 1", "Block 4", "Block 5", "Block 9", "J2 Block 1", "J2 Block 3", "J2 Block 4", "J2 Block 6"];
const visibleBlocks = (settings) => catalogBlocks.filter((block) => matchesStudyProfile({ block }, settings));
assert.deepEqual(visibleBlocks(adminSettings), catalogBlocks);
assert.deepEqual(visibleBlocks(studentSettings), ["J2 Block 1", "J2 Block 3"]);
assert.equal(adminSettings.ariEnabled, true);
assert.deepEqual(selectedBlockIds(adminSettings), []);
assert.equal(savedStudySettings.studyYear, "year2");
assert.equal(savedStudySettings.semester, "hs");
assert.equal(matchesStudyProfile({ block: "Altfragen Block 5" }, adminSettings, { altfragen: true }), true);
assert.equal(matchesStudyProfile({ block: "Altfragen Block 5" }, adminSettings), false);
console.log("Assessment catalog tests passed, including admin access across all study years and unchanged student filters.");
