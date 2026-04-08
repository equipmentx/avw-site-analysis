"use client";

import { useState } from "react";
import { Satellite, ZoomIn, ZoomOut, ExternalLink } from "lucide-react";

interface SatelliteViewProps {
  coordinates: { lat: number; lng: number };
  address: string;
  apiKey: string;
}

const ZOOM_LEVELS = [
  { label: "Site View",         zoom: 19, desc: "Exact lot & immediate surroundings" },
  { label: "Neighborhood",      zoom: 17, desc: "Surrounding streets & nearby businesses" },
  { label: "Area Overview",     zoom: 15, desc: "Full trade area — 1 mile radius" },
];

export default function SatelliteView({ coordinates, address, apiKey }: SatelliteViewProps) {
  const [zoomIndex, setZoomIndex] = useState(1);
  const [imgError, setImgError]   = useState(false);

  if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
    return (
      <div className="w-full h-[380px] bg-slate-800/50 border border-slate-700/40 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <Satellite className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable satellite view</p>
        </div>
      </div>
    );
  }

  const { lat, lng } = coordinates;
  const currentZoom = ZOOM_LEVELS[zoomIndex];

  // Google Maps Static API — satellite imagery
  const imageUrl =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=${currentZoom.zoom}` +
    `&size=900x480` +
    `&scale=2` +
    `&maptype=satellite` +
    `&markers=color:blue%7Clabel:S%7C${lat},${lng}` +
    `&key=${apiKey}`;

  // Google Maps link to open in browser at same view
  const mapsUrl = `https://www.google.com/maps/@${lat},${lng},${currentZoom.zoom}z/data=!3m1!1e3`;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/40 rounded-xl p-1">
          {ZOOM_LEVELS.map((level, i) => (
            <button
              key={level.label}
              onClick={() => { setZoomIndex(i); setImgError(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                zoomIndex === i
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              {i === 0 ? <ZoomIn className="w-3 h-3" /> : i === 2 ? <ZoomOut className="w-3 h-3" /> : <Satellite className="w-3 h-3" />}
              {level.label}
            </button>
          ))}
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5"
        >
          <ExternalLink className="w-3 h-3" />
          Open in Google Maps
        </a>
      </div>

      {/* Satellite image */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-700/40 bg-slate-900">
        {!imgError ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Satellite view of ${address}`}
              className="w-full object-cover"
              style={{ display: "block", minHeight: "300px" }}
              onError={() => setImgError(true)}
            />

            {/* Overlay: zoom label */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Satellite className="w-3.5 h-3.5 text-blue-400" />
              <div>
                <div className="text-white text-xs font-bold">{currentZoom.label}</div>
                <div className="text-slate-400 text-[10px]">{currentZoom.desc}</div>
              </div>
            </div>

            {/* Overlay: coordinates */}
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-slate-400 font-mono">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>

            {/* Overlay: live badge */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-300 font-semibold">Live Imagery</span>
            </div>
          </>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-center p-6">
            <Satellite className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm mb-1">Satellite imagery unavailable</p>
            <p className="text-slate-600 text-xs mb-4">
              This may be due to API restrictions or billing not enabled for Maps Static API.
            </p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on Google Maps instead
            </a>
          </div>
        )}
      </div>

      {/* What to look for */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
        <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">What to assess in this view</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { icon: "📐", label: "Lot shape", hint: "Square/rectangle = best" },
            { icon: "🛣️",  label: "Road access", hint: "Corner or mid-block entry?" },
            { icon: "🏪", label: "Anchor tenants", hint: "Grocery/big-box nearby?" },
            { icon: "↔️", label: "Visibility corridor", hint: "500ft clear sightline?" },
            { icon: "🌿", label: "Greenspace", hint: "Trees or grade issues?" },
            { icon: "🚦", label: "Road width", hint: "Median blocking access?" },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2 text-xs">
              <span className="flex-shrink-0 text-base leading-none mt-0.5">{item.icon}</span>
              <div>
                <div className="text-slate-300 font-medium">{item.label}</div>
                <div className="text-slate-600">{item.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
