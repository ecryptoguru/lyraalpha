"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof window !== "undefined") {
      return !navigator.onLine;
    }
    return false;
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed top-0 left-0 right-0 z-50 p-2 sm:p-4 pointer-events-none"
        >
          <div className="mx-auto max-w-md bg-destructive/95 backdrop-blur-2xl text-destructive-foreground px-4 py-3 rounded-2xl shadow-2xl border border-destructive-foreground/20 flex items-center justify-between gap-3 pointer-events-auto">
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline. Data may be outdated.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
