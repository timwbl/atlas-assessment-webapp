import type { AssessmentSummary } from "./types";

export type StudyYear = "year1" | "year2" | "year3";
export type StudySemester = "hs" | "fs";
export type ExamId = "eMC1" | "eMC2" | "eMC3" | "eMC4";
export type ExamPreparationMode = "semester" | "singleExam";

export type UserStudySettings = {
  studyYear: StudyYear | null;
  semester: StudySemester | null;
  examPreparation: {
    mode: ExamPreparationMode;
    selectedExams: ExamId[];
  };
  ariEnabled: boolean;
};

type ExamConfig = {
  label: ExamId;
  blocks: readonly string[];
};

type SemesterConfig = {
  label: string;
  shortLabel: string;
  exams: Partial<Record<ExamId, ExamConfig>>;
  defaultExamGroup: readonly ExamId[];
};

export const STUDY_PROGRAM_CONFIG = {
  year1: {
    label: "1. Studienjahr",
    available: true,
    semesters: {
      hs: {
        label: "1. Semester",
        shortLabel: "HS · eMC1/eMC2",
        exams: {
          eMC1: { label: "eMC1", blocks: ["block1"] },
          eMC2: { label: "eMC2", blocks: ["block2", "block3", "block4"] }
        },
        defaultExamGroup: ["eMC1", "eMC2"]
      },
      fs: {
        label: "2. Semester",
        shortLabel: "FS · eMC3/eMC4",
        exams: {
          eMC3: { label: "eMC3", blocks: ["block5", "block7", "block8"] },
          eMC4: { label: "eMC4", blocks: ["block6", "block9"] }
        },
        defaultExamGroup: ["eMC3", "eMC4"]
      }
    }
  },
  year2: {
    label: "2. Studienjahr",
    available: false,
    semesters: {}
  },
  year3: {
    label: "3. Studienjahr",
    available: false,
    semesters: {}
  }
} as const;

export const STUDY_YEARS: Array<{ id: StudyYear; label: string; available: boolean }> = [
  { id: "year1", label: "1. Studienjahr", available: true },
  { id: "year2", label: "2. Studienjahr", available: false },
  { id: "year3", label: "3. Studienjahr", available: false }
];

export function defaultStudySettings(ariEnabled = false): UserStudySettings {
  return {
    studyYear: null,
    semester: null,
    examPreparation: {
      mode: "semester",
      selectedExams: []
    },
    ariEnabled
  };
}

export function semesterConfig(semester: StudySemester | null): SemesterConfig | null {
  if (!semester) return null;
  return STUDY_PROGRAM_CONFIG.year1.semesters[semester];
}

export function examsForSemester(semester: StudySemester | null): ExamId[] {
  return [...(semesterConfig(semester)?.defaultExamGroup || [])];
}

export function normalizeStudySettings(value: unknown, ariFallback = false): UserStudySettings {
  const record = isRecord(value) ? value : {};
  const studyYear = isStudyYear(record.studyYear) ? record.studyYear : null;
  const semester = record.semester === "hs" || record.semester === "fs" ? record.semester : null;
  const prep = isRecord(record.examPreparation) ? record.examPreparation : {};
  const validExams = examsForSemester(semester);
  const selected = Array.isArray(prep.selectedExams)
    ? prep.selectedExams.filter((item): item is ExamId => isExamId(item) && validExams.includes(item))
    : [];
  const mode: ExamPreparationMode = prep.mode === "singleExam" && selected.length === 1
    ? "singleExam"
    : "semester";

  return {
    studyYear,
    semester: studyYear === "year1" ? semester : null,
    examPreparation: {
      mode,
      selectedExams: semester
        ? mode === "singleExam" ? selected.slice(0, 1) : validExams
        : []
    },
    ariEnabled: typeof record.ariEnabled === "boolean" ? record.ariEnabled : ariFallback
  };
}

export function settingsForSemester(
  current: UserStudySettings,
  semester: StudySemester
): UserStudySettings {
  return {
    ...current,
    studyYear: "year1",
    semester,
    examPreparation: {
      mode: "semester",
      selectedExams: examsForSemester(semester)
    }
  };
}

export function selectedExamIds(settings: UserStudySettings): ExamId[] {
  if (settings.studyYear !== "year1" || !settings.semester) return [];
  if (settings.examPreparation.mode === "singleExam" && settings.examPreparation.selectedExams.length) {
    return settings.examPreparation.selectedExams.slice(0, 1);
  }
  return examsForSemester(settings.semester);
}

export function selectedBlockIds(settings: UserStudySettings): string[] {
  const config = semesterConfig(settings.semester);
  if (settings.studyYear !== "year1" || !config) return [];
  return selectedExamIds(settings).flatMap((exam) => config.exams[exam]?.blocks || []);
}

export function examForBlock(block: string): ExamId | null {
  const id = normalizedBlockId(block);
  if (!id) return null;
  for (const semester of [semesterConfig("hs"), semesterConfig("fs")]) {
    if (!semester) continue;
    for (const exam of semester.defaultExamGroup) {
      if (semester.exams[exam]?.blocks.includes(id)) return exam;
    }
  }
  return null;
}

export function blockIdForContent(
  value: { block?: string; title?: string; lectureCode?: string } | string
): string | null {
  if (typeof value === "string") return normalizedBlockId(value);
  return normalizedBlockId(value.block || "")
    || normalizedBlockId(value.title || "")
    || normalizedBlockId(value.lectureCode || "");
}

export function examForContent(
  value: { block?: string; title?: string; lectureCode?: string } | string
): ExamId | null {
  const blockId = blockIdForContent(value);
  return blockId ? examForBlock(blockId) : null;
}

export function normalizedBlockId(value: string): string | null {
  const match = normalizeText(value).match(/\bblock\s*([1-9])\b/) || normalizeText(value).match(/\b([1-9])\b/);
  return match ? `block${match[1]}` : null;
}

export function studySemesterForLegacyId(value: string): StudySemester | null {
  if (value === "HS2025") return "hs";
  if (value === "FS2026") return "fs";
  return null;
}

export function legacySemesterId(value: StudySemester | null): "HS2025" | "FS2026" | null {
  if (value === "hs") return "HS2025";
  if (value === "fs") return "FS2026";
  return null;
}

export function matchesStudyProfile(
  assessment: Pick<AssessmentSummary, "block" | "title" | "lectureCode">,
  settings: UserStudySettings,
  options: { altfragen?: boolean } = {}
): boolean {
  if (isThreeDContent(assessment)) return false;
  const altfragen = isAltfragenValue(assessment.block);
  if (options.altfragen ? !altfragen : altfragen) return false;
  if (settings.studyYear !== "year1" || !settings.semester) return true;

  const blockId = blockIdForContent(assessment);
  if (!blockId) {
    return settings.semester === "fs" && isExamSimulation(assessment.block);
  }
  return selectedBlockIds(settings).includes(blockId);
}

export function isAltfragenValue(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized.includes("altfragen")
    || normalized.includes("altfrage")
    || normalized.includes("alte fragen");
}

export function isThreeDContent(value: { block?: string; title?: string; lectureCode?: string } | string): boolean {
  const source = typeof value === "string"
    ? value
    : [value.block, value.title, value.lectureCode].filter(Boolean).join(" ");
  const normalized = normalizeText(source);
  return normalized.includes("3d-mc")
    || normalized.includes("3d mc")
    || normalized.includes("3d anatomie")
    || normalized.includes("three_d");
}

export function semesterPeriod(now = new Date()): { id: string; semester: StudySemester } | null {
  const time = now.getTime();
  const year = now.getFullYear();
  if (!Number.isFinite(time) || year < 2024 || year > 2100) return null;
  const month = now.getMonth();
  const day = now.getDate();
  const semester: StudySemester = month >= 8 || (month === 0 && day <= 30) ? "hs" : "fs";
  const academicYear = semester === "hs" && month === 0 ? year - 1 : year;
  return { id: `${academicYear}-${semester}`, semester };
}

export function semesterHeading(settings: UserStudySettings): string {
  if (settings.studyYear !== "year1") {
    return settings.studyYear
      ? `${STUDY_PROGRAM_CONFIG[settings.studyYear].label} · Inhalte folgen`
      : "Alle Inhalte";
  }
  const config = semesterConfig(settings.semester);
  return config ? `1. Studienjahr · ${config.label}` : "1. Studienjahr";
}

function isStudyYear(value: unknown): value is StudyYear {
  return value === "year1" || value === "year2" || value === "year3";
}

function isExamId(value: unknown): value is ExamId {
  return value === "eMC1" || value === "eMC2" || value === "eMC3" || value === "eMC4";
}

function isExamSimulation(value: string): boolean {
  return normalizeText(value).includes("prufungssimulation");
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
