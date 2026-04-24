"use client";

export function PanelNoise() {
  const rows = [
    { sym: "BTC", dir: "↑", val: "+8.34%", c: "text-info" }, { sym: "ETH", dir: "↓", val: "-3.12%", c: "text-danger" },
    { sym: "SOL", dir: "↑", val: "+12.1%", c: "text-info" }, { sym: "BNB", dir: "↓", val: "-0.92%", c: "text-danger" },
    { sym: "XRP", dir: "↑", val: "+2.33%", c: "text-info" }, { sym: "ADA", dir: "↓", val: "-1.44%", c: "text-danger" },
    { sym: "AVAX", dir: "↑", val: "+5.67%", c: "text-info" }, { sym: "DOT", dir: "↓", val: "-4.21%", c: "text-danger" },
  ];
  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 01</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Market <span className="font-light text-danger">noise.</span></h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">24 platforms, 47 alerts, zero clarity. Data without synthesis.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-5 backdrop-blur-sm shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-danger/5 to-transparent" />
          <div className="grid grid-cols-2 gap-2">
            {rows.map((r, i) => (
              <div key={r.sym} className="flex items-center justify-between rounded-lg border border-white/6 bg-white/2.5 px-3 py-2" style={{ opacity: 0.4 + (i % 3) * 0.2 }}>
                <span className="font-mono text-[11px] font-semibold text-white/60">{r.sym}</span>
                <span className={`font-mono text-[11px] font-bold ${r.c}`}>{r.dir} {r.val}</span>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,0,0,0.015)_2px,rgba(255,0,0,0.015)_4px)] mix-blend-overlay" />
          <div className="mt-3 rounded-lg border border-danger/20 bg-danger/8 px-3 py-2">
            <p className="font-mono text-[10px] text-danger/70">⚠ 47 conflicting signals detected across 12 sources</p>
          </div>
        </div>
      </div>
    </div>
  );
}
