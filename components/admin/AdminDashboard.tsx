"use client";

import { useEffect, useMemo, useState } from "react";
import { loadActiveAssessments } from "@/lib/assessmentClient";
import { loadAdminAltfragenRequests } from "@/lib/altfragenAccess";
import { loadAdminAssessmentReviews } from "@/lib/assessmentReviews";
import { fetchAdminProgressRows } from "@/lib/cloudProgress";
import { isAltfragenAssessment } from "@/lib/altfragenAccess";
import type { AdminView } from "./AdminWorkspace";

type DashboardData = {
  assessments: number;
  questions: number;
  altfragen: number;
  pendingRequests: number;
  pendingReviews: number;
  users: number;
};

const EMPTY: DashboardData = {
  assessments: 0,
  questions: 0,
  altfragen: 0,
  pendingRequests: 0,
  pendingReviews: 0,
  users: 0
};

export function AdminDashboard({ onNavigate }: { onNavigate: (view: AdminView) => void }) {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const [assessmentResult, requestResult, reviewResult, progressResult] = await Promise.allSettled([
      loadActiveAssessments(),
      loadAdminAltfragenRequests(),
      loadAdminAssessmentReviews(),
      fetchAdminProgressRows()
    ]);

    const assessments = assessmentResult.status === "fulfilled" ? assessmentResult.value : [];
    const requests = requestResult.status === "fulfilled" ? requestResult.value : [];
    const reviews = reviewResult.status === "fulfilled" ? reviewResult.value : [];
    const progress = progressResult.status === "fulfilled" ? progressResult.value : [];

    setData({
      assessments: assessments.filter((item) => !isAltfragenAssessment(item)).length,
      questions: assessments.reduce((sum, item) => sum + item.questions.length, 0),
      altfragen: assessments.filter(isAltfragenAssessment).length,
      pendingRequests: requests.filter((item) => item.status === "pending").length,
      pendingReviews: reviews.filter((item) => !item.approved).length,
      users: new Set(progress.map((item) => item.userId)).size
    });

    const failures = [assessmentResult, requestResult, reviewResult, progressResult]
      .filter((result) => result.status === "rejected").length;
    if (failures) setError(`${failures} Datenquelle${failures === 1 ? "" : "n"} konnten nicht geladen werden.`);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const priority = useMemo(() => [
    {
      title: "Altfragen-Anfragen",
      value: data.pendingRequests,
      note: data.pendingRequests === 1 ? "offene Freigabe" : "offene Freigaben",
      view: "requests" as const
    },
    {
      title: "Kommentare prüfen",
      value: data.pendingReviews,
      note: data.pendingReviews === 1 ? "wartet auf Moderation" : "warten auf Moderation",
      view: "reviews" as const
    }
  ], [data.pendingRequests, data.pendingReviews]);

  return (
    <div className="admin-dashboard">
      {error && (
        <div className="admin-alert admin-alert--warning">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>Erneut versuchen</button>
        </div>
      )}

      <section className="admin-stat-grid" aria-label="Admin-Kennzahlen">
        <Stat label="Assessments" value={data.assessments} loading={loading} />
        <Stat label="Fragen gesamt" value={data.questions} loading={loading} />
        <Stat label="Altfragen-Sets" value={data.altfragen} loading={loading} />
        <Stat label="Aktive Accounts" value={data.users} loading={loading} />
      </section>

      <div className="admin-dashboard-grid">
        <section className="card admin-panel">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">Heute relevant</div>
              <h2>Offene Arbeit</h2>
            </div>
          </div>
          <div className="admin-priority-list">
            {priority.map((item) => (
              <button key={item.title} onClick={() => onNavigate(item.view)} type="button">
                <span className="admin-priority-count">{loading ? "–" : item.value}</span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.note}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card admin-panel">
          <div className="admin-section-heading">
            <div>
              <div className="eyebrow">Direktzugriff</div>
              <h2>Quick Actions</h2>
            </div>
          </div>
          <div className="admin-quick-grid">
            <button type="button" onClick={() => onNavigate("assessments")}>Assessment verwalten</button>
            <button type="button" onClick={() => onNavigate("altfragen")}>Altfragen verwalten</button>
            <button type="button" onClick={() => onNavigate("quality")}>Fragenqualität prüfen</button>
            <button type="button" onClick={() => onNavigate("downloads")}>Dokument hochladen</button>
            <button type="button" onClick={() => onNavigate("users")}>Nutzerfortschritt öffnen</button>
            <button type="button" onClick={() => onNavigate("settings")}>Umbau-Modus verwalten</button>
          </div>
        </section>
      </div>

      <section className="card admin-panel">
        <div className="admin-section-heading">
          <div>
            <div className="eyebrow">System</div>
            <h2>Arbeitsbereich</h2>
          </div>
          <span className="admin-status-badge admin-status-badge--success">Bereit</span>
        </div>
        <div className="admin-system-grid">
          <div><strong>Modulare Bereiche</strong><span>Nur der aktive Bereich lädt seine Daten.</span></div>
          <div><strong>Supabase RLS</strong><span>Admin-Daten bleiben rollenbasiert geschützt.</span></div>
          <div><strong>Lokaler Editor</strong><span>Assessment-Änderungen werden weiterhin als JSON exportiert.</span></div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="card admin-stat">
      <span>{label}</span>
      <strong>{loading ? "–" : value.toLocaleString("de-CH")}</strong>
    </div>
  );
}
