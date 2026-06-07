import type {
  AnswerStatus,
  AssessmentQuestion,
  QuestionOption,
  QuizResultRow,
  StoredQuestionResult,
  UserAnswer
} from "./types";

export function optionKey(option: QuestionOption): string {
  return option.sessionOptionId || option.id;
}

export function optionLabel(option: QuestionOption): string {
  return option.displayId || option.id;
}

export function isQuestionCorrect(question: AssessmentQuestion, answer: UserAnswer | undefined): boolean {
  return evaluateQuestion(question, answer).status === "correct";
}

export function answerLabel(question: AssessmentQuestion, answer: UserAnswer | undefined): string {
  if (!answer) return "nicht beantwortet";

  if (question.type === "KPRIM") {
    return question.options.map((option) => {
      const value = answer.kprim?.[optionKey(option)];
      const label = typeof value === "boolean" ? (value ? "richtig" : "falsch") : "-";
      return `${optionLabel(option)}: ${label}`;
    }).join(" · ");
  }

  const selected = question.options.find((option) => optionKey(option) === answer.selected);
  return selected ? `${optionLabel(selected)}: ${selected.text}` : "nicht beantwortet";
}

export function correctAnswerLabel(question: AssessmentQuestion): string {
  if (question.type === "KPRIM") {
    return question.options.map((option) => `${optionLabel(option)}: ${option.correct ? "richtig" : "falsch"}`).join(" · ");
  }

  const correct = question.options.find((option) => option.correct);
  return correct ? `${optionLabel(correct)}: ${correct.text}` : "keine Lösung markiert";
}

export function buildResultRows(
  questions: AssessmentQuestion[],
  answers: Record<string, UserAnswer>
): QuizResultRow[] {
  return questions.map((question) => {
    const answer = answers[question.id] || {};
    const evaluation = evaluateQuestion(question, answer);
    return {
      question,
      answer,
      correct: evaluation.status === "correct",
      ...evaluation
    };
  });
}

export function scorePercent(rows: QuizResultRow[]): number {
  if (!rows.length) return 0;
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  const maxPoints = rows.reduce((sum, row) => sum + row.maxPoints, 0);
  return maxPoints ? Math.round((points / maxPoints) * 100) : 0;
}

export function evaluateQuestion(
  question: AssessmentQuestion,
  answer: UserAnswer | undefined
): Omit<QuizResultRow, "question" | "answer" | "correct"> {
  if (question.type === "KPRIM") {
    let correctStatements = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    question.options.forEach((option) => {
      const chosen = answer?.kprim?.[optionKey(option)];
      if (chosen === option.correct) correctStatements += 1;
      else if (chosen === true && option.correct === false) falsePositives += 1;
      else if (chosen === false && option.correct === true) falseNegatives += 1;
      else if (typeof chosen !== "boolean" && option.correct) falseNegatives += 1;
    });

    const totalStatements = question.options.length;
    const status: AnswerStatus = correctStatements === totalStatements
      ? "correct"
      : correctStatements > 0
        ? "partial"
        : "incorrect";
    const points = correctStatements === totalStatements
      ? 1
      : correctStatements === totalStatements - 1
        ? 0.5
        : 0;

    return {
      status,
      points,
      maxPoints: 1,
      correctStatements,
      totalStatements,
      falsePositives,
      falseNegatives
    };
  }

  const correct = question.options.find((option) => option.correct);
  const isCorrect = !!correct && optionKey(correct) === answer?.selected;
  return {
    status: isCorrect ? "correct" : "incorrect",
    points: isCorrect ? 1 : 0,
    maxPoints: 1
  };
}

export function stableAnswer(question: AssessmentQuestion, answer: UserAnswer): UserAnswer {
  if (question.type === "KPRIM") {
    const values = answer.kprim || {};
    return {
      kprim: question.options.reduce<Record<string, boolean>>((acc, option) => {
        const value = values[optionKey(option)];
        if (typeof value === "boolean") acc[stableOptionId(option)] = value;
        return acc;
      }, {})
    };
  }

  const selected = question.options.find((option) => optionKey(option) === answer.selected);
  return selected ? { selected: stableOptionId(selected) } : {};
}

export function toStoredQuestionResult(row: QuizResultRow): StoredQuestionResult {
  return {
    questionId: row.question.id,
    answer: stableAnswer(row.question, row.answer),
    optionOrder: row.question.options.map(stableOptionId),
    status: row.status,
    points: row.points,
    maxPoints: row.maxPoints,
    correctStatements: row.correctStatements,
    totalStatements: row.totalStatements
  };
}

export function stableOptionId(option: QuestionOption): string {
  return option.originalId || option.id;
}
