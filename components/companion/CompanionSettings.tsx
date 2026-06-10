"use client";

import { useCompanion } from "./CompanionProvider";
import { useUserStudyContext } from "../study/UserStudyProvider";

export function CompanionSettings() {
  const {
    hideInExamMode,
    reducedMotion,
    setHideInExamMode,
    setReducedMotion
  } = useCompanion();
  const { settings, updateSettings } = useUserStudyContext();

  return (
    <section className="companion-settings" aria-labelledby="companion-settings-title">
      <div>
        <strong id="companion-settings-title">Companion</strong>
        <span>Optionaler Lernbegleiter für Fokus- und Fortschrittshinweise.</span>
      </div>
      <CompanionToggle
        checked={settings.ariEnabled}
        label="Ari anzeigen"
        onChange={(ariEnabled) => updateSettings({ ...settings, ariEnabled })}
      />
      <CompanionToggle
        checked={hideInExamMode}
        label="Im Prüfungsmodus ausblenden"
        onChange={setHideInExamMode}
      />
      <CompanionToggle
        checked={reducedMotion}
        label="Animationen reduzieren"
        onChange={setReducedMotion}
      />
    </section>
  );
}

function CompanionToggle({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="companion-setting-row">
      <span>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="companion-switch" aria-hidden="true" />
    </label>
  );
}
