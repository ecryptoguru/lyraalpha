import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function AssetLoading() {
  return (
    <IntelligenceLoader
      message="Loading Asset Intelligence"
      subtext="Fetching real-time market data and AI analysis"
    />
  );
}
