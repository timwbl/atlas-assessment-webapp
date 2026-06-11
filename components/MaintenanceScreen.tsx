import Image from "next/image";

export function MaintenanceScreen() {
  return (
    <main className="maintenance-page">
      <section className="maintenance-screen" aria-labelledby="maintenance-title">
        <div className="maintenance-logo">
          <Image
            src="/atlas-logo.svg"
            alt="ATLAS"
            width={144}
            height={144}
            priority
          />
        </div>
        <p className="eyebrow">ATLAS Study OS</p>
        <h1 id="maintenance-title">ATLAS befindet sich aktuell im Umbau.</h1>
        <p className="maintenance-message">
          Wir verbessern gerade die Plattform, damit dein Lernen noch strukturierter,
          schneller und präziser wird.
        </p>
        <div className="maintenance-loader" aria-label="Umbau läuft" role="status">
          <span />
        </div>
        <p className="maintenance-subtext">Bitte versuche es später nochmals.</p>
      </section>
    </main>
  );
}
