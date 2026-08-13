"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AtlasIcon } from "./AtlasIcon";

export function MobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAltfragenContext = searchParams.get("origin") === "altfragen" || searchParams.get("from") === "altfragen";
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
