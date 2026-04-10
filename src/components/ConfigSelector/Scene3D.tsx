"use client";

import { Suspense, useRef, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import type { CarWashConfig } from "@/lib/carwashConfigs";

type ViewMode = "perspective" | "aerial" | "interior" | "spin";

// ─────────────────────────────────────────────────────────────────────────────
// Primitive helpers
// ─────────────────────────────────────────────────────────────────────────────

function B({
  p, s, color, rough = 0.75, metal = 0.08, emissive = "#000000", emInt = 0, rxShadow = true,
}: {
  p: [number, number, number];
  s: [number, number, number];
  color: string;
  rough?: number;
  metal?: number;
  emissive?: string;
  emInt?: number;
  rxShadow?: boolean;
}) {
  return (
    <mesh position={p} castShadow receiveShadow={rxShadow}>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        roughness={rough}
        metalness={metal}
        emissive={emissive}
        emissiveIntensity={emInt}
      />
    </mesh>
  );
}

function Cyl({
  p, r, h, color, emissive = "#000000", emInt = 0,
}: {
  p: [number, number, number];
  r: number;
  h: number;
  color: string;
  emissive?: string;
  emInt?: number;
}) {
  return (
    <mesh position={p} castShadow>
      <cylinderGeometry args={[r, r, h, 16]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.45}
        emissive={emissive} emissiveIntensity={emInt} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene furniture
// ─────────────────────────────────────────────────────────────────────────────

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} color="#b8ccff" />
      <directionalLight
        position={[18, 28, 14]}
        intensity={2.2}
        color="#fff8f0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-camera-far={90}
        shadow-bias={-0.0008}
      />
      {/* Cool blue fill from opposite side */}
      <directionalLight position={[-14, 12, -10]} intensity={0.55} color="#3b6fff" />
      {/* Warm accent under-fill */}
      <pointLight position={[0, 1.5, 0]} intensity={1.2} color="#1e40af" distance={30} decay={2} />
      {/* Ground bounce */}
      <hemisphereLight args={["#0a1020", "#0d1a2e", 0.4]} />
    </>
  );
}

function Ground() {
  return (
    <group>
      {/* Outer terrain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#060e1a" roughness={0.99} metalness={0} />
      </mesh>
      {/* Paved lot — slightly reflective asphalt */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[58, 28]} />
        <meshStandardMaterial color="#101825" roughness={0.78} metalness={0.14} />
      </mesh>
      {/* Roads top + bottom */}
      <B p={[0, 0, -14.5]} s={[120, 0.06, 5]} color="#060d1a" rough={0.96} rxShadow={false} />
      <B p={[0, 0,  14.5]} s={[120, 0.06, 5]} color="#060d1a" rough={0.96} rxShadow={false} />
      {/* Lane markers */}
      {Array.from({ length: 9 }).map((_, i) => (
        <B key={i} p={[-16 + i * 4, 0.04, -14.5]} s={[1.8, 0.02, 0.15]}
          color="#fbbf24" emissive="#d97706" emInt={0.1} rxShadow={false} />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <B key={i} p={[-16 + i * 4, 0.04, 14.5]} s={[1.8, 0.02, 0.15]}
          color="#fbbf24" emissive="#d97706" emInt={0.1} rxShadow={false} />
      ))}
      {/* Landscaping strips */}
      <B p={[0, 0.06, -12]} s={[56, 0.14, 2.5]} color="#14532d" rough={0.92} rxShadow={false} />
      <B p={[0, 0.06,  12]} s={[56, 0.14, 2.5]} color="#14532d" rough={0.92} rxShadow={false} />
      {/* Shrub dots */}
      {[-18, -10, -2, 6, 14].map((x, i) => (
        <Cyl key={i} p={[x, 0.35, -12]} r={0.55} h={0.7} color="#15803d" emissive="#14532d" emInt={0.05} />
      ))}
      {[-18, -10, -2, 6, 14].map((x, i) => (
        <Cyl key={i} p={[x, 0.35, 12]} r={0.55} h={0.7} color="#15803d" emissive="#14532d" emInt={0.05} />
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera controller
// ─────────────────────────────────────────────────────────────────────────────

interface CamTarget {
  pos: [number, number, number];
  look: [number, number, number];
}

function CameraController({
  mode,
  perspective,
  interior,
}: {
  mode: ViewMode;
  perspective: CamTarget;
  interior: CamTarget;
}) {
  const { camera } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const spinRef = useRef(0);
  const initialised = useRef(false);

  const targets = useMemo<Record<Exclude<ViewMode, "spin">, CamTarget>>(() => ({
    perspective,
    // Slight angle so building depth is visible from above — much less "flat CAD"
    aerial: { pos: [0, 36, 10], look: [0, 0, 0] },
    interior,
  }), [perspective, interior]);

  // Apply immediately on first render and on mode change
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const t = targets[mode === "spin" ? "perspective" : mode];
    camera.position.set(...t.pos);
    if (typeof c.target?.set === "function") {
      c.target.set(...t.look);
    }
    if (typeof c.update === "function") {
      c.update();
    }
    initialised.current = true;
  }, [mode, camera, targets]);

  // Auto-spin
  useFrame((_, delta) => {
    if (mode !== "spin" || !controlsRef.current) return;
    spinRef.current += delta * 0.45;
    const r = Math.sqrt(
      perspective.pos[0] ** 2 + perspective.pos[2] ** 2
    );
    const y = perspective.pos[1];
    camera.position.set(
      Math.sin(spinRef.current) * r,
      y,
      Math.cos(spinRef.current) * r
    );
    camera.lookAt(...(targets.perspective.look as [number, number, number]));
  });

  return (
    <OrbitControls
      ref={controlsRef as any}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      autoRotate={false}
      enableZoom={mode !== "interior"}
      maxPolarAngle={
        mode === "aerial"   ? Math.PI * 0.52 :
        mode === "interior" ? Math.PI * 0.55 :
        Math.PI * 0.495
      }
      minPolarAngle={mode === "aerial" ? Math.PI * 0.46 : 0.08}
      minAzimuthAngle={mode === "interior" ? -Math.PI / 5 : -Infinity}
      maxAzimuthAngle={mode === "interior" ?  Math.PI / 5 :  Infinity}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared building components
// ─────────────────────────────────────────────────────────────────────────────

/** Conveyor tunnel building. Runs along X axis, centred at origin. */
function TunnelBuilding({
  len, archColor = "#2563eb", variant,
}: {
  len: number;
  archColor?: string;
  variant?: string;
}) {
  const h = 4.2;
  const d = 7.2;            // front-to-back depth (Z)
  const archs = Math.max(4, Math.floor(len / 4.5));

  const ac = variant === "touchless" ? "#10b981" : archColor;

  return (
    <group>
      {/* Main shell */}
      <B p={[0, h / 2, 0]} s={[len, h, d]} color="#1e3a5f" rough={0.6} metal={0.3} />
      {/* Roof slab */}
      <B p={[0, h + 0.1, 0]} s={[len + 0.3, 0.18, d + 0.3]} color="#0f2040" rough={0.82} metal={0.2} />
      {/* Roof accent glow strip */}
      <B p={[0, h + 0.2, 0]} s={[len - 1.2, 0.07, 0.35]}
        color="#2563eb" emissive="#1d4ed8" emInt={0.55} rough={0.35} metal={0.5} />

      {/* Entry portal */}
      <B p={[-len / 2 + 0.35, h / 2, 0]} s={[0.6, h, d + 0.15]} color="#172d4a" rough={0.7} metal={0.2} />
      {/* Entry opening — dark */}
      <B p={[-len / 2 - 0.06, h * 0.42, 0]} s={[0.08, h * 0.84, d - 1.4]}
        color="#010812" rough={0.95} metal={0} rxShadow={false} />

      {/* Exit portal */}
      <B p={[len / 2 - 0.35, h / 2, 0]} s={[0.6, h, d + 0.15]} color="#172d4a" rough={0.7} metal={0.2} />
      {/* Exit glow — blue light at end */}
      <B p={[len / 2 + 0.06, h * 0.42, 0]} s={[0.08, h * 0.84, d - 1.4]}
        color="#93c5fd" emissive="#3b82f6" emInt={1.1} rough={0.15} metal={0} rxShadow={false} />

      {/* Interior arch frames */}
      {Array.from({ length: archs }).map((_, i) => {
        const x = -len / 2 + (len / (archs + 1)) * (i + 1);
        return (
          <group key={i}>
            <B p={[x, h / 2, -d / 2 + 0.35]} s={[0.22, h, 0.32]}
              color={ac} emissive={ac} emInt={0.22} rough={0.4} metal={0.5} />
            <B p={[x, h / 2, d / 2 - 0.35]} s={[0.22, h, 0.32]}
              color={ac} emissive={ac} emInt={0.22} rough={0.4} metal={0.5} />
            <B p={[x, h - 0.22, 0]} s={[0.22, 0.3, d - 1.0]}
              color={ac} emissive={ac} emInt={0.22} rough={0.4} metal={0.5} />
          </group>
        );
      })}

      {/* Ceiling LED strip */}
      <B p={[0, h - 0.1, 0]} s={[len - 1.6, 0.07, 0.42]}
        color="#bfdbfe" emissive="#60a5fa" emInt={3.5} rough={0.08} metal={0} rxShadow={false} />
      {/* Reflective wet floor */}
      <B p={[0, 0.03, 0]} s={[len - 0.7, 0.04, d - 0.8]}
        color="#1a2235" rough={0.05} metal={0.92} rxShadow={false} />

      {/* Rooftop HVAC units (visible from aerial) */}
      {Array.from({ length: Math.max(2, Math.floor(len / 10)) }).map((_, i) => {
        const spacing = len / (Math.max(2, Math.floor(len / 10)) + 1);
        const x = -len / 2 + spacing * (i + 1);
        return (
          <group key={i} position={[x, h + 0.3, 0]}>
            <B p={[0, 0.3, 0]} s={[2.2, 0.55, 1.5]} color="#1a2a3a" rough={0.7} metal={0.5} />
            <Cyl p={[0, 0.72, 0]} r={0.5} h={0.3} color="#0f1a2a" emissive="#1e3a5f" emInt={0.1} />
          </group>
        );
      })}
    </group>
  );
}

function KioskUnit({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <B p={[0, 0.05, 0]} s={[0.65, 0.12, 0.65]} color="#374151" rough={0.8} metal={0.2} />
      <B p={[0, 0.88, 0]} s={[0.52, 1.62, 0.52]} color="#4c1d95" rough={0.5} metal={0.4}
        emissive="#3b0764" emInt={0.28} />
      <B p={[0.28, 1.0, 0]} s={[0.03, 0.55, 0.38]}
        color="#bfdbfe" emissive="#3b82f6" emInt={1.1} rough={0.08} metal={0} />
    </group>
  );
}

function VacuumUnit({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Cyl p={[0, 0.72, 0]} r={0.36} h={1.44} color="#134e4a" emissive="#0f766e" emInt={0.28} />
      <Cyl p={[0, 1.48, 0]} r={0.26} h={0.14} color="#0f766e" emissive="#0f766e" emInt={0.65} />
      <B p={[0.45, 0.52, 0]} s={[0.85, 0.07, 0.07]} color="#0f766e" rough={0.6} metal={0.4} />
    </group>
  );
}

function ExitCanopy({ p, w }: { p: [number, number, number]; w: number }) {
  return (
    <group position={p}>
      <B p={[0, 4.1, 0]} s={[w, 0.2, 7.6]} color="#0f2040" rough={0.82} metal={0.2} />
      <B p={[-w / 2 + 0.3, 2.05, 2.8]} s={[0.28, 4.1, 0.28]} color="#1e3a5f" rough={0.6} metal={0.3} />
      <B p={[-w / 2 + 0.3, 2.05, -2.8]} s={[0.28, 4.1, 0.28]} color="#1e3a5f" rough={0.6} metal={0.3} />
      <B p={[w / 2 - 0.3, 2.05, 2.8]} s={[0.28, 4.1, 0.28]} color="#1e3a5f" rough={0.6} metal={0.3} />
      <B p={[w / 2 - 0.3, 2.05, -2.8]} s={[0.28, 4.1, 0.28]} color="#1e3a5f" rough={0.6} metal={0.3} />
    </group>
  );
}

function StackingLane({ p, w }: { p: [number, number, number]; w: number }) {
  return (
    <group position={p}>
      <B p={[0, 0.04, 0]} s={[w, 0.06, 9]} color="#0e1929" rough={0.9} rxShadow={false} />
      <B p={[0, 0.06, 0]} s={[w, 0.02, 0.12]} color="#fbbf24" emissive="#d97706" emInt={0.12} rxShadow={false} />
    </group>
  );
}

function InBayBuilding({
  p = [0, 0, 0] as [number, number, number],
  bw = 9,
  bd = 9,
}: {
  p?: [number, number, number];
  bw?: number;
  bd?: number;
}) {
  const h = 4.8;
  return (
    <group position={p}>
      {/* Side walls (Z sides) */}
      <B p={[0, h / 2, -bd / 2 + 0.3]} s={[bw + 0.7, h, 0.55]} color="#172d4a" rough={0.7} metal={0.2} />
      <B p={[0, h / 2,  bd / 2 - 0.3]} s={[bw + 0.7, h, 0.55]} color="#172d4a" rough={0.7} metal={0.2} />
      {/* Entry/exit frames (X sides) */}
      <B p={[-bw / 2 + 0.32, h / 2, 0]} s={[0.55, h, bd + 0.15]} color="#1e3a5f" rough={0.6} metal={0.3} />
      <B p={[ bw / 2 - 0.32, h / 2, 0]} s={[0.55, h, bd + 0.15]} color="#1e3a5f" rough={0.6} metal={0.3} />
      {/* Roof */}
      <B p={[0, h + 0.12, 0]} s={[bw + 0.9, 0.2, bd + 0.9]} color="#0f2040" rough={0.82} metal={0.2} />
      <B p={[0, h + 0.22, 0]} s={[bw - 0.5, 0.07, 0.35]}
        color="#2563eb" emissive="#1d4ed8" emInt={0.5} rough={0.35} metal={0.5} />
      {/* Gantry top rail */}
      <B p={[0, h - 0.45, 0]} s={[bw - 1.6, 0.32, bd - 1.2]}
        color="#374151" rough={0.55} metal={0.5} />
      {/* Gantry bottom rail */}
      <B p={[0, 0.55, 0]} s={[bw - 1.6, 0.32, bd - 1.2]}
        color="#374151" rough={0.55} metal={0.5} />
      {/* Gantry vertical arm */}
      <B p={[0, h / 2, 0]} s={[0.42, h - 1.6, 0.42]}
        color="#374151" rough={0.5} metal={0.55} />
      {/* Nozzle indicators */}
      {[-2.2, 0, 2.2].map((zo, i) => (
        <Cyl key={i} p={[0, h / 2, zo]} r={0.18} h={0.52}
          color="#1d4ed8" emissive="#3b82f6" emInt={0.9} />
      ))}
      {/* Ceiling LED */}
      <B p={[0, h - 0.12, 0]} s={[bw - 2.0, 0.07, 0.4]}
        color="#bfdbfe" emissive="#60a5fa" emInt={3.5} rough={0.08} metal={0} rxShadow={false} />
      {/* Wet floor */}
      <B p={[0, 0.03, 0]} s={[bw - 0.9, 0.04, bd - 0.9]}
        color="#1a2235" rough={0.04} metal={0.94} rxShadow={false} />
    </group>
  );
}

function SelfServeBay({ p, d = 4.5 }: { p: [number, number, number]; d?: number }) {
  return (
    <group position={p}>
      {/* Three walls (back + two sides, open front) */}
      <B p={[0, 1.6, -d / 2 + 0.25]} s={[d, 3.2, 0.4]} color="#1e3a5f" rough={0.7} metal={0.2} />
      <B p={[-d / 2 + 0.25, 1.6, 0]} s={[0.4, 3.2, d]} color="#1e3a5f" rough={0.7} metal={0.2} />
      <B p={[ d / 2 - 0.25, 1.6, 0]} s={[0.4, 3.2, d]} color="#1e3a5f" rough={0.7} metal={0.2} />
      {/* Roof */}
      <B p={[0, 3.3, 0]} s={[d + 0.4, 0.18, d + 0.4]} color="#0f2040" rough={0.82} metal={0.2} />
      <B p={[0, 3.4, 0]} s={[d - 0.5, 0.06, 0.25]}
        color="#2563eb" emissive="#1d4ed8" emInt={0.5} rough={0.35} metal={0.5} />
      {/* Wand post */}
      <Cyl p={[-d / 2 + 0.7, 1.5, 0.4]} r={0.09} h={3.0}
        color="#0f766e" emissive="#0f766e" emInt={0.45} />
      {/* Pay terminal */}
      <B p={[0.1, 0.95, -d / 2 + 0.65]} s={[0.32, 1.9, 0.22]}
        color="#4c1d95" emissive="#3b0764" emInt={0.22} rough={0.5} metal={0.4} />
    </group>
  );
}

function DetailBay({ p, w = 3.5, d = 7.5 }: { p: [number, number, number]; w?: number; d?: number }) {
  return (
    <group position={p}>
      <B p={[0, 2.2, 0]} s={[w, 4.4, d]} color="#1e1b4b" rough={0.65} metal={0.25} />
      <B p={[0, 4.5, 0]} s={[w + 0.3, 0.18, d + 0.3]} color="#0f0f2a" rough={0.85} metal={0.2} />
      <B p={[0, 4.6, 0]} s={[w - 0.4, 0.06, 0.25]}
        color="#7c3aed" emissive="#6d28d9" emInt={0.55} rough={0.35} metal={0.5} />
      {/* Entry (open face — just a glow at back) */}
      <B p={[0, 2.2, d / 2 - 0.1]} s={[w - 0.8, 3.2, 0.07]}
        color="#a78bfa" emissive="#7c3aed" emInt={0.7} rough={0.1} metal={0} rxShadow={false} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene models — one per diagramType
// ─────────────────────────────────────────────────────────────────────────────

function ExpressTunnelScene({ tunnelW = 170, variant }: { tunnelW?: number; variant?: string }) {
  const len = tunnelW / 6;              // SVG-to-3D scale
  const vacX = len / 2 + 2.2;

  return (
    <group>
      <StackingLane p={[-len / 2 - 5, 0, 0]} w={10} />
      <KioskUnit p={[-len / 2 - 0.4, 0, 2.8]} />
      <KioskUnit p={[-len / 2 - 0.4, 0, -2.8]} />
      <TunnelBuilding len={len} variant={variant} />
      <ExitCanopy p={[len / 2 + 2.5, 0, 0]} w={5} />
      {/* Vacuum cluster at exit */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <VacuumUnit key={i} p={[vacX + Math.floor(i / 3) * 2.2, 0, -2.2 + (i % 3) * 2.2]} />
      ))}
    </group>
  );
}

function FlexServeScene() {
  const len = 28;
  const finishX = len / 2 + 4.5;
  return (
    <group>
      <StackingLane p={[-len / 2 - 5.5, 0, 0]} w={10} />
      <KioskUnit p={[-len / 2 - 0.5, 0, 2.8]} />
      <KioskUnit p={[-len / 2 - 0.5, 0, -2.8]} />
      <TunnelBuilding len={len} />
      {/* Finish bays building */}
      <B p={[finishX, 2.1, 0]} s={[8, 4.2, 9.5]} color="#172d4a" rough={0.7} metal={0.2} />
      <B p={[finishX, 4.3, 0]} s={[8.4, 0.18, 9.9]} color="#0f2040" rough={0.82} metal={0.2} />
      <B p={[finishX, 4.4, 0]} s={[7.2, 0.07, 0.32]}
        color="#2563eb" emissive="#1d4ed8" emInt={0.5} rough={0.35} metal={0.5} />
      {[-2.5, 0, 2.5].map((z, i) => (
        <B key={i} p={[finishX, 2.1, z]} s={[6.8, 3.5, 0.1]}
          color="#0e1929" rough={0.9} metal={0} rxShadow={false} />
      ))}
      <B p={[finishX, 4.15, 0]} s={[7.5, 0.07, 0.35]}
        color="#bfdbfe" emissive="#60a5fa" emInt={1.6} rough={0.08} metal={0} rxShadow={false} />
      {[0, 1, 2].map((i) => (
        <VacuumUnit key={i} p={[len / 2 + 1.2, 0, -2.2 + i * 2.2]} />
      ))}
    </group>
  );
}

function FullServiceScene() {
  const len = 28;
  return (
    <group>
      <StackingLane p={[-len / 2 - 5.5, 0, 0]} w={10} />
      <KioskUnit p={[-len / 2 - 0.5, 0, 2.8]} />
      <KioskUnit p={[-len / 2 - 0.5, 0, -2.8]} />
      <TunnelBuilding len={len} />
      {/* Detail bays */}
      {[-1.75, 0, 1.75, 3.5, 5.25].map((xOff, i) => (
        <DetailBay key={i} p={[len / 2 + 5 + xOff, 0, 0]} w={3} d={7.2} />
      ))}
      {/* Lounge */}
      <B p={[len / 2 + 14, 2.2, 0]} s={[4.5, 4.4, 9]} color="#172d4a" rough={0.7} metal={0.2} />
      <B p={[len / 2 + 14, 4.42, 0]} s={[4.8, 0.18, 9.4]} color="#0f2040" rough={0.82} metal={0.2} />
    </group>
  );
}

function TunnelDetailComboScene() {
  const len = 30;
  return (
    <group>
      <StackingLane p={[-len / 2 - 5.5, 0, 0]} w={10} />
      <KioskUnit p={[-len / 2 - 0.5, 0, 2.8]} />
      <KioskUnit p={[-len / 2 - 0.5, 0, -2.8]} />
      <TunnelBuilding len={len} />
      {[0, 1, 2].map((i) => (
        <DetailBay key={i} p={[len / 2 + 4 + i * 4.2, 0, 0]} w={3.5} d={8} />
      ))}
      {[0, 1, 2].map((i) => (
        <VacuumUnit key={i} p={[len / 2 + 1.2, 0, -2.2 + i * 2.2]} />
      ))}
    </group>
  );
}

function InBaySingleScene() {
  return (
    <group>
      <StackingLane p={[-8.5, 0, 0]} w={8} />
      <KioskUnit p={[-4.8, 0, 0]} />
      <InBayBuilding p={[0, 0, 0]} bw={9} bd={9} />
      <VacuumUnit p={[6.2, 0, 3]} />
      <VacuumUnit p={[6.2, 0, -3]} />
    </group>
  );
}

function InBayDualScene() {
  const gap = 11.5;
  return (
    <group>
      <StackingLane p={[-gap - 8, 0, 0]} w={8} />
      {[-gap / 2, gap / 2].map((xOff, i) => (
        <group key={i}>
          <InBayBuilding p={[xOff, 0, 0]} bw={9} bd={9} />
          <KioskUnit p={[xOff - 5, 0, 0]} />
        </group>
      ))}
      <VacuumUnit p={[gap / 2 + 6, 0, 3]} />
      <VacuumUnit p={[gap / 2 + 6, 0, -3]} />
    </group>
  );
}

function InBayTripleScene() {
  const positions: [number, number, number][] = [[-13, 0, 0], [0, 0, 0], [13, 0, 0]];
  return (
    <group>
      <StackingLane p={[-21, 0, 0]} w={8} />
      {positions.map((pos, i) => (
        <group key={i}>
          <InBayBuilding p={pos} bw={8.5} bd={9} />
          <KioskUnit p={[pos[0], 0, 5.5]} />
        </group>
      ))}
      <VacuumUnit p={[19.5, 0, 3]} />
      <VacuumUnit p={[19.5, 0, -3]} />
    </group>
  );
}

function SelfServeScene({ bays = 6 }: { bays?: number }) {
  const perRow = bays <= 4 ? bays : Math.ceil(bays / 2);
  const rows   = bays <= 4 ? 1 : 2;
  const baySpacing = 5.5;
  const totalW = (perRow - 1) * baySpacing;
  const row1Z  = rows === 1 ? 0 : -5;
  const row2Z  = 5;

  return (
    <group>
      {/* Row 1 */}
      {Array.from({ length: perRow }).map((_, i) => (
        <SelfServeBay key={i}
          p={[-totalW / 2 + i * baySpacing, 0, row1Z]}
          d={4.5}
        />
      ))}
      {/* Row 2 */}
      {rows === 2 && Array.from({ length: bays - perRow }).map((_, i) => (
        <SelfServeBay key={i}
          p={[-totalW / 2 + i * baySpacing, 0, row2Z]}
          d={4.5}
        />
      ))}
      {/* Vacuum on side */}
      {[0, 1, 2].map((i) => (
        <VacuumUnit key={i} p={[totalW / 2 + 3.5, 0, -2.5 + i * 2.5]} />
      ))}
      {/* Drive aisle marker */}
      {rows === 2 && (
        <B p={[0, 0.04, 0]} s={[totalW + 6, 0.02, 0.12]}
          color="#fbbf24" emissive="#d97706" emInt={0.1} rxShadow={false} />
      )}
    </group>
  );
}

function TunnelComboScene() {
  const len = 28;
  const baySpacing = 5.5;
  const bays = 4;
  const bayStartX = -len / 2;
  return (
    <group>
      <StackingLane p={[-len / 2 - 5.5, 0, -4]} w={10} />
      <KioskUnit p={[-len / 2 - 0.5, 0, -1.5]} />
      <KioskUnit p={[-len / 2 - 0.5, 0, -6.2]} />
      {/* Tunnel in upper half (positive Z) */}
      <group position={[0, 0, 3.6]}>
        <TunnelBuilding len={len} />
      </group>
      {/* Self-serve bays in lower section */}
      {Array.from({ length: bays }).map((_, i) => (
        <SelfServeBay key={i}
          p={[bayStartX + i * baySpacing + baySpacing / 2, 0, -8]}
          d={4.5}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <VacuumUnit key={i} p={[len / 2 + 1.5, 0, 1 + i * 2.2]} />
      ))}
      <B p={[0, 0.05, -1.2]} s={[len + 12, 0.05, 0.12]}
        color="#334155" rough={0.9} rxShadow={false} />
    </group>
  );
}

function InBaySelfServeComboScene() {
  return (
    <group>
      <StackingLane p={[-9, 0, 3.5]} w={8} />
      <KioskUnit p={[-4.8, 0, 3.5]} />
      {/* In-bay */}
      <InBayBuilding p={[0, 0, 3.5]} bw={9} bd={8} />
      {/* Self-serve bays */}
      {[-4.5, 0, 4.5].map((xOff, i) => (
        <SelfServeBay key={i} p={[xOff, 0, -5]} d={4} />
      ))}
      <VacuumUnit p={[7, 0, 3.5]} />
      <VacuumUnit p={[7, 0, 0.5]} />
      <B p={[0, 0.05, -0.5]} s={[22, 0.04, 0.12]}
        color="#334155" rough={0.9} rxShadow={false} />
    </group>
  );
}

function HandWashScene() {
  const stalls = 4;
  const spacing = 5;
  const totalW = (stalls - 1) * spacing;
  return (
    <group>
      {Array.from({ length: stalls }).map((_, i) => {
        const x = -totalW / 2 + i * spacing;
        return (
          <group key={i} position={[x, 0, 0]}>
            {/* Stall shell */}
            <B p={[0, 2.0, 0]} s={[4, 4.0, 7]} color="#172d4a" rough={0.72} metal={0.2} />
            {/* Entry opening */}
            <B p={[4 / 2, 1.8, 0]} s={[0.05, 3.0, 5.4]}
              color="#93c5fd" emissive="#3b82f6" emInt={0.5} rough={0.1} metal={0} rxShadow={false} />
            <B p={[-4 / 2, 1.8, 0]} s={[0.05, 3.0, 5.4]}
              color="#93c5fd" emissive="#3b82f6" emInt={0.5} rough={0.1} metal={0} rxShadow={false} />
            {/* Roof */}
            <B p={[0, 4.1, 0]} s={[4.4, 0.18, 7.4]} color="#0f2040" rough={0.82} metal={0.2} />
            <B p={[0, 4.2, 0]} s={[3.5, 0.07, 0.3]}
              color="#2563eb" emissive="#1d4ed8" emInt={0.5} rough={0.35} metal={0.5} />
            {/* Hose */}
            <Cyl p={[-1.4, 1.8, 2.5]} r={0.09} h={3.5}
              color="#0f766e" emissive="#0f766e" emInt={0.4} />
            {/* Ceiling light */}
            <B p={[0, 3.9, 0]} s={[3.2, 0.06, 0.35]}
              color="#bfdbfe" emissive="#60a5fa" emInt={1.8} rough={0.08} metal={0} rxShadow={false} />
            {/* Floor */}
            <B p={[0, 0.03, 0]} s={[3.4, 0.04, 6.4]}
              color="#1a2235" rough={0.08} metal={0.85} rxShadow={false} />
          </group>
        );
      })}
      {/* Equipment room */}
      <B p={[totalW / 2 + 5, 2.2, 0]} s={[5, 4.4, 8]} color="#374151" rough={0.72} metal={0.3} />
      <B p={[totalW / 2 + 5, 4.42, 0]} s={[5.4, 0.18, 8.4]} color="#0f2040" rough={0.82} metal={0.2} />
    </group>
  );
}

function EvExpressScene() {
  const len = 30;
  const vacX = len / 2 + 1.8;
  const evX  = len / 2 + 8;
  return (
    <group>
      <StackingLane p={[-len / 2 - 5.5, 0, 0]} w={10} />
      <KioskUnit p={[-len / 2 - 0.5, 0, 2.8]} />
      <KioskUnit p={[-len / 2 - 0.5, 0, -2.8]} />
      <TunnelBuilding len={len} variant="touchless" archColor="#10b981" />
      {[0, 1, 2].map((i) => (
        <VacuumUnit key={i} p={[vacX, 0, -2.2 + i * 2.2]} />
      ))}
      {/* EV charging canopy */}
      <B p={[evX, 4.2, 0]} s={[9, 0.2, 9]} color="#065f46" rough={0.75} metal={0.3}
        emissive="#022c22" emInt={0.15} />
      {[-2.8, 0, 2.8].map((z, i) => (
        <B key={i} p={[evX - 2.8, 2.1, z]} s={[0.28, 4.2, 0.28]}
          color="#065f46" rough={0.6} metal={0.4} />
      ))}
      {[-2.8, 0, 2.8].map((z, i) => (
        <B key={i} p={[evX + 2.8, 2.1, z]} s={[0.28, 4.2, 0.28]}
          color="#065f46" rough={0.6} metal={0.4} />
      ))}
      {/* EV charger units */}
      {[-2.8, 0, 2.8].map((z, i) => (
        <group key={i} position={[evX, 0, z]}>
          <B p={[0, 0.8, 0]} s={[0.42, 1.6, 0.42]}
            color="#065f46" emissive="#10b981" emInt={0.45} rough={0.4} metal={0.5} />
          <B p={[0.24, 1.0, 0]} s={[0.03, 0.6, 0.32]}
            color="#6ee7b7" emissive="#10b981" emInt={1.1} rough={0.08} metal={0} rxShadow={false} />
        </group>
      ))}
    </group>
  );
}

function MobileScene() {
  return (
    <group>
      {/* Parking lot surface */}
      <B p={[0, 0.04, 0]} s={[34, 0.06, 22]} color="#0e1929" rough={0.92} rxShadow={false} />
      {/* Parking bay lines */}
      {[-12, -6, 0, 6, 12].map((x, i) => (
        <B key={i} p={[x, 0.07, 0]} s={[0.1, 0.02, 20]}
          color="#334155" rough={0.9} rxShadow={false} />
      ))}
      {/* Service van */}
      <group position={[-10, 0, 0]}>
        <B p={[0, 1.5, 0]} s={[5.5, 2.8, 2.4]} color="#1e3a5f" rough={0.6} metal={0.3} />
        <B p={[-1.5, 1.6, 0]} s={[2, 1.8, 2.1]} color="#172d4a" rough={0.65} metal={0.25} />
        <Cyl p={[-2, 0, 1.1]} r={0.55} h={0.4} color="#1f2937" />
        <Cyl p={[ 2, 0, 1.1]} r={0.55} h={0.4} color="#1f2937" />
        <Cyl p={[-2, 0, -1.1]} r={0.55} h={0.4} color="#1f2937" />
        <Cyl p={[ 2, 0, -1.1]} r={0.55} h={0.4} color="#1f2937" />
        <B p={[2.8, 1.5, 0]} s={[0.05, 1.0, 1.8]}
          color="#93c5fd" emissive="#3b82f6" emInt={0.8} rough={0.05} metal={0} rxShadow={false} />
      </group>
      {/* Container unit */}
      <group position={[3, 0, 0]}>
        <B p={[0, 1.55, 0]} s={[6, 3.1, 2.6]} color="#1e293b" rough={0.65} metal={0.4} />
        {[0.8, 1.8, 2.8].map((xR, i) => (
          <B key={i} p={[-3 + xR, 1.55, 0]} s={[0.08, 3.0, 2.5]}
            color="#334155" rough={0.7} metal={0.3} />
        ))}
        <B p={[0, 3.2, 0]} s={[6.4, 0.18, 2.9]} color="#0f172a" rough={0.85} metal={0.2} />
        <B p={[3.1, 1.55, 0]} s={[0.1, 2.4, 2.0]}
          color="#10b981" emissive="#065f46" emInt={0.5} rough={0.2} metal={0} rxShadow={false} />
      </group>
      {/* Water tank */}
      <group position={[11, 0, 0]}>
        <Cyl p={[0, 1.3, 0]} r={1.1} h={2.6} color="#0c4a6e" emissive="#075985" emInt={0.15} />
        <Cyl p={[0, 2.75, 0]} r={1.12} h={0.22} color="#0369a1" />
      </group>
      {/* Pump unit */}
      <group position={[7, 0, 0]}>
        <B p={[0, 0.9, 0]} s={[1.5, 1.8, 1.5]} color="#374151" rough={0.6} metal={0.5} />
        <Cyl p={[0, 2.0, 0]} r={0.35} h={0.6} color="#0f766e" emissive="#0f766e" emInt={0.5} />
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene dispatcher
// ─────────────────────────────────────────────────────────────────────────────

function SceneModel({ config }: { config: CarWashConfig }) {
  const { diagramType, diagramParams = {} } = config;
  switch (diagramType) {
    case "express-tunnel":
      return <ExpressTunnelScene
        tunnelW={(diagramParams.tunnelW as number) ?? 170}
        variant={diagramParams.variant as string | undefined}
      />;
    case "flex-serve":          return <FlexServeScene />;
    case "full-service":        return <FullServiceScene />;
    case "tunnel-detail-combo": return <TunnelDetailComboScene />;
    case "inbay-single":        return <InBaySingleScene />;
    case "inbay-dual":          return <InBayDualScene />;
    case "inbay-triple":        return <InBayTripleScene />;
    case "self-serve":
      return <SelfServeScene bays={(diagramParams.bays as number) ?? 6} />;
    case "tunnel-combo":           return <TunnelComboScene />;
    case "inbay-selfserve-combo":  return <InBaySelfServeComboScene />;
    case "hand-wash":              return <HandWashScene />;
    case "ev-express":             return <EvExpressScene />;
    case "mobile":                 return <MobileScene />;
    default:                       return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-config camera positions
// ─────────────────────────────────────────────────────────────────────────────

function getCameraParams(config: CarWashConfig): {
  perspective: CamTarget;
  interior: CamTarget;
} {
  const dt = config.diagramType;
  const dp = config.diagramParams ?? {};

  if (dt === "express-tunnel" || dt === "flex-serve" || dt === "full-service" ||
      dt === "tunnel-detail-combo" || dt === "tunnel-combo" || dt === "ev-express") {
    const tunnelW = (dp.tunnelW as number) ?? 170;
    const len = tunnelW / 6;
    return {
      perspective: { pos: [0, 13, 28], look: [0, 2, 0] },
      interior:    { pos: [-len / 2 + 3.5, 2.2, 0.05], look: [len / 2, 2.2, 0] },
    };
  }
  if (dt === "inbay-single") {
    return {
      perspective: { pos: [0, 12, 22], look: [0, 2, 0] },
      interior:    { pos: [-3, 2.5, 0.05], look: [0, 2.5, 0] },
    };
  }
  if (dt === "inbay-dual") {
    return {
      perspective: { pos: [0, 13, 26], look: [0, 2, 0] },
      interior:    { pos: [-9.5, 2.5, 0.05], look: [-1, 2.5, 0] },
    };
  }
  if (dt === "inbay-triple") {
    return {
      perspective: { pos: [0, 13, 30], look: [0, 2, 0] },
      interior:    { pos: [-16, 2.5, 0.05], look: [-6, 2.5, 0] },
    };
  }
  if (dt === "self-serve") {
    const bays = (dp.bays as number) ?? 6;
    const perRow = bays <= 4 ? bays : Math.ceil(bays / 2);
    return {
      perspective: { pos: [0, 14, 26], look: [0, 1.5, 0] },
      interior:    { pos: [-(perRow - 1) * 5.5 / 2, 2.0, -7], look: [0, 1.5, 0] },
    };
  }
  if (dt === "inbay-selfserve-combo") {
    return {
      perspective: { pos: [0, 13, 24], look: [0, 2, 0] },
      interior:    { pos: [-3.5, 2.4, 3.5], look: [0, 2.4, 3.5] },
    };
  }
  if (dt === "hand-wash") {
    return {
      perspective: { pos: [0, 13, 24], look: [0, 2, 0] },
      interior:    { pos: [-12, 2.2, 0.05], look: [0, 2.0, 0] },
    };
  }
  if (dt === "mobile") {
    return {
      perspective: { pos: [0, 14, 26], look: [0, 1.5, 0] },
      interior:    { pos: [-14, 3.5, 0.05], look: [5, 2.0, 0] },
    };
  }
  return {
    perspective: { pos: [0, 13, 26], look: [0, 2, 0] },
    interior:    { pos: [-8, 2.5, 0.05], look: [8, 2.5, 0] },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

interface Scene3DProps {
  config: CarWashConfig;
  mode: ViewMode;
  className?: string;
}

function SceneContent({ config, mode }: { config: CarWashConfig; mode: ViewMode }) {
  const camParams = useMemo(() => getCameraParams(config), [config]);
  return (
    <>
      <color attach="background" args={["#060d1c"]} />
      <fog attach="fog" args={["#060d1a", 42, 90]} />
      <Lights />
      <Suspense fallback={null}>
        <Environment preset="night" />
      </Suspense>
      <Ground />
      <CameraController
        mode={mode}
        perspective={camParams.perspective}
        interior={camParams.interior}
      />
      <SceneModel config={config} />
      {/* ── Post-processing ─────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <EffectComposer multisampling={4}>
          {/* Bloom makes emissive LEDs and glow panels actually glow */}
          <Bloom
            luminanceThreshold={0.18}
            luminanceSmoothing={0.88}
            intensity={1.6}
          />
          {/* ACES Filmic tone mapping — cinematic look */}
          <ToneMapping />
          {/* Subtle vignette to frame the scene */}
          <Vignette eskil={false} offset={0.25} darkness={0.65} />
        </EffectComposer>
      </Suspense>
    </>
  );
}

export default function Scene3D({ config, mode, className = "" }: Scene3DProps) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        shadows
        camera={{ fov: 48, near: 0.5, far: 200 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          // Disable built-in tone mapping — EffectComposer handles it
          toneMapping: THREE.NoToneMapping,
        }}
        style={{ display: "block" }}
      >
        <SceneContent config={config} mode={mode} />
      </Canvas>
    </div>
  );
}
