import { Suspense } from "react";
import dynamic from "next/dynamic";
import { MotionConfig } from "framer-motion";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CryptoHero } from "@/components/landing/CryptoHero";
import { LivePriceTicker } from "@/components/landing/LivePriceTicker";
import { PublicMyraWidget } from "@/components/landing/public-myra-widget";

// Lazy-load heavy below-fold sections to improve LCP and TTI
const ThesisSection = dynamic(() => import("@/components/landing/ThesisSection").then((m) => m.ThesisSection));
const KineticScrollStory = dynamic(() => import("@/components/landing/KineticScrollStory").then((m) => m.KineticScrollStory));
const HowItWorksV2 = dynamic(() => import("@/components/landing/HowItWorksV2").then((m) => m.HowItWorksV2));
const SixSignalsShowcase = dynamic(() => import("@/components/landing/SixSignalsShowcase").then((m) => m.SixSignalsShowcase));
const LyraCapabilitiesBento = dynamic(() => import("@/components/landing/LyraCapabilitiesBento").then((m) => m.LyraCapabilitiesBento));
const SocialProofWall = dynamic(() => import("@/components/landing/SocialProofWall").then((m) => m.SocialProofWall));
const PricingTeaser = dynamic(() => import("@/components/landing/PricingTeaser").then((m) => m.PricingTeaser));
const FinalKineticCTA = dynamic(() => import("@/components/landing/FinalKineticCTA").then((m) => m.FinalKineticCTA));
const BlogPreview = dynamic(() => import("@/components/landing/BlogPreview").then((m) => m.BlogPreview));

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
          <ThesisSection />
          <KineticScrollStory />
          <HowItWorksV2 />
          <SixSignalsShowcase />
          <LyraCapabilitiesBento />
          <SocialProofWall />
          <PricingTeaser />
          <FinalKineticCTA />
          <Suspense fallback={null}>
            <BlogPreview />
          </Suspense>
          <PublicMyraWidget />
          <Footer />
        </main>
      </div>
    </MotionConfig>
  );
}
