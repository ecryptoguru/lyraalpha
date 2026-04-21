import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function RewardsLoading() {
  return (
    <IntelligenceLoader
      message="Loading Rewards Center"
      subtext="Fetching points, achievements, and tier status"
    />
  );
}
