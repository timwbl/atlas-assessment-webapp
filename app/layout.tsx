import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppChrome } from "@/components/AppChrome";
import { CompanionProvider } from "@/components/companion/CompanionProvider";
import { UserStudyProvider } from "@/components/study/UserStudyProvider";
import { APP_VERSION } from "@/lib/appVersion";
import "@/components/companion/ari-companion.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MC Übungsfragen",
  description: "Read-only Assessment-WebApp für medizinische Vorlesungen.",
  manifest: "/manifest.webmanifest",
  other: {
    "application-version": APP_VERSION
  },
  icons: {
    icon: [
      { url: "/atlas-logo.svg", type: "image/svg+xml" },
      { url: "/icons/atlas-192.png", sizes: "192x192", type: "image/png" }
    ],
    shortcut: "/atlas-logo.svg",
    apple: "/icons/atlas-192.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ATLAS"
  }
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de" data-app-version={APP_VERSION} suppressHydrationWarning>
      <body>
        <UserStudyProvider>
          <CompanionProvider>
            <AppChrome />
            {children}
          </CompanionProvider>
        </UserStudyProvider>
      </body>
    </html>
  );
}
