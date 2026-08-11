import { DesktopTrain } from "@/components/DesktopTrain";
import { MobileTrain } from "@/components/mobile/MobileTrain";

export default function TrainPage() {
  return (
    <>
      <MobileTrain />
      <DesktopTrain />
    </>
  );
}
