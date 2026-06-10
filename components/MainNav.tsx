"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MainNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/quiz")) return null;

  const items = [
    { href: "/", label: "MC Übungsfragen" },
    { href: "/altfragen", label: "Altfragen" },
    { href: "/downloads", label: "Zusammenfassungen" }
  ];

  return (
    <nav className="main-nav" aria-label="Hauptnavigation">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link className={active ? "main-nav-item is-active" : "main-nav-item"} href={item.href} key={item.href}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
