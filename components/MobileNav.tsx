import Link from "next/link";
import { AtlasIcon } from "./AtlasIcon";
import { mainNavLocation } from "./MainNav";

const items = [
  { href: "/", icon: "dashboard", label: "Übersicht" },
  { href: "/assessments", icon: "book", label: "Übungen" },
  { href: "/train", icon: "play", label: "Training" },
  { href: "/progress", icon: "chart", label: "Fortschritt" },
  { href: "/downloads", icon: "folder", label: "Unterlagen" }
] as const;

export function MobileNav(props: Parameters<typeof mainNavLocation>[0]) {
  const location = mainNavLocation(props);
  const activeHref = location === "/altfragen" ? "/assessments" : location;

  return (
    <nav className="mobile-nav" aria-label="Mobile Hauptnavigation">
      {items.map((item) => {
        const active = activeHref === item.href;
        return (
          <Link
            aria-current={active ? (props.pathname === item.href ? "page" : "location") : undefined}
            className={active ? "mobile-nav-item is-active" : "mobile-nav-item"}
            href={item.href}
            key={item.href}
            prefetch={false}
          >
            <span className="mobile-nav-icon" aria-hidden="true"><AtlasIcon name={item.icon} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
