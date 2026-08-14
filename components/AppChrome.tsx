"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AtlasBrand } from "./AtlasBrand";
import { MainNav } from "./MainNav";
import { MobileNav } from "./MobileNav";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";
import { APP_VERSION } from "@/lib/appVersion";
import { StudyPrompts } from "./study/StudyPrompts";
import { AtlasIcon, type AtlasIconName } from "./AtlasIcon";
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

export function AppChrome() {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isPageEnd, setIsPageEnd] = useState(false);
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
    document.body.classList.toggle("atlas-sidebar-collapsed", sidebarCollapsed);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    return () => document.body.classList.remove("atlas-sidebar-collapsed");
  }, [sidebarCollapsed]);

  useEffect(() => {
    let frame = 0;

    function updatePageEndState() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const root = document.documentElement;
        const scrollTop = window.scrollY || root.scrollTop;
        const viewportHeight = window.innerHeight;
        const pageHeight = Math.max(root.scrollHeight, document.body.scrollHeight);
        setIsPageEnd(scrollTop + viewportHeight >= pageHeight - 16);
      });
    }

    updatePageEndState();
    const timeout = window.setTimeout(updatePageEndState, 180);
    window.addEventListener("scroll", updatePageEndState, { passive: true });
    window.addEventListener("resize", updatePageEndState);

    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updatePageEndState);
      window.removeEventListener("resize", updatePageEndState);
    };
  }, [pathname]);

  if (pathname === "/maintenance") return null;
  if (pathname.startsWith("/admin")) return <ServiceWorkerRegistration />;

  return (
    <>
      <ServiceWorkerRegistration />
      <AtlasBrand />
      <MainNav />
      <AppTopbar
        collapsed={sidebarCollapsed}
        isAltfragenContext={isAltfragenContext}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        pathname={pathname}
      />
      <AccountMenu />
      <MobileNav />
      <StudyPrompts />
      <div className={isPageEnd ? "site-copyright is-visible" : "site-copyright"} aria-hidden={!isPageEnd}>
        <span>WebApp-Version {APP_VERSION}</span>
        <Link href="/datenschutz">Datenschutz</Link>
        <Link href="/nutzungsbedingungen">Nutzungsbedingungen</Link>
        <span>Copyright by Tim Weibel</span>
      </div>
      <AdminShortcut />
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
  if (pathname.startsWith("/quiz")) return null;

  const meta = topbarMeta(pathname, isAltfragenContext);
  return (
    <header className="app-topbar" aria-label="Aktueller Bereich">
      <div className="app-topbar-title">
        <button
          aria-label={collapsed ? "Sidebar einblenden" : "Sidebar ausblenden"}
          aria-pressed={collapsed}
          className="app-sidebar-toggle"
          onClick={onToggleSidebar}
          type="button"
        >
          <AtlasIcon name="sidebar" />
        </button>
        <span>{meta.label}</span>
      </div>
    </header>
  );
}

function topbarMeta(pathname: string, isAltfragenContext = false): { label: string; icon: AtlasIconName } {
  if (pathname === "/") return { label: "Dashboard", icon: "dashboard" };
  if (pathname.startsWith("/assessment/") && isAltfragenContext) return { label: "Altfragen", icon: "archive" };
  if (pathname.startsWith("/assessments") || pathname.startsWith("/assessment/") || pathname.startsWith("/blocks/")) {
    return { label: "Übungen", icon: "book" };
  }
  if (pathname.startsWith("/train")) return { label: "Trainieren", icon: "play" };
  if (pathname.startsWith("/progress")) return { label: "Lernfortschritt", icon: "chart" };
  if (pathname.startsWith("/downloads")) return { label: "Zusammenfassungen", icon: "folder" };
  if (pathname.startsWith("/altfragen")) return { label: "Altfragen", icon: "archive" };
  if (pathname.startsWith("/settings")) return { label: "Einstellungen", icon: "settings" };
  if (pathname.startsWith("/datenschutz")) return { label: "Datenschutz", icon: "shield" };
  if (pathname.startsWith("/nutzungsbedingungen")) return { label: "Nutzungsbedingungen", icon: "clipboard" };
  return { label: "ATLAS", icon: "dashboard" };
}
