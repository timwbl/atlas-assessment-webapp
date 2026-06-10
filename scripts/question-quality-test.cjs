const assert = require("node:assert/strict");
const path = require("node:path");

const compiledDirectory = process.argv[2];
if (!compiledDirectory) throw new Error("Compiled quality module directory is required.");
const {
  analyzeQuestionQuality,
  validateKPrimQuestion
} = require(path.resolve(compiledDirectory, "questionQuality.js"));

const fullExplanation = {
  coreIdea: "Die zentrale Aussage.",
  correctReasoning: "Die richtige Antwort folgt aus dem beschriebenen Mechanismus.",
  wrongAnswerExplanations: {
    A: "A ist hier mechanistisch falsch.",
    B: "B verwechselt Ursache und Folge.",
    C: "C gilt nur unter einer anderen Voraussetzung.",
    D: "D ist richtig, weil der Mechanismus direkt greift.",
    E: "E beschreibt einen parallelen Prozess."
  },
  commonTrap: "Ursache und Korrelation nicht verwechseln.",
  highYield: "Mechanismus vor Einzelbegriff prüfen."
};

const kprim22 = question("KPRIM", [true, true, false, false]);
assert(!validateKPrimQuestion(kprim22).includes("all_true_kprim"));
assert(!validateKPrimQuestion(kprim22).includes("all_false_kprim"));

const kprim40 = question("KPRIM", [true, true, true, true]);
assert(validateKPrimQuestion(kprim40).includes("all_true_kprim"));

const kprim04 = question("KPRIM", [false, false, false, false]);
assert(validateKPrimQuestion(kprim04).includes("all_false_kprim"));

const missingExplanation = question("A", [true, false, false, false, false], {
  explanation: "",
  structuredExplanation: undefined
});
assert(analyzeQuestionQuality(assessment("Block 8"), missingExplanation).flags.includes("missing_explanation"));

const block5Name = question("A", [true, false, false, false, false], {
  stem: "Wer entwickelte das biopsychosoziale Modell?"
});
assert(analyzeQuestionQuality(assessment("Block 5"), block5Name).flags.includes("name_recall"));

const block6Recall = question("A", [true, false, false, false, false], {
  stem: "Welche Definition beschreibt Confounding?"
});
assert(analyzeQuestionQuality(assessment("Block 6"), block6Recall).flags.includes("too_recall_heavy"));

const block8Mechanism = question("A", [false, false, false, true, false], {
  stem: "Warum führt ein intrazellulärer Calciumanstieg trotz ausreichendem ATP nicht zwingend zu einer Kontraktion glatter Muskulatur?",
  difficulty: 4,
  concepts: ["Calcium-Sensitivierung", "MLCK", "MLCP"],
  bloomLevel: "mechanism",
  difficultyLevel: "hard"
});
const block8Analysis = analyzeQuestionQuality(assessment("Block 8"), block8Mechanism);
assert.equal(block8Analysis.bloomLevel, "mechanism");
assert.equal(block8Analysis.difficulty, "hard");
assert(!block8Analysis.flags.includes("insufficient_transfer"));

const transfer = question("A", [false, true, false, false, false], {
  stem: "Eine Patientin zeigt trotz intakter Calciumfreisetzung eine reduzierte Kraftentwicklung. Welche mechanistische Konsequenz erklärt den Befund am besten?",
  difficulty: 5,
  bloomLevel: "clinical_reasoning",
  difficultyLevel: "very_hard",
  concepts: ["Kraftentwicklung", "Calcium", "Querbrücken"]
});
const transferAnalysis = analyzeQuestionQuality(assessment("Block 8"), transfer);
assert.equal(transferAnalysis.difficulty, "very_hard");
assert.equal(transferAnalysis.bloomLevel, "clinical_reasoning");

console.log("Question quality tests passed: 2/2, 4/0, 0/4, explanations, recall, mechanism and transfer.");

function assessment(block) {
  return {
    id: `test-${block}`,
    lectureCode: "TEST",
    title: "Quality Test",
    block,
    sourceSummary: "",
    learningObjectives: [{ id: "lo1", text: "Mechanismen anwenden" }],
    questions: []
  };
}

function question(type, correct, overrides = {}) {
  const ids = type === "KPRIM" ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"];
  return {
    id: "q1",
    type,
    difficulty: 3,
    learningObjectiveId: "lo1",
    stem: "Welche Folge ergibt sich aus dem beschriebenen Mechanismus am ehesten?",
    options: ids.map((id, index) => ({
      id,
      text: `Aussage ${id} beschreibt einen eigenständigen, ausreichend differenzierten Mechanismus ${index + 1}.`,
      correct: correct[index]
    })),
    explanation: "Die richtige Einordnung folgt aus dem zugrunde liegenden Mechanismus.",
    trap: "Ähnliche Begriffe nicht gleichsetzen.",
    tags: ["Mechanismus", "Transfer"],
    concepts: ["Mechanismus", "Transfer"],
    structuredExplanation: fullExplanation,
    sourceReliability: "high",
    ...overrides
  };
}
