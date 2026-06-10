"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AltfragenAccessPanel } from "./AltfragenAccessPanel";
import { AssessmentCard } from "./AssessmentCard";
import { useUserStudyContext } from "./study/UserStudyProvider";
import {
  ALTFRAGEN_ACCESS_CHANGED_EVENT,
  canAccessAltfragen
} from "@/lib/altfragenAccess";
import { loadAssessmentSummaries } from "@/lib/assessmentClient";
import { getAllProgress, PROGRESS_CHANGED_EVENT } from "@/lib/progressStore";
import {
  blockIdForContent,
  examForContent,
  examsForSemester,
  isAltfragenValue,
  isThreeDContent,
  type ExamId
} from "@/lib/studyProgram";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import type {
  AssessmentProgress,
  AssessmentSummary,
  LoadedAssessmentSummary
} from "@/lib/types";

type Scope = "all" | "current" | ExamId;

export function AltfragenLibrary() {
  const { settings } = useUserStudyContext();
  const [loaded, setLoaded] = useState<LoadedAssessmentSummary[]>([]);
  const [progress, setProgress] = useState<Record<string, AssessmentProgress>>({});
  const [access, setAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [scope, setScope] = useState<Scope>("current");
  const [blockId, setBlockId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAssessmentSummaries()
      .then(setLoaded)
      .catch((loadError: unknown) => setError(
        loadError instanceof Error ? loadError.message : "Altfragen konnten nicht geladen werden."
      ));
    setProgress(getAllProgress());

    function updateProgress() {
      setProgress(getAllProgress());
    }

    window.addEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, updateProgress);
  }, []);

  useEffect(() => {
    async function refreshAccess() {
      setCheckingAccess(true);
      setAccess(await canAccessAltfragen().catch(() => false));
      setCheckingAccess(false);
    }

    void refreshAccess();
    window.addEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, refreshAccess);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshAccess);
    window.addEventListener("storage", refreshAccess);
    return () => {
      window.removeEventListener(ALTFRAGEN_ACCESS_CHANGED_EVENT, refreshAccess);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshAccess);
      window.removeEventListener("storage", refreshAccess);
    };
  }, []);

  const assessments = useMemo(
    () => loaded
      .map((item) => item.assessment)
      .filter((assessment): assessment is AssessmentSummary => (
        !!assessment
        && isAltfragenValue(assessment.block)
        && !isThreeDContent(assessment)
      )),
    [loaded]
  );

  const currentExams = useMemo(
    () => settings.studyYear === "year1" ? examsForSemester(settings.semester) : [],
    [settings.semester, settings.studyYear]
  );
  const blockOptions = useMemo(
    () => [...new Set(assessments.map(blockIdForContent).filter((value): value is string => !!value))]
      .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))),
    [assessments]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assessments.filter((assessment) => {
      const exam = examForContent(assessment);
      const assessmentBlock = blockIdForContent(assessment);
      const scopeMatches = scope === "all"
        || (scope === "current" && (currentExams.length === 0 || (!!exam && currentExams.includes(exam))))
        || scope === exam;
      const queryMatches = !needle || [
        assessment.title,
        assessment.lectureCode,
        assessment.sourceSummary,
        ...assessment.tags
      ].join(" ").toLowerCase().includes(needle);
      return scopeMatches
        && queryMatches
        && (!blockId || assessmentBlock === blockId);
    });
  }, [assessments, blockId, currentExams, query, scope]);

  return (
    <main className="shell" id="top">
      <header className="glass library-hero rounded-[28px] p-6 md:p-8">
        <p className="eyebrow">Prüfungsnahes Training</p>
        <h1 className="library-title mt-2 max-w-3xl text-4xl font-black leading-[1.02] md:text-6xl">
          Altfragen
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          Separater Fragenpool für prüfungsnahe Wiederholung. Filtere nach aktueller Lernphase, eMC oder Block.
        </p>
      </header>
      <nav className="mobile-library-tabs mobile-only" aria-label="Fragenbereiche">
        <Link href="/assessments">Assessments</Link>
        <Link className="is-active" href="/altfragen">Altfragen</Link>
      </nav>

      {checkingAccess ? (
        <section className="card mt-5 p-5 text-[var(--muted)]">Zugriff wird geprüft…</section>
      ) : !access ? (
        <div className="mt-5">
          <AltfragenAccessPanel onUnlocked={() => setAccess(true)} />
        </div>
      ) : (
        <>
          <section className="card mt-5 p-4">
            <div className="study-filter-chips altfragen-scope-tabs" aria-label="Altfragen filtern">
              <button className={scope === "all" ? "is-active" : ""} onClick={() => setScope("all")} type="button">
                Alle Altfragen
              </button>
              <button className={scope === "current" ? "is-active" : ""} onClick={() => setScope("current")} type="button">
                Aktuelles Semester
              </button>
              {(["eMC1", "eMC2", "eMC3", "eMC4"] as ExamId[]).map((exam) => (
                <button className={scope === exam ? "is-active" : ""} key={exam} onClick={() => setScope(exam)} type="button">
                  {exam}
                </button>
              ))}
            </div>
            <div className="assessment-filters mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <input
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                className="input"
                inputMode="search"
                name="atlas-altfragen-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Altfragen suchen"
                spellCheck={false}
                type="search"
                value={query}
              />
              <select className="input" onChange={(event) => setBlockId(event.target.value)} value={blockId}>
                <option value="">Alle Blöcke</option>
                {blockOptions.map((value) => (
                  <option key={value} value={value}>Block {value.replace(/\D/g, "")}</option>
                ))}
              </select>
            </div>
          </section>

          {error && <div className="card mt-5 border-red-300 p-4 text-red-600">{error}</div>}

          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Auswahl</p>
                <h2 className="text-3xl font-black">{scopeLabel(scope)}</h2>
              </div>
              <span className="pill">{filtered.length} Assessments</span>
            </div>
            {filtered.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((assessment) => (
                  <AssessmentCard
                    assessment={assessment}
                    key={assessment.id}
                    progress={progress[assessment.id]}
                  />
                ))}
              </div>
            ) : (
              <div className="card p-8 text-center">
                <h3 className="text-2xl font-black">Keine passenden Altfragen</h3>
                <p className="mt-2 text-[var(--muted)]">
                  Für diese Auswahl sind aktuell keine korrekt zugeordneten Altfragen vorhanden.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function scopeLabel(scope: Scope): string {
  if (scope === "all") return "Alle Altfragen";
  if (scope === "current") return "Aktuelles Semester";
  return scope;
}
