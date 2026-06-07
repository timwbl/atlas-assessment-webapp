import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { AtlasBrand } from "@/components/AtlasBrand";
import { AdminShortcut } from "@/components/AdminShortcut";
import { MainNav } from "@/components/MainNav";
import { MobileNav } from "@/components/MobileNav";
import { OnlinePresenceBadge } from "@/components/OnlinePresenceBadge";
import { APP_VERSION } from "@/lib/appVersion";
import "./globals.css";

export const metadata: Metadata = {
  title: "MC Übungsfragen",
  description: "Read-only Assessment-WebApp für medizinische Vorlesungen.",
  other: {
    "application-version": APP_VERSION
  },
  icons: {
    icon: [
      { url: "/atlas-logo.svg", type: "image/svg+xml" }
    ],
    shortcut: "/atlas-logo.svg",
    apple: "/atlas-logo.svg"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de" data-app-version={APP_VERSION} suppressHydrationWarning>
      <body>
        <AtlasBrand />
        <MainNav />
        <OnlinePresenceBadge />
        <AccountMenu />
        {children}
        <MobileNav />
        <div className="site-copyright">
          <span>WebApp-Version {APP_VERSION}</span>
          <span>Copyright by Tim Weibel</span>
        </div>
        <AdminShortcut />
      </body>
    </html>
  );
}
