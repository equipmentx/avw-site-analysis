"use client";

import { useState } from "react";
import { Satellite, ZoomIn, ZoomOut, ExternalLink, Move } from "lucide-react";

interface SatelliteViewProps {
  coordinates: { lat: number; lng: number };
  address: string;
  apiKey: string;
}

const ZOOM_LEVELS = [
  { label: "Site View",     zoom: 19, desc: "Exact lot & immediate surroundings" },
  { label: "Neighbourhood", zoom: 17, desc: "Surrounding streets & nearby businesses" },
  { label: "Area Overview", zoom: 15, desc: "Full trade area — 1 mile radius" },
];

export default function SatelliteView({ coordinates, address, apiKey }: SatelliteViewProps) {
  const [zoomIndex, setZoomIndex] = useState(1);

  if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
    return (
      <div className="w-full h-[600px] bg-slate-800/50 border border-slate-700/40 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <Satellite className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-white text-sm">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable satellite view</p>
        </div>
      </div>
    );
  }

  const { lat, lng } = coordinates;
  const currentZoom = ZOOM_LEVELS[zoomIndex];

  // Google Maps Embed API — fully interactive satellite map (drag, pan, zoom)
  const embedUrl =
    `https://www.google.com/maps/embed/v1/view` +
    `?key=${apiKey}` +
    `&center=${lat},${lng}` +
    `&zoom=${currentZoom.zoom}` +
    `&maptype=satellite`;

  const mapsUrl = `https://www.google.com/maps/@${lat},${lng},${currentZoom.zoom}z/data=!3m1!1e3`;

  return (
    <div className="space-y-3">

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-600/60 rounded-xl p-1">
          {ZOOM_LEVELS.map((level, i) => (
            <button
              key={level.label}
              onClick={() => setZoomIndex(i)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                zoomIndex === i
                  ? "bg-blue-600 text-white shadow-lg"
                  : "text-slate-200 hover:text-white hover:bg-slate-700"
              }`}
            >
              {i === 0 ? <ZoomIn className="w-3 h-3" /> : i === 2 ? <ZoomOut className="w-3 h-3" /> : <Satellite className="w-3 h-3" />}
              {level.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-1.5">
            <Move className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-300 text-xs font-semibold">Drag &amp; zoom to explore</span>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-white font-semibold bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 rounded-lg px-3 py-1.5 transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            Full Screen
          </a>
        </div>
      </div>

      {/* Interactive map — fully draggable and zoomable via iframe embed */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-600/50 bg-slate-900 shadow-2xl">
        <iframe
          src={embedUrl}
          width="100%"
          height="620"
          style={{ border: 0, display: "block" }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          title={`Satellite view of ${address}`}
        />

        {/* Overlay: zoom level label (top-left, above map) */}
        <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 pointer-events-none">
          <Satellite className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-white text-xs font-bold">{currentZoom.label}</div>
            <div className="text-slate-300 text-[10px]">{currentZoom.desc}</div>
          </div>
        </div>

        {/* Overlay: live badge (top-right) */}
        <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex items-center gap-1.5 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 text-xs font-bold">Live Satellite</span>
        </div>

        {/* Overlay: coordinates (bottom-right) */}
        <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1.5 pointer-events-none">
          <span className="text-slate-200 text-[10px] font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        </div>
      </div>

      {/* What to look for */}
      <div className="bg-slate-800/60 border border-slate-600/40 rounded-xl p-5">
        <p className="text-white text-sm font-bold mb-3 uppercase tracking-wider">What to assess in this view</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { icon: "📐", label: "Lot Shape", hint: "Square or rectangle = best for car wash layout" },
            { icon: "🛣️", label: "Road Access", hint: "Is there a corner entry or mid-block access?" },
            { icon: "🏪", label: "Anchor Tenants", hint: "Grocery/big-box retailer nearby drives traffic" },
            { icon: "↔️", label: "Visibility Corridor", hint: "500ft clear sightline in both directions" },
            { icon: "🌿", label: "Grade & Trees", hint: "Level ground required — trees add cost" },
            { icon: "🚦", label: "Median / Divider", hint: "Raised medians block left-turn access" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2.5 bg-slate-700/30 border border-slate-600/30 rounded-xl p-3">
              <span className="flex-shrink-0 text-lg leading-none mt-0.5">{item.icon}</span>
              <div>
                <div className="text-white text-xs font-bold">{item.label}</div>
                <div className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{item.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
