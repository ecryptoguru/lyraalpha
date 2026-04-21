import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function NarrativesLoading() {
  return (
    <IntelligenceLoader
      message="Loading Market Narratives"
      subtext="Scanning dominant market themes and sentiment"
    />
  );
}
