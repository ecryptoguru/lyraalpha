"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";

const PublicMyraPanel = dynamic(
  () => import("@/components/landing/public-myra-panel").then((mod) => mod.PublicMyraPanel),
  {
    ssr: false,
    loading: () => (
      <div className="fixed bottom-6 right-4 z-50 sm:right-6">
        <div className="h-[min(640px,calc(100dvh-3rem))] w-[calc(100vw-1.5rem)] sm:w-[410px] rounded-4xl border border-border/80 bg-white/96 shadow-[0_30px_90px_rgba(15,23,42,0.16)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#07111f]/96 dark:shadow-[0_30px_90px_rgba(0,0,0,0.48)]" />
      </div>
    ),
  },
);

function preloadPublicMyraPanel() {
  return import("@/components/landing/public-myra-panel");
}

type WidgetState = "closed" | "open" | "minimized";

export function PublicMyraWidget() {
  const [state, setState] = useState<WidgetState>("closed");
  const [shouldRenderPanel, setShouldRenderPanel] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const preload = () => {
      void preloadPublicMyraPanel();
      setShouldRenderPanel(true);
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 2200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(preload, 2200);
    return () => clearTimeout(timeoutId);
  }, []);

  const launcherClassName =
    "group relative flex h-16 w-16 items-center justify-center rounded-full border border-warning/40 bg-white text-warning shadow-[0_16px_48px_rgba(245,158,11,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-warning/60 hover:bg-primary/5 dark:border-warning/30 dark:bg-[#0b1322] dark:text-primary/60 dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)] dark:hover:border-warning/45 dark:hover:bg-[#0f182b]";

  const preparePanel = () => {
    setShouldRenderPanel(true);
    void preloadPublicMyraPanel();
  };

  return (
    <div className="fixed bottom-6 right-4 z-50 sm:right-6">
      <AnimatePresence mode="wait">
        {state === "open" && shouldRenderPanel ? (
          <PublicMyraPanel
            key="panel"
            isMinimized={false}
            onExpand={() => setState("open")}
            onMinimize={() => setState("minimized")}
            onClose={() => setState("closed")}
          />
        ) : state === "minimized" && shouldRenderPanel ? (
          <PublicMyraPanel
            key="minimized-panel"
            isMinimized={true}
            onExpand={() => setState("open")}
            onMinimize={() => setState("minimized")}
            onClose={() => setState("closed")}
          />
        ) : (
          <button
            key="launcher"
            onMouseEnter={preparePanel}
            onFocus={preparePanel}
            onClick={() => {
              preparePanel();
              setState("open");
            }}
            className={launcherClassName}
            aria-label="Chat with Myra"
          >
            <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.24),rgba(245,158,11,0.02)_68%,transparent)] blur-md transition-opacity duration-300 group-hover:opacity-100 dark:bg-[radial-gradient(circle,rgba(251,191,36,0.22),rgba(251,191,36,0.02)_68%,transparent)]" />
            <MessageCircle className="relative z-10 h-7 w-7" />
            <span className="absolute inset-0 rounded-full border border-warning/18" />
            <span className="absolute inset-0 rounded-full bg-warning3634" style={{ animation: "ping 1s cubic-bezier(0,0,0.2,1) 7" }} />
          </button>
        )}
      </AnimatePresence>
    </div>
  );
}
