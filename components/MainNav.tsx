"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtlasIcon } from "./AtlasIcon";

export function MainNav() {
  const pathname = usePathname();

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
              pathname.startsWith("/assessment/") ||
              pathname.startsWith("/blocks/") :
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
