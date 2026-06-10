import { QuizPageClient } from "@/components/QuizPageClient";
import type { QuickTrainingType, QuizMode } from "@/lib/types";

export default async function QuizPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; resume?: string; quick?: string; limit?: string }>;
}) {
  const { id } = await params;
  const { mode, resume, quick, limit } = await searchParams;
  const parsedMode: QuizMode = mode === "exam" || mode === "review" ? mode : "training";
  const parsedQuick: QuickTrainingType = quick === "wrong" || quick === "marked" || quick === "random"
    ? quick
    : "";
  const parsedLimit = Math.max(0, Math.min(80, Number(limit) || 0));

  return (
    <QuizPageClient
      id={id}
      limit={parsedLimit}
      mode={parsedMode}
      quick={parsedQuick}
      resume={resume === "1"}
    />
  );
}
