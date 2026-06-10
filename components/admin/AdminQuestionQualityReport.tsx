"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { loadActiveAssessments } from "@/lib/assessmentClient";
import { isAltfragenAssessment } from "@/lib/altfragenAccess";
import { examForContent } from "@/lib/studyProgram";
import {
  analyzeAssessmentQuality,
  bloomLabel,
  difficultyLabel,
  qualityFlagLabel,
  QUESTION_QUALITY_FLAGS,
  type QuestionQualityAnalysis,
  type QuestionQualityFlag
} from "@/lib/questionQuality";
import {
  loadQuestionQualityReviews,
  qualityReviewKey,
  saveQuestionQualityReview,
  setAdminQuestionTarget,
  type StoredQuestionQualityReview
} from "@/lib/questionQualityReviewStore";
import type {
  Assessment,
  QuestionReviewStatus
} from "@/lib/types";
import type { AdminView } from "./AdminWorkspace";

type QualityRow = QuestionQualityAnalysis & { assessment: Assessment };

export function AdminQuestionQualityReport({
  onNavigate
}: {
  onNavigate: (view: AdminView) => void;
}) {
  const [rows, setRows] = useState<QualityRow[]>([]);
  const [reviews, setReviews] = useState<Record<string, StoredQuestionQualityReview>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [block, setBlock] = useState("all");
  const [exam, setExam] = useState("all");
  const [type, setType] = useState("all");
  const [flag, setFlag] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [status, setStatus] = useState("needs_review");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const assessments = await loadActiveAssessments();
      setRows(assessments.flatMap((assessment) => (
        analyzeAssessmentQuality(assessment).questions.map((analysis) => ({ ...analysis, assessment }))
      )));
      setReviews(loadQuestionQualityReviews());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Qualitätsreport konnte nicht erstellt werden.");
    } finally {
      setLoading(false);
    }
  }

  const enriched = useMemo(() => rows.map((row) => {
    const review = reviews[qualityReviewKey(row.assessmentId, row.questionId)];
    const reviewedFlags = new Set([
      ...(row.assessment.questions[row.questionIndex]?.reviewedQualityFlags || []),
      ...(review?.reviewedFlags || [])
    ]);
    return {
      ...row,
      reviewStatus: review?.reviewStatus || row.reviewStatus,
      activeFlags: row.flags.filter((item) => !reviewedFlags.has(item))
    };
  }), [reviews, rows]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return enriched
      .filter((row) => block === "all" || row.blockId === block)
      .filter((row) => exam === "all" || examForContent(row.assessment) === exam)
      .filter((row) => type === "all" || row.questionType === type)
      .filter((row) => flag === "all" || row.activeFlags.includes(flag as QuestionQualityFlag))
      .filter((row) => difficulty === "all" || row.difficulty === difficulty)
      .filter((row) => status === "all" || row.reviewStatus === status)
      .filter((row) => !needle || [
        row.stem,
        row.lectureCode,
        row.assessmentTitle,
        row.questionId,
        row.concepts.join(" ")
      ].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => (
        severityScore(b) - severityScore(a)
        || blockNumber(a.blockId) - blockNumber(b.blockId)
        || a.lectureCode.localeCompare(b.lectureCode, "de")
        || a.questionIndex - b.questionIndex
      ));
  }, [block, deferredQuery, difficulty, enriched, exam, flag, status, type]);

  const stats = useMemo(() => {
    const kprim = enriched.filter((row) => row.questionType === "KPRIM");
    return {
      total: enriched.length,
      kprim: kprim.length,
      allTrue: kprim.filter((row) => row.flags.includes("all_true_kprim")).length,
      allFalse: kprim.filter((row) => row.flags.includes("all_false_kprim")).length,
      needsReview: enriched.filter((row) => row.reviewStatus === "needs_review" || row.activeFlags.length).length
    };
  }, [enriched]);

  const blockSummary = useMemo(() => {
    const values = new Map<string, { blockId: string; total: number; flagged: number; allTrue: number }>();
    enriched.forEach((row) => {
      const blockId = row.blockId || "unmapped";
      const current = values.get(blockId) || { blockId, total: 0, flagged: 0, allTrue: 0 };
      current.total += 1;
      if (row.activeFlags.length) current.flagged += 1;
      if (row.activeFlags.includes("all_true_kprim")) current.allTrue += 1;
      values.set(blockId, current);
    });
    return [...values.values()].sort((a, b) => (
      b.flagged / Math.max(1, b.total) - a.flagged / Math.max(1, a.total)
    ));
  }, [enriched]);

  function updateReview(row: QualityRow, reviewStatus: QuestionReviewStatus, reviewAll = false) {
    const previous = reviews[qualityReviewKey(row.assessmentId, row.questionId)];
    const saved = saveQuestionQualityReview(row.assessmentId, row.questionId, {
      reviewStatus,
      reviewedFlags: reviewAll ? row.flags : previous?.reviewedFlags || []
    });
    setReviews((current) => ({
      ...current,
      [qualityReviewKey(row.assessmentId, row.questionId)]: saved
    }));
  }

  function reviewFlag(row: QualityRow, reviewedFlag: QuestionQualityFlag) {
    const previous = reviews[qualityReviewKey(row.assessmentId, row.questionId)];
    const saved = saveQuestionQualityReview(row.assessmentId, row.questionId, {
      reviewStatus: previous?.reviewStatus || row.reviewStatus,
      reviewedFlags: [...new Set([...(previous?.reviewedFlags || []), reviewedFlag])]
    });
    setReviews((current) => ({
      ...current,
      [qualityReviewKey(row.assessmentId, row.questionId)]: saved
    }));
  }

  function openQuestion(row: QualityRow) {
    setAdminQuestionTarget(row.assessmentId, row.questionId);
    onNavigate(isAltfragenAssessment(row.assessment) ? "altfragen" : "assessments");
  }

  if (loading) {
    return <div className="admin-loading card" aria-label="Fragenqualität wird analysiert"><span /><span /><span /></div>;
  }

  return (
    <div>
      <section className="card admin-panel">
        <div className="admin-section-heading">
          <div>
            <div className="eyebrow">Question Intelligence</div>
            <h2>Fragenqualität</h2>
            <p>Automatische Qualitätsprüfung aller bestehenden Fragen. Die Analyse markiert nur und verändert keine Inhalte.</p>
          </div>
          <button className="btn-secondary" onClick={() => void load()} type="button">Neu analysieren</button>
        </div>

        <div className="admin-stat-grid admin-stat-grid--quality">
          <QualityStat label="Fragen total" value={stats.total} />
          <QualityStat label="K-Prim" value={stats.kprim} />
          <QualityStat label="K-Prim 4/0" value={stats.allTrue} warning={stats.allTrue > 0} />
          <QualityStat label="K-Prim 0/4" value={stats.allFalse} warning={stats.allFalse > 0} />
          <QualityStat label="Reviewbedarf" value={stats.needsReview} warning={stats.needsReview > 0} />
        </div>

        <div className="admin-quality-blocks">
          {blockSummary.map((item) => (
            <button
              className={block === item.blockId ? "is-active" : ""}
              key={item.blockId}
              onClick={() => setBlock(block === item.blockId ? "all" : item.blockId)}
              type="button"
            >
              <span>{item.blockId === "unmapped" ? "Ohne Block" : `Block ${blockNumber(item.blockId)}`}</span>
              <strong>{item.flagged}/{item.total}</strong>
              {["block7", "block8", "block9"].includes(item.blockId) && item.allTrue > 0 && (
                <small>{item.allTrue} × alle richtig</small>
              )}
            </button>
          ))}
        </div>

        <div className="admin-quality-filters">
          <label className="admin-filter-search">
            <span>Suche</span>
            <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Frage, Code oder Konzept" />
          </label>
          <Filter label="Block" value={block} onChange={setBlock} options={[
            ["all", "Alle Blöcke"],
            ...Array.from({ length: 9 }, (_, index) => (
              [`block${index + 1}`, `Block ${index + 1}`] as [string, string]
            ))
          ]} />
          <Filter label="Prüfung" value={exam} onChange={setExam} options={[
            ["all", "Alle Prüfungen"], ["eMC1", "eMC1"], ["eMC2", "eMC2"], ["eMC3", "eMC3"], ["eMC4", "eMC4"]
          ]} />
          <Filter label="Fragetyp" value={type} onChange={setType} options={[
            ["all", "Alle Typen"], ["A", "Typ A"], ["KPRIM", "K-Prim"]
          ]} />
          <Filter label="Quality Flag" value={flag} onChange={setFlag} options={[
            ["all", "Alle Flags"],
            ...QUESTION_QUALITY_FLAGS.map((item) => [item, qualityFlagLabel(item)] as [string, string])
          ]} />
          <Filter label="Schwierigkeit" value={difficulty} onChange={setDifficulty} options={[
            ["all", "Alle"], ["easy", "Einfach"], ["medium", "Mittel"], ["hard", "Schwierig"], ["very_hard", "Sehr schwierig"]
          ]} />
          <Filter label="Review Status" value={status} onChange={setStatus} options={[
            ["all", "Alle"], ["draft", "Entwurf"], ["needs_review", "Review nötig"], ["reviewed", "Geprüft"], ["verified", "Verifiziert"]
          ]} />
        </div>
      </section>

      {error && <div className="admin-alert admin-alert--error">{error}</div>}

      <section className="card admin-quality-list">
        <div className="admin-quality-list-heading">
          <strong>{filtered.length} Fragen</strong>
          <span>Schwächste und kritischste Fragen zuerst</span>
        </div>
        {filtered.slice(0, 400).map((row) => (
          <article key={`${row.assessmentId}:${row.questionId}`}>
            <div className="admin-quality-row-head">
              <div>
                <span>{row.blockId ? `Block ${blockNumber(row.blockId)}` : "Ohne Block"} · {row.lectureCode} · Frage {row.questionIndex + 1}</span>
                <h3>{row.stem}</h3>
              </div>
              <span className={`admin-quality-status is-${row.reviewStatus}`}>{reviewStatusLabel(row.reviewStatus)}</span>
            </div>
            <div className="admin-quality-meta">
              <span>{row.questionType === "KPRIM" ? "K-Prim" : "Typ A"}</span>
              <span>{difficultyLabel(row.difficulty)}</span>
              <span>{bloomLabel(row.bloomLevel)}</span>
              {row.kprimDistribution && <span>{row.kprimDistribution.correct} richtig / {row.kprimDistribution.incorrect} falsch</span>}
            </div>
            <div className="admin-quality-flags">
              {row.activeFlags.map((item) => (
                <button
                  key={item}
                  onClick={() => reviewFlag(row, item)}
                  title="Diesen Flag als geprüft markieren"
                  type="button"
                >
                  {qualityFlagLabel(item)} <span aria-hidden="true">×</span>
                </button>
              ))}
              {!row.activeFlags.length && <span className="is-clear">Alle Flags geprüft</span>}
            </div>
            <div className="admin-quality-actions">
              <button className="btn-primary" onClick={() => openQuestion(row)} type="button">Frage öffnen</button>
              <select
                className="input"
                value={row.reviewStatus}
                onChange={(event) => updateReview(row, event.target.value as QuestionReviewStatus)}
              >
                <option value="draft">Entwurf</option>
                <option value="needs_review">Review nötig</option>
                <option value="reviewed">Geprüft</option>
                <option value="verified">Verifiziert</option>
              </select>
              {!!row.activeFlags.length && (
                <button className="btn-secondary" onClick={() => updateReview(row, "reviewed", true)} type="button">
                  Flags als geprüft markieren
                </button>
              )}
            </div>
          </article>
        ))}
        {filtered.length > 400 && (
          <div className="admin-quality-limit-note">
            400 von {filtered.length} Treffern angezeigt. Nutze die Filter, um den Reviewbereich weiter einzugrenzen.
          </div>
        )}
        {!filtered.length && (
          <div className="admin-empty-state">
            <h3>Keine Fragen gefunden</h3>
            <p>Für diese Filterkombination besteht kein offener Qualitätsbefund.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function QualityStat({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={`admin-quality-stat ${warning ? "is-warning" : ""}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString("de-CH")}</strong>
    </div>
  );
}

function Filter(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <select className="input" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
  );
}

function severityScore(row: QuestionQualityAnalysis): number {
  const critical = row.activeFlags.filter((flag) => (
    flag === "all_true_kprim"
    || flag === "all_false_kprim"
    || flag === "ambiguous_answer"
    || flag === "missing_explanation"
  )).length;
  return critical * 10 + row.activeFlags.length;
}

function blockNumber(blockId: string | null): number {
  return Number(blockId?.replace(/\D/g, "")) || 99;
}

function reviewStatusLabel(status: QuestionReviewStatus): string {
  if (status === "verified") return "Verifiziert";
  if (status === "reviewed") return "Geprüft";
  if (status === "draft") return "Entwurf";
  return "Review nötig";
}
