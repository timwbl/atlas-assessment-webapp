"use client";

import { useState } from "react";
import { useCompanion } from "./CompanionProvider";
import type { AriEventType, AriMood } from "./companion.types";

const MOODS: Array<[AriMood, string]> = [
  ["idle", "Idle"],
  ["success", "Success"],
  ["thinking", "Thinking"],
  ["encourage", "Encourage"],
  ["focus", "Focus"],
  ["comeback_sleepy", "Comeback Sleepy"]
];

const EVENTS: Array<[AriEventType, string]> = [
  ["assessment_completed", "Assessment completed"],
  ["wrong_answer", "Wrong answer"],
  ["wrong_confident_answer", "Wrong confident answer"],
  ["new_focus_area", "New focus area"]
];

export function CompanionDebugPanel() {
  const [open, setOpen] = useState(false);
  const {
    companionEnabled,
    isExamMode,
    reducedMotion,
    setAriMood,
    setCompanionEnabled,
    setCompanionExamMode,
    setReducedMotion,
    triggerAriEvent
  } = useCompanion();

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="companion-debug">
      <button className="companion-debug__toggle" onClick={() => setOpen((value) => !value)} type="button">
        Ari Debug
      </button>
      {open && (
        <div className="companion-debug__panel">
          <strong>Moods</strong>
          <div>{MOODS.map(([mood, label]) => <button key={mood} onClick={() => setAriMood(mood)} type="button">{label}</button>)}</div>
          <strong>Events</strong>
          <div>{EVENTS.map(([event, label]) => <button key={event} onClick={() => triggerAriEvent(event)} type="button">{label}</button>)}</div>
          <strong>State</strong>
          <div>
            <button onClick={() => setCompanionEnabled(!companionEnabled)} type="button">Companion: {companionEnabled ? "on" : "off"}</button>
            <button onClick={() => setCompanionExamMode(!isExamMode)} type="button">Exam: {isExamMode ? "on" : "off"}</button>
            <button onClick={() => setReducedMotion(!reducedMotion)} type="button">Motion: {reducedMotion ? "reduced" : "on"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
