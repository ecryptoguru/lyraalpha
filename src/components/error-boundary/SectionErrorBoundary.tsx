"use client";

import type { ReactNode } from "react";

import { ErrorBoundary } from "./ErrorBoundary";
import { SectionErrorFallback } from "./ErrorFallback";

export function SectionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <SectionErrorFallback error={error} resetError={resetError} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
