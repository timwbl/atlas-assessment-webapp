"use client";

import { useRef } from "react";
import { exportProgressJson, importProgressJson } from "@/lib/progressStore";

export function ProgressTools({ onImported }: { onImported?: () => void }) {
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
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import fehlgeschlagen.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" onClick={exportProgress}>Fortschritt exportieren</button>
      <button className="btn-secondary" onClick={() => inputRef.current?.click()}>Fortschritt importieren</button>
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
    </div>
  );
}
