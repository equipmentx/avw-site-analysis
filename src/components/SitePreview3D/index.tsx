"use client";

import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment, Sky } from "@react-three/drei";
import * as THREE from "three";
import { getConfig } from "@/lib/carwashConfigs";

// ── Model mapping — configId → GLB file ──────────────────────────────────────
// Grouped by physical similarity — ~5 base models cover all 22 configs

const CONFIG_MODEL: Record<string, string> = {
  // Tunnel configs → tunnel.glb
  "express-100":         "/models/tunnel.glb",
  "express-130":         "/models/tunnel.glb",
  "express-150":         "/models/tunnel.glb",
  "express-200":         "/models/tunnel.glb",
  "touchless-conveyor":  "/models/tunnel.glb",
  "soft-touch-conveyor": "/models/tunnel.glb",
  "hybrid-conveyor":     "/models/tunnel.glb",
  "flex-serve":          "/models/tunnel.glb",
  "full-service":        "/models/tunnel.glb",
  "ev-express":          "/models/tunnel.glb",
  // In-bay configs → inbay.glb
  "inbay-touchless":     "/models/inbay.glb",
  "inbay-soft-touch":    "/models/inbay.glb",
  "inbay-dual":          "/models/inbay.glb",
  "inbay-triple":        "/models/inbay.glb",
  // Self-serve → selfserve.glb
  "self-serve-4":        "/models/selfserve.glb",
  "self-serve-6":        "/models/selfserve.glb",
  "self-serve-8":        "/models/selfserve.glb",
  // Combo → tunnel.glb (closest match)
  "tunnel-selfserve-combo":  "/models/tunnel.glb",
  "inbay-selfserve-combo":   "/models/inbay.glb",
  "tunnel-detail-combo":     "/models/tunnel.glb",
  // Specialised
  "hand-wash":           "/models/handwash.glb",
  "mobile-container":    "/models/container.glb",
};

// ── Camera presets ────────────────────────────────────────────────────────────

type CameraView = "aerial" | "exterior" | "street" | "spin";

const CAMERA_PRESETS: Record<CameraView, { position: [number,number,number]; target: [number,number,number] }> = {
  aerial:    { position: [0, 28, 2],   target: [0, 0, 0] },
  exterior:  { position: [22, 12, 22], target: [0, 2, 0] },
  street:    { position: [30, 3, 0],   target: [0, 3, 0] },
  spin:      { position: [22, 10, 22], target: [0, 2, 0] }, // auto-rotates
};

// ── Satellite ground plane ────────────────────────────────────────────────────

function SatelliteGround({ imageUrl }: { imageUrl: string | null }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
    });
  }, [imageUrl]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial
        map={texture ?? undefined}
        color={texture ? "#ffffff" : "#1e293b"}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

// ── Lot boundary outline ──────────────────────────────────────────────────────

function LotBoundary({ widthFt, depthFt }: { widthFt: number; depthFt: number }) {
  const SCALE = 1 / 4;
  const w = widthFt * SCALE;
  const d = depthFt * SCALE;

  const points = [
    new THREE.Vector3(-w/2, 0.05, -d/2),
    new THREE.Vector3( w/2, 0.05, -d/2),
    new THREE.Vector3( w/2, 0.05,  d/2),
    new THREE.Vector3(-w/2, 0.05,  d/2),
    new THREE.Vector3(-w/2, 0.05, -d/2),
  ];

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: "#3b82f6" });
  const lineObj  = new THREE.Line(geometry, material);

  return <primitive object={lineObj} />;
}

// ── GLB model loader ──────────────────────────────────────────────────────────

function CarWashModel({ modelPath, scale = 1 }: { modelPath: string; scale?: number }) {
  const { scene } = useGLTF(modelPath);

  useEffect(() => {
    // Centre and ground the model
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    scene.position.set(-center.x, -box.min.y, -center.z);

    // Cast and receive shadows on all meshes
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} scale={scale} />;
}

// ── Fallback box model (shown when GLB not yet available) ─────────────────────

function FallbackModel({ configId }: { configId: string }) {
  const config = getConfig(configId);
  const SCALE  = 1 / 4;
  const w = (config?.minLotWidthFt  ?? 130) * SCALE * 0.55;
  const d = (config?.minLotDepthFt  ?? 245) * SCALE * 0.55;
  const h = configId.startsWith("self-serve") ? 2.5 : 5;

  return (
    <group>
      {/* Main building */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, h + 0.3, 0]} castShadow>
        <boxGeometry args={[w + 0.5, 0.3, d + 0.5]} />
        <meshStandardMaterial color="#1e40af" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Entry arch */}
      <mesh position={[0, h / 2, -d / 2 - 0.5]}>
        <boxGeometry args={[w * 0.4, h * 0.9, 0.4]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.4} metalness={0.5} emissive="#1d4ed8" emissiveIntensity={0.3} />
      </mesh>
      {/* "3D model loading" label rendered as a plane — shown until GLB arrives */}
    </group>
  );
}

// ── Auto-spin camera ──────────────────────────────────────────────────────────

function SpinCamera() {
  const { camera } = useThree();
  const angle = useRef(Math.PI / 4);

  useFrame((_, delta) => {
    angle.current += delta * 0.3;
    const r = 30;
    camera.position.set(Math.sin(angle.current) * r, 10, Math.cos(angle.current) * r);
    camera.lookAt(0, 2, 0);
  });

  return null;
}

// ── Camera animator (smooth transition between presets) ───────────────────────

function CameraAnimator({ target, view }: { target: [number,number,number]; view: CameraView }) {
  const { camera } = useThree();
  const preset     = CAMERA_PRESETS[view];
  const targetPos  = useRef(new THREE.Vector3(...preset.position));
  const targetLook = useRef(new THREE.Vector3(...preset.target));

  useEffect(() => {
    targetPos.current.set(...CAMERA_PRESETS[view].position);
    targetLook.current.set(...CAMERA_PRESETS[view].target);
  }, [view]);

  useFrame((_, delta) => {
    if (view === "spin") return; // SpinCamera handles this
    camera.position.lerp(targetPos.current, delta * 2.5);
    const lookTarget = new THREE.Vector3();
    lookTarget.lerpVectors(
      new THREE.Vector3().copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3())),
      targetLook.current,
      delta * 2.5
    );
    camera.lookAt(targetLook.current);
  });

  return null;
}

// ── Main scene ────────────────────────────────────────────────────────────────

interface SceneProps {
  configId: string;
  satelliteUrl: string | null;
  view: CameraView;
  modelReady: boolean;
}

function Scene({ configId, satelliteUrl, view, modelReady }: SceneProps) {
  const config     = getConfig(configId);
  const modelPath  = CONFIG_MODEL[configId] ?? "/models/tunnel.glb";
  const isSpinning = view === "spin";

  return (
    <>
      <Sky sunPosition={[100, 20, 100]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <Environment preset="city" />

      <SatelliteGround imageUrl={satelliteUrl} />

      {config && (
        <LotBoundary
          widthFt={config.minLotWidthFt}
          depthFt={config.minLotDepthFt}
        />
      )}

      {modelReady ? (
        <CarWashModel modelPath={modelPath} />
      ) : (
        <FallbackModel configId={configId} />
      )}

      {isSpinning ? (
        <SpinCamera />
      ) : (
        <>
          <CameraAnimator target={[0,0,0]} view={view} />
          <OrbitControls
            enablePan={false}
            minDistance={8}
            maxDistance={60}
            maxPolarAngle={Math.PI / 2}
          />
        </>
      )}
    </>
  );
}

// ── Satellite image fetcher ───────────────────────────────────────────────────

async function fetchSatelliteUrl(lat: number, lng: number): Promise<string> {
  // Uses our own API route to keep the Maps key server-side
  const res = await fetch(`/api/satellite?lat=${lat}&lng=${lng}&zoom=19&size=640x640`);
  if (!res.ok) throw new Error("satellite fetch failed");
  const { url } = await res.json();
  return url;
}

// ── View tab button ───────────────────────────────────────────────────────────

function ViewTab({ id, label, icon, active, onClick }: {
  id: CameraView; label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
        ${active
          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
        }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface SitePreview3DProps {
  configId: string;
  lat: number;
  lng: number;
  address: string;
}

export default function SitePreview3D({ configId, lat, lng, address }: SitePreview3DProps) {
  const config                          = getConfig(configId);
  const [view, setView]                 = useState<CameraView>("aerial");
  const [satelliteUrl, setSatelliteUrl] = useState<string | null>(null);
  const [modelReady, setModelReady]     = useState(false);

  // Check if GLB model file exists for this config
  useEffect(() => {
    const modelPath = CONFIG_MODEL[configId] ?? "/models/tunnel.glb";
    fetch(modelPath, { method: "HEAD" })
      .then(r => setModelReady(r.ok))
      .catch(() => setModelReady(false));
  }, [configId]);

  // Fetch satellite image of the lot
  useEffect(() => {
    if (!lat || !lng) return;
    fetchSatelliteUrl(lat, lng)
      .then(setSatelliteUrl)
      .catch(() => setSatelliteUrl(null));
  }, [lat, lng]);

  const VIEW_TABS: Array<{ id: CameraView; label: string; icon: string }> = [
    { id: "aerial",   label: "Aerial",    icon: "🛸" },
    { id: "exterior", label: "Exterior",  icon: "🏢" },
    { id: "street",   label: "Street",    icon: "🚗" },
    { id: "spin",     label: "Auto-spin", icon: "🔄" },
  ];

  if (!config) return null;

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
        <div>
          <h3 className="text-white font-bold text-sm">Site Preview</h3>
          <p className="text-slate-400 text-[11px] mt-0.5 truncate max-w-xs">{address}</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
          {VIEW_TABS.map(tab => (
            <ViewTab key={tab.id} {...tab} active={view === tab.id} onClick={() => setView(tab.id)} />
          ))}
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="relative" style={{ height: "420px" }}>
        <Canvas
          shadows
          camera={{ position: [0, 28, 2], fov: 50 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <Suspense fallback={null}>
            <Scene
              configId={configId}
              satelliteUrl={satelliteUrl}
              view={view}
              modelReady={modelReady}
            />
          </Suspense>
        </Canvas>

        {/* Model not ready badge */}
        {!modelReady && (
          <div className="absolute bottom-3 left-3 bg-amber-500/15 border border-amber-500/25 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
            <span className="text-[10px] text-amber-400 font-medium">
              3D model preview — add GLB to /public/models/ for real building
            </span>
          </div>
        )}

        {/* Config label overlay */}
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
          <div className="text-white font-bold text-xs">{config.shortName}</div>
          <div className="text-blue-300 text-[10px]">{config.minLotWidthFt}×{config.minLotDepthFt}ft minimum lot</div>
        </div>
      </div>

      {/* Footer note */}
      <div className="px-4 py-2.5 border-t border-slate-700/30 flex items-center justify-between">
        <p className="text-slate-500 text-[10px]">
          Blue outline = minimum lot size for this format · Drag to explore · Scroll to zoom
        </p>
        {satelliteUrl && (
          <span className="text-[10px] text-emerald-400/70">● Live satellite</span>
        )}
      </div>
    </div>
  );
}
