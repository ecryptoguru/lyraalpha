import { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardLayoutClient } from "./DashboardLayoutClient";
import { Region } from "@/lib/context/RegionContext";
import { getDashboardViewer } from "@/lib/server/dashboard-viewer";

export const metadata: Metadata = {
  title: "Dashboard | LyraAlpha AI",
  description: "Institutional Assessment Console",
  openGraph: {
    title: "Dashboard | LyraAlpha AI",
    description: "Institutional Assessment Console",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dashboard | LyraAlpha AI",
    description: "Institutional Assessment Console",
    images: ["/og-image.png"],
  },
};

export default async function Layout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const savedRegion = cookieStore.get("user_region_preference")?.value;
  const VALID_REGIONS = ["US", "IN"] as const;
  type ValidRegion = typeof VALID_REGIONS[number];
  const initialRegion = (VALID_REGIONS.includes(savedRegion as ValidRegion) ? savedRegion : "US") as Region;
  const viewer = await getDashboardViewer();

  // Auth gate — middleware already blocks unauthenticated requests but handle null userId
  // defensively in case the middleware is mis-configured or bypassed in tests.
  // Allow access when auth bypass is active (userId will be a real ELITE user from auth.ts)
  if (!viewer.userId) {
    redirect("/sign-in");
  }

  return (
    <DashboardLayoutClient
      initialRegion={initialRegion}
      initialPlan={viewer.plan}
      initialOnboardingCompleted={viewer.onboardingCompleted}
      userId={viewer.userId}
    >
      {children}
    </DashboardLayoutClient>
  );
}
