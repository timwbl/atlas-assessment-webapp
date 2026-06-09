import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppChrome } from "@/components/AppChrome";
import { CompanionProvider } from "@/components/companion/CompanionProvider";
import { APP_VERSION } from "@/lib/appVersion";
import "@/components/companion/ari-companion.css";
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
        <CompanionProvider>
          <AppChrome />
          {children}
        </CompanionProvider>
      </body>
    </html>
  );
}
