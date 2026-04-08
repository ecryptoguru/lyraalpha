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
  const initialRegion = (savedRegion === "US" || savedRegion === "IN") ? (savedRegion as Region) : "US";
  const viewer = await getDashboardViewer();

  // Auth gate — middleware already blocks unauthenticated requests but handle null userId
  // defensively in case the middleware is mis-configured or bypassed in tests.
  if (!viewer.userId) {
    redirect("/sign-in");
  }

  // Prelaunch gate — authenticated STARTER users must redeem a coupon before entering the dashboard.
  // This closes the bypass for Google OAuth, direct URL navigation, and any other path that skips
  // the client-side coupon check on the sign-in page.
  if (viewer.plan === "STARTER") {
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
