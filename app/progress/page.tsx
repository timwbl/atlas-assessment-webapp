import { DesktopProgress } from "@/components/DesktopProgress";
import { MobileProgress } from "@/components/mobile/MobileProgress";

export default function ProgressPage() {
  return (
    <>
      <MobileProgress />
      <DesktopProgress />
    </>
  );
}
