"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/quiz")) return null;

  return (
    <nav className="mobile-nav" aria-label="Mobile Navigation">
      <Link className={pathname === "/" ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/">
        <span className="mobile-nav-icon" aria-hidden="true">⌂</span>
        <span>Home</span>
      </Link>
      <Link className={pathname.startsWith("/train") ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/train">
        <span className="mobile-nav-icon" aria-hidden="true">▶</span>
        <span>Train</span>
      </Link>
      <Link className={pathname.startsWith("/assessments") || pathname.startsWith("/assessment/") ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/assessments">
        <span className="mobile-nav-icon" aria-hidden="true">▤</span>
        <span>Assessments</span>
      </Link>
      <Link className={pathname.startsWith("/progress") ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/progress">
        <span className="mobile-nav-icon" aria-hidden="true">◒</span>
        <span>Progress</span>
      </Link>
    </nav>
  );
}
