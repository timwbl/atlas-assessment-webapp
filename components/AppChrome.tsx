"use client";

import { usePathname } from "next/navigation";
import { AccountMenu } from "./AccountMenu";
import { AdminShortcut } from "./AdminShortcut";
import { AtlasBrand } from "./AtlasBrand";
import { MainNav } from "./MainNav";
import { MobileNav } from "./MobileNav";
import { OnlinePresenceBadge } from "./OnlinePresenceBadge";
import { APP_VERSION } from "@/lib/appVersion";

export function AppChrome() {
  const pathname = usePathname();
  if (pathname === "/maintenance") return null;

  return (
    <>
      <AtlasBrand />
      <MainNav />
      <OnlinePresenceBadge />
      <AccountMenu />
      <MobileNav />
      <div className="site-copyright">
        <span>WebApp-Version {APP_VERSION}</span>
        <span>Copyright by Tim Weibel</span>
      </div>
      <AdminShortcut />
    </>
  );
}
