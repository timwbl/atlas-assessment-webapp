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
  total: number;
  startedAt: string;
  completedAt: string;
  answers: Record<string, UserAnswer>;
  wrongQuestionIds: string[];
};

export type AssessmentProgress = {
  assessmentId: string;
  attempts: QuizAttempt[];
  questionStats: Record<string, QuestionStat>;
  bestScore: number;
  lastScore: number | null;
  lastAttemptAt?: string;
  errorTags: Record<string, number>;
};

export type LoadedAssessment = {
  file: string;
  assessment: Assessment | null;
  errors: string[];
  warnings: string[];
};

export type QuizResultRow = {
  question: AssessmentQuestion;
  answer: UserAnswer;
  correct: boolean;
};
