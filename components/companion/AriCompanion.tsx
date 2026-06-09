"use client";

import { useState, type SyntheticEvent } from "react";
import { usePathname } from "next/navigation";
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

export function AriCompanion() {
  const pathname = usePathname();
  const {
    mood,
    reaction,
    companionEnabled,
    hideInExamMode,
    isExamMode,
    reducedMotion
  } = useCompanion();
  const [failedMood, setFailedMood] = useState<AriMood | null>(null);
  const [idleFailed, setIdleFailed] = useState(false);

  if (!companionEnabled || (isExamMode && hideInExamMode) || idleFailed) return null;

  const source = failedMood === mood ? ARI_ASSETS.idle : ARI_ASSETS[mood];

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
        pathname.startsWith("/quiz") ? "ari-companion--quiz" : "",
        reducedMotion ? "ari-companion--reduced-motion" : ""
      ].filter(Boolean).join(" ")}
    >
      <AriCallout reaction={reaction} />
      <div className="ari-companion__image-wrap">
        <img
          alt="Ari, dein ATLAS Companion"
          className={`ari-companion__image ari-companion__image--${mood}`}
          onError={handleImageError}
          src={source}
        />
      </div>
    </aside>
  );
}
