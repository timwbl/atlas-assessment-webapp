"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AtlasIcon } from "./AtlasIcon";
import { ASSESSMENT_ROUTE_CONTEXT_CHANGED_EVENT, type AssessmentRouteContext } from "@/lib/assessmentRouteContext";

export function MainNav() {
  const pathname = usePathname();
  const isAltfragenContext = useAltfragenRouteContext(pathname);
  const isAssessmentDetail = pathname.startsWith("/assessment/");

  if (pathname.startsWith("/quiz")) return null;

  const items = [
    { href: "/", icon: "dashboard", label: "Dashboard" },
    { href: "/assessments", icon: "book", label: "Übungen" },
    { href: "/train", icon: "play", label: "Trainieren" },
    { href: "/progress", icon: "chart", label: "Lernfortschritt" },
    { href: "/downloads", icon: "folder", label: "Zusammenfassungen" },
    { href: "/altfragen", icon: "archive", label: "Altfragen" }
  ] as const;

  return (
    <nav className="main-nav" aria-label="Hauptnavigation">
      {items.map((item) => {
        const active =
          item.href === "/" ?
            pathname === "/" :
            item.href === "/assessments" ?
              pathname.startsWith("/assessments") ||
              pathname.startsWith("/blocks/") ||
              (isAssessmentDetail && !isAltfragenContext) :
              item.href === "/altfragen" ?
                pathname.startsWith("/altfragen") ||
                (isAssessmentDetail && isAltfragenContext) :
              pathname.startsWith(item.href);

        return (
          <Link className={active ? "main-nav-item is-active" : "main-nav-item"} href={item.href} key={item.href}>
            <AtlasIcon name={item.icon} />
            <span className="main-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
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
