import { Suspense } from "react";
import dynamic from "next/dynamic";
import { MotionConfig } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CryptoHero } from "@/components/landing/CryptoHero";
import { LivePriceTicker } from "@/components/landing/LivePriceTicker";
import { PublicMyraWidget } from "@/components/landing/public-myra-widget";

// Narrative-driven flow built on 6 marketing pillars:
// 1. Hero — Institutional Crypto Intelligence. Retail Pricing.
// 2. NoiseToAlpha — Turn Crypto Noise into Actionable Alpha.
// 3. InstitutionalEdge — Think Like a Fund. Trade Like an Insider.
// 4. SixSignalsShowcase — Your AI Edge in Crypto Markets.
// 5. WorkflowsShowcase — Stop Researching. Start Executing.
// 6. PricingTeaser — Invest in Your Portfolio. Not in Expensive Tools.
const NoiseToAlpha = dynamic(() => import("@/components/landing/NoiseToAlpha").then((m) => m.NoiseToAlpha));
const InstitutionalEdge = dynamic(() => import("@/components/landing/InstitutionalEdge").then((m) => m.InstitutionalEdge));
const SixSignalsShowcase = dynamic(() => import("@/components/landing/SixSignalsShowcase").then((m) => m.SixSignalsShowcase));
const LyraCapabilitiesBento = dynamic(() => import("@/components/landing/LyraCapabilitiesBento").then((m) => m.LyraCapabilitiesBento));
const WorkflowsShowcase = dynamic(() => import("@/components/landing/WorkflowsShowcase").then((m) => m.WorkflowsShowcase));
const PricingTeaser = dynamic(() => import("@/components/landing/PricingTeaser").then((m) => m.PricingTeaser));
const EmailCapture = dynamic(() => import("@/components/landing/EmailCapture").then((m) => m.EmailCapture));
const FinalKineticCTA = dynamic(() => import("@/components/landing/FinalKineticCTA").then((m) => m.FinalKineticCTA));

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="dark relative h-screen flex flex-col bg-[#040816]">
        <Navbar />
        <main
          data-scroll-root="landing"
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
        >
          <CryptoHero />
          <LivePriceTicker />
          <Suspense fallback={null}>
            <NoiseToAlpha />
          </Suspense>
          <Suspense fallback={null}>
            <InstitutionalEdge />
          </Suspense>
          <Suspense fallback={null}>
            <SixSignalsShowcase />
          </Suspense>
          <Suspense fallback={null}>
            <LyraCapabilitiesBento />
          </Suspense>
          <Suspense fallback={null}>
            <WorkflowsShowcase />
          </Suspense>
          <Suspense fallback={null}>
            <PricingTeaser />
          </Suspense>
          <Suspense fallback={null}>
            <EmailCapture />
          </Suspense>
          <Suspense fallback={null}>
            <FinalKineticCTA />
          </Suspense>
          <PublicMyraWidget />
          <Footer />
        </main>
      </div>
    </MotionConfig>
  );
}
