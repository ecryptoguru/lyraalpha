"use client";

import { ClerkProvider } from "@clerk/nextjs";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/" clerkJSUrl="/api/clerk-js" telemetry={false}>
      {children}
    </ClerkProvider>
  );
}
