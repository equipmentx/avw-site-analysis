"use client";

import { useEffect, useRef, useState } from "react";
import type { CompetitorAnalysis } from "@/lib/types";

interface AnalysisMapProps {
  center: { lat: number; lng: number };
  competitors: CompetitorAnalysis[];
  apiKey: string;
}

declare global {
  interface Window {
    google: typeof google;
    _mapCallback?: () => void;
  }
}

export default function AnalysisMap({ center, competitors, apiKey }: AnalysisMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeMapType, setActiveMapType] = useState<"roadmap" | "satellite" | "terrain">("roadmap");
  const [trafficOn, setTrafficOn] = useState(false);

  const handleMapTypeChange = (type: "roadmap" | "satellite" | "terrain") => {
    mapInstanceRef.current?.setMapTypeId(type);
    setActiveMapType(type);
  };

  const handleTrafficToggle = () => {
    if (!mapInstanceRef.current) return;
    if (trafficOn) {
      trafficLayerRef.current?.setMap(null);
    } else {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(mapInstanceRef.current);
    }
    setTrafficOn((v) => !v);
  };

  useEffect(() => {
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") return;

    const initMap = () => {
      if (!mapRef.current) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1e3a8a" }] },
          { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e40af" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c1a2e" }] },
          { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
          { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f2816" }] },
          { featureType: "transit", stylers: [{ color: "#1e293b" }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,   // we use our own custom control
        streetViewControl: false,
        fullscreenControl: true,
      });

      mapInstanceRef.current = map;

      // Target location marker (pulsing blue pin)
      const targetMarker = new window.google.maps.Marker({
        position: center,
        map,
        title: "Your Target Location",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#93c5fd",
          strokeWeight: 3,
        },
        zIndex: 100,
      });

      const targetInfo = new window.google.maps.InfoWindow({
        content: `<div style="background:#1e293b;color:#f1f5f9;padding:10px 14px;border-radius:10px;font-family:Inter,sans-serif;font-size:13px;font-weight:600;border:1px solid #3b82f6;">📍 Your Target Site</div>`,
      });

      targetMarker.addListener("click", () => targetInfo.open(map, targetMarker));

      // Competitor markers
      competitors.forEach((comp, i) => {
        const { place, distanceMiles, threatLevel, sentiment } = comp;
        const pos = place.geometry.location;

        const colorMap = { LOW: "#10b981", MEDIUM: "#f59e0b", HIGH: "#ef4444" };
        const color = colorMap[threatLevel];

        const marker = new window.google.maps.Marker({
          position: pos,
          map,
          title: place.name,
          label: {
            text: String(i + 1),
            color: "#ffffff",
            fontSize: "11px",
            fontWeight: "bold",
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          zIndex: 50,
        });

        const rating = place.rating ? `⭐ ${place.rating} (${place.user_ratings_total?.toLocaleString() ?? 0} reviews)` : "No rating";
        const complaints = sentiment.topComplaints.slice(0, 2).map((c) => `${c.emoji} ${c.category}`).join("<br>");

        const mapsUrl = place.place_id
          ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
          : `https://maps.google.com/maps?q=${pos.lat},${pos.lng}`;

        const infoContent = `
          <div style="background:#1e293b;color:#f1f5f9;padding:12px 16px;border-radius:12px;font-family:Inter,sans-serif;min-width:200px;border:1px solid ${color}40;">
            <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#fff">${place.name}</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">${place.vicinity ?? ""}</div>
            <div style="font-size:12px;margin-bottom:4px;">${rating}</div>
            <div style="font-size:11px;color:#94a3b8;">${distanceMiles.toFixed(1)} miles away</div>
            ${complaints ? `<div style="margin-top:8px;font-size:11px;color:#fbbf24;">Complaints:<br>${complaints}</div>` : ""}
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
               style="display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:11px;color:#60a5fa;text-decoration:none;font-weight:600;">
              📍 Open in Google Maps →
            </a>
          </div>
        `;

        const infoWindow = new window.google.maps.InfoWindow({ content: infoContent });
        marker.addListener("click", () => infoWindow.open(map, marker));
      });

      // Draw radius circle
      new window.google.maps.Circle({
        strokeColor: "#3b82f6",
        strokeOpacity: 0.15,
        strokeWeight: 1.5,
        fillColor: "#3b82f6",
        fillOpacity: 0.03,
        map,
        center,
        radius: 8047, // 5 miles in meters
      });

      setMapLoaded(true);
    };

    if (window.google?.maps) {
      initMap();
      return;
    }

    window._mapCallback = initMap;

    const existing = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=_mapCallback`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      existing.addEventListener("load", initMap);
    }
  }, [apiKey, center, competitors]);

  if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
    return (
      <div className="w-full h-[400px] bg-slate-800/50 border border-slate-700/40 rounded-2xl flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🗺️</div>
          <p className="text-slate-400 text-sm">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[480px] rounded-2xl overflow-hidden border border-slate-700/40" />

      {/* Map type + traffic controls */}
      {mapLoaded && (
        <div className="absolute top-4 left-4 flex items-center gap-1 bg-slate-900/90 backdrop-blur-sm border border-slate-700/40 rounded-xl p-1 z-10">
          {(["roadmap", "satellite", "terrain"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleMapTypeChange(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                activeMapType === type
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              {type === "roadmap" ? "Map" : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-700 mx-0.5" />
          <button
            onClick={handleTrafficToggle}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              trafficOn
                ? "bg-orange-500 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            Traffic
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm border border-slate-700/40 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-slate-300">Your Site</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-slate-300">High Threat</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-xs text-slate-300">Medium Threat</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-300">Low Threat</span>
        </div>
      </div>

      {/* Competitor count badge */}
      <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-sm border border-slate-700/40 rounded-xl px-3 py-2">
        <span className="text-white font-bold text-sm">{competitors.length}</span>
        <span className="text-slate-400 text-xs ml-1.5">car wash{competitors.length !== 1 ? "es" : ""} found</span>
      </div>
    </div>
  );
}
