import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function AnalyticsLoading() {
  return (
    <IntelligenceLoader
      message="Loading Analytics Dashboard"
      subtext="Computing performance metrics and visualizations"
    />
  );
}
