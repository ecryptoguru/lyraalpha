"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LazyNavbarUserButton = dynamic(
  () => import("./navbar-user-button").then((mod) => mod.NavbarUserButton),
  {
    ssr: false,
    loading: () => (
      <div className="inline-flex h-10 w-10 rounded-full border border-border/50 bg-white/90 dark:border-white/8 dark:bg-white/3" />
    ),
  },
);

export function NavbarAccountSlot() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enable = () => setEnabled(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(enable, { timeout: 1400 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(enable, 1200);
    return () => clearTimeout(timeoutId);
  }, []);

  return enabled ? (
    <div className="inline-flex">
      <LazyNavbarUserButton />
    </div>
  ) : (
    <div className="inline-flex h-10 w-10 rounded-full border border-border/50 bg-white/90 dark:border-white/8 dark:bg-white/3" />
  );
}
