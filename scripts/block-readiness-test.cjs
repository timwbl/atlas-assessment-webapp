const assert = require("node:assert/strict");
const path = require("node:path");

const buildDir = process.argv[2] || ".readiness-test";
const readiness = require(path.resolve(buildDir, "blockReadiness.js"));

function question(id, objective, type = "A", difficulty = 3, stem = `Mechanismus ${id}`) {
  const optionCount = type === "KPRIM" ? 4 : 5;
  return {
    id,
    type,
    difficulty,
    learningObjectiveId: objective,
    stem,
    options: Array.from({ length: optionCount }, (_, index) => ({
      id: String.fromCharCode(65 + index),
      text: `Option ${index + 1} zu ${id}`,
      correct: type === "A" ? index === 0 : index % 2 === 0
    })),
    explanation: "Erklärung",
    trap: "",
    tags: [objective],
    sourceReliability: "high",
    conceptualDepth: 4,
    discriminationScore: 0.75
  };
}

function assessment(id, block, count, kprimEvery = 4) {
  return {
    id,
    lectureCode: id.toUpperCase(),
    title: `Assessment ${id}`,
    block,
    sourceSummary: "",
    learningObjectives: Array.from({ length: 6 }, (_, index) => ({
      id: `lo${index + 1}`,
      text: `Lernziel ${index + 1}`
    })),
    questions: Array.from({ length: count }, (_, index) => question(
      `q${index + 1}`,
      `lo${index % 6 + 1}`,
      index % kprimEvery === 0 ? "KPRIM" : "A",
      index % 5 + 1,
      `Welche Konsequenz hat Mechanismus ${index + 1} im klinischen Fall ${id}?`
    ))
  };
}

function resultRow(candidate, correct) {
  const question = readiness.toFastQuizQuestion(candidate);
  return {
    question,
    answer: {},
    correct,
    status: correct ? "correct" : "incorrect",
    points: correct ? 1 : 0,
    maxPoints: 1
  };
}

const utility = {
  learningObjectiveWeight: 0.8,
  weaknessWeight: 0.6,
  discriminationWeight: 0.7,
  forgettingRisk: 0.5,
  conceptualDepth: 0.9,
  novelty: 1
};
assert.equal(
  readiness.calculateUtilityScore({ utility, qualityPenalty: 0 }, "pulse"),
  0.705,
  "utilityScore muss die dokumentierten Gewichte verwenden"
);

const assessments = [
  assessment("kv-a", "Block 8", 36, 4),
  assessment("kv-b", "Block 8", 36, 5)
];
const progress = {
  "kv-a": {
    assessmentId: "kv-a",
    attempts: [],
    questionStats: {
      q2: {
        seen: 3,
        correct: 0,
        wrong: 3,
        lastCorrect: false,
        markedForReview: true,
        priority: "high",
        lastAnsweredAt: "2026-01-01T00:00:00.000Z"
      }
    },
    bestScore: 0,
    lastScore: null,
    errorTags: {}
  }
};
const candidates = readiness.buildBlockQuestionCandidates(
  assessments,
  progress,
  "block8",
  new Date("2026-06-01T00:00:00.000Z").getTime()
);

for (const [mode, expected] of [["pulse", 15], ["weakness", 20], ["readiness", 35]]) {
  const selection = readiness.selectFastQuizQuestions(candidates, mode);
  assert.equal(selection.questions.length, expected, `${mode} muss die Zielgrösse liefern`);
  assert.equal(new Set(selection.questions.map((item) => item.id)).size, expected, `${mode} darf keine IDs doppeln`);
  assert.ok(selection.objectiveCount >= 5, `${mode} muss Lernziele breit abdecken`);
  assert.ok(selection.typeCounts.KPRIM > 0, `${mode} soll K-Prim einmischen, wenn verfügbar`);
}

const weaknessSelection = readiness.selectFastQuizQuestions(candidates, "weakness");
assert.ok(
  weaknessSelection.candidates.some((candidate) => candidate.assessmentId === "kv-a" && candidate.sourceQuestionId === "q2"),
  "Weakness Hunter muss eine stark schwache Frage priorisieren"
);

const badKprim = {
  ...candidates.find((candidate) => candidate.question.type === "KPRIM"),
  sessionQuestionId: "bad::all-true",
  sourceQuestionId: "all-true",
  qualityPenalty: 0.28,
  utility: {
    learningObjectiveWeight: 1,
    weaknessWeight: 1,
    discriminationWeight: 1,
    forgettingRisk: 1,
    conceptualDepth: 1,
    novelty: 1
  }
};
const qualitySelection = readiness.selectFastQuizQuestions([badKprim, ...candidates], "readiness", 20);
assert.ok(
  !qualitySelection.candidates.some((candidate) => candidate.sessionQuestionId === badKprim.sessionQuestionId),
  "Problematische 4/0-K-Prim dürfen bei genügend guten Fragen nicht für die Quote erzwungen werden"
);

const few = readiness.selectFastQuizQuestions(candidates.slice(0, 7), "readiness");
assert.equal(few.questions.length, 7, "Bei wenig Daten müssen alle gültigen Fragen als Fallback verwendet werden");

const selected = readiness.selectFastQuizQuestions(candidates, "readiness", 12);
const rows = selected.candidates.map((candidate, index) => resultRow(candidate, index < 9));
const withoutNormal = readiness.calculateBlockReadiness({
  blockId: "block8",
  mode: "readiness",
  quizResultId: "result-1",
  rows,
  candidates: selected.candidates,
  allBlockCandidates: candidates,
  assessmentProgress: {}
});
assert.equal(withoutNormal.assessmentPerformance, null);
assert.ok(withoutNormal.readinessScore >= 0 && withoutNormal.readinessScore <= 100);

const withNormalProgress = {
  "kv-a": {
    ...progress["kv-a"],
    attempts: [{
      id: "normal-1",
      assessmentId: "kv-a",
      mode: "exam",
      score: 82,
      correct: 8,
      total: 10,
      startedAt: "2026-05-01T00:00:00.000Z",
      completedAt: "2026-05-01T00:10:00.000Z",
      answers: {},
      wrongQuestionIds: []
    }],
    lastScore: 82
  }
};
const withNormal = readiness.calculateBlockReadiness({
  blockId: "block8",
  mode: "readiness",
  quizResultId: "result-2",
  rows,
  candidates: selected.candidates,
  allBlockCandidates: candidates,
  assessmentProgress: withNormalProgress
});
assert.equal(withNormal.assessmentPerformance, 82);

assert.equal(readiness.classifyReadiness(85), "ready");
assert.equal(readiness.classifyReadiness(70), "almost_ready");
assert.equal(readiness.classifyReadiness(55), "risk_zone");
assert.equal(readiness.classifyReadiness(54), "not_ready");

console.log("Block Readiness tests passed.");
