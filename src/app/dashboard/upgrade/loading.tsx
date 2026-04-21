import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function UpgradeLoading() {
  return (
    <IntelligenceLoader
      message="Loading Plan Options"
      subtext="Comparing features and pricing tiers"
    />
  );
}
