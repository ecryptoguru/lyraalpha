import type { Metadata } from "next";
import { Mail, ShieldCheck } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "Contact & Support | LyraAlpha AI",
  description:
    "Reach LyraAlpha AI support for account access, billing, onboarding, or product questions. Include your account email for faster resolution.",
  alternates: { canonical: "https://lyraalpha.ai/contact" },
  openGraph: {
    title: "Contact & Support | LyraAlpha AI",
    description: "Reach LyraAlpha AI support for account access, billing, onboarding, or product questions.",
    url: "https://lyraalpha.ai/contact",
  },
  twitter: {
    card: "summary",
    title: "Contact & Support | LyraAlpha AI",
    description: "Reach LyraAlpha AI support for account access, billing, onboarding, or product questions.",
  },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background font-sans text-foreground selection:bg-amber-300/30" suppressHydrationWarning>
      <Navbar />
      <main data-scroll-root="landing" className="flex-1 overflow-x-clip overflow-y-auto">
        <section className="px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
          <div className="container mx-auto max-w-5xl px-0">
            <div className="overflow-hidden rounded-[2.8rem] border border-slate-200 bg-[linear-gradient(145deg,rgba(245,158,11,0.09),rgba(255,255,255,0.96)_24%,rgba(248,250,252,0.94)_100%)] shadow-[0_30px_100px_rgba(15,23,42,0.12)] dark:border-white/8 dark:bg-[linear-gradient(145deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03)_24%,rgba(255,255,255,0.015)_100%)] dark:shadow-[0_30px_100px_rgba(0,0,0,0.26)]">
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="p-8 sm:p-12">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-50 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.34em] text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/8 dark:text-amber-100/75">
                    <Mail className="h-3.5 w-3.5" />
                    Help and support
                  </div>
                  <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-[-0.06em] text-slate-900 sm:text-6xl dark:text-white">
                    Reach support without losing system context.
                  </h1>
                  <p className="mt-6 max-w-2xl text-base leading-8 text-slate-500 sm:text-lg dark:text-white/56">
                    If you need help with access, billing, onboarding or product behavior, contact support and include the email tied to your account so the team can resolve it faster.
                  </p>
                </div>
                <div className="border-t border-slate-200 bg-slate-50/75 p-8 dark:border-white/8 dark:bg-white/3 lg:border-l lg:border-t-0 sm:p-10">
                  <div className="rounded-[1.8rem] border border-slate-200 bg-white/92 p-5 dark:border-white/8 dark:bg-white/3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 dark:text-white/38">Primary channel</p>
                    <p className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white">support@lyraalpha.ai</p>
                    <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-white/56">
                      Best for account issues, system access questions, billing support, and product feedback.
                    </p>
                  </div>
                  <div className="mt-4 rounded-[1.8rem] border border-amber-300/20 bg-amber-50/80 p-5 dark:border-amber-300/16 dark:bg-amber-300/8">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                      <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-200" />
                      <p className="text-sm font-semibold">Include your account email</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/60">
                      Sharing the email linked to your account helps support review entitlement, waitlist, or system issues without extra back-and-forth.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
