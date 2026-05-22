"use client";

export function PrivacyNotice() {
  return (
    <div className="card p-4 text-sm text-[var(--muted)]">
      <strong className="text-[var(--text)]">Datenschutz:</strong>{" "}
      Dein Fortschritt wird nur lokal in diesem Browser gespeichert. Es gibt keine Accounts,
      keine Cloud-Speicherung und keine zentrale personenbezogene Datenbank.
    </div>
  );
}
