import Link from "next/link";
import { MobileProgress } from "@/components/mobile/MobileProgress";

export default function ProgressPage() {
  return (
    <>
      <MobileProgress />
      <main className="shell desktop-only">
        <section className="card p-6">
          <p className="eyebrow">Mobile Action Layer</p>
          <h1 className="mt-2 text-3xl font-black">Kompakter Fortschritt</h1>
          <p className="mt-2 text-[var(--muted)]">Die ausführliche Analyse bleibt auf Desktop in den Assessment-Ergebnissen verfügbar.</p>
          <Link className="btn-primary mt-5 inline-flex" href="/">Zur Assessment Library</Link>
        </section>
      </main>
    </>
  );
}
