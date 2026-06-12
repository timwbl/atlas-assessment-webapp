export type QuestionType = "A" | "KPRIM";

export type SourceReliability = "high" | "medium" | "low" | "insufficient_source";
export type QuestionDifficulty = "easy" | "medium" | "hard" | "very_hard";
export type BloomLevel =
  | "recall"
  | "understanding"
  | "application"
  | "mechanism"
  | "transfer"
  | "clinical_reasoning";
export type QuestionReviewStatus = "draft" | "needs_review" | "reviewed" | "verified";
export type FastQuizMode = "pulse" | "weakness" | "readiness";
export type QuestionConfidence = "sure" | "unsure";
export type QuestionMistakeType =
  | "knowledge_gap"
  | "conceptual_error"
  | "misread"
  | "too_slow";
export type BlockReadinessStatus = "ready" | "almost_ready" | "risk_zone" | "not_ready";
export type AssessmentSubject =
  | "Embryologie"
  | "Histologie"
  | "Physiologie"
  | "Biochemie"
  | "Chemie"
  | "Physik"
  | "Public Health / Epidemiologie"
  | "Psychosoziale Medizin"
  | "Medical Humanities"
  | "Sonstiges";

export type StructuredQuestionExplanation = {
  coreIdea: string;
  correctReasoning: string;
  wrongAnswerExplanations: Record<string, string>;
  commonTrap?: string;
  highYield?: string;
};

export type LearningObjective = {
  id: string;
  text: string;
};

export type QuestionOption = {
  id: string;
  text: string;
  correct: boolean;
  originalId?: string;
  sessionOptionId?: string;
  displayId?: string;
};

export type AssessmentQuestion = {
  id: string;
  type: QuestionType;
  difficulty: number;
  learningObjectiveId: string;
  stem: string;
  options: QuestionOption[];
  explanation: string;
  trap: string;
  tags: string[];
  sourceReliability: SourceReliability;
  difficultyLevel?: QuestionDifficulty;
  bloomLevel?: BloomLevel;
  concepts?: string[];
  questionGoal?: string;
  commonConfusions?: string[];
  structuredExplanation?: StructuredQuestionExplanation;
  qualityFlags?: string[];
  reviewedQualityFlags?: string[];
  reviewStatus?: QuestionReviewStatus;
  blockId?: string;
  lectureId?: string;
  learningObjectiveIds?: string[];
  conceptualDepth?: number;
  discriminationScore?: number;
  isHighYield?: boolean;
  sourceAssessmentId?: string;
  sourceQuestionId?: string;
};

export type Assessment = {
  id: string;
  lectureCode: string;
  title: string;
  block: string;
  subject?: AssessmentSubject;
  sourceSummary: string;
  learningObjectives: LearningObjective[];
  questions: AssessmentQuestion[];
  active?: boolean;
};

export type AssessmentSummary = {
  id: string;
  lectureCode: string;
  title: string;
  block: string;
  subject?: AssessmentSubject;
  sourceSummary: string;
  questionCount: number;
  questionIds: string[];
  tags: string[];
  active?: boolean;
};

export type ValidationResult<T> = {
  ok: true;
  value: T;
  warnings: string[];
} | {
  ok: false;
  errors: string[];
};

export type UserAnswer = {
  selected?: string;
  kprim?: Record<string, boolean>;
};

export type QuizMode = "training" | "exam" | "review";
export type QuickTrainingType = "wrong" | "marked" | "random" | "";
export type AnswerStatus = "correct" | "partial" | "incorrect";
export type AnalysisPriority = "high" | "medium" | "low";

export type StoredQuestionResult = {
  questionId: string;
  answer: UserAnswer;
  optionOrder: string[];
  status: AnswerStatus;
  points: number;
  maxPoints: number;
  correctStatements?: number;
  totalStatements?: number;
};

export type AnalysisWeakness = {
  topic: string;
  priority: AnalysisPriority;
  reason: string;
  recommendedAction: string;
  relatedQuestions: number[];
  relatedLearningObjectives: string[];
};

export type AnalysisErrorPattern = {
  pattern: string;
  exampleQuestionNumbers: number[];
  correctionStrategy: string;
};

export type AssessmentAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: AnalysisWeakness[];
  errorPatterns: AnalysisErrorPattern[];
  nextStudySteps: string[];
};

export type QuestionStat = {
  seen: number;
  correct: number;
  wrong: number;
  lastCorrect: boolean | null;
  markedForReview: boolean;
  priority: "normal" | "high";
  lastAnsweredAt?: string;
  avgTimeSeconds?: number;
  confidence?: QuestionConfidence;
  mistakeType?: QuestionMistakeType;
};

export type QuizAttempt = {
  id: string;
  assessmentId: string;
  mode: QuizMode;
  score: number;
  correct: number;
  partial?: number;
  incorrect?: number;
  points?: number;
  maxPoints?: number;
  total: number;
  startedAt: string;
  completedAt: string;
  answers: Record<string, UserAnswer>;
  wrongQuestionIds: string[];
  questionResults?: StoredQuestionResult[];
  analysis?: AssessmentAnalysis;
  fastQuizMode?: FastQuizMode;
  blockId?: string;
  readinessResult?: BlockReadinessResult;
  questionTelemetry?: Record<string, FastQuizQuestionTelemetry>;
};

export type FastQuizQuestionTelemetry = {
  sourceAssessmentId: string;
  sourceQuestionId: string;
  learningObjectiveIds: string[];
  timeSeconds: number;
  confidence?: QuestionConfidence;
  mistakeType?: QuestionMistakeType;
};

export type BlockReadinessResult = {
  userId?: string;
  blockId: string;
  mode: FastQuizMode;
  quizResultId: string;
  readinessScore: number;
  status: BlockReadinessStatus;
  assessmentPerformance: number | null;
  fastQuizPerformance: number;
  learningObjectiveCoverage: number;
  stabilityScore: number;
  testedLearningObjectiveIds: string[];
  weakLearningObjectiveIds: string[];
  strongLearningObjectiveIds: string[];
  learningObjectiveLabels: Record<string, string>;
  recommendedNextMode: FastQuizMode;
  recommendedAssessmentId?: string;
  createdAt: string;
};

export type AssessmentProgress = {
  assessmentId: string;
  attempts: QuizAttempt[];
  questionStats: Record<string, QuestionStat>;
  bestScore: number;
  lastScore: number | null;
  lastAttemptAt?: string;
  errorTags: Record<string, number>;
  activeSession?: ActiveQuizSession;
  activeSessionClearedAt?: string;
};

export type ActiveQuizSession = {
  assessmentId: string;
  blockId: string;
  lectureId?: string;
  currentQuestionIndex: number;
  answers: Record<string, UserAnswer>;
  questionOrder: string[];
  optionOrder: Record<string, string[]>;
  revealedQuestionIds: string[];
  startedAt: string;
  lastOpenedAt: string;
  mode: QuizMode;
  quickType?: QuickTrainingType;
  fastQuizMode?: FastQuizMode;
  questionTimings?: Record<string, number>;
  confidenceByQuestion?: Record<string, QuestionConfidence>;
  device?: "mobile" | "desktop";
};

export type LoadedAssessment = {
  file: string;
  assessment: Assessment | null;
  errors: string[];
  warnings: string[];
};

export type LoadedAssessmentSummary = {
  file: string;
  assessment: AssessmentSummary | null;
  errors: string[];
  warnings: string[];
};

export type QuizResultRow = {
  question: AssessmentQuestion;
  answer: UserAnswer;
  correct: boolean;
  status: AnswerStatus;
  points: number;
  maxPoints: number;
  correctStatements?: number;
  totalStatements?: number;
  falsePositives?: number;
  falseNegatives?: number;
};
