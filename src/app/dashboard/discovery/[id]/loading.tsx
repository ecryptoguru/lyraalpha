import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function DiscoveryLoading() {
  return (
    <IntelligenceLoader
      message="Loading Discovery Insights"
      subtext="Analyzing market signals and institutional data"
    />
  );
}
