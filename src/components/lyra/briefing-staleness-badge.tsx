"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Clock } from "lucide-react";
import { fetcher } from "@/lib/swr-fetcher";

export function BriefingStalenessBadge({ region }: { region: string }) {
  const { data } = useSWR<{ briefing?: { generatedAt?: string } }>(
    `/api/lyra/briefing?region=${region}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const generatedAt = data?.briefing?.generatedAt;
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!generatedAt) {
      return;
    }

    const generatedMs = new Date(generatedAt).getTime();
    const currentAgeHours = (Date.now() - generatedMs) / 3_600_000;

    const updateNow = () => setNow(Date.now());
    updateNow();

    // Only run the recurring interval when the badge is visible (age >= 16h).
    // Otherwise, set a single timeout to wake up when the badge would appear.
    if (currentAgeHours >= 16) {
      const interval = setInterval(updateNow, 60_000);
      return () => clearInterval(interval);
    }

    // Schedule a single wake-up near the 16h mark
    const msUntil16h = Math.max(60_000, (16 - currentAgeHours) * 3_600_000);
    const timeout = setTimeout(() => {
      updateNow();
      // After waking up, the effect re-runs and will start the interval if needed
    }, msUntil16h);
    return () => clearTimeout(timeout);
  }, [generatedAt]);

  const ageHours = generatedAt
    ? Math.max(0, (now - new Date(generatedAt).getTime()) / 3_600_000)
    : null;

  if (ageHours === null || ageHours < 18) return null;

  const hoursLabel = ageHours < 24
    ? `${Math.floor(ageHours)}h`
    : `${Math.floor(ageHours / 24)}d`;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-[10px] font-bold text-warning">
      <Clock className="h-3 w-3 shrink-0" />
      Market briefing is {hoursLabel} old — Lyra context may be stale
    </div>
  );
}
