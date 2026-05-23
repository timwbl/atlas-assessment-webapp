"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/quiz")) return null;

  return (
    <nav className="mobile-nav" aria-label="Mobile Navigation">
      <Link className={pathname === "/" ? "mobile-nav-item is-active" : "mobile-nav-item"} href="/">
        <span aria-hidden="true">⌂</span>
        <span>Library</span>
      </Link>
      <a className="mobile-nav-item" href="#top">
        <span aria-hidden="true">↑</span>
        <span>Oben</span>
      </a>
    </nav>
  );
}
