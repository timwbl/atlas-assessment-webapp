"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function AtlasBootLoader() {
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 700);
    const removeTimer = window.setTimeout(() => setVisible(false), 1020);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`atlas-logo-loader atlas-boot-loader${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-label="ATLAS wird geladen"
    >
      <div className="atlas-logo-loader-mark">
        <span className="atlas-logo-loader-ring" aria-hidden="true" />
        <Image src="/atlas-loader-logo.svg" alt="ATLAS" width={118} height={118} priority />
        <span className="atlas-logo-loader-shimmer" aria-hidden="true" />
      </div>
      <p>Daten werden synchronisiert</p>
    </div>
  );
}
