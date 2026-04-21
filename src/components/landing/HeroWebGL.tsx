"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";
import { ArrowRight, TrendingUp, Activity, Zap } from "lucide-react";
import { ScrollToSectionButton } from "@/components/landing/scroll-to-section-button";
import Link from "next/link";

// ─── Module-level precomputed random data (stable across renders) ───────────

const ORBIT_COUNT = 120;
const _orbitRadii = new Float32Array(ORBIT_COUNT);
const _orbitSpeeds = new Float32Array(ORBIT_COUNT);
const _orbitPhases = new Float32Array(ORBIT_COUNT);
const _orbitTilts = new Float32Array(ORBIT_COUNT);
const _orbitPositions = new Float32Array(ORBIT_COUNT * 3);
const ORBIT_RADIUS_BASE = 2.8;
const NODE_COUNT = 280;
const CONNECTION_THRESHOLD = 1.45;
for (let _i = 0; _i < ORBIT_COUNT; _i++) {
  _orbitRadii[_i] = ORBIT_RADIUS_BASE + 0.3 + Math.random() * 0.8;
  _orbitSpeeds[_i] = 0.12 + Math.random() * 0.18;
  _orbitPhases[_i] = Math.random() * Math.PI * 2;
  _orbitTilts[_i] = (Math.random() - 0.5) * Math.PI;
}

const STAR_COUNT = 600;
const _starPositions = new Float32Array(STAR_COUNT * 3);
for (let _i = 0; _i < STAR_COUNT; _i++) {
  _starPositions[_i * 3] = (Math.random() - 0.5) * 40;
  _starPositions[_i * 3 + 1] = (Math.random() - 0.5) * 40;
  _starPositions[_i * 3 + 2] = (Math.random() - 0.5) * 40;
}

// ─── Neural Lattice Sphere ───────────────────────────────────────────────────

function NeuralLattice() {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const { nodePositions, linePositions } = useMemo(() => {
    const nodes: THREE.Vector3[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5));
    const RADIUS = ORBIT_RADIUS_BASE;

    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = phi * i;
      nodes.push(
        new THREE.Vector3(
          Math.cos(theta) * r * RADIUS,
          y * RADIUS,
          Math.sin(theta) * r * RADIUS
        )
      );
    }

    const lineVerts: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (nodes[i].distanceTo(nodes[j]) < CONNECTION_THRESHOLD) {
          lineVerts.push(
            nodes[i].x, nodes[i].y, nodes[i].z,
            nodes[j].x, nodes[j].y, nodes[j].z
          );
        }
      }
    }

    const nodeVerts = new Float32Array(nodes.length * 3);
    for (let i = 0; i < nodes.length; i++) {
      nodeVerts[i * 3]     = nodes[i].x;
      nodeVerts[i * 3 + 1] = nodes[i].y;
      nodeVerts[i * 3 + 2] = nodes[i].z;
    }
    return {
      nodePositions: nodeVerts,
      linePositions: new Float32Array(lineVerts),
    };
  }, []);

  const orbitData = useMemo(() => ({
    positions: _orbitPositions,
    speeds: _orbitSpeeds,
    radii: _orbitRadii,
    phases: _orbitPhases,
    tilts: _orbitTilts,
    count: ORBIT_COUNT,
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.07;
      groupRef.current.rotation.x = Math.sin(t * 0.04) * 0.12;
    }

    if (particlesRef.current) {
      const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < orbitData.count; i++) {
        const angle = t * orbitData.speeds[i] + orbitData.phases[i];
        const r = orbitData.radii[i];
        const tilt = orbitData.tilts[i];
        pos[i * 3] = Math.cos(angle) * r;
        pos[i * 3 + 1] = Math.sin(angle + tilt) * r * 0.35;
        pos[i * 3 + 2] = Math.sin(angle) * r;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Node points */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[nodePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.038}
          color="#818CF8"
          transparent
          opacity={0.85}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Connection lines */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#22D3EE"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Orbiting particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[orbitData.positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.022}
          color="#22D3EE"
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// ─── Ambient Light Rings ─────────────────────────────────────────────────────

function LightRings() {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 0.06;
      ring1Ref.current.rotation.z = t * 0.04;
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.12 + Math.sin(t * 0.8) * 0.04;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -t * 0.05;
      ring2Ref.current.rotation.y = t * 0.08;
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.08 + Math.sin(t * 1.1) * 0.03;
    }
  });

  return (
    <>
      <mesh ref={ring1Ref}>
        <torusGeometry args={[3.6, 0.012, 8, 180]} />
        <meshBasicMaterial
          color="#818CF8"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[4.1, 0.008, 8, 180]} />
        <meshBasicMaterial
          color="#22D3EE"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

// ─── Background Star Field ────────────────────────────────────────────────────

function StarField() {
  const starsRef = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (starsRef.current) {
      starsRef.current.rotation.y = clock.getElapsedTime() * 0.005;
    }
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[_starPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.012}
        color="#C4B5FD"
        transparent
        opacity={0.28}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ─── Camera Setup ─────────────────────────────────────────────────────────────

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.04) * 0.4;
    camera.position.y = Math.cos(t * 0.03) * 0.25 + 0.3;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─── HUD Metric Card ─────────────────────────────────────────────────────────

interface HudCardProps {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  icon: React.ReactNode;
  className?: string;
}

function HudCard({ label, value, delta, positive = true, icon, className = "" }: HudCardProps) {
  return (
    <div
      className={`hud-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 px-4 py-3 backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/6 to-transparent" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
            {label}
          </p>
          <p className="mt-1.5 font-mono text-xl font-bold tracking-tight text-white">
            {value}
          </p>
          {delta && (
            <p
              className={`mt-0.5 font-mono text-[10px] font-semibold ${positive ? "text-info" : "text-danger"}`}
            >
              {delta}
            </p>
          )}
        </div>
        <div className="mt-0.5 text-warning/70">{icon}</div>
      </div>
      <div className="hud-scan-line pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-info/40 to-transparent" />
    </div>
  );
}

// ─── Candlestick SVG ──────────────────────────────────────────────────────────

function MiniCandlestick() {
  const bars = [
    { x: 4, open: 32, close: 18, high: 10, low: 40, up: false },
    { x: 14, open: 20, close: 10, high: 6, low: 26, up: true },
    { x: 24, open: 22, close: 12, high: 8, low: 28, up: true },
    { x: 34, open: 16, close: 28, high: 10, low: 34, up: false },
    { x: 44, open: 26, close: 14, high: 8, low: 32, up: true },
    { x: 54, open: 12, close: 24, high: 6, low: 30, up: false },
    { x: 64, open: 20, close: 8, high: 4, low: 26, up: true },
  ];

  return (
    <svg width="72" height="44" viewBox="0 0 72 44" fill="none" className="opacity-60">
      {bars.map((b) => (
        <g key={b.x}>
          <line
            x1={b.x + 3}
            y1={b.high}
            x2={b.x + 3}
            y2={b.low}
            stroke={b.up ? "#22D3EE" : "#818CF8"}
            strokeWidth="0.8"
          />
          <rect
            x={b.x}
            y={Math.min(b.open, b.close)}
            width={6}
            height={Math.abs(b.open - b.close)}
            fill={b.up ? "#22D3EE" : "#818CF8"}
            opacity={0.85}
          />
        </g>
      ))}
    </svg>
  );
}

// ─── Main Hero Component ───────────────────────────────────────────────────────

export function HeroWebGL() {
  const [prefersReduced, setPrefersReduced] = useState(false);
  const mountedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    const raf = requestAnimationFrame(() => {
      setPrefersReduced(mq.matches);
      setMounted(true);
    });
    return () => {
      mq.removeEventListener("change", handler);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#040816]">
      {/* WebGL Canvas */}
      {mounted && !prefersReduced && (
        <div className="pointer-events-none absolute inset-0 z-0">
          <Canvas
            camera={{ position: [0, 0, 8.5], fov: 52 }}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            }}
            dpr={[1, 1.5]}
          >
            <AdaptiveDpr pixelated />
            <ambientLight intensity={0.15} />
            <StarField />
            <LightRings />
            <NeuralLattice />
            <CameraRig />
          </Canvas>
        </div>
      )}

      {/* Fallback gradient for no-motion / SSR */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(129,140,248,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(34,211,238,0.07),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,22,0)_60%,rgba(4,8,22,1)_100%)]" />
      </div>

      {/* Obsidian grid overlay */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.055] bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[80px_80px]" />

      {/* Main content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-28 pt-32 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1fr_340px] lg:items-center xl:grid-cols-[1fr_380px]">

            {/* Left: headline + CTA */}
            <div className="space-y-8">
              {/* Eyebrow */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-info/25 bg-info/8 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-info">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info" />
                  Beta · Open Access
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-info/20 bg-info/6 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-info/80">
                  <Zap className="h-3 w-3 text-info" />
                  US &amp; India · 5 Asset Classes
                </span>
              </div>

              {/* Headline */}
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.55em] text-white/55">
                  Stop guessing. Start knowing.
                </p>
                <h1 className="hero-headline mt-5 text-[2.4rem] font-extralight leading-[0.92] tracking-[-0.055em] text-white sm:text-[3.6rem] lg:text-[4.4rem] xl:text-[5.2rem]">
                  engines compute.
                  <span className="block font-thin text-white-300">AI interprets.</span>
                  <span className="block font-thin text-warning text-[3rem] sm:text-[4.4rem] lg:text-[5.6rem] xl:text-[6.8rem] mt-3">AI OS for Investments.</span>
                </h1>
              </div>

              {/* Sub copy */}
              <p className="max-w-xl border-l-2 border-info/50 pl-5 font-mono text-sm leading-8 text-white/75 sm:text-base">
                Engines compute the signals. Lyra interprets them. No hallucinated metrics — ever.
              </p>

              {/* CTAs */}
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/sign-up"
                  className="hero-cta-primary group inline-flex h-14 items-center gap-2 rounded-full border border-warning/30 bg-warning px-8 font-bold text-foreground shadow-[0_0_40px_rgba(245,158,11,0.3),0_18px_60px_rgba(245,158,11,0.2)] transition-all duration-300 hover:-translate-y-1 hover:bg-warning15337 hover:shadow-[0_0_60px_rgba(245,158,11,0.45),0_24px_80px_rgba(245,158,11,0.28)]"
                >
                  Sign Up Free
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <ScrollToSectionButton
                  size="lg"
                  variant="outline"
                  targetId="scrollytelling"
                  className="h-14 rounded-full border border-white/15 bg-white/4 px-8 font-bold text-white/80 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-info/40 hover:bg-info/8 hover:text-white"
                >
                  See How It Works
                </ScrollToSectionButton>
              </div>
              <p className="font-mono text-[10px] text-white/28 tracking-wide">
                Free to join · No credit card · Priority access for early members
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { value: "250M+", label: "Investors · US & India", accent: "amber" },
                  { value: "6",     label: "Signals computed first", accent: "info" },
                  { value: "5",     label: "Asset classes", accent: "default" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-2xl border p-4 backdrop-blur-sm ${
                      s.accent === "amber"
                        ? "border-warning/18 bg-warning/5"
                        : s.accent === "info"
                        ? "border-info/15 bg-info/4"
                        : "border-white/8 bg-white/3"
                    }`}
                  >
                    <p className={`font-mono text-2xl font-bold tracking-tight sm:text-3xl ${
                      s.accent === "amber" ? "text-warning" : s.accent === "info" ? "text-info" : "text-white"
                    }`}>
                      {s.value}
                    </p>
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/38">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: HUD panel stack */}
            <div className="space-y-3 lg:pt-8">
              <HudCard
                label="Trend Score"
                value="78 / 100"
                delta="Strong directional momentum"
                positive
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <HudCard
                label="Volatility Score"
                value="42 / 100"
                delta="Low regime risk"
                positive
                icon={<Activity className="h-4 w-4" />}
              />

              {/* Candlestick HUD card */}
              <div className="hud-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/6 to-transparent" />
                <div className="relative flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
                      Price Action
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold text-white">Cross-Asset</p>
                    <p className="font-mono text-[10px] text-info">Illustrative example</p>
                  </div>
                  <MiniCandlestick />
                </div>
                <div className="hud-scan-line pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-warning/40 to-transparent" />
              </div>

              {/* Sentiment gauge */}
              <div className="hud-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/4 p-4 backdrop-blur-xl">
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/6 to-transparent" />
                <div className="relative">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
                    Market Sentiment
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-info to-warning"
                        style={{ width: "68%" }}
                      />
                    </div>
                    <span className="font-mono text-sm font-bold text-white">68</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="font-mono text-[9px] text-white/30">Bear</span>
                    <span className="font-mono text-[9px] text-warning">Bullish Bias</span>
                    <span className="font-mono text-[9px] text-white/30">Bull</span>
                  </div>
                </div>
                <div className="hud-scan-line pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-info/40 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-[#040816] to-transparent" />
    </section>
  );
}
