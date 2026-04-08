import type { Metadata } from "next";

import { BlogPreview } from "@/components/landing/BlogPreview";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingMotionStyles } from "@/components/landing/LandingMotionStyles";
import { PublicMyraWidget } from "@/components/landing/public-myra-widget";
import { StickyWaitlistBar } from "@/components/landing/StickyWaitlistBar";
import { Trust } from "@/components/landing/Trust";
import { WaitlistSection } from "@/components/landing/WaitlistSection";
import { HeroWebGLDynamic, ScrollytellingSectionDynamic } from "@/components/landing/DynamicLandingSections";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "InsightAlpha AI | The AI that computes before it speaks",
  description:
    "The only financial intelligence platform that grounds every AI response in deterministic engine computation. Lyra interprets what the engines computed — never invents. US & India. 5 asset classes. Join the early access waitlist.",
  openGraph: {
    title: "InsightAlpha AI | The AI that computes before it speaks",
    description:
      "Stop guessing. Start knowing. AI-grounded financial intelligence for US & India investors across equities, crypto, ETFs, mutual funds, and commodities. Early access waitlist open.",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "InsightAlpha AI | The AI that computes before it speaks",
    description:
      "Stop guessing. Start knowing. AI-grounded financial intelligence for US & India investors across equities, crypto, ETFs, mutual funds, and commodities. Early access waitlist open.",
    images: ["/og-image.png"],
  },
};

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "InsightAlpha AI",
  url: "https://insightalpha.ai",
  logo: "https://insightalpha.ai/logo.png",
  description:
    "AI-grounded financial intelligence platform for US and India markets. Deterministic engine computation with AI interpretation across equities, crypto, ETFs, mutual funds, and commodities.",
  sameAs: [] as string[],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "InsightAlpha AI",
  url: "https://insightalpha.ai",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://insightalpha.ai/blog?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const APP_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "InsightAlpha AI",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free waitlist — early access cohort",
  },
  description:
    "The only financial intelligence platform that grounds every AI response in deterministic engine computation. Lyra interprets what the engines computed across US and India markets.",
};

function HomeJsonLd() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_SCHEMA) }} />
    </>
  );
}

export default function Home() {
  return (
    <div
      className="dark flex h-dvh flex-col overflow-hidden bg-[#040816] font-sans text-white selection:bg-amber-300/30"
      suppressHydrationWarning
    >
      <HomeJsonLd />
      <LandingMotionStyles />
      <Navbar />
      <main
        data-scroll-root="landing"
        className="flex-1 min-h-0 overflow-x-clip overflow-y-auto will-change-scroll overscroll-contain scroll-smooth"
      >
        <HeroWebGLDynamic />
        <ScrollytellingSectionDynamic />
        <Trust />
        <HowItWorks />
        <Features />
        <WaitlistSection />
        <BlogPreview />
        <Footer />
      </main>
      <PublicMyraWidget />
      <StickyWaitlistBar />
    </div>
  );
}
