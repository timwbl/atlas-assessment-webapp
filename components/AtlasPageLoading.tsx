"use client";

import Image from "next/image";

export function AtlasPageLoading({ title = "ATLAS lädt" }: { title?: string }) {
  return (
    <main className="atlas-logo-loader" aria-label={title} role="status">
      <div className="atlas-logo-loader-mark">
        <span className="atlas-logo-loader-ring" aria-hidden="true" />
        <Image src="/atlas-loader-logo.svg" alt="ATLAS" width={118} height={118} priority />
        <span className="atlas-logo-loader-shimmer" aria-hidden="true" />
      </div>
      <p>{title}</p>
    </main>
  );
}
