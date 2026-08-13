"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AtlasIcon } from "./AtlasIcon";
import { ASSESSMENT_ROUTE_CONTEXT_CHANGED_EVENT, type AssessmentRouteContext } from "@/lib/assessmentRouteContext";

export function MobileNav() {
  const pathname = usePathname();
  const isAltfragenContext = useAltfragenRouteContext(pathname);
  const isAssessmentDetail = pathname.startsWith("/assessment/");

  if (pathname.startsWith("/quiz")) return null;

  return (
    <nav className="mobile-nav" aria-label="Mobile Navigation">
      <Link className={pathname === "/" ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/" prefetch={false}>
        <span className="mobile-nav-icon" aria-hidden="true"><AtlasIcon name="dashboard" /></span>
        <span>Heute</span>
      </Link>
      <Link className={pathname.startsWith("/assessments") || pathname.startsWith("/blocks/") || pathname.startsWith("/altfragen") || (isAssessmentDetail && !isAltfragenContext) ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/assessments" prefetch={false}>
        <span className="mobile-nav-icon" aria-hidden="true"><AtlasIcon name="book" /></span>
        <span>Übungen</span>
      </Link>
      <Link className={pathname.startsWith("/train") ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/train" prefetch={false}>
        <span className="mobile-nav-icon" aria-hidden="true"><AtlasIcon name="play" /></span>
        <span>Train</span>
      </Link>
      <Link className={pathname.startsWith("/progress") ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/progress" prefetch={false}>
        <span className="mobile-nav-icon" aria-hidden="true"><AtlasIcon name="chart" /></span>
        <span>Stand</span>
      </Link>
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
