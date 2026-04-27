"use client";

import { useRef, useMemo, useSyncExternalStore, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";

/**
 * CryptoLatticeScene — Crypto-centric WebGL hero animation
 *
 * Composition:
 * 1. Warping wave-grid floor (volatility surface)
 * 2. 3 floating crypto sigils (BTC orange, ETH blue, SOL green) with halos
 * 3. Vertical data-tick streams rising from the grid (trading activity)
 * 4. Subtle particle field (depth)
 *
 * Mobile-optimized: reduced segments, single sigil, no streams.
 */

// ─────────────────────────── Wave Grid ───────────────────────────

function WaveGrid({ isMobile }: { isMobile: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const segments = isMobile ? 36 : 64;
  const size = isMobile ? 16 : 22;

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [size, segments]);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#22D3EE",
        wireframe: true,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const pos = meshRef.current.geometry.attributes.position;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i];
      const z = arr[i + 2];
      const dist = Math.sqrt(x * x + z * z);
      // Layered ripples for organic feel
      arr[i + 1] =
        Math.sin(dist * 0.55 - t * 1.4) * 0.45 +
        Math.cos(x * 0.3 + t * 0.5) * 0.18 +
        Math.sin(z * 0.4 - t * 0.7) * 0.12;
    }
    pos.needsUpdate = true;
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} position={[0, -2.4, 0]} />;
}

// ─────────────────────────── Crypto Sigil ───────────────────────────

interface SigilProps {
  position: [number, number, number];
  color: string;
  size: number;
  speed: number;
}

function CryptoSigil({ position, color, size, speed }: SigilProps) {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * speed;
      // Gentle float
      groupRef.current.position.y = position[1] + Math.sin(t * speed * 1.5 + position[0]) * 0.2;
    }
    if (haloRef.current) {
      const pulse = 1 + Math.sin(t * 2 + position[0]) * 0.08;
      haloRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Halo glow */}
      <mesh ref={haloRef}>
        <ringGeometry args={[size * 1.4, size * 1.7, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Core token — octahedron for crystalline gem feel */}
      <mesh>
        <octahedronGeometry args={[size, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Wireframe overlay */}
      <mesh>
        <octahedronGeometry args={[size * 1.05, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Outer ring orbit */}
      <mesh rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[size * 2, 0.012, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─────────────────────────── Data Tick Streams ───────────────────────────

function DataTicks({ isMobile }: { isMobile: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = isMobile ? 40 : 120;

  const { positions, speeds } = useMemo(() => {
    // Seeded mulberry32 PRNG — deterministic across renders, no Math.random impurity
    let seed = 0x9e3779b9;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 20;
      positions[i * 3 + 1] = -2.4 + rand() * 6;
      positions[i * 3 + 2] = (rand() - 0.5) * 16;
      speeds[i] = 0.6 + rand() * 1.2;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      if (arr[i * 3 + 1] > 4) {
        arr[i * 3 + 1] = -2.4;
        arr[i * 3] = (Math.random() - 0.5) * 20;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#FFFFFF"
        transparent
        opacity={0.5}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ─────────────────────────── Camera ───────────────────────────

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.04) * 0.6;
    camera.position.y = 0.8 + Math.cos(t * 0.03) * 0.25;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─────────────────────────── Reduced Motion + Mobile Detection ───────────────────────────

const reducedSubscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedGetSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reducedServer = () => true;

const mobileSubscribe = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const mobileGetSnapshot = () => window.matchMedia("(max-width: 768px)").matches;
const mobileServer = () => false;

// ─────────────────────────── Scene Root ───────────────────────────

export function CryptoLatticeScene() {
  const prefersReduced = useSyncExternalStore(reducedSubscribe, reducedGetSnapshot, reducedServer);
  const isMobile = useSyncExternalStore(mobileSubscribe, mobileGetSnapshot, mobileServer);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pause WebGL when off-screen to save GPU
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: "200px 0px 200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const dpr: [number, number] = isMobile ? [1, 1.25] : [1, 1.5];

  // Sigil layout — fewer + larger on mobile
  const sigils: SigilProps[] = isMobile
    ? [{ position: [0, 0.5, 0], color: "#F7931A", size: 0.55, speed: 0.35 }]
    : [
        { position: [-2.6, 0.6, 0], color: "#F7931A", size: 0.5, speed: 0.32 }, // BTC
        { position: [0, 1.1, -1.5], color: "#627EEA", size: 0.42, speed: 0.45 }, // ETH
        { position: [2.4, 0.3, 0.6], color: "#14F195", size: 0.36, speed: 0.55 }, // SOL
      ];

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-0">
      {mounted && !prefersReduced && isVisible && (
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 1, 7], fov: 55 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            dpr={dpr}
          >
            <AdaptiveDpr pixelated />
            <ambientLight intensity={0.15} />
            <WaveGrid isMobile={isMobile} />
            {sigils.map((s, i) => (
              <CryptoSigil key={i} {...s} />
            ))}
            {!isMobile && <DataTicks isMobile={isMobile} />}
            <CameraRig />
          </Canvas>
        </div>
      )}
    </div>
  );
}
