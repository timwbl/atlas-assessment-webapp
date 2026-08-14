import Link from "next/link";

type LegalSection = {
  title: string;
  body?: string[];
  items?: string[];
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function LegalPage({ eyebrow, intro, sections, title, updatedAt }: LegalPageProps) {
  return (
    <main className="shell atlas-subpage-shell legal-page-shell">
      <header className="legal-page-hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <div className="legal-page-meta" aria-label="Dokumentstatus">
          <span>Stand</span>
          <strong>{updatedAt}</strong>
        </div>
      </header>

      <section className="legal-page-note" aria-label="Hinweis">
        <strong>Standarddokument</strong>
        <p>
          Diese Seite ist als transparente, alltagstaugliche Grundlage für ATLAS formuliert.
          Sie ersetzt keine individuelle juristische Prüfung.
        </p>
      </section>

      <section className="legal-page-content" aria-label={title}>
        {sections.map((section) => (
          <article className="legal-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.body?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>

      <nav className="legal-page-links" aria-label="Rechtliche Dokumente">
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link>
        <a href="mailto:tim.nick.weibel@icloud.com?subject=ATLAS%20Rechtliches">Kontakt</a>
      </nav>
    </main>
  );
}
