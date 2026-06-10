"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ASSESSMENT_REVIEWS_CHANGED_EVENT,
  deleteAssessmentReview,
  loadAdminAssessmentReviews,
  reviewsAvailable,
  setAssessmentReviewApproved,
  type AssessmentReview
} from "@/lib/assessmentReviews";

export function AdminAssessmentReviews() {
  const [reviews, setReviews] = useState<AssessmentReview[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved">("all");
  const [busyId, setBusyId] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    void refresh();

    function onChange() {
      void refresh();
    }

    window.addEventListener(ASSESSMENT_REVIEWS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ASSESSMENT_REVIEWS_CHANGED_EVENT, onChange);
  }, []);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return reviews.filter((review) => {
      if (status === "pending" && review.approved) return false;
      if (status === "approved" && !review.approved) return false;
      if (!needle) return true;
      return [
        review.assessmentTitle,
        review.lectureCode,
        review.userEmail,
        review.displayName,
        review.comment
      ].join(" ").toLowerCase().includes(needle);
    });
  }, [deferredQuery, reviews, status]);

  async function refresh() {
    if (!reviewsAvailable()) return;
    setLoading(true);
    setError("");
    try {
      setReviews(await loadAdminAssessmentReviews());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Bewertungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string, approved: boolean) {
    setBusyId(id);
    setError("");
    try {
      await setAssessmentReviewApproved(id, approved);
      setReviews((current) => current.map((review) => review.id === id ? { ...review, approved } : review));
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Moderation fehlgeschlagen.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(id: string) {
    if (!confirm("Bewertung wirklich löschen?")) return;
    setBusyId(id);
    setError("");
    try {
      await deleteAssessmentReview(id);
      setReviews((current) => current.filter((review) => review.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusyId("");
    }
  }

  if (!reviewsAvailable()) {
    return (
      <section className="card mt-5 p-5">
        <div className="eyebrow">User Bewertungen</div>
        <h2 className="mt-1 text-2xl font-black">Supabase nicht eingerichtet</h2>
      </section>
    );
  }

  return (
    <section className="card admin-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">User Bewertungen</div>
          <h2 className="mt-1 text-2xl font-black">Neueste Assessment-Kommentare</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Kommentare erscheinen erst öffentlich, wenn du sie freigibst.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="input w-full lg:w-72"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Bewertungen suchen"
          />
          <select className="input w-full lg:w-44" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">Alle Status</option>
            <option value="pending">Ausstehend</option>
            <option value="approved">Freigegeben</option>
          </select>
          <button className="btn-secondary" disabled={loading} onClick={() => void refresh()}>Aktualisieren</button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-2xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}

      {loading && reviews.length === 0 ? (
        <div className="admin-loading" aria-label="Bewertungen werden geladen"><span /><span /><span /></div>
      ) : <div className="mt-5 grid gap-3">
        {filtered.map((review) => (
          <article className="admin-review-row" key={review.id}>
            <div className="min-w-0">
              <div className="eyebrow">{review.approved ? "Freigegeben" : "Ausstehend"} · {review.rating}/5 Sterne</div>
              <h3 className="mt-1 font-black">{review.lectureCode} · {review.assessmentTitle}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{review.comment || "Kein Kommentar."}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {review.displayName || review.userEmail} · {new Date(review.updatedAt).toLocaleString("de-CH")}
              </p>
            </div>
            <div className="admin-review-actions">
              <button disabled={busyId === review.id} className={review.approved ? "btn-secondary" : "btn-primary"} onClick={() => void approve(review.id, !review.approved)}>
                {review.approved ? "Zurückziehen" : "Freigeben"}
              </button>
              <button disabled={busyId === review.id} className="btn-danger" onClick={() => void remove(review.id)}>Löschen</button>
            </div>
          </article>
        ))}
        {!filtered.length && <div className="admin-empty-state"><h3>Keine Bewertungen gefunden</h3><p>Es warten keine passenden Kommentare auf Bearbeitung.</p></div>}
      </div>}
    </section>
  );
}
