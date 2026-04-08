"use client";

import { useEffect } from "react";
import { PageErrorFallback } from "@/components/error-boundary";

/**
 * App-level error boundary for Next.js App Router
 * Catches errors in page components
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("App Error:", error);
    }
  }, [error]);

  return (
    <PageErrorFallback error={error} resetError={reset} showDetails={true} />
  );
}
