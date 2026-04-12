import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Trust } from "@/components/landing/Trust";
import { BlogPreview } from "@/components/landing/BlogPreview";
import { LandingMotionStyles } from "@/components/landing/LandingMotionStyles";
import { PublicMyraWidget } from "@/components/landing/public-myra-widget";
import {
  HeroWebGLDynamic,
  ScrollytellingSectionDynamic,
} from "@/components/landing/DynamicLandingSections";

export default function Home() {
  return (
    <div className="relative h-screen flex flex-col bg-[#040816]">
      <LandingMotionStyles />
      <Navbar />
      <main data-scroll-root="landing" className="flex-1 overflow-y-auto overflow-x-hidden">
        <HeroWebGLDynamic />
        <ScrollytellingSectionDynamic />
        <Trust />
        <HowItWorks />
        <Features />
        <Suspense fallback={null}>
          <BlogPreview />
        </Suspense>
        <PublicMyraWidget />
      </main>
    </div>
  );
}
