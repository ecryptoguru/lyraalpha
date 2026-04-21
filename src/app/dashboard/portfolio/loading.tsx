import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function PortfolioLoading() {
  return (
    <IntelligenceLoader
      message="Loading Portfolio Intelligence"
      subtext="Analyzing holdings, risk metrics, and allocation data"
    />
  );
}
