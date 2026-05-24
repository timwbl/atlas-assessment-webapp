"use client";

export function PrivacyNotice() {
  return (
    <div className="card p-4 text-sm text-[var(--muted)]">
      <strong className="text-[var(--text)]">Datenschutz:</strong>{" "}
      Ohne Login wird dein Fortschritt nur lokal in diesem Browser gespeichert. Wenn du dich freiwillig
      einloggst, kann dein Fortschritt mit deinem Account synchronisiert werden.
    </div>
  );
}
