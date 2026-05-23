import type { AssessmentQuestion, QuestionOption, QuizResultRow, UserAnswer } from "./types";

export function optionKey(option: QuestionOption): string {
  return option.sessionOptionId || option.id;
}

export function optionLabel(option: QuestionOption): string {
  return option.displayId || option.id;
}

export function isQuestionCorrect(question: AssessmentQuestion, answer: UserAnswer | undefined): boolean {
  if (!answer) return false;

  if (question.type === "KPRIM") {
    return question.options.every((option) => answer.kprim?.[optionKey(option)] === option.correct);
  }

  const correct = question.options.find((option) => option.correct);
  return !!correct && optionKey(correct) === answer.selected;
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
