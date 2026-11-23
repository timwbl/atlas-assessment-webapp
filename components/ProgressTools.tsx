"use client";

import { useRef, useState } from "react";
import { exportProgressJson, importProgressJson } from "@/lib/progressStore";

export function ProgressTools({ onImported }: { onImported?: () => void }) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  function exportProgress() {
    const blob = new Blob([exportProgressJson()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atlas-assessment-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File) {
    try {
      importProgressJson(await file.text());
      onImported?.();
      setMessage("Fortschrittsdaten importiert.");
    } catch {
      setMessage("Die Datei konnte nicht gelesen werden. Wähle eine aus ATLAS exportierte JSON-Datei.");
    }
  }

  return (
    <details className="progress-data-tools">
      <summary>Fortschrittsdaten verwalten</summary>
      <div className="progress-tools flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={exportProgress} type="button">Fortschritt exportieren</button>
        <button className="btn-secondary" onClick={() => inputRef.current?.click()} type="button">Fortschritt importieren</button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file);
          event.currentTarget.value = "";
        }}
      />
      {message && <p role="status">{message}</p>}
    </details>
  );
}
