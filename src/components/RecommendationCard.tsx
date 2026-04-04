"use client";

import type { Recommendation } from "@/lib/types";

interface RecommendationCardProps {
  rec: Recommendation;
  index: number;
}

const PRIORITY_STYLES = {
  CRITICAL: { bg: "bg-red-500/10",    border: "border-red-500/20",    text: "text-red-400",    badge: "bg-red-500/20 text-red-300" },
  HIGH:     { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400", badge: "bg-orange-500/20 text-orange-300" },
  MEDIUM:   { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-400",   badge: "bg-blue-500/20 text-blue-300" },
  LOW:      { bg: "bg-slate-700/30",  border: "border-slate-600/30",  text: "text-slate-400",  badge: "bg-slate-700 text-slate-400" },
};

export default function RecommendationCard({ rec, index }: RecommendationCardProps) {
  const style = PRIORITY_STYLES[rec.priority];

  return (
    <div className={`card-hover rounded-2xl p-5 border ${style.bg} ${style.border} relative overflow-hidden`}>
      {/* Priority badge */}
      <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${style.badge} mb-3`}>
        {rec.priority}
      </div>

      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">{rec.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">{rec.category}</div>
          <h4 className="text-white font-bold text-sm mb-2 leading-tight">{rec.title}</h4>
          <p className="text-slate-400 text-sm leading-relaxed">{rec.description}</p>
        </div>
      </div>

      {/* Number watermark */}
      <div className="absolute top-3 right-4 text-6xl font-black text-slate-800/30 select-none pointer-events-none">
        {index + 1}
      </div>
    </div>
  );
}
