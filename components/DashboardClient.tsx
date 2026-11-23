"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AtlasIcon, type AtlasIconName } from "@/components/AtlasIcon";
import { ProgressTools } from "@/components/ProgressTools";
import { useMobileLearningData } from "@/components/mobile/useMobileLearningData";
import { useUserStudyContext } from "@/components/study/UserStudyProvider";
import { formatBlockLabel } from "@/lib/blockLabels";
import { cloudSyncAvailable, getCurrentProfile, getCurrentUser } from "@/lib/cloudProgress";
import { AUTH_SESSION_CHANGED_EVENT } from "@/lib/supabaseClient";
import {
  examForBlock,
  matchesStudyProfile,
  semesterHeading,
  semesterPeriod,
  settingsForSemester
} from "@/lib/studyProgram";
import type { AssessmentProgress, AssessmentSummary } from "@/lib/types";

const NAME_KEY = "atlas-user-display-name";
const PROFILE_NAME_CHANGED_EVENT = "atlas-profile-name-changed";

type DashboardAction = {
  title: string;
  description: string;
  href: string;
  icon: AtlasIconName;
  meta?: string;
  disabled?: boolean;
};

type ActivityRow = {
  assessment: AssessmentSummary;
  progress: AssessmentProgress;
  seen: number;
  wrong: number;
  marked: number;
  lastActivity: number;
};

type DashboardScope = {
  recentAssessment: AssessmentSummary | null;
  wrongTarget: AssessmentSummary | null;
  markedTarget: AssessmentSummary | null;
  wrongCount: number;
  markedCount: number;
  seenCount: number;
  totalQuestions: number;
};

export function DashboardClient() {
  const data = useMobileLearningData();
  const { contentSettings: settings, isAdmin } = useUserStudyContext();
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    let active = true;

    async function refreshGreeting() {
      if (!cloudSyncAvailable()) {
        if (active) setFirstName("");
        return;
      }
      try {
        const user = await getCurrentUser();
        if (!user) {
          if (active) setFirstName("");
          return;
        }
        const profile = await getCurrentProfile(user);
        const displayName = profile?.display_name?.trim() || window.localStorage.getItem(NAME_KEY)?.trim() || "";
        if (active) setFirstName(displayName.split(/\s+/)[0] || "");
      } catch {
        if (active) setFirstName("");
      }
    }

    void refreshGreeting();
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshGreeting);
    window.addEventListener(PROFILE_NAME_CHANGED_EVENT, refreshGreeting);
    return () => {
      active = false;
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshGreeting);
      window.removeEventListener(PROFILE_NAME_CHANGED_EVENT, refreshGreeting);
    };
  }, []);
  const scopedSettings = useMemo(() => {
    if (isAdmin || (settings.studyYear && settings.semester)) return settings;
    const current = semesterPeriod();
    return current ? settingsForSemester(settings, current.semester, "year1") : settings;
  }, [isAdmin, settings]);
  const scopedAssessments = useMemo(
    () => data.allAssessments.filter((assessment) => matchesStudyProfile(assessment, scopedSettings)),
    [data.allAssessments, scopedSettings]
  );
  const scopedData = useMemo(
    () => deriveDashboardScope(scopedAssessments, data.progress),
    [data.progress, scopedAssessments]
  );

  const recentRows = useMemo<ActivityRow[]>(() => {
    return scopedAssessments
      .map((assessment) => {
        const progress = data.progress[assessment.id];
        if (!progress) return null;
        const stats = Object.values(progress.questionStats || {});
        const seen = stats.filter((stat) => stat.seen > 0).length;
        const wrong = stats.filter((stat) => stat.lastCorrect === false || stat.wrong > stat.correct).length;
        const marked = stats.filter((stat) => stat.markedForReview).length;
        const lastActivity = Math.max(
          progress.lastAttemptAt ? new Date(progress.lastAttemptAt).getTime() : 0,
          progress.activeSession ? new Date(progress.activeSession.lastOpenedAt).getTime() : 0
        );
        if (!seen && !lastActivity) return null;
        return { assessment, progress, seen, wrong, marked, lastActivity };
      })
      .filter((row): row is ActivityRow => Boolean(row))
      .sort((left, right) => right.lastActivity - left.lastActivity)
      .slice(0, 5);
  }, [data.progress, scopedAssessments]);

  const resumeAssessment = data.resume
    ? scopedAssessments.find((assessment) => assessment.id === data.resume?.assessmentId) || null
    : null;
  const primaryAssessment = resumeAssessment || scopedData.recentAssessment;
  const progressPercent = scopedData.totalQuestions
    ? Math.round((scopedData.seenCount / scopedData.totalQuestions) * 100)
    : 0;
  const activeSessionCount = scopedAssessments.filter((assessment) => data.progress[assessment.id]?.activeSession).length;
  const scopeLabel = semesterHeading(scopedSettings);
  const todayLabel = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date());

  const wrongHref = scopedData.wrongTarget
    ? `/quiz/${scopedData.wrongTarget.id}?quick=wrong`
    : "/train";
  const markedHref = scopedData.markedTarget
    ? `/quiz/${scopedData.markedTarget.id}?quick=marked`
    : "/train";
  const resumeHref = primaryAssessment
    ? data.resume && resumeAssessment
      ? `/quiz/${primaryAssessment.id}?resume=1`
      : `/quiz/${primaryAssessment.id}?mode=training`
    : "/assessments";

  const actions: DashboardAction[] = [
    {
      title: "Übungen",
      description: "Fragen nach Block, Titel oder Fach suchen.",
      href: "/assessments",
      icon: "book",
      meta: `${scopedAssessments.length} Übungen`
    },
    {
      title: "Schwächen trainieren",
      description: scopedData.wrongTarget
        ? compactAssessmentTitle(scopedData.wrongTarget)
        : "Noch keine offenen Fehler",
      href: wrongHref,
      icon: "target",
      meta: `${scopedData.wrongCount} offen`,
      disabled: !scopedData.wrongTarget
    },
    {
      title: "Markierte Fragen",
      description: scopedData.markedTarget
        ? compactAssessmentTitle(scopedData.markedTarget)
        : "Noch keine markierten Fragen",
      href: markedHref,
      icon: "bookmark",
      meta: `${scopedData.markedCount} markiert`,
      disabled: !scopedData.markedTarget
    }
  ];

  return (
    <main className="shell atlas-dashboard-shell">
      <header className="atlas-dashboard-hero">
        <div>
          <p className="eyebrow">{todayLabel}</p>
          <h1>{firstName ? `Hallo ${firstName}` : "Deine Lernübersicht"}</h1>
        </div>
        <ProgressTools />
      </header>

      {data.error ? <div className="dashboard-alert" role="alert">{data.error}</div> : null}

      <section className="dashboard-learning-actions" aria-label="Lernen">
        <article className="dashboard-next-study">
          <p className="eyebrow">{data.resume && resumeAssessment ? "Laufende Übung" : "Training"}</p>
          <h2>{primaryAssessment ? compactAssessmentTitle(primaryAssessment) : "Wähle eine Übung"}</h2>
          {primaryAssessment && <p>{assessmentMeta(primaryAssessment)} · {primaryAssessment.questionCount} Fragen</p>}
          <Link className="btn-primary" href={resumeHref}>
            <AtlasIcon name="play" />
            {data.resume && resumeAssessment ? "Fortsetzen" : primaryAssessment ? "Training starten" : "Übungen öffnen"}
          </Link>
        </article>
        <ul className="dashboard-study-list" aria-label="Weitere Lernmöglichkeiten">
          {actions.map((action) => (
            <li key={action.title}><DashboardLearningLink action={action} /></li>
          ))}
        </ul>
      </section>

      <section className="dashboard-overview-grid dashboard-overview-grid--wide">
        <article className="dashboard-progress-panel">
          <div className="dashboard-panel-head">
            <div>
              <p className="eyebrow">Lernfortschritt · {scopeLabel}</p>
              <h2>Semesterfortschritt</h2>
            </div>
            <span className="dashboard-pill">{progressPercent}% gesehen</span>
          </div>
          <div className="dashboard-progress-bar" aria-label={`${progressPercent}% der Fragen gesehen`}>
            <span style={{ width: `${Math.min(progressPercent, 100)}%` }} />
          </div>
          <div className="dashboard-metric-row">
            <Metric label="Gesehen" value={`${scopedData.seenCount}/${scopedData.totalQuestions || 0}`} />
            <Metric label="Offene Fehler" value={scopedData.wrongCount} />
            <Metric label="Markiert" value={scopedData.markedCount} />
            <Metric label="Aktive Sessions" value={activeSessionCount} />
          </div>
        </article>
      </section>

      <section className="dashboard-activity-panel">
        <div className="dashboard-panel-head">
          <div>
            <h2>Letzte Aktivitäten</h2>
          </div>
          <Link className="dashboard-subtle-link" href="/progress">Lernfortschritt öffnen</Link>
        </div>

        {data.loading ? (
          <div className="dashboard-empty-state" role="status">Lerndaten werden geladen …</div>
        ) : recentRows.length ? (
          <div className="dashboard-activity-list">
            {recentRows.map((row) => (
              <ActivityItem row={row} key={row.assessment.id} />
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state">Noch keine Aktivität.</div>
        )}
      </section>
    </main>
  );
}

function DashboardLearningLink({ action }: { action: DashboardAction }) {
  const content = (
    <>
      <AtlasIcon name={action.icon} />
      <span className="dashboard-study-label">
        <strong>{action.title}</strong>
        <small>{action.description}</small>
      </span>
      {!action.disabled && <span className="dashboard-study-count">{action.meta}</span>}
      {!action.disabled && <AtlasIcon name="chevronRight" />}
    </>
  );

  return action.disabled
    ? <div aria-disabled="true" className="dashboard-study-row">{content}</div>
    : <Link className="dashboard-study-row" href={action.href}>{content}</Link>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="dashboard-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ActivityItem({ row }: { row: ActivityRow }) {
  const score = row.progress.lastScore === null ? "offen" : `${Math.round(row.progress.lastScore)}%`;
  return (
    <Link className="dashboard-activity-item" href={`/assessment/${row.assessment.id}`}>
      <div>
        <strong>{compactAssessmentTitle(row.assessment)}</strong>
        <span>{assessmentMeta(row.assessment)}</span>
      </div>
      <div className="dashboard-activity-stats">
        <span>{row.seen}/{row.assessment.questionCount}</span>
        <span>{score}</span>
        {row.wrong ? <span>{row.wrong} falsch</span> : null}
        {row.marked ? <span>{row.marked} markiert</span> : null}
      </div>
    </Link>
  );
}

function compactAssessmentTitle(assessment: AssessmentSummary): string {
  return assessment.title
    .replace(/\s+/g, " ")
    .replace(/^Assessment\s*[·:-]\s*/i, "")
    .trim();
}

function assessmentMeta(assessment: AssessmentSummary): string {
  const block = formatBlockLabel(assessment.block);
  const exam = examForBlock(assessment.block);
  return [block, assessment.subject, exam].filter(Boolean).join(" · ");
}

function deriveDashboardScope(
  assessments: AssessmentSummary[],
  progress: Record<string, AssessmentProgress>
): DashboardScope {
  let recentAssessment: AssessmentSummary | null = assessments[0] || null;
  let recentTime = 0;
  let wrongTarget: AssessmentSummary | null = null;
  let markedTarget: AssessmentSummary | null = null;
  let highestWrong = 0;
  let highestMarked = 0;
  let wrongCount = 0;
  let markedCount = 0;
  let seenCount = 0;
  let totalQuestions = 0;

  assessments.forEach((assessment) => {
    const assessmentProgress = progress[assessment.id];
    const stats = Object.values(assessmentProgress?.questionStats || {});
    const assessmentWrong = stats.filter((stat) => stat.lastCorrect === false || stat.wrong > stat.correct).length;
    const assessmentMarked = stats.filter((stat) => stat.markedForReview).length;
    const assessmentSeen = stats.filter((stat) => stat.seen > 0).length;
    const lastActivity = Math.max(
      assessmentProgress?.lastAttemptAt ? new Date(assessmentProgress.lastAttemptAt).getTime() : 0,
      assessmentProgress?.activeSession ? new Date(assessmentProgress.activeSession.lastOpenedAt).getTime() : 0
    );

    wrongCount += assessmentWrong;
    markedCount += assessmentMarked;
    seenCount += assessmentSeen;
    totalQuestions += assessment.questionCount;

    if (assessmentWrong > highestWrong) {
      highestWrong = assessmentWrong;
      wrongTarget = assessment;
    }
    if (assessmentMarked > highestMarked) {
      highestMarked = assessmentMarked;
      markedTarget = assessment;
    }
    if (lastActivity > recentTime) {
      recentTime = lastActivity;
      recentAssessment = assessment;
    }
  });

  return {
    recentAssessment,
    wrongTarget,
    markedTarget,
    wrongCount,
    markedCount,
    seenCount,
    totalQuestions
  };
}
