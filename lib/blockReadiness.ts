import { validateKPrimQuestion } from "./questionQuality";
import { blockIdForContent } from "./studyProgram";
import type {
  Assessment,
  AssessmentProgress,
  AssessmentQuestion,
  BlockReadinessResult,
  BlockReadinessStatus,
  FastQuizMode,
  QuestionConfidence,
  QuestionStat,
  QuizResultRow
} from "./types";

export const FAST_QUIZ_COUNTS: Record<FastQuizMode, number> = {
  pulse: 15,
  weakness: 20,
  readiness: 35
};

export const FAST_QUIZ_MODE_LABELS: Record<FastQuizMode, string> = {
  pulse: "Block Pulse",
  weakness: "Weakness Hunter",
  readiness: "Exam Readiness Check"
};

export type UtilityComponents = {
  learningObjectiveWeight: number;
  weaknessWeight: number;
  discriminationWeight: number;
  forgettingRisk: number;
  conceptualDepth: number;
  novelty: number;
};

export type BlockQuestionCandidate = {
  assessmentId: string;
  assessmentTitle: string;
  lectureCode: string;
  blockId: string;
  question: AssessmentQuestion;
  sourceQuestionId: string;
  sessionQuestionId: string;
  learningObjectiveIds: string[];
  learningObjectiveLabels: Record<string, string>;
  stats?: QuestionStat;
  utility: UtilityComponents;
  utilityScore: number;
  qualityPenalty: number;
};

export type FastQuizSelection = {
  mode: FastQuizMode;
  requestedCount: number;
  questions: AssessmentQuestion[];
  candidates: BlockQuestionCandidate[];
  availableCount: number;
  objectiveCount: number;
  typeCounts: { A: number; KPRIM: number };
};

export type ReadinessCalculationInput = {
  blockId: string;
  mode: FastQuizMode;
  quizResultId: string;
  rows: QuizResultRow[];
  candidates: BlockQuestionCandidate[];
  allBlockCandidates?: BlockQuestionCandidate[];
  assessmentProgress: Record<string, AssessmentProgress>;
  previousFastQuizScores?: number[];
  confidenceByQuestion?: Record<string, QuestionConfidence>;
  createdAt?: string;
};

export function buildBlockQuestionCandidates(
  assessments: Assessment[],
  progress: Record<string, AssessmentProgress>,
  requestedBlockId: string,
  now = Date.now()
): BlockQuestionCandidate[] {
  const matching = assessments.filter((assessment) => blockIdForContent(assessment) === requestedBlockId);
  const objectiveFrequency = new Map<string, number>();

  matching.forEach((assessment) => {
    assessment.questions.forEach((question) => {
      objectiveIds(assessment, question).forEach((objectiveId) => {
        objectiveFrequency.set(objectiveId, (objectiveFrequency.get(objectiveId) || 0) + 1);
      });
    });
  });

  const maxFrequency = Math.max(1, ...objectiveFrequency.values());
  return matching.flatMap((assessment) => {
    const labels = new Map(assessment.learningObjectives.map((objective) => [
      namespacedObjectiveId(assessment.id, objective.id),
      objective.text
    ]));

    return assessment.questions
      .filter(isUsableQuestion)
      .map((question): BlockQuestionCandidate => {
        const learningObjectiveIds = objectiveIds(assessment, question);
        const stats = progress[assessment.id]?.questionStats?.[question.id];
        const utility = calculateUtilityComponents(
          question,
          stats,
          learningObjectiveIds,
          objectiveFrequency,
          maxFrequency,
          now
        );
        const qualityPenalty = questionQualityPenalty(question);
        return {
          assessmentId: assessment.id,
          assessmentTitle: assessment.title,
          lectureCode: assessment.lectureCode,
          blockId: requestedBlockId,
          question,
          sourceQuestionId: question.id,
          sessionQuestionId: `${assessment.id}::${question.id}`,
          learningObjectiveIds,
          learningObjectiveLabels: Object.fromEntries(learningObjectiveIds.map((id) => [
            id,
            labels.get(id) || fallbackObjectiveLabel(assessment, question)
          ])),
          stats,
          utility,
          utilityScore: roundScore(weightedUtility(utility)),
          qualityPenalty
        };
      });
  });
}

export function calculateUtilityScore(
  candidate: Pick<BlockQuestionCandidate, "utility" | "qualityPenalty">,
  mode: FastQuizMode
): number {
  const base = weightedUtility(candidate.utility);
  const modeAdjusted = mode === "weakness"
    ? base * 0.68 + candidate.utility.weaknessWeight * 0.22 + candidate.utility.forgettingRisk * 0.10
    : mode === "readiness"
      ? base * 0.78 + candidate.utility.discriminationWeight * 0.14 + candidate.utility.conceptualDepth * 0.08
      : base;
  return roundScore(clamp01(modeAdjusted - candidate.qualityPenalty));
}

export function selectFastQuizQuestions(
  candidates: BlockQuestionCandidate[],
  mode: FastQuizMode,
  requestedCount = FAST_QUIZ_COUNTS[mode]
): FastQuizSelection {
  const target = Math.max(1, Math.min(requestedCount, candidates.length));
  const allScored = candidates
    .map((candidate) => ({
      ...candidate,
      utilityScore: calculateUtilityScore(candidate, mode)
    }))
    .sort(candidateSort);
  const qualityCleared = allScored.filter((candidate) => candidate.qualityPenalty < 0.25);
  const scored = qualityCleared.length >= target ? qualityCleared : allScored;
  const selected: BlockQuestionCandidate[] = [];
  const objectiveGroups = groupByObjective(scored);

  // Coverage first: one strong item per learning objective until the quiz is
  // roughly two thirds full. Remaining slots are pure utility picks.
  const coverageTarget = Math.min(target, Math.ceil(target * (mode === "weakness" ? 0.55 : 0.68)));
  const groupQueue = [...objectiveGroups.values()]
    .sort((left, right) => (right[0]?.utilityScore || 0) - (left[0]?.utilityScore || 0));
  while (selected.length < coverageTarget && groupQueue.some((group) => group.length)) {
    groupQueue.forEach((group) => {
      if (selected.length >= coverageTarget) return;
      const candidate = group.find((item) => canSelect(item, selected, mode));
      if (!candidate) {
        group.length = 0;
        return;
      }
      selected.push(candidate);
      group.splice(group.indexOf(candidate), 1);
    });
  }

  for (const candidate of scored) {
    if (selected.length >= target) break;
    if (canSelect(candidate, selected, mode)) selected.push(candidate);
  }

  // If similarity/type constraints were too strict, fill with the best unique IDs.
  for (const candidate of scored) {
    if (selected.length >= target) break;
    if (!selected.some((item) => item.sessionQuestionId === candidate.sessionQuestionId)) {
      selected.push(candidate);
    }
  }

  const balanced = ensureQuestionTypeMix(selected, scored, mode);
  const sessionQuestions = balanced.map(toSessionQuestion);
  return {
    mode,
    requestedCount,
    questions: sessionQuestions,
    candidates: balanced,
    availableCount: candidates.length,
    objectiveCount: new Set(balanced.flatMap((candidate) => candidate.learningObjectiveIds)).size,
    typeCounts: {
      A: balanced.filter((candidate) => candidate.question.type === "A").length,
      KPRIM: balanced.filter((candidate) => candidate.question.type === "KPRIM").length
    }
  };
}

export function calculateBlockReadiness(input: ReadinessCalculationInput): BlockReadinessResult {
  const currentCandidateById = new Map(input.candidates.map((candidate) => [
    candidate.sessionQuestionId,
    candidate
  ]));
  const fastQuizPerformance = difficultyWeightedPerformance(input.rows);
  const objectivePerformance = objectivePerformanceMap(input.rows, currentCandidateById);
  const testedLearningObjectiveIds = [...objectivePerformance.keys()];
  const weakLearningObjectiveIds = testedLearningObjectiveIds
    .filter((id) => (objectivePerformance.get(id)?.score || 0) < 0.65);
  const strongLearningObjectiveIds = testedLearningObjectiveIds
    .filter((id) => (objectivePerformance.get(id)?.score || 0) >= 0.78);
  const learningObjectiveCoverage = coverageScore(objectivePerformance);
  const assessmentScores = normalAssessmentScores(
    input.allBlockCandidates || input.candidates,
    input.assessmentProgress
  );
  const assessmentPerformance = assessmentScores.length ? weightedRecentAverage(assessmentScores) : null;
  const stabilityScores = [
    ...assessmentScores,
    ...(input.previousFastQuizScores || []),
    fastQuizPerformance
  ];
  const stabilityScore = calculateStabilityScore(stabilityScores);
  const readinessScore = assessmentPerformance === null
    ? Math.round(
      fastQuizPerformance * 0.60
      + learningObjectiveCoverage * 0.25
      + stabilityScore * 0.15
    )
    : Math.round(
      assessmentPerformance * 0.45
      + fastQuizPerformance * 0.30
      + learningObjectiveCoverage * 0.15
      + stabilityScore * 0.10
    );
  const status = classifyReadiness(readinessScore);
  const learningObjectiveLabels = input.candidates.reduce<Record<string, string>>((acc, candidate) => {
    Object.assign(acc, candidate.learningObjectiveLabels);
    return acc;
  }, {});

  return {
    blockId: input.blockId,
    mode: input.mode,
    quizResultId: input.quizResultId,
    readinessScore,
    status,
    assessmentPerformance,
    fastQuizPerformance,
    learningObjectiveCoverage,
    stabilityScore,
    testedLearningObjectiveIds,
    weakLearningObjectiveIds,
    strongLearningObjectiveIds,
    learningObjectiveLabels,
    recommendedNextMode: recommendedMode(status, weakLearningObjectiveIds.length),
    recommendedAssessmentId: weakestAssessmentId(input.rows, currentCandidateById),
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function classifyReadiness(score: number): BlockReadinessStatus {
  if (score >= 85) return "ready";
  if (score >= 70) return "almost_ready";
  if (score >= 55) return "risk_zone";
  return "not_ready";
}

export function readinessProgressId(blockId: string): string {
  return `block-readiness:${blockId}`;
}

export function latestReadinessResults(progress?: AssessmentProgress): BlockReadinessResult[] {
  return (progress?.attempts || [])
    .map((attempt) => attempt.readinessResult)
    .filter((result): result is BlockReadinessResult => !!result)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export function readinessStatusLabel(status: BlockReadinessStatus): string {
  if (status === "ready") return "Ready";
  if (status === "almost_ready") return "Almost ready";
  if (status === "risk_zone") return "Risk zone";
  return "Not ready";
}

export function toFastQuizQuestion(candidate: BlockQuestionCandidate): AssessmentQuestion {
  return toSessionQuestion(candidate);
}

export function createFastQuizAssessment(
  blockId: string,
  mode: FastQuizMode,
  candidates: BlockQuestionCandidate[]
): Assessment {
  const learningObjectives = new Map<string, string>();
  candidates.forEach((candidate) => {
    Object.entries(candidate.learningObjectiveLabels).forEach(([id, label]) => {
      learningObjectives.set(id, label);
    });
  });
  return {
    id: readinessProgressId(blockId),
    lectureCode: "FAST",
    title: `${FAST_QUIZ_MODE_LABELS[mode]} · ${formatBlockId(blockId)}`,
    block: formatBlockId(blockId),
    sourceSummary: "Adaptiver, blockweiter Readiness-Check aus hochwertigen Fragen des vorhandenen ATLAS-Fragenpools.",
    learningObjectives: [...learningObjectives.entries()].map(([id, text]) => ({ id, text })),
    questions: candidates.map(toSessionQuestion),
    active: true
  };
}

export function formatBlockId(blockId: string): string {
  const number = String(blockId).match(/\d+/)?.[0];
  return number ? `Block ${number}` : "Block";
}

function calculateUtilityComponents(
  question: AssessmentQuestion,
  stats: QuestionStat | undefined,
  objectiveIdsForQuestion: string[],
  objectiveFrequency: Map<string, number>,
  maxFrequency: number,
  now: number
): UtilityComponents {
  const frequency = Math.min(
    ...objectiveIdsForQuestion.map((id) => objectiveFrequency.get(id) || maxFrequency)
  );
  const learningObjectiveWeight = clamp01(1 - (frequency - 1) / Math.max(1, maxFrequency) * 0.45);
  const attempts = stats?.seen || 0;
  const wrongRate = attempts ? (stats?.wrong || 0) / attempts : 0;
  const weaknessWeight = attempts
    ? clamp01(wrongRate * 0.72 + Number(stats?.lastCorrect === false) * 0.20 + Number(stats?.markedForReview) * 0.08)
    : 0.42;
  const explicitDiscrimination = typeof question.discriminationScore === "number"
    ? clamp01(question.discriminationScore)
    : null;
  const discriminationWeight = explicitDiscrimination
    ?? clamp01(
      0.46
      + Number(question.isHighYield) * 0.28
      + Math.max(0, question.difficulty - 2) * 0.06
      + Number(["application", "mechanism", "transfer", "clinical_reasoning"].includes(question.bloomLevel || "")) * 0.12
    );
  const daysSinceSeen = stats?.lastAnsweredAt
    ? Math.max(0, (now - new Date(stats.lastAnsweredAt).getTime()) / 86_400_000)
    : null;
  const forgettingRisk = daysSinceSeen === null
    ? 0.50
    : clamp01(0.15 + Math.min(daysSinceSeen / 30, 1) * 0.62 + wrongRate * 0.23);
  const conceptualDepth = clamp01(
    (question.conceptualDepth || inferredConceptualDepth(question)) / 5
  );
  const novelty = attempts === 0 ? 1 : clamp01(1 / (1 + attempts * 0.55));

  return {
    learningObjectiveWeight,
    weaknessWeight,
    discriminationWeight,
    forgettingRisk,
    conceptualDepth,
    novelty
  };
}

function weightedUtility(utility: UtilityComponents): number {
  return utility.learningObjectiveWeight * 0.25
    + utility.weaknessWeight * 0.25
    + utility.discriminationWeight * 0.20
    + utility.forgettingRisk * 0.15
    + utility.conceptualDepth * 0.10
    + utility.novelty * 0.05;
}

function objectiveIds(assessment: Assessment, question: AssessmentQuestion): string[] {
  const raw = question.learningObjectiveIds?.length
    ? question.learningObjectiveIds
    : question.learningObjectiveId
      ? [question.learningObjectiveId]
      : question.tags.slice(0, 1).map((tag) => `tag:${tag}`)
        || [];
  const ids = raw.length ? raw : ["general"];
  return [...new Set(ids.map((id) => namespacedObjectiveId(assessment.id, id)))];
}

function namespacedObjectiveId(assessmentId: string, objectiveId: string): string {
  return `${assessmentId}::${objectiveId}`;
}

function fallbackObjectiveLabel(assessment: Assessment, question: AssessmentQuestion): string {
  return question.tags[0] || `${assessment.lectureCode} · Allgemein`;
}

function questionQualityPenalty(question: AssessmentQuestion): number {
  let penalty = 0;
  const flags = new Set(question.qualityFlags || []);
  if (question.type === "KPRIM") {
    validateKPrimQuestion(question).forEach((flag) => flags.add(flag));
  }
  if (flags.has("all_true_kprim") || flags.has("all_false_kprim")) penalty += 0.28;
  if (flags.has("ambiguous_answer")) penalty += 0.35;
  if (flags.has("weak_distractor")) penalty += 0.08;
  if (flags.has("too_recall_heavy") || flags.has("low_concept_depth")) penalty += 0.08;
  if (question.reviewStatus === "draft" || question.reviewStatus === "needs_review") penalty += 0.12;
  return Math.min(0.55, penalty);
}

function isUsableQuestion(question: AssessmentQuestion): boolean {
  if (!question?.id || !question.stem || !Array.isArray(question.options)) return false;
  if (question.type === "A") return question.options.length >= 2
    && question.options.filter((option) => option.correct).length === 1;
  return question.type === "KPRIM" && question.options.length === 4;
}

function inferredConceptualDepth(question: AssessmentQuestion): number {
  if (question.bloomLevel === "clinical_reasoning" || question.bloomLevel === "transfer") return 5;
  if (question.bloomLevel === "mechanism" || question.bloomLevel === "application") return 4;
  if (question.bloomLevel === "understanding") return 3;
  if (question.bloomLevel === "recall") return 1;
  if (/\b(warum|mechanismus|folge|konsequenz|patient|klinisch|führt|verändert)\b/i.test(question.stem)) return 4;
  return Math.max(1, Math.min(5, question.difficulty || 2));
}

function groupByObjective(candidates: BlockQuestionCandidate[]): Map<string, BlockQuestionCandidate[]> {
  const groups = new Map<string, BlockQuestionCandidate[]>();
  candidates.forEach((candidate) => {
    const key = candidate.learningObjectiveIds[0] || `${candidate.assessmentId}::general`;
    const group = groups.get(key) || [];
    group.push(candidate);
    groups.set(key, group);
  });
  return groups;
}

function canSelect(
  candidate: BlockQuestionCandidate,
  selected: BlockQuestionCandidate[],
  mode: FastQuizMode
): boolean {
  if (selected.some((item) => item.sessionQuestionId === candidate.sessionQuestionId)) return false;
  if (selected.some((item) => stemSimilarity(item.question.stem, candidate.question.stem) >= 0.72)) return false;

  const targetKprimRatio = mode === "readiness" ? 0.30 : 0.24;
  if (candidate.question.type === "KPRIM") {
    const nextRatio = (selected.filter((item) => item.question.type === "KPRIM").length + 1) / (selected.length + 1);
    if (nextRatio > targetKprimRatio + 0.18 && selected.length >= 4) return false;
  }
  return true;
}

function ensureQuestionTypeMix(
  selected: BlockQuestionCandidate[],
  scored: BlockQuestionCandidate[],
  mode: FastQuizMode
): BlockQuestionCandidate[] {
  const result = [...selected];
  const ratio = mode === "readiness" ? 0.30 : 0.24;
  const availableKprim = scored.filter((candidate) => (
    candidate.question.type === "KPRIM"
    && candidate.qualityPenalty < 0.25
  ));
  const targetKprim = Math.min(availableKprim.length, Math.max(0, Math.round(result.length * ratio)));
  let currentKprim = result.filter((candidate) => candidate.question.type === "KPRIM").length;
  if (currentKprim >= targetKprim) return result;

  for (const replacement of availableKprim) {
    if (currentKprim >= targetKprim) break;
    if (result.some((candidate) => candidate.sessionQuestionId === replacement.sessionQuestionId)) continue;
    const replaceIndex = [...result]
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.question.type === "A")
      .sort((left, right) => left.candidate.utilityScore - right.candidate.utilityScore)
      .find(({ index }) => (
        !result.some((candidate, candidateIndex) => (
          candidateIndex !== index
          && stemSimilarity(candidate.question.stem, replacement.question.stem) >= 0.72
        ))
      ))?.index;
    if (replaceIndex === undefined) continue;
    result[replaceIndex] = replacement;
    currentKprim += 1;
  }

  return result.sort(candidateSort);
}

function toSessionQuestion(candidate: BlockQuestionCandidate): AssessmentQuestion {
  return {
    ...candidate.question,
    id: candidate.sessionQuestionId,
    blockId: candidate.blockId,
    lectureId: candidate.lectureCode,
    learningObjectiveId: candidate.learningObjectiveIds[0] || "",
    learningObjectiveIds: candidate.learningObjectiveIds,
    sourceAssessmentId: candidate.assessmentId,
    sourceQuestionId: candidate.sourceQuestionId,
    options: candidate.question.options.map((option) => ({ ...option }))
  };
}

function candidateSort(left: BlockQuestionCandidate, right: BlockQuestionCandidate): number {
  return right.utilityScore - left.utilityScore
    || left.qualityPenalty - right.qualityPenalty
    || stableHash(left.sessionQuestionId) - stableHash(right.sessionQuestionId);
}

function difficultyWeightedPerformance(rows: QuizResultRow[]): number {
  if (!rows.length) return 0;
  let earned = 0;
  let available = 0;
  rows.forEach((row) => {
    const weight = 1 + Math.max(0, Math.min(5, row.question.difficulty) - 1) * 0.12;
    earned += row.points * weight;
    available += row.maxPoints * weight;
  });
  return available ? Math.round(earned / available * 100) : 0;
}

function objectivePerformanceMap(
  rows: QuizResultRow[],
  candidates: Map<string, BlockQuestionCandidate>
): Map<string, { earned: number; available: number; score: number }> {
  const values = new Map<string, { earned: number; available: number; score: number }>();
  rows.forEach((row) => {
    const candidate = candidates.get(row.question.id);
    (candidate?.learningObjectiveIds || row.question.learningObjectiveIds || []).forEach((objectiveId) => {
      const value = values.get(objectiveId) || { earned: 0, available: 0, score: 0 };
      value.earned += row.points;
      value.available += row.maxPoints;
      value.score = value.available ? value.earned / value.available : 0;
      values.set(objectiveId, value);
    });
  });
  return values;
}

function coverageScore(values: Map<string, { score: number; available: number }>): number {
  if (!values.size) return 0;
  const stable = [...values.values()].filter((value) => value.available > 0 && value.score >= 0.67).length;
  return Math.round(stable / values.size * 100);
}

function normalAssessmentScores(
  candidates: BlockQuestionCandidate[],
  progress: Record<string, AssessmentProgress>
): number[] {
  const assessmentIds = [...new Set(candidates.map((candidate) => candidate.assessmentId))];
  return assessmentIds.flatMap((assessmentId) => (
    (progress[assessmentId]?.attempts || [])
      .filter((attempt) => !attempt.fastQuizMode)
      .slice(0, 3)
      .map((attempt) => ({ score: attempt.score, completedAt: attempt.completedAt }))
  ))
    .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())
    .slice(0, 12)
    .map((attempt) => attempt.score);
}

function weightedRecentAverage(scores: number[]): number {
  if (!scores.length) return 0;
  let total = 0;
  let weights = 0;
  scores.slice(0, 12).forEach((score, index) => {
    const weight = Math.max(0.35, 1 - index * 0.07);
    total += score * weight;
    weights += weight;
  });
  return Math.round(total / weights);
}

export function calculateStabilityScore(scores: number[]): number {
  const values = scores.filter(Number.isFinite).slice(-10);
  if (!values.length) return 35;
  if (values.length === 1) return Math.round(clamp(values[0] * 0.65, 35, 65));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  const evidenceFactor = Math.min(1, values.length / 4);
  return Math.round(clamp(
    mean * 0.58 + (100 - standardDeviation * 2.1) * 0.27 + evidenceFactor * 15,
    20,
    100
  ));
}

function recommendedMode(status: BlockReadinessStatus, weaknessCount: number): FastQuizMode {
  if (status === "ready" && weaknessCount === 0) return "pulse";
  if (status === "almost_ready" && weaknessCount <= 1) return "readiness";
  return "weakness";
}

function weakestAssessmentId(
  rows: QuizResultRow[],
  candidates: Map<string, BlockQuestionCandidate>
): string | undefined {
  const buckets = new Map<string, { errors: number; total: number }>();
  rows.forEach((row) => {
    const assessmentId = candidates.get(row.question.id)?.assessmentId;
    if (!assessmentId) return;
    const bucket = buckets.get(assessmentId) || { errors: 0, total: 0 };
    bucket.total += 1;
    if (!row.correct) bucket.errors += 1;
    buckets.set(assessmentId, bucket);
  });
  return [...buckets.entries()]
    .sort((left, right) => (
      right[1].errors / Math.max(1, right[1].total)
      - left[1].errors / Math.max(1, left[1].total)
    ))[0]?.[0];
}

function stemSimilarity(left: string, right: string): number {
  const a = wordSet(left);
  const b = wordSet(right);
  const union = new Set([...a, ...b]);
  if (!union.size) return 0;
  return [...a].filter((word) => b.has(word)).length / union.size;
}

function wordSet(value: string): Set<string> {
  return new Set(normalizeText(value).split(/\s+/).filter((word) => word.length >= 4));
}

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function roundScore(value: number): number {
  return Math.round(clamp01(value) * 10_000) / 10_000;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
