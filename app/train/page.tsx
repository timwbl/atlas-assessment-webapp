import Link from "next/link";
import { MobileTrain } from "@/components/mobile/MobileTrain";

export default function TrainPage() {
  return (
    <>
      <MobileTrain />
      <main className="shell desktop-only">
        <section className="card p-6">
          <p className="eyebrow">Mobile Action Layer</p>
          <h1 className="mt-2 text-3xl font-black">Kurze Trainings</h1>
          <p className="mt-2 text-[var(--muted)]">Die kompakten Trainingseinstiege sind für Smartphones optimiert.</p>
          <Link className="btn-primary mt-5 inline-flex" href="/">Zur Assessment Library</Link>
        </section>
      </main>
    </>
  );
}
