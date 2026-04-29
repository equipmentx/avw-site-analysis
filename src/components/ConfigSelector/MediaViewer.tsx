"use client";

import {
  useState, useRef, useEffect, useCallback,
} from "react";
import Image from "next/image";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";
import type { CarWashConfig } from "@/lib/carwashConfigs";
import AerialDiagram from "./AerialDiagram";

export type MediaMode = "video" | "exterior" | "interior" | "floorplan";

// ─────────────────────────────────────────────────────────────────────────────
// File path conventions
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_EXTS = ["mp4", "webm"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];

function videoPath(id: string, ext: string) {
  return `/media/configs/${id}/video.${ext}`;
}
function imagePath(id: string, mode: Exclude<MediaMode, "video" | "floorplan">, ext: string) {
  return `/media/configs/${id}/${mode}.${ext}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Probe hook — tries a list of URLs in order, resolves to first that loads
// ─────────────────────────────────────────────────────────────────────────────

function useProbeUrl(candidates: string[]): string | null | "notfound" {
  const [result, setResult] = useState<string | null | "notfound">(null);

  useEffect(() => {
    if (!candidates.length) { setResult("notfound"); return; }
    setResult(null);
    let cancelled = false;
    let idx = 0;

    function tryNext() {
      if (cancelled || idx >= candidates.length) {
        if (!cancelled) setResult("notfound");
        return;
      }
      const url = candidates[idx++];
      const el = new window.Image();
      el.onload  = () => { if (!cancelled) setResult(url); };
      el.onerror = () => tryNext();
      el.src = url;
    }
    tryNext();
    return () => { cancelled = true; };
  }, [candidates.join("|")]);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Video player
// ─────────────────────────────────────────────────────────────────────────────

function VideoPlayer({ id }: { id: string }) {
  const [src, setSrc]     = useState<string | null>(null);
  const [found, setFound] = useState<boolean | null>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);
  const idxRef = useRef(0);

  // Probe video candidates
  useEffect(() => {
    setSrc(null); setFound(null); idxRef.current = 0;
    const candidates = VIDEO_EXTS.map(e => videoPath(id, e));

    function tryNext() {
      if (idxRef.current >= candidates.length) { setFound(false); return; }
      const url = candidates[idxRef.current++];
      // Use a fetch HEAD to check existence without loading the whole video
      fetch(url, { method: "HEAD" })
        .then(r => {
          if (r.ok) { setSrc(url); setFound(true); }
          else tryNext();
        })
        .catch(() => tryNext());
    }
    tryNext();
  }, [id]);

  useEffect(() => {
    const v = vidRef.current;
    if (!v || !src) return;
    v.load();
    if (!paused) v.play().catch(() => {});
  }, [src, paused]);

  const toggleMute  = useCallback(() => {
    setMuted(m => { if (vidRef.current) vidRef.current.muted = !m; return !m; });
  }, []);
  const togglePlay  = useCallback(() => {
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPaused(false); }
    else { v.pause(); setPaused(true); }
  }, []);

  if (found === false) return <VideoPlaceholder id={id} />;
  if (found === null || !src) return <Spinner />;

  return (
    <div className="relative w-full h-full group">
      <video
        ref={vidRef}
        key={src}
        className="w-full h-full object-cover"
        autoPlay muted loop playsInline
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      >
        <source src={src} type="video/mp4" />
        <source src={src} type="video/webm" />
      </video>

      {/* Subtle controls — appear on hover */}
      <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition"
          title={paused ? "Play" : "Pause"}
        >
          {paused ? <Play className="w-4 h-4 fill-white" /> : <Pause className="w-4 h-4 fill-white" />}
        </button>
        <button
          onClick={toggleMute}
          className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition"
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Looping badge */}
      <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span className="text-[10px] bg-black/50 backdrop-blur-sm text-white/70 px-2 py-1 rounded-full tracking-widest uppercase">
          Looping · HD
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo viewer
// ─────────────────────────────────────────────────────────────────────────────

function PhotoViewer({
  id, angle,
}: {
  id: string; angle: Exclude<MediaMode, "video" | "floorplan">;
}) {
  const candidates = IMAGE_EXTS.map(e => imagePath(id, angle, e));
  const src = useProbeUrl(candidates);

  if (src === null) return <Spinner />;
  if (src === "notfound") return <PhotoPlaceholder id={id} angle={angle} />;

  return (
    <div className="relative w-full h-full">
      <Image
        src={src}
        alt={`${id} ${angle} view`}
        fill
        className="object-cover"
        priority
        sizes="(max-width: 768px) 100vw, 60vw"
        quality={95}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder states
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="w-7 h-7 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
    </div>
  );
}

function VideoPlaceholder({ id }: { id: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-slate-900 to-black px-6">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Play className="w-7 h-7 text-white/40 fill-white/40" />
      </div>
      <div className="text-center">
        <p className="text-white/80 font-semibold text-sm">No video yet</p>
        <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
          Drop a high-quality clip here:
        </p>
        <p className="text-blue-400/70 text-[11px] font-mono mt-1 break-all">
          public/media/configs/{id}/video.mp4
        </p>
        <p className="text-white/30 text-[10px] mt-3 max-w-xs mx-auto leading-relaxed">
          Ideal: 10–30 sec cinematic walk-around, 1080p or 4K, H.264 or H.265
        </p>
      </div>
    </div>
  );
}

function PhotoPlaceholder({ id, angle }: { id: string; angle: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-900 to-black px-6">
      <div className="text-center">
        <p className="text-white/70 font-semibold text-sm capitalize">{angle} photo not set</p>
        <p className="text-white/40 text-[11px] mt-1.5">Add a high-res photo at:</p>
        <p className="text-blue-400/70 text-[11px] font-mono mt-1 break-all">
          public/media/configs/{id}/{angle}.jpg
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor plan tab — the SVG aerial diagram
// ─────────────────────────────────────────────────────────────────────────────

function FloorPlanView({ config }: { config: CarWashConfig }) {
  return (
    <div className="w-full h-full bg-[#080f1f] flex items-center justify-center p-4">
      <AerialDiagram
        diagramType={config.diagramType}
        diagramParams={config.diagramParams}
        className="w-full h-full max-w-2xl"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay info bar (always visible over media)
// ─────────────────────────────────────────────────────────────────────────────

function MediaOverlay({ config }: { config: CarWashConfig }) {
  return (
    <>
      {/* Bottom gradient + info */}
      <div
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)" }}
      />
      {/* Config badge — top left */}
      <div className="absolute top-3 left-3 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2">
          <p className="text-white font-bold text-sm leading-tight">{config.shortName}</p>
          <p className="text-blue-300 text-[10px] mt-0.5">{config.categoryLabel}</p>
        </div>
      </div>
      {/* Lot size — top right */}
      <div className="absolute top-3 right-3 pointer-events-none text-right">
        <div className="bg-black/50 backdrop-blur-md rounded-xl px-3 py-2">
          <p className="text-slate-300 text-[10px] leading-tight">Min lot</p>
          <p className="text-white font-bold text-xs mt-0.5">
            {config.minLotWidthFt}×{config.minLotDepthFt} ft
          </p>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  config: CarWashConfig;
  mode: MediaMode;
  className?: string;
}

export default function MediaViewer({ config, mode, className = "" }: Props) {
  // Force remount of media content when config changes (clean transition)
  const key = `${config.id}::${mode}`;

  return (
    <div className={`relative w-full h-full overflow-hidden bg-black ${className}`}>
      {/* Fade-in wrapper */}
      <div key={key} className="w-full h-full animate-[fadeIn_0.4s_ease]">
        {mode === "video"      && <VideoPlayer id={config.id} />}
        {mode === "exterior"   && <PhotoViewer id={config.id} angle="exterior" />}
        {mode === "interior"   && <PhotoViewer id={config.id} angle="interior" />}
        {mode === "floorplan"  && <FloorPlanView config={config} />}
      </div>

      {/* Overlay always on top (except floor plan) */}
      {mode !== "floorplan" && <MediaOverlay config={config} />}
    </div>
  );
}
