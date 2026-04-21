import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function CompareLoading() {
  return (
    <IntelligenceLoader
      message="Preparing Comparison Analysis"
      subtext="Loading multi-asset correlation and regime data"
    />
  );
}
