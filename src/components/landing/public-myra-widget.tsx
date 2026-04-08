"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

const PublicMyraPanel = dynamic(
  () => import("@/components/landing/public-myra-panel").then((mod) => mod.PublicMyraPanel),
  {
    ssr: false,
    loading: () => (
      <div className="fixed bottom-3 right-3 z-50 w-[calc(100vw-1.5rem)] sm:bottom-6 sm:right-6 sm:w-[410px]">
        <div className="h-[min(640px,calc(100dvh-3rem))] animate-in fade-in slide-in-from-bottom-3 rounded-4xl border border-slate-200/80 bg-white/96 shadow-[0_24px_72px_rgba(15,23,42,0.14)] backdrop-blur-xl duration-300 dark:border-white/10 dark:bg-[#07111f]/96 dark:shadow-[0_24px_72px_rgba(0,0,0,0.44)]" />
      </div>
    ),
  },
);

function preloadPublicMyraPanel() {
  return import("@/components/landing/public-myra-panel");
}

export function PublicMyraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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
    "group relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/40 bg-white text-amber-500 shadow-[0_16px_48px_rgba(245,158,11,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:bg-amber-50 dark:border-amber-300/30 dark:bg-[#0b1322] dark:text-amber-200 dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)] dark:hover:border-amber-300/45 dark:hover:bg-[#0f182b]";

  const preparePanel = () => {
    setShouldRenderPanel(true);
    void preloadPublicMyraPanel();
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-20 right-4 z-50 sm:bottom-22 sm:right-6">
        <button
          onMouseEnter={preparePanel}
          onFocus={preparePanel}
          onClick={() => {
            preparePanel();
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className={launcherClassName}
          aria-label="Chat with Myra"
        >
          <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.24),rgba(245,158,11,0.02)_68%,transparent)] blur-md transition-opacity duration-300 group-hover:opacity-100 dark:bg-[radial-gradient(circle,rgba(251,191,36,0.22),rgba(251,191,36,0.02)_68%,transparent)]" />
          <MessageCircle className="relative z-10 h-7 w-7" />
          <span className="absolute inset-0 rounded-full bg-amber-300/10" style={{ animation: "ping 1s cubic-bezier(0,0,0.2,1) 7" }} />
          <span className="absolute -left-28 hidden rounded-full border border-slate-200/80 bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 shadow-[0_12px_40px_rgba(15,23,42,0.14)] sm:block dark:border-white/10 dark:bg-[#07111f]/88 dark:text-white/55 dark:shadow-[0_12px_40px_rgba(0,0,0,0.32)]">
            Ask Myra
          </span>
        </button>
      </div>
    );
  }

  if (!shouldRenderPanel) {
    return null;
  }

  return (
    <PublicMyraPanel
      isMinimized={isMinimized}
      onExpand={() => setIsMinimized(false)}
      onMinimize={() => setIsMinimized(true)}
      onClose={() => {
        setIsOpen(false);
        setIsMinimized(false);
      }}
    />
  );
}
