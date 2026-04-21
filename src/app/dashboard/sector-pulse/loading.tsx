import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function SectorPulseLoading() {
  return (
    <IntelligenceLoader
      message="Loading Sector Pulse"
      subtext="Aggregating sector rotation and momentum data"
    />
  );
}
