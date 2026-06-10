export type QuestionType = "A" | "KPRIM";

export type SourceReliability = "high" | "medium" | "low" | "insufficient_source";

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
};

export type Assessment = {
  id: string;
  lectureCode: string;
  title: string;
  block: string;
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
