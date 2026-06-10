import { blockIdForContent } from "./studyProgram";
import { blockQuestionDesignRule } from "./questionDesignRules";
import type {
  Assessment,
  AssessmentQuestion,
  BloomLevel,
  QuestionDifficulty,
  QuestionReviewStatus,
  StructuredQuestionExplanation
} from "./types";

export const QUESTION_QUALITY_FLAGS = [
  "all_true_kprim",
  "all_false_kprim",
  "redundant_statements",
  "trivial_negation",
  "length_imbalance",
  "weak_distractor",
  "dependent_statements",
  "too_recall_heavy",
  "name_recall",
  "missing_explanation",
  "missing_wrong_answer_explanations",
  "unclear_stem",
  "ambiguous_answer",
  "too_easy",
  "insufficient_transfer",
  "low_concept_depth",
  "duplicate_concept",
  "missing_learning_objective",
  "missing_block_mapping"
] as const;

export type QuestionQualityFlag = typeof QUESTION_QUALITY_FLAGS[number];

export type QuestionQualityAnalysis = {
  assessmentId: string;
  assessmentTitle: string;
  lectureCode: string;
  block: string;
  blockId: string | null;
  questionId: string;
  questionIndex: number;
  questionType: AssessmentQuestion["type"];
  stem: string;
  difficulty: QuestionDifficulty;
  bloomLevel: BloomLevel;
  reviewStatus: QuestionReviewStatus;
  concepts: string[];
  flags: QuestionQualityFlag[];
  activeFlags: QuestionQualityFlag[];
  kprimDistribution?: { correct: number; incorrect: number };
};

export type AssessmentQualityReport = {
  assessmentId: string;
  title: string;
  lectureCode: string;
  block: string;
  blockId: string | null;
  questions: QuestionQualityAnalysis[];
};

export function validateKPrimQuestion(question: AssessmentQuestion): QuestionQualityFlag[] {
  if (question.type !== "KPRIM") return [];
  const flags = new Set<QuestionQualityFlag>();
  const correctCount = question.options.filter((option) => option.correct).length;
  if (correctCount === 4) flags.add("all_true_kprim");
  if (correctCount === 0) flags.add("all_false_kprim");

  const normalized = question.options.map((option) => normalizeWords(option.text));
  for (let index = 0; index < normalized.length; index += 1) {
    for (let compare = index + 1; compare < normalized.length; compare += 1) {
      if (jaccardSimilarity(normalized[index], normalized[compare]) >= 0.72) {
        flags.add("redundant_statements");
      }
    }
  }

  const statements = question.options.map((option) => normalizeText(option.text));
  if (statements.some((statement) => /\b(nicht|nie|kein(?:e|en|er|es)?|ausschliesslich|immer)\b/.test(statement))
    && statements.some((statement, index) => statements.some((other, otherIndex) => (
      index !== otherIndex && stripNegation(statement) === stripNegation(other)
    )))) {
    flags.add("trivial_negation");
  }

  const lengths = question.options.map((option) => option.text.trim().length).filter(Boolean);
  if (lengths.length && Math.max(...lengths) > Math.max(38, Math.min(...lengths) * 2.8)) {
    flags.add("length_imbalance");
  }

  if (question.options.some((option) => isWeakStatement(option.text))) flags.add("weak_distractor");
  if (question.options.some((option) => /\b(diese|obige|vorherige|letztere|erstere) aussage\b/i.test(option.text))) {
    flags.add("dependent_statements");
  }
  return [...flags];
}

export function analyzeQuestionQuality(
  assessment: Assessment,
  question: AssessmentQuestion,
  questionIndex = 0,
  duplicateConcepts: Set<string> = new Set()
): QuestionQualityAnalysis {
  const blockId = blockIdForContent(assessment);
  const rule = blockQuestionDesignRule(blockId);
  const flags = new Set<QuestionQualityFlag>(validateKPrimQuestion(question));
  const combinedText = `${question.stem} ${question.options.map((option) => option.text).join(" ")}`;
  const normalizedStem = normalizeText(question.stem);
  const concepts = question.concepts?.filter(Boolean) || deriveConcepts(question);
  const bloomLevel = question.bloomLevel || inferBloomLevel(question, rule?.transferSignals || []);
  const difficulty = question.difficultyLevel || inferDifficulty(question, bloomLevel);
  const structured = getStructuredExplanation(question);

  if (!question.explanation.trim() && !structured?.correctReasoning && !structured?.coreIdea) {
    flags.add("missing_explanation");
  }
  if (!structured || missingWrongAnswerExplanations(question, structured)) {
    flags.add("missing_wrong_answer_explanations");
  }
  if (!question.learningObjectiveId) flags.add("missing_learning_objective");
  if (!blockId) flags.add("missing_block_mapping");
  if (question.stem.trim().length < 24 || /^(welche aussage|was ist richtig|zur .+:?)$/i.test(question.stem.trim())) {
    flags.add("unclear_stem");
  }
  if (question.type === "A" && question.options.filter((option) => option.correct).length !== 1) {
    flags.add("ambiguous_answer");
  }

  const recallSignal = bloomLevel === "recall"
    || isRecallStem(normalizedStem)
    || !!rule?.recallSignals.some((pattern) => pattern.test(question.stem));
  if (recallSignal) flags.add("too_recall_heavy");
  if ((blockId === "block5" || blockId === "block6") && isNameRecallQuestion(combinedText)) flags.add("name_recall");
  if (difficulty === "easy" || question.difficulty <= 1) flags.add("too_easy");
  if (["block5", "block6", "block7", "block8", "block9"].includes(blockId || "")
    && !["application", "mechanism", "transfer", "clinical_reasoning"].includes(bloomLevel)) {
    flags.add("insufficient_transfer");
  }
  if (!concepts.length || (question.stem.length < 55 && !containsReasoningSignal(combinedText))) {
    flags.add("low_concept_depth");
  }
  if (concepts.some((concept) => duplicateConcepts.has(normalizeText(concept)))) flags.add("duplicate_concept");

  const reviewed = new Set(question.reviewedQualityFlags || []);
  const allFlags = [...new Set([...(question.qualityFlags || []), ...flags])]
    .filter(isQuestionQualityFlag);

  return {
    assessmentId: assessment.id,
    assessmentTitle: assessment.title,
    lectureCode: assessment.lectureCode,
    block: assessment.block,
    blockId,
    questionId: question.id,
    questionIndex,
    questionType: question.type,
    stem: question.stem,
    difficulty,
    bloomLevel,
    reviewStatus: question.reviewStatus || (allFlags.length ? "needs_review" : "reviewed"),
    concepts,
    flags: allFlags,
    activeFlags: allFlags.filter((flag) => !reviewed.has(flag)),
    ...(question.type === "KPRIM"
      ? { kprimDistribution: {
          correct: question.options.filter((option) => option.correct).length,
          incorrect: question.options.filter((option) => !option.correct).length
        } }
      : {})
  };
}

export function analyzeAssessmentQuality(assessment: Assessment): AssessmentQualityReport {
  const conceptCounts = new Map<string, number>();
  assessment.questions.forEach((question) => {
    (question.concepts?.length ? question.concepts : deriveConcepts(question)).forEach((concept) => {
      const normalized = normalizeText(concept);
      conceptCounts.set(normalized, (conceptCounts.get(normalized) || 0) + 1);
    });
  });
  const duplicateConcepts = new Set(
    [...conceptCounts.entries()].filter(([, count]) => count >= Math.max(4, assessment.questions.length * 0.45)).map(([concept]) => concept)
  );
  return {
    assessmentId: assessment.id,
    title: assessment.title,
    lectureCode: assessment.lectureCode,
    block: assessment.block,
    blockId: blockIdForContent(assessment),
    questions: assessment.questions.map((question, index) => (
      analyzeQuestionQuality(assessment, question, index, duplicateConcepts)
    ))
  };
}

export function getStructuredExplanation(question: AssessmentQuestion): StructuredQuestionExplanation | null {
  if (question.structuredExplanation) return question.structuredExplanation;
  if (!question.explanation && !question.trap) return null;
  return {
    coreIdea: firstSentence(question.explanation),
    correctReasoning: question.explanation,
    wrongAnswerExplanations: {},
    ...(question.trap ? { commonTrap: question.trap } : {})
  };
}

export function difficultyLabel(value: QuestionDifficulty): string {
  if (value === "very_hard") return "Sehr schwierig";
  if (value === "hard") return "Schwierig";
  if (value === "medium") return "Mittel";
  return "Einfach";
}

export function bloomLabel(value: BloomLevel): string {
  const labels: Record<BloomLevel, string> = {
    recall: "Recall",
    understanding: "Verständnis",
    application: "Anwendung",
    mechanism: "Mechanismus",
    transfer: "Transfer",
    clinical_reasoning: "Klinisches Denken"
  };
  return labels[value];
}

export function qualityFlagLabel(flag: QuestionQualityFlag): string {
  const labels: Record<QuestionQualityFlag, string> = {
    all_true_kprim: "K-Prim: alle richtig",
    all_false_kprim: "K-Prim: alle falsch",
    redundant_statements: "Redundante Aussagen",
    trivial_negation: "Triviale Negation",
    length_imbalance: "Unausgewogene Antwortlängen",
    weak_distractor: "Schwacher Distraktor",
    dependent_statements: "Abhängige Aussagen",
    too_recall_heavy: "Zu Recall-lastig",
    name_recall: "Namensfrage",
    missing_explanation: "Erklärung fehlt",
    missing_wrong_answer_explanations: "Falschantworten nicht erklärt",
    unclear_stem: "Unklarer Fragenstamm",
    ambiguous_answer: "Mehrdeutige Lösung",
    too_easy: "Zu einfach",
    insufficient_transfer: "Zu wenig Transfer",
    low_concept_depth: "Geringe Konzepttiefe",
    duplicate_concept: "Konzept stark wiederholt",
    missing_learning_objective: "Lernziel fehlt",
    missing_block_mapping: "Block-Mapping fehlt"
  };
  return labels[flag];
}

function inferBloomLevel(question: AssessmentQuestion, transferSignals: readonly RegExp[]): BloomLevel {
  const text = `${question.stem} ${question.options.map((option) => option.text).join(" ")}`;
  if (/\b(patient|patientin|klinisch|symptom|diagnos|therap|behandlung)\b/i.test(text)) return "clinical_reasoning";
  if (/\b(mechanismus|warum|führt .* zu|signalweg|ursache|folge)\b/i.test(text)) return "mechanism";
  if (/\b(übertragen|neue situation|unter der annahme|verändert sich|konsequenz)\b/i.test(text)) return "transfer";
  if (transferSignals.some((pattern) => pattern.test(text))) return "application";
  if (isRecallStem(normalizeText(question.stem))) return "recall";
  return "understanding";
}

function inferDifficulty(question: AssessmentQuestion, bloom: BloomLevel): QuestionDifficulty {
  if (question.difficulty >= 5 || bloom === "clinical_reasoning") return "very_hard";
  if (question.difficulty >= 4 || bloom === "transfer" || bloom === "mechanism") return "hard";
  if (question.difficulty >= 2 || bloom === "application" || bloom === "understanding") return "medium";
  return "easy";
}

function deriveConcepts(question: AssessmentQuestion): string[] {
  return [...new Set([
    ...question.tags,
    question.learningObjectiveId
  ].map((item) => item.trim()).filter(Boolean))].slice(0, 8);
}

function missingWrongAnswerExplanations(
  question: AssessmentQuestion,
  explanation: StructuredQuestionExplanation
): boolean {
  const expected = question.options.filter((option) => question.type === "KPRIM" || !option.correct);
  return expected.some((option) => !(
    explanation.wrongAnswerExplanations[option.id]
    || explanation.wrongAnswerExplanations[option.originalId || ""]
    || explanation.wrongAnswerExplanations[option.displayId || ""]
  )?.trim());
}

function isRecallStem(stem: string): boolean {
  return /^(wer|was|welches?|welche|wie heisst|wie lautet|wo befindet|wann)\b/.test(stem)
    && !/\b(warum|folge|konsequenz|am ehesten|patient|fall|mechanismus|interpret)\b/.test(stem);
}

function isNameRecallQuestion(text: string): boolean {
  return /\bwer (?:war|entwickelte|prägte|sagte|beschrieb|formulierte)\b/i.test(text)
    || /\bwelche[rs]? (?:autor|forscher|philosoph|person)\b/i.test(text);
}

function containsReasoningSignal(text: string): boolean {
  return /\b(warum|mechanismus|folge|konsequenz|führt|verändert|patient|klinisch|vergleich|interpret|abwäg)\b/i.test(text);
}

function isWeakStatement(text: string): boolean {
  const normalized = normalizeText(text);
  return normalized.length < 10
    || /\b(immer|nie|ausschliesslich|vollständig|unter allen umständen|offensichtlich)\b/.test(normalized)
    || /^(keine der|alle genannten|nichts davon)/.test(normalized);
}

function normalizeWords(value: string): Set<string> {
  return new Set(normalizeText(value).split(/\s+/).filter((word) => word.length > 3));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  return [...a].filter((word) => b.has(word)).length / union.size;
}

function stripNegation(value: string): string {
  return value.replace(/\b(nicht|nie|kein(?:e|en|er|es)?)\b/g, "").replace(/\s+/g, " ").trim();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] || trimmed).slice(0, 220);
}

function isQuestionQualityFlag(value: string): value is QuestionQualityFlag {
  return (QUESTION_QUALITY_FLAGS as readonly string[]).includes(value);
}
