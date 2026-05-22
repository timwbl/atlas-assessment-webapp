import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AtlasBrand } from "@/components/AtlasBrand";
import { AdminShortcut } from "@/components/AdminShortcut";
import "./globals.css";

export const metadata: Metadata = {
  title: "MC Übungsfragen",
  description: "Read-only Assessment-WebApp für medizinische Vorlesungen."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <AtlasBrand />
        {children}
        <div className="site-copyright">Copyright by Tim Weibel</div>
        <AdminShortcut />
      </body>
    </html>
  );
}
