"use client";

import Image from "next/image";
import { useState, type SyntheticEvent } from "react";
import { useCompanion } from "./CompanionProvider";
import { AriCallout } from "./AriCallout";
import type { AriMood } from "./companion.types";

export const ARI_ASSETS: Record<AriMood, string> = {
  idle: "/assets/ari/ari_idle.png",
  success: "/assets/ari/ari_success.png",
  thinking: "/assets/ari/ari_thinking.png",
  encourage: "/assets/ari/ari_encourage.png",
  focus: "/assets/ari/ari_focus.png",
  comeback_sleepy: "/assets/ari/ari_comeback_sleepy.png"
};

const ARI_DIMENSIONS: Record<AriMood, { width: number; height: number }> = {
  idle: { width: 640, height: 426 },
  success: { width: 640, height: 512 },
  thinking: { width: 640, height: 426 },
  encourage: { width: 640, height: 426 },
  focus: { width: 640, height: 640 },
  comeback_sleepy: { width: 640, height: 426 }
};

export function AriCompanion() {
  const {
    mood,
    reaction,
    companionEnabled,
    hideInExamMode,
    isExamMode,
    isAssessmentActive,
    reducedMotion
  } = useCompanion();
  const [failedMood, setFailedMood] = useState<AriMood | null>(null);
  const [idleFailed, setIdleFailed] = useState(false);

  if (!companionEnabled || (isExamMode && hideInExamMode) || idleFailed) return null;

  const source = failedMood === mood ? ARI_ASSETS.idle : ARI_ASSETS[mood];
  const dimensions = failedMood === mood ? ARI_DIMENSIONS.idle : ARI_DIMENSIONS[mood];

  function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
    if (source !== ARI_ASSETS.idle) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[Ari] Asset fehlt: ${source}. Fallback auf idle.`);
      }
      setFailedMood(mood);
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("[Ari] Auch ari_idle.png fehlt. Companion wird ausgeblendet.");
    }
    event.currentTarget.style.display = "none";
    setIdleFailed(true);
  }

  return (
    <aside
      aria-label="Ari, dein ATLAS Companion"
      className={[
        "ari-companion",
        isAssessmentActive ? "ari-companion--assessment-active" : "",
        reducedMotion ? "ari-companion--reduced-motion" : ""
      ].filter(Boolean).join(" ")}
    >
      <AriCallout reaction={reaction} />
      <div className="ari-companion__image-wrap">
        <Image
          alt="Ari, dein ATLAS Companion"
          className={`ari-companion__image ari-companion__image--${mood}`}
          height={dimensions.height}
          onError={handleImageError}
          sizes="(max-width: 720px) 60px, 82px"
          src={source}
          width={dimensions.width}
        />
      </div>
    </aside>
  );
}
