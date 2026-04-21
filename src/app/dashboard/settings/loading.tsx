import { IntelligenceLoader } from "@/components/ui/intelligence-loader";

export default function SettingsLoading() {
  return (
    <IntelligenceLoader
      message="Loading Settings"
      subtext="Fetching preferences and account configuration"
    />
  );
}
