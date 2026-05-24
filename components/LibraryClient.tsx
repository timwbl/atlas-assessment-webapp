"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountSyncPanel } from "./AccountSyncPanel";
import { AssessmentCard } from "./AssessmentCard";
import { PrivacyNotice } from "./PrivacyNotice";
import { ProgressTools } from "./ProgressTools";
import { loadAssessments } from "@/lib/assessmentClient";
import { collectAssessmentTags } from "@/lib/assessmentValidator";
import { formatBlockLabel } from "@/lib/blockLabels";
import { getAllProgress, PROGRESS_CHANGED_EVENT } from "@/lib/progressStore";
import type { Assessment, AssessmentProgress, LoadedAssessment } from "@/lib/types";

export function LibraryClient() {
  const [loaded, setLoaded] = useState<LoadedAssessment[]>([]);
  const [progress, setProgress] = useState<Record<string, AssessmentProgress>>({});
  const [query, setQuery] = useState("");
  const [block, setBlock] = useState("");
  const [code, setCode] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAssessments()
      .then(setLoaded)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Laden fehlgeschlagen."));
    setProgress(getAllProgress());
  }, []);

  useEffect(() => {
    function updateProgress() {
      setProgress(getAllProgress());
    }

    window.addEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
  }, []);

  const assessments = loaded.map((item) => item.assessment).filter(Boolean) as Assessment[];
  const invalid = loaded.filter((item) => !item.assessment && item.errors.length);

  const blocks = [...new Set(assessments.map((assessment) => assessment.block))]
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" }));
  const codes = [...new Set(assessments.map((assessment) => assessment.lectureCode))]
    .sort((a, b) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" }));
  const tags = [...new Set(assessments.flatMap(collectAssessmentTags))]
    .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assessments.filter((assessment) => {
      const haystack = [
        assessment.title,
        assessment.lectureCode,
        assessment.block,
        assessment.sourceSummary,
        ...collectAssessmentTags(assessment)
      ].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle))
        && (!block || assessment.block === block)
        && (!code || assessment.lectureCode === code)
        && (!tag || collectAssessmentTags(assessment).includes(tag));
    });
  }, [assessments, block, code, query, tag]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, Assessment[]>>((acc, assessment) => {
      acc[assessment.block] = acc[assessment.block] || [];
      acc[assessment.block].push(assessment);
      return acc;
    }, {});
  }, [filtered]);

  return (
    <main id="top" className="shell">
      <header className="glass library-hero rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow">ATLAS Assessment Library</div>
            <h1 className="library-title mt-2 max-w-3xl text-4xl font-black leading-[1.02] md:text-6xl">
              MC Übungsfragen
            </h1>
          </div>
          <ProgressTools onImported={() => setProgress(getAllProgress())} />
        </div>
      </header>

      <div className="mt-5">
        <PrivacyNotice />
      </div>

      <div className="mt-5">
        <AccountSyncPanel onSynced={() => setProgress(getAllProgress())} />
      </div>

      <section className="card mt-5 p-4">
        <div className="assessment-filters grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suchen nach Titel, Code, Tag" />
          <select className="input" value={block} onChange={(event) => setBlock(event.target.value)}>
            <option value="">Alle Blöcke</option>
            {blocks.map((value) => <option key={value} value={value}>{formatBlockLabel(value)}</option>)}
          </select>
          <select className="input" value={code} onChange={(event) => setCode(event.target.value)}>
            <option value="">Alle Codes</option>
            {codes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="input" value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">Alle Tags</option>
            {tags.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </section>

      {error && <div className="card mt-5 border-red-300 p-4 text-red-600">{error}</div>}

      {invalid.length > 0 && (
        <section className="card mt-5 p-4">
          <h2 className="font-black">Validierungsfehler</h2>
          <div className="mt-3 grid gap-2">
            {invalid.map((item) => (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20" key={item.file}>
                <strong>{item.file}</strong>: {item.errors.join(" ")}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-8">
        {Object.entries(grouped).map(([groupBlock, groupAssessments]) => (
          <div key={groupBlock}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black">{formatBlockLabel(groupBlock)}</h2>
              <span className="pill">{groupAssessments.length} Assessments</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groupAssessments.map((assessment) => (
                <AssessmentCard
                  key={assessment.id}
                  assessment={assessment}
                  progress={progress[assessment.id]}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
