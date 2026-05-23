import type { AssessmentQuestion, QuestionOption } from "./types";

const TYPE_A_LABELS = ["A", "B", "C", "D", "E"];
const KPRIM_LABELS = ["A", "B", "C", "D"];

export function createSessionQuestions(questions: AssessmentQuestion[]): AssessmentQuestion[] {
  return questions.map((question) => {
    const labels = question.type === "KPRIM" ? KPRIM_LABELS : TYPE_A_LABELS;
    const shuffledOptions = fisherYatesShuffle(
      question.options.map((option, optionIndex) => ({
        ...option,
        originalId: option.originalId || option.id,
        sessionOptionId: createSessionOptionId(question.id, option, optionIndex)
      }))
    ).map((option, shuffledIndex) => ({
      ...option,
      displayId: labels[shuffledIndex] || String(shuffledIndex + 1)
    }));

    return {
      ...question,
      options: shuffledOptions
    };
  });
}

function fisherYatesShuffle<T>(items: T[]): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function createSessionOptionId(questionId: string, option: QuestionOption, optionIndex: number): string {
  const sourceId = option.originalId || option.id || String(optionIndex);
  return `${questionId}:${sourceId}:${optionIndex}:${randomToken()}`;
}

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
