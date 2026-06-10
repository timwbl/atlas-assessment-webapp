"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminDashboard } from "./AdminDashboard";

export type AdminView =
  | "overview"
  | "requests"
  | "assessments"
  | "altfragen"
  | "recommendations"
  | "reviews"
  | "downloads"
  | "users";

const AdminEditor = dynamic(
  () => import("@/components/AdminEditor").then((module) => module.AdminEditor),
  { loading: AdminLoading }
);
const AdminAltfragenRequests = dynamic(
  () => import("@/components/AdminAltfragenRequests").then((module) => module.AdminAltfragenRequests),
  { loading: AdminLoading }
);
const AdminAssessmentReviews = dynamic(
  () => import("@/components/AdminAssessmentReviews").then((module) => module.AdminAssessmentReviews),
  { loading: AdminLoading }
);
const AdminBlockRecommendations = dynamic(
  () => import("@/components/AdminBlockRecommendations").then((module) => module.AdminBlockRecommendations),
  { loading: AdminLoading }
);
const AdminDownloadsManager = dynamic(
  () => import("@/components/AdminDownloadsManager").then((module) => module.AdminDownloadsManager),
  { loading: AdminLoading }
);
const AdminProgressDashboard = dynamic(
  () => import("@/components/AdminProgressDashboard").then((module) => module.AdminProgressDashboard),
  { loading: AdminLoading }
);

const NAV_ITEMS: Array<{ id: AdminView; label: string; description: string }> = [
  { id: "overview", label: "Übersicht", description: "Offene Arbeit und Systemstatus" },
  { id: "requests", label: "Altfragen-Anfragen", description: "Zugriffe prüfen und freigeben" },
  { id: "assessments", label: "Assessments", description: "Normale Assessments verwalten" },
  { id: "altfragen", label: "Altfragen", description: "Prüfungsnahe Inhalte verwalten" },
  { id: "recommendations", label: "Empfehlungen", description: "Blockbewertungen pflegen" },
  { id: "reviews", label: "Kommentare", description: "User-Kommentare moderieren" },
  { id: "downloads", label: "Downloads", description: "Zusammenfassungen verwalten" },
  { id: "users", label: "Nutzer", description: "Accounts und Fortschritt ansehen" }
];

export function AdminWorkspace() {
  const [view, setView] = useState<AdminView>("overview");
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    const applyHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (hash.startsWith("altfragen-request")) setView("requests");
      else if (NAV_ITEMS.some((item) => item.id === hash)) setView(hash as AdminView);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const active = useMemo(() => NAV_ITEMS.find((item) => item.id === view) || NAV_ITEMS[0], [view]);
  const navigate = useCallback((next: AdminView) => {
    setView(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  async function lockAdmin() {
    setLocking(true);
    await fetch("/api/admin/access", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <div className="admin-kicker">ATLAS 3.0 · ADMIN</div>
          <h1>{active.label}</h1>
          <p>{active.description}</p>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-mode-badge">Admin Mode</span>
          <Link className="btn-secondary" href="/">Zur App</Link>
          <button className="btn-secondary" disabled={locking} onClick={() => void lockAdmin()} type="button">
            {locking ? "Sperrt…" : "Admin sperren"}
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <nav className="admin-navigation" aria-label="Admin-Navigation">
          {NAV_ITEMS.map((item) => (
            <button
              className={view === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => navigate(item.id)}
              type="button"
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>

        <section className="admin-content" aria-live="polite">
          {view === "overview" && <AdminDashboard onNavigate={navigate} />}
          {view === "requests" && <AdminAltfragenRequests />}
          {view === "assessments" && <AdminEditor contentType="assessment" />}
          {view === "altfragen" && <AdminEditor contentType="altfragen" />}
          {view === "recommendations" && <AdminBlockRecommendations />}
          {view === "reviews" && <AdminAssessmentReviews />}
          {view === "downloads" && <AdminDownloadsManager />}
          {view === "users" && <AdminProgressDashboard />}
        </section>
      </div>
    </main>
  );
}

function AdminLoading() {
  return (
    <div className="admin-loading card" aria-label="Admin-Bereich wird geladen">
      <span />
      <span />
      <span />
    </div>
  );
}
