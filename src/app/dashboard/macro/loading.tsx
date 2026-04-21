import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function MacroLoading() {
  return (
    <IntelligenceLoader
      message="Loading Macro Intelligence"
      subtext="Analyzing global macro trends and regime indicators"
    />
  );
}
