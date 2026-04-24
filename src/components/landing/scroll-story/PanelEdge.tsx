"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export function PanelEdge() {
  const dims = [{l:"Deterministic Analytics",s:"10/10"},{l:"AI Interpretation",s:"10/10"},{l:"Workflow Depth",s:"9/10"},{l:"On-Chain Coverage",s:"10/10"},{l:"Trust Infrastructure",s:"10/10"}];
  const comps = [
    {n:"Chain Explorers",sub:"Etherscan, Solscan",g:"no synthesis or interpretation",c:"text-danger"},
    {n:"Generic AI",sub:"ChatGPT Crypto, Perplexity",g:"no deterministic backbone",c:"text-warning"},
    {n:"DeFi Dashboards",sub:"DeFi Llama, DefiPulse",g:"data aggregation, not intelligence",c:"text-warning"},
    {n:"Niche Crypto Tools",sub:"Glassnode, Messari",g:"on-chain only, no AI interpretation",c:"text-danger"},
  ];
  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 05</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl">Leads across <span className="font-light text-info">all five dimensions.</span></h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">Chain explorers, generic AI, DeFi dashboards, and on-chain tools — all have critical gaps.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-5 shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]"><p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">Five Critical Dimensions</p><div className="mt-4 space-y-2.5">{dims.map(d=>(<div key={d.l} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0"><span className="font-mono text-[11px] text-white/55">{d.l}</span><span className="font-mono text-sm font-bold text-info">{d.s}</span></div>))}</div></div>
          <div className="space-y-2">
            {comps.map(c=>(<div key={c.n} className="rounded-xl border border-white/6 bg-white/2.5 px-4 py-3"><div className="flex items-center gap-2"><XCircle className="h-3.5 w-3.5 shrink-0 text-white/25"/><span className="text-sm font-semibold text-white">{c.n}</span><span className="font-mono text-[10px] text-white/30">{c.sub}</span></div><p className="mt-1 pl-5 font-mono text-[10px] leading-5 text-white/40">but <span className={`font-semibold ${c.c}`}>{c.g}</span></p></div>))}
            <div className="rounded-xl border border-info/25 bg-info/6 px-4 py-3"><div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-info"/><span className="text-sm font-bold text-info">LyraAlpha AI</span></div><p className="mt-1 pl-5 font-mono text-[10px] leading-5 text-white/55">Deterministic computation + Grounded AI + Premium Workflows across the entire crypto ecosystem.</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
