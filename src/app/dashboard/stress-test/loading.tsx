import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function StressTestLoading() {
  return (
    <IntelligenceLoader
      message="Loading Shock Simulator"
      subtext="Preparing historical scenario data and stress models"
    />
  );
}
