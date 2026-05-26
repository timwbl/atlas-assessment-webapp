import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { AtlasBrand } from "@/components/AtlasBrand";
import { AdminShortcut } from "@/components/AdminShortcut";
import { MainNav } from "@/components/MainNav";
import { MobileNav } from "@/components/MobileNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "MC Übungsfragen",
  description: "Read-only Assessment-WebApp für medizinische Vorlesungen.",
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
    <html lang="de" suppressHydrationWarning>
      <body>
        <AtlasBrand />
        <MainNav />
        <AccountMenu />
        {children}
        <MobileNav />
        <div className="site-copyright">Copyright by Tim Weibel</div>
        <AdminShortcut />
      </body>
    </html>
  );
}
