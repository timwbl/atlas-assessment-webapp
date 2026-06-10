"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatBlockLabel } from "@/lib/blockLabels";
import { useMobileLearningData } from "./useMobileLearningData";

export function MobileAssessments() {
  const data = useMobileLearningData();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.assessments.filter((assessment) => !needle || [
      assessment.title,
      assessment.lectureCode,
      assessment.block
    ].join(" ").toLowerCase().includes(needle));
  }, [data.assessments, query]);

  return (
    <main className="mobile-action-page mobile-only" id="top">
      <header className="mobile-action-header">
        <p className="eyebrow">Assessments</p>
        <h1>Fragen auswählen</h1>
        <p>Nach Titel, KV oder Block suchen.</p>
      </header>
      <input
        autoComplete="off"
        className="mobile-assessment-search"
        inputMode="search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Assessment suchen"
        type="search"
        value={query}
      />
      <section className="mobile-assessment-list">
        {filtered.map((assessment) => {
          const progress = data.progress[assessment.id];
          const seen = Object.values(progress?.questionStats || {}).filter((stat) => stat.seen > 0).length;
          return (
            <Link className="mobile-assessment-row" href={`/assessment/${assessment.id}`} key={assessment.id}>
              <div>
                <span>{formatBlockLabel(assessment.block)} · {assessment.lectureCode}</span>
                <strong>{assessment.title}</strong>
                <small>{assessment.questions.length} Fragen · {seen} gesehen</small>
              </div>
              <b aria-hidden="true">›</b>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
