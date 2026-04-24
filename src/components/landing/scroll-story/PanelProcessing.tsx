"use client";

export function PanelProcessing() {
  const nodes = [{ x: 50, y: 20, l: "MACRO", a: true }, { x: 30, y: 50, l: "L1", a: true }, { x: 70, y: 50, l: "L2", a: true }, { x: 30, y: 78, l: "DeFi", a: true }, { x: 70, y: 78, l: "NFT", a: false }];
  const edges: [number, number][] = [[0,1],[0,2],[1,3],[2,4],[0,3]];
  return (
    <div className="flex h-full w-screen shrink-0 flex-col items-center justify-center px-8 py-16 lg:px-16">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-10">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">Phase 02</p>
          <h2 className="mt-3 text-4xl font-extralight leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">AI <span className="font-light text-warning">processing.</span></h2>
          <p className="mt-4 max-w-lg font-mono text-sm leading-7 text-white/42">Signals mapped across asset classes. Noise filtered. Structure built before AI speaks.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-5 backdrop-blur-sm shadow-[8px_8px_24px_rgba(0,0,0,0.45),-4px_-4px_16px_rgba(255,255,255,0.03)]">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-warning/5 to-transparent" />
          <svg viewBox="0 0 100 100" className="mx-auto h-48 w-full" preserveAspectRatio="xMidYMid meet">
            {edges.map(([a,b],i)=>(<line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke={nodes[a].a&&nodes[b].a?"#22D3EE":"rgba(255,255,255,0.1)"} strokeWidth="0.5" strokeDasharray={nodes[a].a&&nodes[b].a?"none":"2,2"}/>))}
            {nodes.map(n=>(<g key={n.l}><circle cx={n.x} cy={n.y} r={3.5} fill={n.a?"#818CF8":"rgba(255,255,255,0.15)"} opacity={n.a?1:0.4}/><text x={n.x} y={n.y+7} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="4" fontFamily="monospace">{n.l}</text></g>))}
          </svg>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[{l:"Signals mapped",v:"2,847"},{l:"Correlations",v:"94.2%"},{l:"Processing",v:"< 2s"}].map(s=>(
              <div key={s.l} className="rounded-lg border border-warning/15 bg-warning/6 px-2 py-2 text-center"><p className="font-mono text-base font-bold text-warning">{s.v}</p><p className="font-mono text-[9px] uppercase tracking-wide text-white/35">{s.l}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
