"use client";

import type { Recommendation } from "@/lib/types";

interface RecommendationCardProps {
  rec: Recommendation;
  index: number;
}

const PRIORITY_STYLES = {
  CRITICAL: { border: "border-red-500/30",    badge: "bg-red-500/20 text-red-300",       bar: "#ef4444" },
  HIGH:     { border: "border-orange-500/30", badge: "bg-orange-500/20 text-orange-300", bar: "#f97316" },
  MEDIUM:   { border: "border-blue-500/30",   badge: "bg-blue-500/20 text-blue-300",     bar: "#3b82f6" },
  LOW:      { border: "border-slate-600/30",  badge: "bg-slate-700 text-slate-300",      bar: "#64748b" },
};

// Real images per recommendation category
const CATEGORY_IMAGES: Record<string, string> = {
  "Business Model":    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&h=240&q=80",
  "Competitive Edge":  "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&h=240&q=80",
  "Amenities":         "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&h=240&q=80",
  "Marketing":         "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=600&h=240&q=80",
  "Pricing Strategy":  "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=600&h=240&q=80",
  "Technology":        "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&h=240&q=80",
  "Expansion":         "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=600&h=240&q=80",
};

const FALLBACK_IMG = "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=600&h=240&q=80";

export default function RecommendationCard({ rec, index }: RecommendationCardProps) {
  const style = PRIORITY_STYLES[rec.priority];
  const img = CATEGORY_IMAGES[rec.category] ?? FALLBACK_IMG;

  return (
    <div className={`card-hover rounded-2xl border overflow-hidden bg-slate-800/50 ${style.border} flex flex-col`}>
      {/* Photo banner */}
      <div className="relative h-32 overflow-hidden">
        <img
          src={img}
          alt={rec.category}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/40 to-transparent" />

        {/* Priority badge top-left */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${style.badge}`}>
          {rec.priority}
        </div>

        {/* Index watermark top-right */}
        <div className="absolute top-3 right-3 w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-xs text-white/70 font-bold border border-white/10">
          {index + 1}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
          {rec.category}
        </div>
        <h4 className="text-white font-bold text-sm leading-snug">{rec.title}</h4>
        <p className="text-slate-300 text-xs leading-relaxed flex-1">{rec.description}</p>

        {/* Priority indicator bar */}
        <div className="mt-2 h-1 rounded-full bg-slate-700/60 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: rec.priority === "CRITICAL" ? "100%" : rec.priority === "HIGH" ? "75%" : rec.priority === "MEDIUM" ? "50%" : "25%",
              backgroundColor: style.bar,
              boxShadow: `0 0 6px ${style.bar}50`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
