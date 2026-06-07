import type {
  AnalysisPriority,
  Assessment,
  AssessmentAnalysis,
  QuizResultRow
} from "./types";

type TopicBucket = {
  label: string;
  errors: number;
  partial: number;
  total: number;
  questions: number[];
  objectives: Set<string>;
};

export function analyzeAssessmentResults(
  assessment: Assessment,
  rows: QuizResultRow[]
): AssessmentAnalysis {
  const incorrect = rows.filter((row) => row.status === "incorrect");
  const partial = rows.filter((row) => row.status === "partial");
  const correct = rows.filter((row) => row.status === "correct");
  const topics = collectTopics(assessment, rows);
  const weaknesses = [...topics.values()]
    .filter((topic) => topic.errors > 0 || topic.partial > 0)
    .sort((a, b) => weightedErrors(b) - weightedErrors(a) || b.total - a.total)
    .slice(0, 6)
    .map((topic) => ({
      topic: topic.label,
      priority: priorityFor(topic),
      reason: topicReason(topic),
      recommendedAction: recommendationFor(topic),
      relatedQuestions: topic.questions,
      relatedLearningObjectives: [...topic.objectives]
    }));

  const strengths = [...topics.values()]
    .filter((topic) => topic.total >= 1 && topic.errors === 0 && topic.partial === 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)
    .map((topic) => `${topic.label}: ${topic.total} Frage${topic.total === 1 ? "" : "n"} sicher beantwortet.`);

  const errorPatterns = buildErrorPatterns(rows);
  const totalPoints = rows.reduce((sum, row) => sum + row.maxPoints, 0);
  const score = totalPoints
    ? Math.round(rows.reduce((sum, row) => sum + row.points, 0) / totalPoints * 100)
    : 0;

  return {
    summary: summaryText(score, correct.length, partial.length, incorrect.length),
    strengths: strengths.length ? strengths : ["Noch kein stabiler Stärkenbereich aus diesem Versuch ableitbar."],
    weaknesses,
    errorPatterns,
    nextStudySteps: buildNextSteps(weaknesses, errorPatterns, incorrect.length + partial.length)
  };
}

function collectTopics(assessment: Assessment, rows: QuizResultRow[]): Map<string, TopicBucket> {
  const objectives = new Map(
    (assessment.learningObjectives || []).map((objective) => [objective.id, objective.text])
  );
  const buckets = new Map<string, TopicBucket>();

  rows.forEach((row, index) => {
    const labels = row.question.tags?.length
      ? row.question.tags
      : [objectives.get(row.question.learningObjectiveId) || assessment.lectureCode || assessment.block || "Allgemein"];

    labels.forEach((label) => {
      const key = normalizeTopic(label);
      const bucket = buckets.get(key) || {
        label,
        errors: 0,
        partial: 0,
        total: 0,
        questions: [],
        objectives: new Set<string>()
      };
      bucket.total += 1;
      if (row.status === "incorrect") bucket.errors += 1;
      if (row.status === "partial") bucket.partial += 1;
      if (row.status !== "correct") bucket.questions.push(index + 1);
      const objective = objectives.get(row.question.learningObjectiveId);
      if (objective) bucket.objectives.add(objective);
      buckets.set(key, bucket);
    });
  });

  return buckets;
}

function buildErrorPatterns(rows: QuizResultRow[]): AssessmentAnalysis["errorPatterns"] {
  const patterns: AssessmentAnalysis["errorPatterns"] = [];
  const kprimRows = rows
    .map((row, index) => ({ row, number: index + 1 }))
    .filter(({ row }) => row.question.type === "KPRIM" && row.status !== "correct");
  const falsePositiveQuestions = kprimRows
    .filter(({ row }) => (row.falsePositives || 0) > 0)
    .map(({ number }) => number);
  const falseNegativeQuestions = kprimRows
    .filter(({ row }) => (row.falseNegatives || 0) > 0)
    .map(({ number }) => number);

  if (falsePositiveQuestions.length) {
    patterns.push({
      pattern: "Bei K-prim wurden falsche Aussagen wiederholt als richtig bewertet.",
      exampleQuestionNumbers: falsePositiveQuestions,
      correctionStrategy: "Prüfe jede Aussage einzeln auf absolute Formulierungen, vertauschte Mechanismen und unzulässige Verallgemeinerungen."
    });
  }

  if (falseNegativeQuestions.length) {
    patterns.push({
      pattern: "Bei K-prim wurden korrekte Aussagen als falsch verworfen.",
      exampleQuestionNumbers: falseNegativeQuestions,
      correctionStrategy: "Trainiere das aktive Bestätigen korrekter Teilkonzepte und begründe vor der Auswahl kurz, weshalb eine Aussage stimmen muss."
    });
  }

  const unanswered = rows
    .map((row, index) => ({ row, number: index + 1 }))
    .filter(({ row }) => isUnanswered(row))
    .map(({ number }) => number);
  if (unanswered.length) {
    patterns.push({
      pattern: "Einzelne Fragen oder Aussagen blieben unbeantwortet.",
      exampleQuestionNumbers: unanswered,
      correctionStrategy: "Plane am Ende eines Prüfungsdurchgangs eine kurze Kontrollrunde für offene Antworten ein."
    });
  }

  return patterns;
}

function isUnanswered(row: QuizResultRow): boolean {
  if (row.question.type === "A") return !row.answer.selected;
  return row.question.options.some((option) => typeof row.answer.kprim?.[option.sessionOptionId || option.id] !== "boolean");
}

function weightedErrors(topic: TopicBucket): number {
  return topic.errors * 2 + topic.partial;
}

function priorityFor(topic: TopicBucket): AnalysisPriority {
  const weight = weightedErrors(topic);
  if (topic.errors >= 2 || weight >= 4) return "high";
  if (topic.errors >= 1 || topic.partial >= 2) return "medium";
  return "low";
}

function topicReason(topic: TopicBucket): string {
  const parts: string[] = [];
  if (topic.errors) parts.push(`${topic.errors} vollständig falsche`);
  if (topic.partial) parts.push(`${topic.partial} teilrichtige`);
  return `${parts.join(" und ")} Antwort${topic.errors + topic.partial === 1 ? "" : "en"} bei ${topic.total} zugeordneten Frage${topic.total === 1 ? "" : "n"}.`;
}

function recommendationFor(topic: TopicBucket): string {
  if (priorityFor(topic) === "high") {
    return `Wiederhole ${topic.label} zuerst anhand der Lernziele und löse danach die zugehörigen Fragen ${topic.questions.join(", ")} erneut.`;
  }
  if (priorityFor(topic) === "medium") {
    return `Erstelle eine kurze Gegenüberstellung der Kernbegriffe zu ${topic.label} und kontrolliere sie mit den Erklärungen der betroffenen Fragen.`;
  }
  return `Nimm ${topic.label} in die nächste kurze Wiederholungsrunde auf.`;
}

function summaryText(score: number, correct: number, partial: number, incorrect: number): string {
  if (score >= 90) {
    return `Sehr sicherer Versuch mit ${score} %. ${correct} Fragen waren vollständig richtig; verbleibende Unsicherheiten sollten gezielt nachgearbeitet werden.`;
  }
  if (score >= 70) {
    return `Solide Grundlage mit ${score} %. ${partial} teilrichtige und ${incorrect} falsche Antworten zeigen klar eingrenzbare Wiederholungsthemen.`;
  }
  return `Dieser Versuch erreichte ${score} %. Priorisiere die wiederkehrenden Fehlerthemen, bevor du das Assessment erneut im Prüfungsmodus bearbeitest.`;
}

function buildNextSteps(
  weaknesses: AssessmentAnalysis["weaknesses"],
  patterns: AssessmentAnalysis["errorPatterns"],
  openCount: number
): string[] {
  if (!openCount) {
    return ["Assessment in einigen Tagen im Reviewmodus wiederholen, um den Lernerhalt zu prüfen."];
  }

  const steps = weaknesses.slice(0, 3).map((item) => item.recommendedAction);
  if (patterns[0]) steps.push(patterns[0].correctionStrategy);
  steps.push("Anschliessend nur die falschen und teilrichtigen Fragen erneut lösen.");
  return [...new Set(steps)].slice(0, 5);
}

function normalizeTopic(value: string): string {
  return value.trim().toLocaleLowerCase("de-CH");
}
