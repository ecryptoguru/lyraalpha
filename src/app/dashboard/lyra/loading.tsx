import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function LyraLoading() {
  return (
    <IntelligenceLoader
      message="Initializing Lyra Intelligence"
      subtext="Preparing AI analysis models and context"
    />
  );
}
