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

export function restoreSessionQuestions(
  questions: AssessmentQuestion[],
  questionOrder: string[],
  optionOrder: Record<string, string[]>
): AssessmentQuestion[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const ordered = questionOrder.map((id) => byId.get(id)).filter(Boolean) as AssessmentQuestion[];

  return ordered.map((question) => {
    const labels = question.type === "KPRIM" ? KPRIM_LABELS : TYPE_A_LABELS;
    const optionsById = new Map(question.options.map((option) => [stableOptionId(option), option]));
    const savedOrder = optionOrder[question.id] || [];
    const options = [
      ...savedOrder.map((id) => optionsById.get(id)).filter(Boolean),
      ...question.options.filter((option) => !savedOrder.includes(stableOptionId(option)))
    ] as QuestionOption[];

    return {
      ...question,
      options: options.map((option, index) => {
        const stableId = stableOptionId(option);
        return {
          ...option,
          originalId: stableId,
          sessionOptionId: stableId,
          displayId: labels[index] || String(index + 1)
        };
      })
    };
  });
}

function stableOptionId(option: QuestionOption): string {
  return option.originalId || option.id;
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
