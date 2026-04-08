import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function DashboardLoading() {
  return (
    <IntelligenceLoader
      message="Synchronizing Market Intelligence"
      subtext="Aggregating institutional coverage data"
    />
  );
}
