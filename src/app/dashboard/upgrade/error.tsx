"use client";

import { useEffect } from "react";
import { PageErrorFallback } from "@/components/error-boundary";

export default function UpgradeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Upgrade Error:", error);
    }
  }, [error]);

  return (
    <PageErrorFallback error={error} resetError={reset} showDetails={true} />
  );
}
