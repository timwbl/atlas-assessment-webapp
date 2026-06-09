import type { AriReaction } from "./companion.types";

export function AriCallout({ reaction }: { reaction: AriReaction | null }) {
  if (!reaction) return null;

  return (
    <div className="ari-companion__callout" aria-live="polite">
      <strong>{reaction.title}</strong>
      {reaction.subtitle && <span>{reaction.subtitle}</span>}
    </div>
  );
}
