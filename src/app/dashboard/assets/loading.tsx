import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function AssetsLoading() {
  return (
    <IntelligenceLoader
      message="Loading Asset Universe"
      subtext="Fetching market data and intelligence scores"
    />
  );
}
