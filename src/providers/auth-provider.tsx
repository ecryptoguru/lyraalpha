"use client";

import { ClerkProvider } from "@clerk/nextjs";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/" telemetry={false}>
      {children}
    </ClerkProvider>
  );
}
