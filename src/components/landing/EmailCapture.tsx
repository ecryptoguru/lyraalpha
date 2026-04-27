"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Check, Loader2 } from "lucide-react";
import { useInViewOnce, kineticVariants } from "./motion/useKineticReveal";

export function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const { ref, inView } = useInViewOnce({ threshold: 0.1 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="relative overflow-hidden bg-[#040816] px-4 py-20 sm:px-6 sm:py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_50%,rgba(129,140,248,0.06),transparent_65%)]" />
      <div ref={ref} className="container relative z-10 mx-auto max-w-3xl px-0">
        <motion.div
          className="rounded-[2.4rem] border border-white/10 bg-white/2.5 p-8 backdrop-blur-xl sm:p-12"
          variants={kineticVariants.fadeUp}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-info/20 bg-info/8">
              <Mail className="h-5 w-5 text-info" />
            </div>
            <h2 className="mt-5 text-2xl font-light tracking-[-0.03em] text-white sm:text-3xl">
              Get the <span className="text-info">Weekly Regime Report</span>
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-white/50">
              One email every Monday. Market regime shifts, top conviction assets, and what the engines computed — before you read the news.
            </p>

            {status === "success" ? (
              <div className="mt-8 flex items-center gap-2 rounded-full border border-success/20 bg-success/8 px-6 py-3 text-sm text-success">
                <Check className="h-4 w-4" />
                Subscribed — check your inbox for confirmation
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/30 outline-none ring-info/0 transition-all focus:border-info/30 focus:ring-2 focus:ring-info/20"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-info/30 bg-info/15 px-6 py-3 text-sm font-semibold text-info transition-all hover:bg-info/25 disabled:opacity-50"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Get Free Report
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="mt-4 font-mono text-[10px] text-white/30">
              No spam. Unsubscribe anytime. We never share your email.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
