"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useUser } from "@/lib/clerk-shim";

import { usePlan } from "@/hooks/use-plan";
import { LiveChatStarterNudge } from "./live-chat-starter-nudge";

const LiveChatWidget = dynamic(
  () => import("./live-chat-widget").then((mod) => mod.LiveChatWidget),
  {
    ssr: false,
    loading: () => (
      <div className="fixed bottom-6 right-4 z-50 sm:right-6">
        <div className="h-[520px] w-[360px] max-w-[calc(100vw-2rem)] rounded-4xl border border-white/10 bg-card/90 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl" />
      </div>
    ),
  },
);

function isLocalDevHost() {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

export function LiveChatBubble() {
  const { plan, isLoading } = usePlan();
  const { user, isLoaded: userLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  if (isLoading) {
    return (
      <div className="fixed bottom-6 right-4 z-50 sm:right-6">
        <button
          aria-label="Loading support chat"
          disabled
          className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-white text-amber-400 opacity-80 shadow-[0_16px_48px_rgba(245,158,11,0.12)] transition-all dark:border-amber-300/22 dark:bg-[#0b1322] dark:text-amber-200 dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)]"
        >
          <MessageCircle className="h-7 w-7 animate-pulse" />
        </button>
      </div>
    );
  }

  if (!isLocalDevHost() && (!userLoaded || !user)) return null;

  const isPaidUser = plan === "PRO" || plan === "ELITE" || plan === "ENTERPRISE";

  if (!isPaidUser) {
    return <LiveChatStarterNudge />;
  }

  if (isOpen) {
    return (
      <div className="fixed bottom-6 right-4 z-50 sm:right-6">
        <LiveChatWidget
          onClose={() => setIsOpen(false)}
          onUnread={() => setHasUnread(true)}
        />
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-4 z-50 sm:right-6">
      <button
        onClick={() => {
          setIsOpen(true);
          setHasUnread(false);
        }}
        className="group relative flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/40 bg-white text-amber-500 shadow-[0_16px_48px_rgba(245,158,11,0.2)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:bg-amber-50 dark:border-amber-300/30 dark:bg-[#0b1322] dark:text-amber-200 dark:shadow-[0_16px_48px_rgba(0,0,0,0.42)] dark:hover:border-amber-300/45 dark:hover:bg-[#0f182b]"
        aria-label="Open support chat"
      >
        <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.24),rgba(245,158,11,0.02)_68%,transparent)] blur-md transition-opacity duration-300 group-hover:opacity-100 dark:bg-[radial-gradient(circle,rgba(251,191,36,0.22),rgba(251,191,36,0.02)_68%,transparent)]" />
        <MessageCircle className="relative z-10 h-7 w-7" />
        <span className="absolute inset-0 rounded-full border border-amber-300/18" />
        <span className="absolute inset-0 rounded-full bg-amber-300/10" style={{ animation: "ping 1s cubic-bezier(0,0,0.2,1) 7" }} />
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-red-500 animate-pulse dark:border-[#0b1322]" />
        ) : null}
      </button>
    </div>
  );
}
