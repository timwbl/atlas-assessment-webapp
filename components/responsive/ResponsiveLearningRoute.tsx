"use client";

import { useEffect, useState } from "react";
import { DashboardClient } from "@/components/DashboardClient";
import { AtlasPageLoading } from "@/components/AtlasPageLoading";
import { LibraryClient } from "@/components/LibraryClient";
import { MobileAssessments } from "@/components/mobile/MobileAssessments";
import { MobileHome } from "@/components/mobile/MobileHome";
import { MobileTrain } from "@/components/mobile/MobileTrain";
import { MobileProgress } from "@/components/mobile/MobileProgress";
import { DesktopTrain } from "@/components/DesktopTrain";
import { DesktopProgress } from "@/components/DesktopProgress";

const views = {
  home: [DashboardClient, MobileHome],
  assessments: [LibraryClient, MobileAssessments],
  train: [DesktopTrain, MobileTrain],
  progress: [DesktopProgress, MobileProgress]
} as const;

export function ResponsiveLearningRoute({ mobileView }: { mobileView: keyof typeof views }) {
  const mobile = useMobileViewport();
  if (mobile === null) return <AtlasPageLoading />;
  const View = views[mobileView][mobile ? 1 : 0];
  return <View />;
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
