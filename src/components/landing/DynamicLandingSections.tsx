"use client";

import dynamic from "next/dynamic";

export const HeroWebGLDynamic = dynamic(
  () => import("@/components/landing/HeroWebGL").then((m) => ({ default: m.HeroWebGL })),
  {
    ssr: false,
    loading: () => (
      <div className="relative min-h-screen w-full bg-[#040816]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(129,140,248,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(34,211,238,0.05),transparent_55%)]" />
      </div>
    ),
  }
);

export const ScrollytellingSectionDynamic = dynamic(
  () =>
    import("@/components/landing/ScrollytellingSection").then((m) => ({
      default: m.ScrollytellingSection,
    })),
  {
    ssr: false,
    loading: () => <div className="w-full bg-[#040816]" style={{ height: "300vh" }} />,
  }
);
