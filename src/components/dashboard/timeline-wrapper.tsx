"use client";

import dynamic from "next/dynamic";
import { MultiHorizonTimelineProps } from "@/components/ui/MultiHorizonTimeline";

const MultiHorizonTimeline = dynamic(
  () => import("@/components/ui/MultiHorizonTimeline").then((mod) => mod.MultiHorizonTimeline),
  { 
    loading: () => <div className="h-[300px] w-full rounded-2xl bg-muted/5 animate-pulse" />,
    ssr: false 
  }
);

export function TimelineWrapper(props: MultiHorizonTimelineProps) {
  return <MultiHorizonTimeline {...props} />;
}
