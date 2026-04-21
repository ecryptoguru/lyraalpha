import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function TimelineLoading() {
  return (
    <IntelligenceLoader
      message="Loading Event Timeline"
      subtext="Aggregating market events and impact analysis"
    />
  );
}
