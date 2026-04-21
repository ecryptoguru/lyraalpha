import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function LearningLoading() {
  return (
    <IntelligenceLoader
      message="Loading Learning Center"
      subtext="Preparing educational modules and progress tracking"
    />
  );
}
