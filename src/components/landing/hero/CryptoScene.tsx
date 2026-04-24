"use client";

import { useRef, useMemo, useSyncExternalStore, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";

const STAR_COUNT = 800;
const _starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  _starPositions[i * 3] = (Math.random() - 0.5) * 50;
  _starPositions[i * 3 + 1] = (Math.random() - 0.5) * 50;
  _starPositions[i * 3 + 2] = (Math.random() - 0.5) * 50;
}

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
      <pointsMaterial size={0.014} color="#C4B5FD" transparent opacity={0.35} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function DataStream({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const ref = useRef<THREE.Line>(null);
  const lineObj = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mid.y += 0.8;
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32));
    const material = new THREE.LineBasicMaterial({
      color: "#22D3EE", transparent: true, opacity: 0.12,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [from, to]);

  useFrame(({ clock }) => {
    if (ref.current) {
      (ref.current.material as THREE.LineBasicMaterial).opacity =
        0.12 + Math.sin(clock.getElapsedTime() * 1.5) * 0.06;
    }
  });

  return <primitive object={lineObj} ref={ref} />;
}

function CryptoCoin({ radius, speed, tilt, position: [x, y, z], color }: {
  radius: number; speed: number; tilt: number; position: [number, number, number]; color: string;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const icosaRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const particleRef = useRef<THREE.Points>(null);

  const particlePositions = useMemo(() => {
    const arr = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i++) {
      const theta = (i / 40) * Math.PI * 2;
      arr[i * 3] = Math.cos(theta) * radius;
      arr[i * 3 + 1] = Math.sin(theta) * radius * 0.15;
      arr[i * 3 + 2] = Math.sin(theta) * radius;
    }
    return arr;
  }, [radius]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * speed;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * tilt;
    }
    if (icosaRef.current) {
      icosaRef.current.rotation.y = -t * speed * 0.4;
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.y = t * (speed * 0.2);
    }
    if (particleRef.current) {
      const pos = particleRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < 40; i++) {
        const theta = t * 0.5 + (i / 40) * Math.PI * 2;
        pos[i * 3] = Math.cos(theta) * (radius + 0.15);
        pos[i * 3 + 1] = Math.sin(t * 0.8 + i) * 0.1;
        pos[i * 3 + 2] = Math.sin(theta) * (radius + 0.15);
      }
      particleRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={meshRef} position={[x, y, z]}>
      {/* Core icosahedron */}
      <mesh ref={icosaRef}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Inner solid */}
      <mesh>
        <icosahedronGeometry args={[0.38, 0]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Ring */}
      <group ref={orbitRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.006, 8, 120]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {/* Orbiting particles */}
      <points ref={particleRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.018} color={color} transparent opacity={0.7} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
    </group>
  );
}

function CryptoConstellation() {
  const groupRef = useRef<THREE.Group>(null);

  const coins = useMemo(() => [
    { pos: [-1.8, 0.4, 0] as [number, number, number], color: "#F7931A", radius: 1.4, speed: 0.25, tilt: 0.15 }, // BTC orange
    { pos: [1.6, -0.3, 0.8] as [number, number, number], color: "#627EEA", radius: 1.1, speed: 0.35, tilt: 0.2 }, // ETH blue
    { pos: [0, 1.2, -1.2] as [number, number, number], color: "#14F195", radius: 0.9, speed: 0.45, tilt: 0.25 }, // SOL green
  ], []);

  const streams = useMemo(() => {
    const v3 = (pos: [number, number, number]) => new THREE.Vector3(...pos);
    return [
      { from: v3(coins[0].pos), to: v3(coins[1].pos) },
      { from: v3(coins[1].pos), to: v3(coins[2].pos) },
      { from: v3(coins[2].pos), to: v3(coins[0].pos) },
    ];
  }, [coins]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.04;
      groupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.03) * 0.06;
    }
  });

  return (
    <group ref={groupRef}>
      {coins.map((c, i) => (
        <CryptoCoin key={i} position={c.pos} color={c.color} radius={c.radius} speed={c.speed} tilt={c.tilt} />
      ))}
      {streams.map((s, i) => (
        <DataStream key={`stream-${i}`} from={s.from} to={s.to} />
      ))}
      {/* Small data particles flowing along paths */}
      <FlowingParticles streams={streams} />
    </group>
  );
}

function FlowingParticles({ streams }: { streams: { from: THREE.Vector3; to: THREE.Vector3 }[] }) {
  const ref = useRef<THREE.Points>(null);
  const count = streams.length * 6;

  // Precompute curves once; reuse in every frame
  const curves = useMemo(() => {
    return streams.map((s) => {
      const mid = new THREE.Vector3().addVectors(s.from, s.to).multiplyScalar(0.5);
      mid.y += 0.8;
      return new THREE.QuadraticBezierCurve3(s.from, mid, s.to);
    });
  }, [streams]);

  const initialPositions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    let idx = 0;
    for (const curve of curves) {
      for (let i = 0; i < 6; i++) {
        const p = curve.getPoint(i / 6);
        arr[idx++] = p.x;
        arr[idx++] = p.y;
        arr[idx++] = p.z;
      }
    }
    return arr;
  }, [curves, count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    let idx = 0;
    const t = (clock.getElapsedTime() * 0.15) % 1;
    for (const curve of curves) {
      for (let i = 0; i < 6; i++) {
        const particleT = (t + i / 6) % 1;
        const p = curve.getPoint(particleT);
        pos[idx++] = p.x;
        pos[idx++] = p.y;
        pos[idx++] = p.z;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initialPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color="#FFFFFF" transparent opacity={0.55} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}

function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    camera.position.x = Math.sin(t * 0.03) * 0.5;
    camera.position.y = Math.cos(t * 0.025) * 0.3 + 0.3;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

const reducedServer = () => true;
const reducedSubscribe = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedGetSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const mobileSubscribe = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const mobileGetSnapshot = () => window.matchMedia("(max-width: 768px)").matches;
const mobileServer = () => false;

export function CryptoScene() {
  const prefersReduced = useSyncExternalStore(reducedSubscribe, reducedGetSnapshot, reducedServer);
  const isMobile = useSyncExternalStore(mobileSubscribe, mobileGetSnapshot, mobileServer);
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // IntersectionObserver: pause/unmount WebGL when hero is off-screen
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

  // Downshift DPR on mobile to save GPU (plan §9)
  const dpr: [number, number] = isMobile ? [1, 1.25] : [1, 1.5];

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-0">
      {mounted && !prefersReduced && isVisible && (
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 9], fov: 50 }}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            dpr={dpr}
          >
            <AdaptiveDpr pixelated />
            <ambientLight intensity={0.1} />
            <StarField />
            <CryptoConstellation />
            <CameraRig />
          </Canvas>
        </div>
      )}
    </div>
  );
}
