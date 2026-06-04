"use client";

import { useEffect, useState } from "react";
import {
  altfragenPasswordConfigured,
  loadOwnAltfragenRequest,
  submitAltfragenAccessRequest,
  verifyAltfragenPassword,
  type AltfragenAccessRequest
} from "@/lib/altfragenAccess";
import { cloudSyncAvailable, getCurrentProfile, type CloudProfile } from "@/lib/cloudProgress";

type Props = {
  onUnlocked: () => void;
};

export function AltfragenAccessPanel({ onUnlocked }: Props) {
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [request, setRequest] = useState<AltfragenAccessRequest | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [studyYear, setStudyYear] = useState(1);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    const currentProfile = await getCurrentProfile().catch(() => null);
    setProfile(currentProfile);
    setDisplayName(currentProfile?.display_name || "");
    const ownRequest = currentProfile ? await loadOwnAltfragenRequest(currentProfile).catch(() => null) : null;
    setRequest(ownRequest);
    if (ownRequest?.displayName) setDisplayName(ownRequest.displayName);
    if (ownRequest?.studyYear) setStudyYear(ownRequest.studyYear);
  }

  async function sendRequest() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await submitAltfragenAccessRequest({ displayName, studyYear });
      setRequest(saved);
      setMessage("Anfrage gesendet. Du siehst den Altfragen-Block, sobald Tim sie freigibt.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Anfrage konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  }

  function unlockWithPassword() {
    setError("");
    setMessage("");
    if (verifyAltfragenPassword(password)) {
      setMessage("Altfragen freigeschaltet.");
      onUnlocked();
      return;
    }
    setError("Passwort ist nicht korrekt.");
  }

  return (
    <section className="card mt-5 p-6">
      <div className="eyebrow">Geschützter Bereich</div>
      <h2 className="mt-2 text-3xl font-black">Altfragen</h2>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Dieser Block ist nur mit freigegebenem Account oder Altfragen-Passwort verfügbar.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
          <h3 className="font-black">Freigabe anfragen</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Nur eingeloggte Accounts können eine Anfrage senden.</p>

          {!cloudSyncAvailable() && (
            <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-500/10 p-3 text-sm text-amber-700">
              Account-Sync ist noch nicht konfiguriert.
            </p>
          )}

          {cloudSyncAvailable() && !profile && (
            <p className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
              Bitte melde dich oben rechts mit deinem Account an.
            </p>
          )}

          {profile && (
            <div className="mt-4 grid gap-3">
              <label>
                <span className="eyebrow">Name</span>
                <input className="input mt-2" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label>
                <span className="eyebrow">Studienjahr</span>
                <select className="input mt-2" value={studyYear} onChange={(event) => setStudyYear(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((year) => <option key={year} value={year}>{year}. Studienjahr</option>)}
                </select>
              </label>
              {request && (
                <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm text-[var(--muted)]">
                  Status: <strong>{request.status === "approved" ? "freigegeben" : request.status === "denied" ? "abgelehnt" : "ausstehend"}</strong>
                </p>
              )}
              <button className="btn-primary" disabled={busy || !displayName.trim()} onClick={() => void sendRequest()}>
                {busy ? "Sendet..." : request?.status === "denied" ? "Erneut anfragen" : "Anfrage senden"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)] p-4">
          <h3 className="font-black">Mit Passwort öffnen</h3>
          <p className="mt-2 text-sm text-[var(--muted)]">Für direkten Zugang ohne Account-Freigabe.</p>
          <div className="mt-4 grid gap-3">
            <input
              className="input"
              type="password"
              value={password}
              disabled={!altfragenPasswordConfigured()}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") unlockWithPassword();
              }}
              placeholder={altfragenPasswordConfigured() ? "Altfragen-Passwort" : "Kein Passwort gesetzt"}
            />
            <button className="btn-secondary" disabled={!altfragenPasswordConfigured() || !password} onClick={unlockWithPassword}>
              Passwort prüfen
            </button>
          </div>
        </div>
      </div>

      {message && <p className="mt-4 rounded-2xl border border-green-300 bg-green-500/10 p-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-4 rounded-2xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
