"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Sparkles } from "lucide-react";

export function LiveChatStarterNudge() {
  const [dismissed, setDismissed] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.95 }}
      className="relative"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowPopover(!showPopover)}
        onKeyDown={(e) => e.key === "Enter" && setShowPopover(!showPopover)}
        className="flex items-center gap-2 px-4 py-3 bg-card/90 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-xl hover:border-primary/40 transition-colors cursor-pointer"
      >
        <MessageCircle className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium text-foreground">Chat Support</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          className="p-1 hover:bg-muted rounded-2xl transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-full right-0 mb-3 w-72 bg-card/95 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-2xl p-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-2xl">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-sm">
                  Direct chat is available on PRO & Elite
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Get real-time support from our team. Upgrade to unlock instant messaging.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/upgrade"
              onClick={() => setShowPopover(false)}
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-primary text-primary-foreground rounded-2xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Upgrade to PRO
              <Sparkles className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
