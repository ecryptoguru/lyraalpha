"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const LazyThemeToggle = dynamic(
  () => import("@/components/theme-toggle").then((mod) => mod.ThemeToggle),
  {
    ssr: false,
    loading: () => (
      <div className="inline-grid h-10 w-[76px] grid-cols-2 rounded-full border border-border/70 bg-background/90 p-0.5 shadow-sm backdrop-blur-xl" />
    ),
  },
);

function MobileThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer setState to avoid cascading renders (React best practice)
    setTimeout(() => setMounted(true), 0);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-sm backdrop-blur-xl" />
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-sm backdrop-blur-xl transition-colors hover:bg-background"
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 text-amber-400" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-slate-500" />
      )}
    </button>
  );
}

export function NavbarThemeToggleSlot() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enable = () => setEnabled(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(enable, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(enable, 900);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <>
      {/* Mobile: single icon toggle */}
      <div className="flex shrink-0 items-center self-center sm:hidden">
        {enabled ? <MobileThemeButton /> : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/90 shadow-sm backdrop-blur-xl" />
        )}
      </div>
      {/* Desktop: two-button rail */}
      <div className="hidden shrink-0 items-center self-center sm:flex">
        {enabled ? (
          <LazyThemeToggle includeSystem={false} />
        ) : (
          <div className="inline-grid h-10 w-[76px] grid-cols-2 rounded-full border border-border/70 bg-background/90 p-0.5 shadow-sm backdrop-blur-xl" />
        )}
      </div>
    </>
  );
}
