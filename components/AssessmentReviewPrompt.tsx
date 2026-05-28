"use client";

import { useEffect, useState } from "react";
import {
  currentReviewProfile,
  reviewsAvailable,
  submitAssessmentReview
} from "@/lib/assessmentReviews";
import type { Assessment } from "@/lib/types";

type Props = {
  assessment: Assessment;
};

export function AssessmentReviewPrompt({ assessment }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void currentReviewProfile().then((profile) => setLoggedIn(!!profile));
  }, []);

  if (!reviewsAvailable()) return null;

  async function submit() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!rating) throw new Error("Bitte wähle eine Bewertung zwischen 1 und 5 Sternen.");
      await submitAssessmentReview({
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        lectureCode: assessment.lectureCode,
        rating,
        comment
      });
      setMessage("Danke. Deine Bewertung wurde gespeichert. Kommentare erscheinen erst nach Freigabe.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Bewertung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card mt-6 p-5">
      <div className="eyebrow">Feedback</div>
      <h2 className="mt-1 text-2xl font-black">Wie hilfreich waren diese Fragen?</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Deine Sternebewertung hilft anderen. Kommentare werden erst nach Admin-Freigabe öffentlich angezeigt.
      </p>

      {!loggedIn ? (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-500/10 p-3 text-sm text-amber-700">
          Bitte logge dich oben rechts ein, um eine Bewertung abzugeben.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          <div className="review-star-row" aria-label="Bewertung">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                aria-label={`${value} Sterne`}
                className={value <= rating ? "review-star is-active" : "review-star"}
                key={value}
                onClick={() => setRating(value)}
                type="button"
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="input min-h-24 py-3"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Optionaler Kommentar, z. B. prüfungsnah, zu leicht, gute Erklärungen..."
          />
          {error && <p className="rounded-2xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
          {message && <p className="rounded-2xl border border-green-300 bg-green-500/10 p-3 text-sm text-green-700">{message}</p>}
          <button className="btn-primary" disabled={saving} onClick={() => void submit()}>
            {saving ? "Speichert…" : "Bewertung senden"}
          </button>
        </div>
      )}
    </section>
  );
}
