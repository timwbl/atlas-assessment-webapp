import type { Metadata } from "next";
import { Suspense } from "react";
import { MaintenanceAccess } from "@/components/MaintenanceAccess";

export const metadata: Metadata = {
  title: "ATLAS wird überarbeitet",
  robots: { index: false, follow: false }
};

export default function MaintenancePage() {
  return (
    <Suspense>
      <MaintenanceAccess />
    </Suspense>
  );
}
