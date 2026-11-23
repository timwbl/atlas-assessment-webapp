"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { AtlasBrand } from "./AtlasBrand";
import { MainNav } from "./MainNav";
import { MobileNav } from "./MobileNav";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";
import { APP_VERSION } from "@/lib/appVersion";
import { StudyPrompts } from "./study/StudyPrompts";
import { AtlasIcon } from "./AtlasIcon";
import { ASSESSMENT_ROUTE_CONTEXT_CHANGED_EVENT, type AssessmentRouteContext } from "@/lib/assessmentRouteContext";

const SIDEBAR_COLLAPSED_KEY = "atlas:sidebar-collapsed:v1";
const APP_VERSION_KEY = "atlas:last-app-version";
const APP_REFRESH_KEY = `atlas:version-refresh:${APP_VERSION}`;

const AccountMenu = dynamic(
  () => import("./AccountMenu").then((module) => module.AccountMenu),
  { ssr: false }
);
const AdminShortcut = dynamic(
  () => import("./AdminShortcut").then((module) => module.AdminShortcut),
  { ssr: false }
);

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean | null>(null);
  const isAltfragenContext = useAltfragenRouteContext(pathname);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    setSidebarCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    const storedVersion = window.localStorage.getItem(APP_VERSION_KEY);
    if (storedVersion === APP_VERSION) return;

    window.localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
    if (!storedVersion || window.sessionStorage.getItem(APP_REFRESH_KEY) === "true") return;

    window.sessionStorage.setItem(APP_REFRESH_KEY, "true");
    void Promise.resolve()
      .then(async () => {
        if ("caches" in window) {
          const keys = await window.caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("atlas-")).map((key) => window.caches.delete(key)));
        }
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
        }
      })
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("atlas-refresh", APP_VERSION);
        window.location.replace(url.toString());
      });
  }, []);

  useEffect(() => {
    if (sidebarCollapsed === null) return;
    document.body.classList.toggle("atlas-sidebar-collapsed", sidebarCollapsed);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    return () => document.body.classList.remove("atlas-sidebar-collapsed");
  }, [sidebarCollapsed]);

  if (pathname === "/maintenance") return children;
  if (pathname.startsWith("/admin") || pathname.startsWith("/auth/")) {
    return <><ServiceWorkerRegistration />{children}</>;
  }
  const isQuiz = pathname.startsWith("/quiz/");

  return (
    <>
      <ServiceWorkerRegistration />
      <a className="atlas-skip-link" href="#top" onClick={skipToContent}>Zum Inhalt springen</a>
      {!isQuiz && (
        <>
          <MainNav isAltfragenContext={isAltfragenContext} pathname={pathname} />
          <AppTopbar
            collapsed={sidebarCollapsed === true}
            isAltfragenContext={isAltfragenContext}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
            pathname={pathname}
          />
          <MobileNav isAltfragenContext={isAltfragenContext} pathname={pathname} />
        </>
      )}
      <div className="atlas-account-chrome">
        <AtlasBrand />
        <AccountMenu />
      </div>
      <StudyPrompts />
      {children}
      {!isQuiz && (
        <footer className="atlas-footer">
          <span>ATLAS {APP_VERSION}</span>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link>
          <span>© Tim Weibel</span>
        </footer>
      )}
      {!isQuiz && <AdminShortcut />}
    </>
  );
}

function useAltfragenRouteContext(pathname: string): boolean {
  const [assessmentContext, setAssessmentContext] = useState<AssessmentRouteContext | null>(null);

  useEffect(() => {
    if (!pathname.startsWith("/assessment/")) {
      setAssessmentContext(null);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setAssessmentContext(params.get("origin") === "altfragen" || params.get("from") === "altfragen" ? "altfragen" : null);

    function handleAssessmentContext(event: Event) {
      const area = (event as CustomEvent<{ area?: AssessmentRouteContext }>).detail?.area;
      if (area === "altfragen" || area === "assessments") setAssessmentContext(area);
    }

    window.addEventListener(ASSESSMENT_ROUTE_CONTEXT_CHANGED_EVENT, handleAssessmentContext);
    return () => window.removeEventListener(ASSESSMENT_ROUTE_CONTEXT_CHANGED_EVENT, handleAssessmentContext);
  }, [pathname]);

  return assessmentContext === "altfragen";
}

function AppTopbar({
  collapsed,
  isAltfragenContext,
  onToggleSidebar,
  pathname
}: {
  collapsed: boolean;
  isAltfragenContext: boolean;
  onToggleSidebar: () => void;
  pathname: string;
}) {
  const label = topbarLabel(pathname, isAltfragenContext);
  return (
    <header className="app-topbar" aria-label="Aktueller Bereich">
      <div className="app-topbar-title">
        <button
          aria-label={collapsed ? "Sidebar einblenden" : "Sidebar ausblenden"}
          aria-controls="atlas-main-nav"
          aria-expanded={!collapsed}
          className="app-sidebar-toggle"
          onClick={onToggleSidebar}
          type="button"
        >
          <AtlasIcon name="sidebar" />
        </button>
        <span>{label}</span>
      </div>
    </header>
  );
}

function topbarLabel(pathname: string, isAltfragenContext: boolean): string {
  if (pathname === "/") return "Übersicht";
  if (pathname.startsWith("/assessment/") && isAltfragenContext) return "Altfragen";
  if (pathname.startsWith("/assessments") || pathname.startsWith("/assessment/") || pathname.startsWith("/blocks/")) {
    return "Übungen";
  }
  if (pathname.startsWith("/train")) return "Trainieren";
  if (pathname.startsWith("/progress")) return "Lernfortschritt";
  if (pathname.startsWith("/downloads")) return "Zusammenfassungen";
  if (pathname.startsWith("/altfragen")) return "Altfragen";
  if (pathname.startsWith("/settings")) return "Einstellungen";
  if (pathname.startsWith("/datenschutz")) return "Datenschutz";
  if (pathname.startsWith("/nutzungsbedingungen")) return "Nutzungsbedingungen";
  return "ATLAS";
}

function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
  const main = Array.from(document.querySelectorAll("main")).find((element) => element.getClientRects().length);
  if (!main) return;
  event.preventDefault();
  main.tabIndex = -1;
  main.focus({ preventScroll: true });
  main.scrollIntoView({ block: "start" });
}
