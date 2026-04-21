"use client";

import { useEffect } from "react";
import { PageErrorFallback } from "@/components/error-boundary";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Dashboard Error:", error);
    }
  }, [error]);

  return (
    <PageErrorFallback error={error} resetError={reset} showDetails={true} />
  );
}
