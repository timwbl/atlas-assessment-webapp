"use client";

export function AtlasPageLoading({ title = "ATLAS lädt" }: { title?: string }) {
  return (
    <main className="shell atlas-page-loading" aria-label={title} role="status">
      <section className="atlas-shimmer-hero">
        <span />
        <span />
        <span />
      </section>
      <section className="atlas-shimmer-grid">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </section>
      <section className="atlas-shimmer-wide">
        <span />
        <span />
        <span />
      </section>
    </main>
  );
}
