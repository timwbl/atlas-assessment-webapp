"use client";

import { useEffect } from "react";
import { isChunkLoadError, recoverFromChunkLoadError } from "@/lib/clientChunkRecovery";

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) void recoverFromChunkLoadError(error);
    else console.error("ATLAS admin route failed", error);
  }, [chunkError, error]);

  return (
    <main className="admin-shell">
      <section className="card admin-error-boundary" role="alert">
        <div className="admin-kicker">ATLAS ADMIN</div>
        <h1>{chunkError ? "ATLAS wird aktualisiert" : "Adminbereich kurz nicht verfügbar"}</h1>
        <p>
          {chunkError
            ? "Eine veraltete Programmdatei wurde erkannt. Die aktuelle Version wird automatisch geladen."
            : "Deine Daten sind nicht betroffen. Versuche den Bereich erneut zu laden."}
        </p>
        <div>
          <button className="btn-primary" onClick={reset} type="button">Erneut versuchen</button>
          <button className="btn-secondary" onClick={() => window.location.reload()} type="button">Seite aktualisieren</button>
        </div>
      </section>
    </main>
  );
}
