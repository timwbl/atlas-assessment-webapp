"use client";

import { useEffect, useState } from "react";
import { DashboardClient } from "@/components/DashboardClient";
import { AtlasPageLoading } from "@/components/AtlasPageLoading";
import { LibraryClient } from "@/components/LibraryClient";
import { MobileAssessments } from "@/components/mobile/MobileAssessments";
import { MobileHome } from "@/components/mobile/MobileHome";

export function ResponsiveLearningRoute({ mobileView }: { mobileView: "home" | "assessments" }) {
  const mobile = useMobileViewport();

  if (mobile === null) return <ResponsiveRouteLoading />;
  if (!mobile) return mobileView === "home" ? <DashboardClient /> : <LibraryClient />;
  return mobileView === "home" ? <MobileHome /> : <MobileAssessments />;
}

function useMobileViewport(): boolean | null {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mobile;
}

function ResponsiveRouteLoading({ mobile = false }: { mobile?: boolean }) {
  if (!mobile) return <AtlasPageLoading />;
  return (
    <main className={mobile ? "mobile-action-page responsive-route-loading" : "shell responsive-route-loading"}>
      <span />
      <span />
      <span />
    </main>
  );
}
