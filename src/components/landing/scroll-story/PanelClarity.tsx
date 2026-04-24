"use client";

import { TrendingUp, Brain, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

export function PanelClarity() {
  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 03</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Actionable <span className="font-light text-info">clarity.</span></h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">Structured, traceable intelligence you can act on.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-info/20 bg-white/3 backdrop-blur-sm shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-info/6 to-transparent" />
          <div className="border-b border-white/8 px-5 py-4"><div className="flex items-center justify-between"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">AI Research Output</p><span className="inline-flex items-center gap-1.5 rounded-full border border-info/25 bg-info/8 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wide text-info"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info"/>Current</span></div></div>
          <div className="space-y-3 p-5">
            {[{i:<TrendingUp className="h-3.5 w-3.5"/>,l:"Conviction Score",v:"8.4 / 10",c:"text-info"},{i:<Brain className="h-3.5 w-3.5"/>,l:"Risk-Adjusted Signal",v:"Bullish",c:"text-warning"},{i:<Zap className="h-3.5 w-3.5"/>,l:"Time Horizon",v:"2–4 weeks",c:"text-white/70"}].map(r=> (
              <div key={r.l} className="flex items-center justify-between rounded-lg border border-white/6 bg-white/2.5 px-3 py-2.5"><div className="flex items-center gap-2 text-white/40">{r.i}<span className="font-mono text-[11px] text-white/50">{r.l}</span></div><span className={`font-mono text-sm font-bold ${r.c}`}>{r.v}</span></div>
            ))}
            <div className="rounded-lg border border-info/12 bg-info/4 px-3 py-2.5"><p className="font-mono text-[10px] leading-5 text-white/45 italic">&ldquo;Semiconductor demand cycle shows asymmetric upside. Macro regime supports risk-on positioning. Cross-asset flows confirm institutional accumulation pattern.&rdquo;</p></div>
          </div>
          <div className="border-t border-white/8 px-5 py-4">
            <Link href="/sign-up" className="flex w-full items-center justify-center gap-2 rounded-xl border border-warning/25 bg-warning/10 py-2.5 font-mono text-sm font-bold text-warning transition-all hover:bg-warning/18 hover:text-warning">Get This Intelligence<ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
