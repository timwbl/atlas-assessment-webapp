import { promises as fs } from "fs";
import path from "path";
import { validateAssessment } from "./assessmentValidator";
import type {
  Assessment,
  AssessmentSummary,
  LoadedAssessment,
  LoadedAssessmentSummary
} from "./types";

let assessmentFilesPromise: Promise<LoadedAssessment[]> | null = null;

export async function loadAssessmentFiles(): Promise<LoadedAssessment[]> {
  if (process.env.NODE_ENV === "production") {
    assessmentFilesPromise ||= readAssessmentFiles();
    return assessmentFilesPromise;
  }

  return readAssessmentFiles();
}

async function readAssessmentFiles(): Promise<LoadedAssessment[]> {
  const directory = path.join(process.cwd(), "public", "assessments");
  const loaded: LoadedAssessment[] = [];

  let files: string[] = [];
  try {
    files = (await fs.readdir(directory))
      .filter((file) => file.toLowerCase().endsWith(".json"))
      .sort((a, b) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" }));
  } catch {
    return [];
  }

  for (const file of files) {
    const fullPath = path.join(directory, file);

    try {
      const raw = JSON.parse(await fs.readFile(fullPath, "utf8")) as unknown;
      const result = validateAssessment(raw);

      if (result.ok) {
        loaded.push({
          file,
          assessment: result.value.active === false ? null : result.value,
          errors: result.value.active === false ? ["Assessment ist deaktiviert."] : [],
          warnings: result.warnings
        });
      } else {
        loaded.push({ file, assessment: null, errors: result.errors, warnings: [] });
      }
    } catch (error) {
      loaded.push({
        file,
        assessment: null,
        errors: [error instanceof Error ? error.message : "JSON konnte nicht gelesen werden."],
        warnings: []
      });
    }
  }

  return loaded;
}

export async function loadAssessmentSummaries(): Promise<LoadedAssessmentSummary[]> {
  const loaded = await loadAssessmentFiles();
  return loaded.map((item) => ({
    file: item.file,
    assessment: item.assessment ? summarizeAssessment(item.assessment) : null,
    errors: item.errors,
    warnings: item.warnings
  }));
}

export async function loadServerAssessmentById(id: string): Promise<Assessment | null> {
  const loaded = await loadAssessmentFiles();
  return loaded
    .map((item) => item.assessment)
    .filter(Boolean)
    .find((assessment) => assessment?.id === id) || null;
}

function summarizeAssessment(assessment: Assessment): AssessmentSummary {
  return {
    id: assessment.id,
    lectureCode: assessment.lectureCode,
    title: assessment.title,
    block: assessment.block,
    sourceSummary: assessment.sourceSummary,
    questionCount: assessment.questions.length,
    questionIds: assessment.questions.map((question) => question.id),
    tags: [...new Set(assessment.questions.flatMap((question) => question.tags))]
      .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })),
    active: assessment.active
  };
}
