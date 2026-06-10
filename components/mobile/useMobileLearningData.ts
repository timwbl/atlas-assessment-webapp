"use client";

import { useEffect, useMemo, useState } from "react";
import { loadActiveAssessments } from "@/lib/assessmentClient";
import {
  getAllProgress,
  getLatestActiveSession,
  PROGRESS_CHANGED_EVENT
} from "@/lib/progressStore";
import type {
  ActiveQuizSession,
  Assessment,
  AssessmentProgress
} from "@/lib/types";

export type MobileLearningData = {
  assessments: Assessment[];
  progress: Record<string, AssessmentProgress>;
  resume: ActiveQuizSession | null;
  loading: boolean;
  error: string;
  recentAssessment: Assessment | null;
  wrongTarget: Assessment | null;
  markedTarget: Assessment | null;
  wrongCount: number;
  markedCount: number;
  seenCount: number;
  totalQuestions: number;
};

export function useMobileLearningData(): MobileLearningData {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [progress, setProgress] = useState<Record<string, AssessmentProgress>>({});
  const [resume, setResume] = useState<ActiveQuizSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    function refreshProgress() {
      setProgress(getAllProgress());
      setResume(getLatestActiveSession());
    }
    refreshProgress();
    loadActiveAssessments()
      .then(setAssessments)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Lerndaten konnten nicht geladen werden."))
      .finally(() => setLoading(false));

    window.addEventListener(PROGRESS_CHANGED_EVENT, refreshProgress);
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, refreshProgress);
  }, []);

  const derived = useMemo(() => deriveLearningData(assessments, progress, resume), [assessments, progress, resume]);
  return { assessments, progress, loading, error, ...derived };
}

function deriveLearningData(
  assessments: Assessment[],
  progress: Record<string, AssessmentProgress>,
  resume: ActiveQuizSession | null
) {
  const assessmentById = new Map(assessments.map((assessment) => [assessment.id, assessment]));
  const validResume = resume && assessmentById.has(resume.assessmentId) ? resume : null;
  const recentProgress = Object.values(progress)
    .filter((item) => item.lastAttemptAt || item.activeSession)
    .sort((a, b) => activityTime(b) - activityTime(a));

  const recentAssessment = (validResume && assessmentById.get(validResume.assessmentId))
    || assessmentById.get(recentProgress[0]?.assessmentId)
    || assessments[0]
    || null;

  let wrongTarget: Assessment | null = null;
  let markedTarget: Assessment | null = null;
  let highestWrong = 0;
  let highestMarked = 0;
  let wrongCount = 0;
  let markedCount = 0;
  let seenCount = 0;
  let totalQuestions = 0;

  assessments.forEach((assessment) => {
    const stats = Object.values(progress[assessment.id]?.questionStats || {});
    const assessmentWrong = stats.filter((stat) => stat.lastCorrect === false || stat.wrong > stat.correct).length;
    const assessmentMarked = stats.filter((stat) => stat.markedForReview).length;
    wrongCount += assessmentWrong;
    markedCount += assessmentMarked;
    seenCount += stats.filter((stat) => stat.seen > 0).length;
    totalQuestions += assessment.questions.length;
    if (assessmentWrong > highestWrong) {
      highestWrong = assessmentWrong;
      wrongTarget = assessment;
    }
    if (assessmentMarked > highestMarked) {
      highestMarked = assessmentMarked;
      markedTarget = assessment;
    }
  });

  return {
    resume: validResume,
    recentAssessment,
    wrongTarget,
    markedTarget,
    wrongCount,
    markedCount,
    seenCount,
    totalQuestions
  };
}

function activityTime(progress: AssessmentProgress): number {
  return Math.max(
    progress.lastAttemptAt ? new Date(progress.lastAttemptAt).getTime() : 0,
    progress.activeSession ? new Date(progress.activeSession.lastOpenedAt).getTime() : 0
  );
}
