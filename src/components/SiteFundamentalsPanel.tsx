"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteFundamentalsScore, SiteFundamentalsDimension } from "@/lib/types";
import { FUNDAMENTALS_WEIGHTS } from "@/lib/industryBenchmarks";

interface Props {
  fundamentals: SiteFundamentalsScore;
}

const DIMENSION_META: Record<keyof Omit<SiteFundamentalsScore, "overall">, { label: string; icon: string; weight: number }> = {
  traffic:       { label: "Traffic Volume",      icon: "🚗", weight: FUNDAMENTALS_WEIGHTS.traffic },
  demographics:  { label: "Demographics",         icon: "🏛️", weight: FUNDAMENTALS_WEIGHTS.demographics },
  competition:   { label: "Competition Gap",      icon: "🏪", weight: FUNDAMENTALS_WEIGHTS.competition },
  accessibility: { label: "Road Accessibility",  icon: "🛣️", weight: FUNDAMENTALS_WEIGHTS.accessibility },
  retailDraw:    { label: "Retail Draw",          icon: "🛒", weight: FUNDAMENTALS_WEIGHTS.retailDraw },
  visibility:    { label: "Site Visibility",      icon: "👁️", weight: FUNDAMENTALS_WEIGHTS.visibility },
};

const DIMENSION_ORDER = ["traffic", "demographics", "competition", "accessibility", "retailDraw", "visibility"] as const;

function DimensionRow({
  dim,
  meta,
  animated,
}: {
  dim: SiteFundamentalsDimension;
  meta: { label: string; icon: string; weight: number };
  animated: number;
}) {
  return (
    <div className="flex items-center gap-4 group">
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 border ${dim.bg} ${dim.border}`}
      >
        {meta.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="text-white text-sm font-semibold">{meta.label}</span>
            <p className="text-slate-400 text-xs mt-0.5 leading-tight line-clamp-1">{dim.detail}</p>
          </div>
          <div className="text-right ml-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-white font-black text-base tabular-nums">{animated}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${dim.bg} ${dim.text} ${dim.border}`}>
                {dim.rating}
              </span>
            </div>
            <div className="text-slate-500 text-[10px] mt-0.5">{Math.round(meta.weight * 100)}% weight</div>
          </div>
        </div>

        {/* Animated bar */}
        <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-75"
            style={{
              width: `${animated}%`,
              backgroundColor: dim.color,
              boxShadow: `0 0 8px ${dim.color}50`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function OverallGauge({ overall, animated }: { overall: SiteFundamentalsDimension; animated: number }) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (animated / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Track */}
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke={overall.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.04s linear", filter: `drop-shadow(0 0 6px ${overall.color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white font-black text-3xl tabular-nums leading-none">{animated}</span>
          <span className="text-slate-400 text-xs mt-0.5">/100</span>
        </div>
      </div>

      <div className={`px-4 py-1.5 rounded-full border text-sm font-bold ${overall.bg} ${overall.text} ${overall.border}`}>
        {overall.rating}
      </div>
      <p className="text-slate-400 text-xs text-center max-w-[140px] leading-relaxed">{overall.detail}</p>
    </div>
  );
}

export default function SiteFundamentalsPanel({ fundamentals }: Props) {
  const [triggered, setTriggered]   = useState(false);
  const [animated,  setAnimated]    = useState<Record<string, number>>(() => {
    const zero: Record<string, number> = { overall: 0 };
    DIMENSION_ORDER.forEach((k) => { zero[k] = 0; });
    return zero;
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !triggered) setTriggered(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [triggered]);

  useEffect(() => {
    if (!triggered) return;
    const duration = 1400;
    const steps    = 60;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const next: Record<string, number> = { overall: Math.round(fundamentals.overall.score * eased) };
      DIMENSION_ORDER.forEach((k) => { next[k] = Math.round(fundamentals[k].score * eased); });
      setAnimated(next);
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [triggered, fundamentals]);

  return (
    <div ref={ref} className="space-y-5">
      {/* Source note */}
      <div className="flex items-start gap-2 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5">
        <span className="text-blue-400 text-sm mt-0.5">📊</span>
        <p className="text-slate-300 text-xs leading-relaxed">
          <span className="text-blue-300 font-semibold">Site Fundamentals Dashboard</span>
          {" "}— 7-dimension scoring derived from live TomTom, Census ACS, and Google Places data.
          Methodology follows ICA site-selection criteria (International Carwash Association 2024)
          and Sonny's Consulting site evaluation framework.
        </p>
      </div>

      {/* Overall + dimensions layout */}
      <div className="grid lg:grid-cols-[180px_1fr] gap-8 items-start">
        {/* Overall gauge */}
        <div className="flex justify-center lg:justify-start">
          <OverallGauge overall={fundamentals.overall} animated={animated.overall} />
        </div>

        {/* 6 dimensions */}
        <div className="space-y-4">
          {DIMENSION_ORDER.map((key) => (
            <DimensionRow
              key={key}
              dim={fundamentals[key]}
              meta={DIMENSION_META[key]}
              animated={animated[key] ?? 0}
            />
          ))}
        </div>
      </div>

      {/* Rating legend */}
      <div className="pt-2 border-t border-slate-700/30">
        <p className="text-slate-500 text-[10px] mb-2 uppercase tracking-widest font-semibold">Rating Scale</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Excellent", color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", range: "85–100" },
            { label: "Great",     color: "#3b82f6", bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    range: "70–84" },
            { label: "Good",      color: "#eab308", bg: "bg-yellow-500/10",  border: "border-yellow-500/30",  text: "text-yellow-400",  range: "55–69" },
            { label: "Borderline",color: "#f97316", bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-400",  range: "40–54" },
            { label: "Poor",      color: "#ef4444", bg: "bg-red-500/10",     border: "border-red-500/30",     text: "text-red-400",     range: "0–39"  },
          ].map(({ label, bg, border, text, range }) => (
            <div key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${bg} ${border} ${text}`}>
              {label}
              <span className="opacity-60 font-normal">{range}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-500 text-[10px] mt-2">
          Source: ICA 2024 · Sonny's Consulting · Buxton Company site-selection methodology.
          Weights: Traffic {Math.round(FUNDAMENTALS_WEIGHTS.traffic * 100)}% · Demographics {Math.round(FUNDAMENTALS_WEIGHTS.demographics * 100)}% · Competition {Math.round(FUNDAMENTALS_WEIGHTS.competition * 100)}% · Accessibility {Math.round(FUNDAMENTALS_WEIGHTS.accessibility * 100)}% · Retail Draw {Math.round(FUNDAMENTALS_WEIGHTS.retailDraw * 100)}% · Visibility {Math.round(FUNDAMENTALS_WEIGHTS.visibility * 100)}%.
        </p>
      </div>
    </div>
  );
}
