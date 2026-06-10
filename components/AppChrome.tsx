"use client";

import { usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";
import { AdminShortcut } from "./AdminShortcut";
import { AtlasBrand } from "./AtlasBrand";
import { MainNav } from "./MainNav";
import { MobileNav } from "./MobileNav";
import { OnlinePresenceBadge } from "./OnlinePresenceBadge";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";
import { AriCompanion } from "./companion/AriCompanion";
import { CompanionDebugPanel } from "./companion/CompanionDebugPanel";
import { APP_VERSION } from "@/lib/appVersion";

export function AppChrome() {
  const pathname = usePathname();
  if (pathname === "/maintenance") return null;

  return (
    <>
      <ServiceWorkerRegistration />
      <AtlasBrand />
      <MainNav />
      <OnlinePresenceBadge />
      <AccountMenu />
      <MobileNav />
      <AriCompanion />
      <CompanionDebugPanel />
      <div className="site-copyright">
        <span>WebApp-Version {APP_VERSION}</span>
        <span>Copyright by Tim Weibel</span>
      </div>
      <AdminShortcut />
    </>
  );
}
