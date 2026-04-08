import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function DiscoveryLoading() {
  return (
    <IntelligenceLoader
      message="Scanning Market Themes"
      subtext="Aggregating cross-asset regime data"
    />
  );
}
