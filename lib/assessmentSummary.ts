import { normalizeAssessmentSubject } from "./assessmentCatalog";
import { validateAssessment } from "./assessmentValidator";
import type { Assessment, AssessmentSummary, LoadedAssessmentSummary } from "./types";

export function summarizeAssessment(assessment: Assessment): AssessmentSummary {
  return {
    id: assessment.id,
    lectureCode: assessment.lectureCode,
    title: assessment.title,
    block: assessment.block,
    subject: assessment.subject,
    sourceSummary: assessment.sourceSummary,
    questionCount: assessment.questions.length,
    questionIds: assessment.questions.map((question) => question.id),
    tags: [...new Set(assessment.questions.flatMap((question) => question.tags))]
      .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })),
    active: assessment.active
  };
}

// Older CDN/browser caches can contain full assessments under the summary key.
// Normalize both shapes before consumers count questions or spread summary tags.
export function normalizeLoadedAssessmentSummaries(value: unknown): LoadedAssessmentSummary[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {};
    const file = text(record.file) || `assessment-${index + 1}.json`;
    const raw = "assessment" in record ? record.assessment : item;
    const warnings = stringList(record.warnings);
    const unavailable = (errors: string[]): LoadedAssessmentSummary => ({
      file, assessment: null, errors, warnings
    });

    if (raw === null) return unavailable(stringList(record.errors));
    if (!isRecord(raw)) return unavailable(["Assessment-Übersicht ist ungültig."]);

    if (Array.isArray(raw.questions)) {
      const result = validateAssessment(raw);
      if (!result.ok) return unavailable(result.errors);
      if (result.value.active === false) return unavailable(["Assessment ist deaktiviert."]);
      return {
        file,
        assessment: summarizeAssessment(result.value),
        errors: [],
        warnings: [...warnings, ...result.warnings]
      };
    }

    const id = text(raw.id);
    const lectureCode = text(raw.lectureCode);
    const title = text(raw.title);
    const block = text(raw.block);
    const questionIds = stringList(raw.questionIds);
    const questionCount = typeof raw.questionCount === "number"
      ? raw.questionCount
      : questionIds.length || NaN;
    if (!id || !lectureCode || !title || !block
      || !Number.isInteger(questionCount) || questionCount < 1) {
      return unavailable(["Assessment-Übersicht ist unvollständig."]);
    }
    if (raw.active === false) return unavailable(["Assessment ist deaktiviert."]);

    const sourceSummary = text(raw.sourceSummary);
    return {
      file,
      assessment: {
        id,
        lectureCode,
        title,
        block,
        subject: normalizeAssessmentSubject(raw.subject, { lectureCode, title, block, sourceSummary }),
        sourceSummary,
        questionCount,
        questionIds,
        tags: stringList(raw.tags),
        active: true
      },
      errors: [],
      warnings
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}
