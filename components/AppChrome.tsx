"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AtlasBrand } from "./AtlasBrand";
import { MainNav } from "./MainNav";
import { MobileNav } from "./MobileNav";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";
import { APP_VERSION } from "@/lib/appVersion";
import { StudyPrompts } from "./study/StudyPrompts";
import { useUserStudyContext } from "./study/UserStudyProvider";

const AccountMenu = dynamic(
  () => import("./AccountMenu").then((module) => module.AccountMenu),
  { ssr: false }
);
const AdminShortcut = dynamic(
  () => import("./AdminShortcut").then((module) => module.AdminShortcut),
  { ssr: false }
);
const OnlinePresenceBadge = dynamic(
  () => import("./OnlinePresenceBadge").then((module) => module.OnlinePresenceBadge),
  { ssr: false }
);
const AriCompanion = dynamic(
  () => import("./companion/AriCompanion").then((module) => module.AriCompanion),
  { ssr: false }
);
const CompanionDebugPanel = dynamic(
  () => import("./companion/CompanionDebugPanel").then((module) => module.CompanionDebugPanel),
  { ssr: false }
);

export function AppChrome() {
  const pathname = usePathname();
  const { hydrated, settings } = useUserStudyContext();
  if (pathname === "/maintenance") return null;
  if (pathname.startsWith("/admin")) return <ServiceWorkerRegistration />;

  return (
    <>
      <ServiceWorkerRegistration />
      <AtlasBrand />
      <MainNav />
      <OnlinePresenceBadge />
      <AccountMenu />
      <MobileNav />
      {hydrated && settings.ariEnabled && <AriCompanion />}
      <StudyPrompts />
      {process.env.NODE_ENV === "development" && <CompanionDebugPanel />}
      <div className="site-copyright">
        <span>WebApp-Version {APP_VERSION}</span>
        <span>Copyright by Tim Weibel</span>
      </div>
      <AdminShortcut />
    </>
  );
}
