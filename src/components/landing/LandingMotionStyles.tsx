"use client";

export function LandingMotionStyles() {
  return (
    <style jsx global>{`
      .hero-headline {
        font-family: var(--font-space-grotesk), system-ui, sans-serif;
      }

      .hud-card p,
      .font-mono {
        font-family: var(--font-jetbrains-mono), monospace;
      }

      /* ── Landing page body override ── */
      [data-scroll-root="landing"] {
        background-color: #040816;
      }

      /* ── HUD panel animations ── */
      .hud-card {
        transition: border-color 250ms ease, background-color 250ms ease, transform 250ms ease;
      }

      .hud-card:hover {
        border-color: rgba(245, 158, 11, 0.25);
        transform: translateY(-2px);
      }

      .hud-scan-line {
        animation: hud-scan 3.5s ease-in-out infinite;
      }

      @keyframes hud-scan {
        0%, 100% { opacity: 0.15; transform: scaleX(0.4); }
        50% { opacity: 0.7; transform: scaleX(1); }
      }

      /* ── CTA glow pulse ── */
      .hero-cta-primary {
        position: relative;
      }

      .hero-cta-primary::before {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: 9999px;
        background: linear-gradient(135deg, rgba(245,158,11,0.4), rgba(129,140,248,0.2));
        opacity: 0;
        transition: opacity 300ms ease;
        filter: blur(8px);
        z-index: -1;
      }

      .hero-cta-primary:hover::before {
        opacity: 1;
      }

      /* ── Obsidian grid pattern ── */
      .obsidian-grid {
        background-image:
          linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
        background-size: 72px 72px;
      }

      /* ── Existing landing reveal animations ── */
      .landing-reveal {
        opacity: 0;
        transform: translate3d(0, var(--landing-reveal-y, 28px), 0) scale(var(--landing-reveal-scale, 0.985));
        transition:
          opacity 900ms cubic-bezier(0.16, 1, 0.3, 1),
          transform 900ms cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform, opacity;
      }

      .landing-reveal--visible {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
      }

      .landing-float-slow {
        animation: landing-float-slow 12s ease-in-out infinite;
      }

      .landing-float-fast {
        animation: landing-float-fast 8s ease-in-out infinite;
      }

      .landing-drift {
        animation: landing-drift 16s linear infinite;
      }

      .landing-pulse-line {
        animation: landing-pulse-line 3.2s ease-in-out infinite;
      }

      .landing-rotate-frame {
        animation: landing-rotate-frame 18s linear infinite;
      }

      .landing-shimmer {
        position: relative;
        overflow: hidden;
      }

      .landing-shimmer::after {
        content: "";
        position: absolute;
        inset: -20%;
        background: linear-gradient(110deg, transparent 25%, rgba(255, 255, 255, 0.09) 45%, transparent 65%);
        transform: translateX(-120%);
        animation: landing-shimmer 5.5s ease-in-out infinite;
      }

      @keyframes landing-float-slow {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -14px, 0); }
      }

      @keyframes landing-float-fast {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -8px, 0); }
      }

      @keyframes landing-drift {
        0% { transform: translate3d(-6%, 0, 0) rotate(0deg); }
        50% { transform: translate3d(6%, -4%, 0) rotate(180deg); }
        100% { transform: translate3d(-6%, 0, 0) rotate(360deg); }
      }

      @keyframes landing-pulse-line {
        0%, 100% { opacity: 0.35; transform: scaleX(0.92); }
        50% { opacity: 1; transform: scaleX(1); }
      }

      @keyframes landing-rotate-frame {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes landing-shimmer {
        0% { transform: translateX(-120%); }
        60%, 100% { transform: translateX(120%); }
      }

      @media (prefers-reduced-motion: reduce) {
        .landing-reveal {
          opacity: 1;
          transform: none;
          transition: none;
          will-change: auto;
        }

        .landing-float-slow,
        .landing-float-fast,
        .landing-drift,
        .landing-pulse-line,
        .landing-rotate-frame,
        .landing-shimmer::after,
        .hud-scan-line {
          animation: none !important;
        }
      }
    `}</style>
  );
}
