import type { AssessmentQuestion, QuizResultRow, UserAnswer } from "./types";

export function isQuestionCorrect(question: AssessmentQuestion, answer: UserAnswer | undefined): boolean {
  if (!answer) return false;

  if (question.type === "KPRIM") {
    return question.options.every((option) => answer.kprim?.[option.id] === option.correct);
  }

  return question.options.find((option) => option.correct)?.id === answer.selected;
}

export function answerLabel(question: AssessmentQuestion, answer: UserAnswer | undefined): string {
  if (!answer) return "nicht beantwortet";

  if (question.type === "KPRIM") {
    return question.options.map((option) => {
      const value = answer.kprim?.[option.id];
      const label = typeof value === "boolean" ? (value ? "richtig" : "falsch") : "-";
      return `${option.id}: ${label}`;
    }).join(" · ");
  }

  const selected = question.options.find((option) => option.id === answer.selected);
  return selected ? `${selected.id}: ${selected.text}` : "nicht beantwortet";
}

export function correctAnswerLabel(question: AssessmentQuestion): string {
  if (question.type === "KPRIM") {
    return question.options.map((option) => `${option.id}: ${option.correct ? "richtig" : "falsch"}`).join(" · ");
  }

  const correct = question.options.find((option) => option.correct);
  return correct ? `${correct.id}: ${correct.text}` : "keine Lösung markiert";
}

export function buildResultRows(
  questions: AssessmentQuestion[],
  answers: Record<string, UserAnswer>
): QuizResultRow[] {
  return questions.map((question) => ({
    question,
    answer: answers[question.id] || {},
    correct: isQuestionCorrect(question, answers[question.id])
  }));
}

export function scorePercent(rows: QuizResultRow[]): number {
  if (!rows.length) return 0;
  return Math.round((rows.filter((row) => row.correct).length / rows.length) * 100);
}
