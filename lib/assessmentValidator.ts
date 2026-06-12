import type {
  Assessment,
  AssessmentQuestion,
  BloomLevel,
  QuestionDifficulty,
  QuestionOption,
  QuestionReviewStatus,
  StructuredQuestionExplanation,
  ValidationResult
} from "./types";
import { validateKPrimQuestion } from "./questionQuality";
import { normalizeAssessmentSubject } from "./assessmentCatalog";

const reliabilityValues = new Set(["high", "medium", "low", "insufficient_source"]);
const questionTypes = new Set(["A", "KPRIM"]);
const difficultyLevels = new Set<QuestionDifficulty>(["easy", "medium", "hard", "very_hard"]);
const bloomLevels = new Set<BloomLevel>([
  "recall",
  "understanding",
  "application",
  "mechanism",
  "transfer",
  "clinical_reasoning"
]);
const reviewStatuses = new Set<QuestionReviewStatus>(["draft", "needs_review", "reviewed", "verified"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

function normalizeStructuredExplanation(value: unknown): StructuredQuestionExplanation | undefined {
  if (!isRecord(value)) return undefined;
  const wrongAnswerExplanations = isRecord(value.wrongAnswerExplanations)
    ? Object.fromEntries(Object.entries(value.wrongAnswerExplanations)
      .map(([key, explanation]) => [key, stringValue(explanation)])
      .filter(([, explanation]) => explanation))
    : {};
  const coreIdea = stringValue(value.coreIdea);
  const correctReasoning = stringValue(value.correctReasoning);
  const commonTrap = stringValue(value.commonTrap);
  const highYield = stringValue(value.highYield);
  if (!coreIdea && !correctReasoning && !Object.keys(wrongAnswerExplanations).length && !commonTrap && !highYield) {
    return undefined;
  }
  return {
    coreIdea,
    correctReasoning,
    wrongAnswerExplanations,
    ...(commonTrap ? { commonTrap } : {}),
    ...(highYield ? { highYield } : {})
  };
}

function validateOptions(question: AssessmentQuestion, path: string): string[] {
  const errors: string[] = [];

  if (!Array.isArray(question.options)) {
    return [`${path}: options fehlt.`];
  }

  if (question.type === "KPRIM" && question.options.length !== 4) {
    errors.push(`${path}: KPRIM braucht genau 4 Aussagen.`);
  }

  if (question.type === "A" && question.options.filter((option) => option.correct).length !== 1) {
    errors.push(`${path}: Typ A braucht genau eine korrekte Antwort.`);
  }

  if (!question.options.some((option) => option.correct)) {
    errors.push(`${path}: mindestens eine korrekte Antwort fehlt.`);
  }

  question.options.forEach((option, optionIndex) => {
    if (!option.id || !option.text) {
      errors.push(`${path}.options[${optionIndex}]: id und text sind Pflicht.`);
    }
    if (typeof option.correct !== "boolean") {
      errors.push(`${path}.options[${optionIndex}]: correct muss boolean sein.`);
    }
  });

  return errors;
}

function normalizeQuestion(raw: unknown, index: number): AssessmentQuestion | null {
  if (!isRecord(raw)) return null;

  const options = Array.isArray(raw.options)
    ? raw.options.map((option, optionIndex): QuestionOption => {
      const record = isRecord(option) ? option : {};
      return {
        id: stringValue(record.id) || String.fromCharCode(65 + optionIndex),
        text: stringValue(record.text),
        correct: Boolean(record.correct)
      };
    })
    : [];

  const rawType = stringValue(raw.type).toUpperCase();
  const difficultyLevel = stringValue(raw.difficultyLevel) as QuestionDifficulty;
  const bloomLevel = stringValue(raw.bloomLevel) as BloomLevel;
  const reviewStatus = stringValue(raw.reviewStatus) as QuestionReviewStatus;

  return {
    id: stringValue(raw.id) || `q${index + 1}`,
    type: questionTypes.has(rawType) ? rawType as AssessmentQuestion["type"] : "A",
    difficulty: Math.max(1, Math.min(5, Number(raw.difficulty) || 1)),
    learningObjectiveId: stringValue(raw.learningObjectiveId),
    stem: stringValue(raw.stem),
    options,
    explanation: stringValue(raw.explanation),
    trap: stringValue(raw.trap),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : [],
    sourceReliability: reliabilityValues.has(stringValue(raw.sourceReliability))
      ? stringValue(raw.sourceReliability) as AssessmentQuestion["sourceReliability"]
      : "medium",
    ...(difficultyLevels.has(difficultyLevel) ? { difficultyLevel } : {}),
    ...(bloomLevels.has(bloomLevel) ? { bloomLevel } : {}),
    ...(stringArray(raw.concepts) ? { concepts: stringArray(raw.concepts) } : {}),
    ...(stringValue(raw.questionGoal) ? { questionGoal: stringValue(raw.questionGoal) } : {}),
    ...(stringArray(raw.commonConfusions) ? { commonConfusions: stringArray(raw.commonConfusions) } : {}),
    ...(normalizeStructuredExplanation(raw.structuredExplanation || (isRecord(raw.explanation) ? raw.explanation : undefined))
      ? { structuredExplanation: normalizeStructuredExplanation(raw.structuredExplanation || raw.explanation) }
      : {}),
    ...(stringArray(raw.qualityFlags) ? { qualityFlags: stringArray(raw.qualityFlags) } : {}),
    ...(stringArray(raw.reviewedQualityFlags) ? { reviewedQualityFlags: stringArray(raw.reviewedQualityFlags) } : {}),
    ...(reviewStatuses.has(reviewStatus) ? { reviewStatus } : {}),
    ...(stringValue(raw.blockId) ? { blockId: stringValue(raw.blockId) } : {}),
    ...(stringValue(raw.lectureId) ? { lectureId: stringValue(raw.lectureId) } : {}),
    ...(stringArray(raw.learningObjectiveIds) ? { learningObjectiveIds: stringArray(raw.learningObjectiveIds) } : {}),
    ...(Number.isFinite(Number(raw.conceptualDepth))
      ? { conceptualDepth: Math.max(1, Math.min(5, Number(raw.conceptualDepth))) }
      : {}),
    ...(Number.isFinite(Number(raw.discriminationScore))
      ? { discriminationScore: Math.max(0, Math.min(1, Number(raw.discriminationScore))) }
      : {}),
    ...(typeof raw.isHighYield === "boolean" ? { isHighYield: raw.isHighYield } : {}),
    ...(stringValue(raw.sourceAssessmentId) ? { sourceAssessmentId: stringValue(raw.sourceAssessmentId) } : {}),
    ...(stringValue(raw.sourceQuestionId) ? { sourceQuestionId: stringValue(raw.sourceQuestionId) } : {})
  };
}

export function validateAssessment(raw: unknown): ValidationResult<Assessment> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ["JSON ist kein Assessment-Objekt."] };
  }

  const questions = Array.isArray(raw.questions)
    ? raw.questions.map(normalizeQuestion).filter(Boolean) as AssessmentQuestion[]
    : [];

  const assessment: Assessment = {
    id: stringValue(raw.id),
    lectureCode: stringValue(raw.lectureCode),
    title: stringValue(raw.title),
    block: stringValue(raw.block),
    subject: normalizeAssessmentSubject(
      raw.subject || raw.fach,
      {
        lectureCode: stringValue(raw.lectureCode),
        title: stringValue(raw.title),
        block: stringValue(raw.block),
        sourceSummary: stringValue(raw.sourceSummary),
        course: raw.course,
        lecture: raw.lecture,
        assessmentTitle: raw.assessment_title
      }
    ),
    sourceSummary: stringValue(raw.sourceSummary),
    learningObjectives: Array.isArray(raw.learningObjectives)
      ? raw.learningObjectives.map((objective, index) => {
        const record = isRecord(objective) ? objective : {};
        return {
          id: stringValue(record.id) || `lo${index + 1}`,
          text: stringValue(record.text)
        };
      }).filter((objective) => objective.text)
      : [],
    questions,
    active: raw.active !== false
  };

  ["id", "lectureCode", "title", "block"].forEach((field) => {
    if (!assessment[field as keyof Assessment]) {
      errors.push(`${field} fehlt.`);
    }
  });

  if (!questions.length) {
    errors.push("questions fehlt oder ist leer.");
  }

  questions.forEach((question, index) => {
    const path = `questions[${index}]`;
    if (!question.id) errors.push(`${path}: id fehlt.`);
    if (!question.stem) errors.push(`${path}: stem fehlt.`);
    if (!questionTypes.has(question.type)) errors.push(`${path}: type muss A oder KPRIM sein.`);
    errors.push(...validateOptions(question, path));
    if (!question.learningObjectiveId) warnings.push(`${path}: learningObjectiveId fehlt.`);
    validateKPrimQuestion(question).forEach((flag) => {
      if (flag === "all_true_kprim") warnings.push(`${path}: K-Prim enthält 4 richtige Aussagen und braucht Review.`);
      if (flag === "all_false_kprim") warnings.push(`${path}: K-Prim enthält 4 falsche Aussagen und braucht Review.`);
    });
  });

  const ids = new Set<string>();
  questions.forEach((question) => {
    if (ids.has(question.id)) {
      errors.push(`Doppelte Frage-ID: ${question.id}.`);
    }
    ids.add(question.id);
  });

  return errors.length ? { ok: false, errors } : { ok: true, value: assessment, warnings };
}

export function collectAssessmentTags(assessment: Assessment): string[] {
  return [...new Set(assessment.questions.flatMap((question) => question.tags))]
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
}
