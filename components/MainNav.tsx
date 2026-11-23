import Link from "next/link";
import { AtlasIcon } from "./AtlasIcon";

const items = [
  { href: "/", icon: "dashboard", label: "Übersicht" },
  { href: "/assessments", icon: "book", label: "Übungen" },
  { href: "/train", icon: "play", label: "Trainieren" },
  { href: "/progress", icon: "chart", label: "Lernfortschritt" },
  { href: "/downloads", icon: "folder", label: "Zusammenfassungen" },
  { href: "/altfragen", icon: "archive", label: "Altfragen" }
] as const;

type NavProps = {
  isAltfragenContext: boolean;
  pathname: string;
};

export function mainNavLocation({ pathname, isAltfragenContext }: NavProps): string {
  if (pathname.startsWith("/assessment/")) return isAltfragenContext ? "/altfragen" : "/assessments";
  if (pathname.startsWith("/blocks/")) return "/assessments";
  return pathname;
}

export function MainNav(props: NavProps) {
  const location = mainNavLocation(props);

  return (
    <nav className="main-nav" id="atlas-main-nav" aria-label="Hauptnavigation">
      {items.map((item) => {
        const active = location === item.href;
        return (
          <Link
            aria-current={active ? (props.pathname === item.href ? "page" : "location") : undefined}
            className={active ? "main-nav-item is-active" : "main-nav-item"}
            href={item.href}
            key={item.href}
            title={item.label}
          >
            <AtlasIcon name={item.icon} />
            <span className="main-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
