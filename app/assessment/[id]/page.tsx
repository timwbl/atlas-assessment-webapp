import { AssessmentDetailClient } from "@/components/AssessmentDetailClient";

export default async function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssessmentDetailClient id={id} />;
}
