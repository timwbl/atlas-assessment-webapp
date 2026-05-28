"use client";

import { useEffect, useState } from "react";
import {
  allRecommendationBlocks,
  BLOCK_RECOMMENDATIONS_CHANGED_EVENT,
  emptyRecommendation,
  loadBlockRecommendations,
  saveBlockRecommendation,
  type BlockRecommendation
} from "@/lib/blockRecommendations";

export function AdminBlockRecommendations() {
  const [recommendations, setRecommendations] = useState<Record<string, BlockRecommendation>>({});
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void refresh();

    function onChange() {
      void refresh();
    }

    window.addEventListener(BLOCK_RECOMMENDATIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(BLOCK_RECOMMENDATIONS_CHANGED_EVENT, onChange);
  }, []);

  async function refresh() {
    setRecommendations(await loadBlockRecommendations());
  }

  function updateDraft(id: string, next: BlockRecommendation) {
    setRecommendations((current) => ({ ...current, [id]: next }));
  }

  async function save(item: BlockRecommendation) {
    setSavingId(item.id);
    setError("");
    setMessage("");

    try {
      const saved = await saveBlockRecommendation(item);
      setRecommendations((current) => ({ ...current, [saved.id]: saved }));
      setMessage(`${saved.blockTitle} gespeichert.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Empfehlung konnte nicht gespeichert werden.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="card mt-5 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="eyebrow">Admin Empfehlungen</div>
          <h2 className="mt-1 text-2xl font-black">Block-Bewertungen für MC-Fragen</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Bewerte pro Block von 1 bis 10 und schreibe einen kurzen Kommentar, damit User besser einschätzen können, welche Fragen sich besonders lohnen.
          </p>
        </div>
      </div>

      {error && <p className="mt-4 rounded-2xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 rounded-2xl border border-green-300 bg-green-500/10 p-3 text-sm text-green-700">{message}</p>}

      <div className="mt-5 grid gap-3">
        {allRecommendationBlocks().map((block) => {
          const current = recommendations[`${block.semester}:${block.blockId}`]
            || emptyRecommendation(block.semester, block.blockId, block.blockTitle);

          return (
            <article className="recommendation-editor-row" key={current.id}>
              <div className="min-w-0">
                <div className="eyebrow">{block.semesterTitle}</div>
                <h3 className="mt-1 text-xl font-black">{block.blockTitle}</h3>
              </div>

              <label className="min-w-0">
                <span className="eyebrow">Bewertung</span>
                <select
                  className="input mt-2"
                  value={current.rating ?? ""}
                  onChange={(event) => updateDraft(current.id, {
                    ...current,
                    rating: event.target.value ? Number(event.target.value) : null
                  })}
                >
                  <option value="">Noch keine</option>
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>{value}/10</option>
                  ))}
                </select>
              </label>

              <label className="min-w-0">
                <span className="eyebrow">Kommentar</span>
                <textarea
                  className="input mt-2 min-h-20 py-3"
                  value={current.comment}
                  onChange={(event) => updateDraft(current.id, { ...current, comment: event.target.value })}
                  placeholder="z. B. Sehr prüfungsnah, besonders Blockverständnis und typische Fallen."
                />
              </label>

              <button className="btn-primary" disabled={savingId === current.id} onClick={() => void save(current)}>
                {savingId === current.id ? "Speichert…" : "Speichern"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
