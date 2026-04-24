"use client";

export function PanelCoverage() {
  const l1 = ["Bitcoin & Ethereum deep analysis","On-chain metrics & network health","Real-time blockchain data sync","DeFi protocol tracking","Staking & yield farming insights"];
  const l2 = ["Solana, Avalanche, Polygon coverage","Smart contract analysis","Cross-chain bridge monitoring","Layer-2 scaling solutions","Emerging protocol discovery"];
  const cov = [{a:"Layer 1",v:"100%"},{a:"Layer 2",v:"95%"},{a:"DeFi",v:"90%"},{a:"Stablecoins",v:"100%"},{a:"NFTs",v:"85%"}];
  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 04</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl">Full crypto stack. <span className="font-light text-warning">Natively.</span></h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">L1, L2, DeFi, and on-chain — built for crypto from day one.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-warning/20 bg-warning/5 p-4 shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]"><div className="pointer-events-none absolute inset-0 bg-linear-to-br from-warning/6 to-transparent"/><p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-warning/70">01 Layer 1</p><p className="mt-2 text-sm font-semibold text-white">BTC, ETH, SOL, ADA · Core</p><ul className="mt-3 space-y-1.5">{l1.map(f=>(<li key={f} className="flex items-start gap-2"><span className="mt-0.5 text-warning/70 text-[10px]">·</span><span className="font-mono text-[10px] leading-5 text-white/50">{f}</span></li>))}</ul></div>
          <div className="relative overflow-hidden rounded-2xl border border-info/18 bg-info/4 p-4 shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]"><div className="pointer-events-none absolute inset-0 bg-linear-to-br from-info/5 to-transparent"/><p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-info/70">02 Layer 2 & DeFi</p><p className="mt-2 text-sm font-semibold text-white">Scaling & Innovation</p><ul className="mt-3 space-y-1.5">{l2.map(f=>(<li key={f} className="flex items-start gap-2"><span className="mt-0.5 text-info/70 text-[10px]">·</span><span className="font-mono text-[10px] leading-5 text-white/50">{f}</span></li>))}</ul></div>
          <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-4 shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]"><p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/35">03 Coverage</p><p className="mt-2 text-sm font-semibold text-white">Comprehensive ecosystem</p><div className="mt-3 space-y-2">{cov.map(c=>(<div key={c.a} className="flex items-center justify-between border-b border-white/6 pb-1.5 last:border-0 last:pb-0"><span className="font-mono text-[10px] text-white/45">{c.a}</span><span className="font-mono text-[10px] font-bold text-white/70">{c.v}</span></div>))}</div></div>
        </div>
      </div>
    </div>
  );
}
