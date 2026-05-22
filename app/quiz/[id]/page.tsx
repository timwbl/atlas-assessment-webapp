import { QuizPageClient } from "@/components/QuizPageClient";
import type { QuizMode } from "@/lib/types";

export default async function QuizPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { id } = await params;
  const { mode } = await searchParams;
  const parsedMode: QuizMode = mode === "exam" || mode === "review" ? mode : "training";

  return <QuizPageClient id={id} mode={parsedMode} />;
}
