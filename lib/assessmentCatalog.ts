import type { Assessment, AssessmentSubject, AssessmentSummary } from "./types";

export const ASSESSMENT_SUBJECTS: readonly AssessmentSubject[] = [
  "Anatomie",
  "Histologie",
  "Physiologie",
  "Biochemie",
  "Chemie",
  "Physik",
  "Public Health / Epidemiologie",
  "Psychosoziale Medizin",
  "Medical Humanities",
  "Sonstiges"
];

type AssessmentCatalogItem = Pick<
  Assessment | AssessmentSummary,
  "id" | "lectureCode" | "title" | "block" | "sourceSummary" | "subject"
>;

export type AssessmentSortKey = {
  group: string;
  number: number;
  title: string;
  recognized: boolean;
};

const CODE_GROUP_ORDER = ["KV", "KVB", "KVC", "KVP", "SV", "FP"];
const SUBJECT_ALIASES: Array<[AssessmentSubject, string[]]> = [
  ["Anatomie", ["anatomie", "anatomy"]],
  ["Histologie", ["histologie", "histology"]],
  ["Physiologie", ["physiologie", "physiology"]],
  ["Biochemie", ["biochemie", "biochemistry"]],
  ["Chemie", ["chemie", "chemistry"]],
  ["Physik", ["physik", "physics"]],
  ["Public Health / Epidemiologie", ["public health", "epidemiologie", "epidemiology"]],
  ["Psychosoziale Medizin", ["psychosoziale medizin", "psychosomatik", "psychologie"]],
  ["Medical Humanities", ["medical humanities", "medizinische humanwissenschaften", "humanities"]],
  ["Sonstiges", ["sonstiges", "other"]]
];

export function normalizeAssessmentSubject(
  rawSubject: unknown,
  assessment: {
    lectureCode?: string;
    title?: string;
    block?: string;
    sourceSummary?: string;
    course?: unknown;
    lecture?: unknown;
    assessmentTitle?: unknown;
  }
): AssessmentSubject {
  const explicit = canonicalSubject(rawSubject);
  if (explicit) return explicit;

  const code = normalizeText(assessment.lectureCode || "");
  if (/^kvb/.test(code)) return "Biochemie";
  if (/^kvc/.test(code)) return "Chemie";
  if (/^kvp/.test(code)) return "Physik";

  const structuredMetadataSubject = canonicalSubject([
    assessment.course,
    assessment.lecture
  ].filter(Boolean).join(" "));
  if (structuredMetadataSubject && structuredMetadataSubject !== "Sonstiges") {
    return structuredMetadataSubject;
  }

  const metadata = normalizeText([
    assessment.assessmentTitle,
    assessment.title,
    assessment.sourceSummary
  ].filter(Boolean).join(" "));

  if (containsAny(metadata, ["histolog", "gewebedynamik", "gewebelehre"])) return "Histologie";
  if (containsAny(metadata, [
    "biochem", "oxidative phosphorylierung", "energiebereitstellung",
    "molekulargenetik", "zytogenetik", "epigenetik", "molekulardiagnostik"
  ])) return "Biochemie";
  if (containsAny(metadata, ["komplexverbindung", "redoxreaktion", "umweltchemie"])) return "Chemie";
  if (containsAny(metadata, ["physikalische aspekte", "biomechanik"])) return "Physik";
  if (containsAny(metadata, [
    "physiolog", "muskelfunktion", "skelettmuskel", "herzmuskel",
    "glatte muskulatur", "muskelmechanik", "motorik", "sensomotorik"
  ])) return "Physiologie";
  if (containsAny(metadata, [
    "anatom", "embryolog", "gametogen", "gastrulation", "somitogenese",
    "neurulation", "schlundbogen", "gliedmassen", "plazenta", "pranatal"
  ])) return "Anatomie";
  if (containsAny(metadata, [
    "psychosoz", "bio psycho sozial", "biopsychosoz", "psychotherapie",
    "resilienz", "coping", "stresserleben", "einsamkeit"
  ])) return "Psychosoziale Medizin";
  if (containsAny(metadata, [
    "public health", "epidemiolog", "planetary health", "umweltmedizin",
    "luftverschmutzung", "klimawandel", "lebensmittelsicherheit",
    "soziale determinante", "gesundheitsokonomie", "screening"
  ])) return "Public Health / Epidemiologie";
  if (containsAny(metadata, [
    "ethik", "wissenschaftstheorie", "medizingeschichte", "medikalisierung",
    "philosoph", "was ist eine krankheit", "medizinische evidenz"
  ])) return "Medical Humanities";

  const blockNumber = normalizeText(assessment.block || "").match(/\bblock\s*([5-9])\b/)?.[1];
  if (blockNumber === "5") return "Medical Humanities";
  if (blockNumber === "6") return "Public Health / Epidemiologie";
  if (blockNumber === "7") return "Psychosoziale Medizin";
  if (blockNumber === "8") return "Physiologie";

  return "Sonstiges";
}

export function getAssessmentSubject(assessment: AssessmentCatalogItem): AssessmentSubject {
  return assessment.subject || normalizeAssessmentSubject(undefined, assessment);
}

export function parseAssessmentSortKey(
  assessment: Pick<AssessmentCatalogItem, "id" | "lectureCode" | "title">
): AssessmentSortKey {
  const sources = [assessment.lectureCode, assessment.title, assessment.id];
  for (const source of sources) {
    const match = normalizeCode(source).match(/(?:^|[^A-Z0-9])(KVP|KVC|KVB|KV|SV|FP)\s*[-_. ]*0*(\d{1,4})/);
    if (!match) continue;
    return {
      group: match[1],
      number: Number(match[2]),
      title: assessment.title,
      recognized: true
    };
  }

  return {
    group: "",
    number: Number.POSITIVE_INFINITY,
    title: assessment.title,
    recognized: false
  };
}

export function compareAssessmentsByNumber(
  left: AssessmentCatalogItem,
  right: AssessmentCatalogItem
): number {
  const leftKey = parseAssessmentSortKey(left);
  const rightKey = parseAssessmentSortKey(right);

  if (leftKey.recognized !== rightKey.recognized) return leftKey.recognized ? -1 : 1;
  if (leftKey.recognized && rightKey.recognized) {
    const groupDifference = groupRank(leftKey.group) - groupRank(rightKey.group);
    if (groupDifference) return groupDifference;
    if (leftKey.number !== rightKey.number) return leftKey.number - rightKey.number;
  }

  return leftKey.title.localeCompare(rightKey.title, "de", {
    numeric: true,
    sensitivity: "base"
  }) || left.lectureCode.localeCompare(right.lectureCode, "de", {
    numeric: true,
    sensitivity: "base"
  });
}

export function availableAssessmentSubjects(
  assessments: readonly AssessmentCatalogItem[]
): AssessmentSubject[] {
  const available = new Set(assessments.map(getAssessmentSubject));
  return ASSESSMENT_SUBJECTS.filter((subject) => available.has(subject));
}

export function groupAssessmentsBySubject<T extends AssessmentCatalogItem>(
  assessments: readonly T[]
): Array<{ subject: AssessmentSubject; assessments: T[] }> {
  const groups = new Map<AssessmentSubject, T[]>();
  assessments.forEach((assessment) => {
    const subject = getAssessmentSubject(assessment);
    const current = groups.get(subject) || [];
    current.push(assessment);
    groups.set(subject, current);
  });

  return ASSESSMENT_SUBJECTS
    .filter((subject) => groups.has(subject))
    .map((subject) => ({
      subject,
      assessments: [...(groups.get(subject) || [])].sort(compareAssessmentsByNumber)
    }));
}

function canonicalSubject(value: unknown): AssessmentSubject | null {
  const normalized = normalizeText(typeof value === "string" ? value : "");
  if (!normalized) return null;
  for (const [subject, aliases] of SUBJECT_ALIASES) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) return subject;
  }
  return null;
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function groupRank(group: string): number {
  const index = CODE_GROUP_ORDER.indexOf(group);
  return index === -1 ? CODE_GROUP_ORDER.length : index;
}

function normalizeCode(value: string): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
