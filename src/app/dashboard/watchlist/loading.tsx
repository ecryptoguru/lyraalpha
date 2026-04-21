import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function WatchlistLoading() {
  return (
    <IntelligenceLoader
      message="Loading Your Watchlist"
      subtext="Fetching tracked assets and price movements"
    />
  );
}
