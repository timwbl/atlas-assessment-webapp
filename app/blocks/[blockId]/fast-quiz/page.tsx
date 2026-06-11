import { FastQuizClient } from "@/components/FastQuizClient";
import type { FastQuizMode } from "@/lib/types";

export default async function BlockFastQuizPage({
  params,
  searchParams
}: {
  params: Promise<{ blockId: string }>;
  searchParams: Promise<{ mode?: string; start?: string; resume?: string }>;
}) {
  const { blockId } = await params;
  const query = await searchParams;
  const mode: FastQuizMode = query.mode === "weakness" || query.mode === "readiness"
    ? query.mode
    : "pulse";

  return (
    <FastQuizClient
      autoStart={query.start === "1"}
      blockId={blockId}
      initialMode={mode}
      resume={query.resume === "1"}
    />
  );
}
