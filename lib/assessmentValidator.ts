import type {
  Assessment,
  AssessmentQuestion,
  QuestionOption,
  ValidationResult
} from "./types";

const reliabilityValues = new Set(["high", "medium", "low", "insufficient_source"]);
const questionTypes = new Set(["A", "KPRIM"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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
      : "medium"
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
