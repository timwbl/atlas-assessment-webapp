"use client";

import { useCompanion } from "./CompanionProvider";

export function CompanionSettings() {
  const {
    companionEnabled,
    hideInExamMode,
    reducedMotion,
    setCompanionEnabled,
    setHideInExamMode,
    setReducedMotion
  } = useCompanion();

  return (
    <section className="companion-settings" aria-labelledby="companion-settings-title">
      <div>
        <strong id="companion-settings-title">Companion</strong>
        <span>Ari begleitet dich dezent beim Lernen.</span>
      </div>
      <CompanionToggle
        checked={companionEnabled}
        label="Companion anzeigen"
        onChange={setCompanionEnabled}
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
