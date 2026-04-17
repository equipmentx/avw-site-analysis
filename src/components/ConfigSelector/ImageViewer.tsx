"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import type { CarWashConfig } from "@/lib/carwashConfigs";

type ViewMode = "perspective" | "aerial" | "interior" | "spin";

interface Props {
  config: CarWashConfig;
  mode: ViewMode;
  className?: string;
}

const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

function getImagePath(configId: string, view: ViewMode, ext: string) {
  return `/images/configs/${configId}/${view}.${ext}`;
}

// ── Panorama drag viewer ──────────────────────────────────────────────────────

function PanoViewer({ src, alt }: { src: string; alt: string }) {
  const [offsetX, setOffsetX]       = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart                   = useRef<{ x: number; offset: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, offset: offsetX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [offsetX]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const delta = e.clientX - dragStart.current.x;
    const maxOffset = 220;
    setOffsetX(Math.max(-maxOffset, Math.min(maxOffset, dragStart.current.offset + delta * 0.55)));
  }, []);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  return (
    <div
      className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none relative"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="w-full h-full"
        style={{ transform: `translateX(${offsetX}px) scale(1.18)`, transformOrigin: "center center" }}
      >
        <Image src={src} alt={alt} fill className="object-cover" draggable={false} priority />
      </div>
      {/* Left / right drag arrows */}
      <div className={`absolute inset-0 flex items-center justify-between px-3 pointer-events-none transition-opacity duration-300 ${isDragging ? "opacity-0" : "opacity-100"}`}>
        <div className="bg-black/40 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center text-white/70 text-sm">‹</div>
        <div className="bg-black/40 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center text-white/70 text-sm">›</div>
      </div>
    </div>
  );
}

// ── Placeholder when no image found ──────────────────────────────────────────

function ImagePlaceholder({ configId, view }: { configId: string; view: ViewMode }) {
  const labels: Record<ViewMode, string> = {
    perspective: "Exterior View",
    interior:    "Interior View",
    aerial:      "Aerial View",
    spin:        "360° View",
  };
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-900/60">
      <div className="text-3xl opacity-20">
        {view === "aerial" ? "🛸" : view === "interior" ? "🏗️" : view === "spin" ? "🔄" : "🏢"}
      </div>
      <div className="text-center px-4">
        <p className="text-slate-400 text-xs font-semibold">{labels[view]}</p>
        <p className="text-slate-600 text-[10px] mt-1.5">Drop an image at:</p>
        <p className="text-slate-500 text-[10px] font-mono mt-0.5 break-all">
          public/images/configs/{configId}/{view}.jpg
        </p>
      </div>
    </div>
  );
}

// ── Main ImageViewer ──────────────────────────────────────────────────────────

export default function ImageViewer({ config, mode, className = "" }: Props) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [notFound, setNotFound]       = useState(false);
  const [visible, setVisible]         = useState(false);
  const extIdxRef                     = useRef(0);

  // Reset and probe for the image whenever config or mode changes
  useEffect(() => {
    setResolvedSrc(null);
    setNotFound(false);
    setVisible(false);
    extIdxRef.current = 0;
    // Kick off by setting the first candidate
    setResolvedSrc(getImagePath(config.id, mode, EXTENSIONS[0]));
  }, [config.id, mode]);

  // Called by the hidden probe <img> on load success
  const handleLoad = useCallback(() => {
    setVisible(false);
    // Small delay so the fade-in is visible
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  // Called by the hidden probe <img> on error — try next extension
  const handleError = useCallback(() => {
    extIdxRef.current += 1;
    if (extIdxRef.current < EXTENSIONS.length) {
      setResolvedSrc(getImagePath(config.id, mode, EXTENSIONS[extIdxRef.current]));
    } else {
      setNotFound(true);
      setVisible(true);
    }
  }, [config.id, mode]);

  const showSpinner = !notFound && !visible;

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-950 ${className}`}>

      {/* Hidden probe img — resolves correct extension for all modes including spin */}
      {resolvedSrc && !notFound && (
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt=""
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}

      {/* Actual visible content */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {notFound ? (
          <ImagePlaceholder configId={config.id} view={mode} />
        ) : resolvedSrc && visible ? (
          mode === "spin" ? (
            <PanoViewer src={resolvedSrc} alt={`${config.name} 360° view`} />
          ) : (
            <Image
              src={resolvedSrc}
              alt={`${config.name} ${mode} view`}
              fill
              className="object-cover"
              priority={mode === "perspective"}
            />
          )
        ) : null}
      </div>

      {/* Loading spinner */}
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
