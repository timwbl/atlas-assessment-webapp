"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const DesktopLibrary = dynamic(
  () => import("@/components/LibraryClient").then((module) => module.LibraryClient),
  { loading: () => <ResponsiveRouteLoading /> }
);

const MobileHome = dynamic(
  () => import("@/components/mobile/MobileHome").then((module) => module.MobileHome),
  { loading: () => <ResponsiveRouteLoading mobile /> }
);

const MobileAssessments = dynamic(
  () => import("@/components/mobile/MobileAssessments").then((module) => module.MobileAssessments),
  { loading: () => <ResponsiveRouteLoading mobile /> }
);

export function ResponsiveLearningRoute({ mobileView }: { mobileView: "home" | "assessments" }) {
  const mobile = useMobileViewport();

  if (mobile === null) return <ResponsiveRouteLoading />;
  if (!mobile) return <DesktopLibrary />;
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
  return (
    <main className={mobile ? "mobile-action-page responsive-route-loading" : "shell responsive-route-loading"}>
      <span />
      <span />
      <span />
    </main>
  );
}
