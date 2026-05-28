"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ASSESSMENT_REVIEWS_CHANGED_EVENT,
  averageReviewRating,
  loadApprovedAssessmentReviews,
  type AssessmentReview
} from "@/lib/assessmentReviews";

type Props = {
  assessmentId: string;
};

export function AssessmentPublicReviews({ assessmentId }: Props) {
  const [reviews, setReviews] = useState<AssessmentReview[]>([]);

  useEffect(() => {
    void refresh();

    function onChange() {
      void refresh();
    }

    window.addEventListener(ASSESSMENT_REVIEWS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ASSESSMENT_REVIEWS_CHANGED_EVENT, onChange);

    async function refresh() {
      setReviews(await loadApprovedAssessmentReviews(assessmentId));
    }
  }, [assessmentId]);

  const average = useMemo(() => averageReviewRating(reviews), [reviews]);
  const comments = reviews.filter((review) => review.comment.trim()).slice(0, 5);

  if (!reviews.length) return null;

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">User Feedback</div>
          <h2 className="mt-1 text-2xl font-black">
            {average ? `${average}/5 Sterne` : "Bewertungen"}
          </h2>
        </div>
        <span className="pill">{reviews.length} Bewertung{reviews.length === 1 ? "" : "en"}</span>
      </div>

      {comments.length > 0 && (
        <div className="mt-4 grid gap-3">
          {comments.map((review) => (
            <article className="public-review" key={review.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{review.displayName || "Anonymer Account"}</strong>
                <span className="text-sm text-[var(--muted)]">{review.rating}/5 Sterne</span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{review.comment}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
