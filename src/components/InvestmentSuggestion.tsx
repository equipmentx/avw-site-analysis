"use client";

import { useEffect, useRef, useState } from "react";
import type { InvestmentSuggestion, CurrencyOption } from "@/lib/types";

interface Props {
  data: InvestmentSuggestion;
  currency: CurrencyOption;
  rate: number; // USD to selected currency
  fetchedAt: string;
}

function fmt(usd: number, rate: number, symbol: string): string {
  const val = usd * rate;
  if (val >= 1_000_000_000) return `${symbol}${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000)     return `${symbol}${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)         return `${symbol}${(val / 1_000).toFixed(0)}K`;
  return `${symbol}${Math.round(val).toLocaleString()}`;
}

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setWidth(pct); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [pct]);

  return (
    <div ref={ref} className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, backgroundColor: color, transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)", boxShadow: `0 0 8px ${color}50` }}
      />
    </div>
  );
}

const BREAKDOWN_META = [
  { key: "land",         label: "Land Acquisition",           color: "#3b82f6", pct: 30 },
  { key: "construction", label: "Construction & Site Work",    color: "#10b981", pct: 34 },
  { key: "equipment",    label: "Equipment & Technology",      color: "#a855f7", pct: 30 },
  { key: "fees",         label: "Permits, Fees & Contingency", color: "#f59e0b", pct: 10 },
];

export default function InvestmentSuggestionPanel({ data, currency, rate, fetchedAt }: Props) {
  const { symbol } = currency;

  const minTotal = fmt(data.minEstimateUSD, rate, symbol);
  const maxTotal = fmt(data.maxEstimateUSD, rate, symbol);

  // USD display for transparency
  const minUSD = fmt(data.minEstimateUSD, 1, "$");
  const maxUSD = fmt(data.maxEstimateUSD, 1, "$");

  const rateFormatted = rate >= 100
    ? Math.round(rate).toLocaleString()
    : rate.toFixed(4);

  return (
    <div className="space-y-5">
      {/* Main estimate banner */}
      <div className="bg-gradient-to-r from-blue-600/20 to-emerald-600/20 border border-blue-500/25 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="text-slate-300 text-sm mb-1">
              Estimated investment range for a {data.cityTier.toLowerCase()} site in{" "}
              <span className="text-white font-semibold">{data.countryName}</span>
            </p>
            <div className="text-3xl md:text-4xl font-black text-white">
              {minTotal} <span className="text-slate-400 font-medium text-2xl">to</span> {maxTotal}
            </div>
            {currency.code !== "USD" && (
              <p className="text-slate-400 text-xs mt-1">
                USD equivalent: {minUSD} to {maxUSD} &middot; Rate: 1 USD = {rateFormatted} {currency.code}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 text-center bg-slate-800/50 rounded-xl px-5 py-3 border border-slate-600/30">
            <div className="text-2xl mb-1">
              {data.cityTier === "Major Metro" ? "🏙️" : data.cityTier === "Urban" ? "🏘️" : "🌆"}
            </div>
            <div className="text-white font-bold text-sm">{data.cityTier}</div>
            <div className="text-slate-400 text-xs">{data.countryName}</div>
          </div>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5 space-y-4">
        <h4 className="text-white font-bold text-sm">Cost Breakdown</h4>
        {BREAKDOWN_META.map((item) => {
          const bd = data.breakdown[item.key as keyof typeof data.breakdown];
          return (
            <div key={item.key}>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-slate-300 text-sm">{item.label}</span>
                <span className="text-white font-bold text-sm">
                  {fmt(bd.min, rate, symbol)} <span className="text-slate-500 font-normal">–</span> {fmt(bd.max, rate, symbol)}
                </span>
              </div>
              <AnimatedBar pct={item.pct * 2.2} color={item.color} />
            </div>
          );
        })}
      </div>

      {/* Rationale */}
      <div className="bg-slate-800/30 border border-slate-700/20 rounded-2xl p-5 space-y-3">
        <h4 className="text-white font-bold text-sm">How This Was Calculated</h4>
        <p className="text-slate-300 text-sm leading-relaxed">{data.rationale}</p>
        <p className="text-slate-400 text-sm leading-relaxed">{data.marketContext}</p>

        {/* Live data badge */}
        <div className="flex items-center gap-2 pt-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-semibold">Live exchange rate</span>
          <span className="text-slate-500 text-xs">
            — fetched {new Date(fetchedAt).toLocaleTimeString()} &middot; Source: European Central Bank
          </span>
        </div>
      </div>

      {/* Source note */}
      <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4">
        <p className="text-yellow-300/80 text-xs leading-relaxed">
          <span className="font-bold">Data Sources:</span> {data.sourceNote}
        </p>
        <p className="text-slate-500 text-xs mt-2">
          Analysis generated: {new Date(data.dataTimestamp).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
