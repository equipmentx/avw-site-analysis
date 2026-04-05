"use client";

import type { TrafficSignals, ReviewInsights } from "@/lib/types";
import { formatNumber } from "@/lib/financialModel";

interface TrafficSignalsProps {
  signals: TrafficSignals;
  insights: ReviewInsights;
}

const SIGNAL_META = [
  { key: "nearbyGasStations",   label: "Gas Stations",   icon: "⛽", desc: "High traffic indicators",  max: 8 },
  { key: "nearbyGroceryStores", label: "Grocery Stores", icon: "🛒", desc: "Regular footfall drivers",  max: 6 },
  { key: "nearbyFastFood",      label: "Food & Dining",  icon: "🍔", desc: "Daily commuter stops",      max: 10 },
  { key: "nearbyShopping",      label: "Shopping Centers",icon: "🏬", desc: "Weekend destination traffic",max: 8 },
  { key: "nearbySchools",       label: "Schools",        icon: "🏫", desc: "Morning/afternoon traffic", max: 5 },
];

const SATURATION_META = {
  LOW:    { label: "Low Saturation", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", desc: "Few competitors. Excellent first-mover opportunity." },
  MEDIUM: { label: "Med Saturation", color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20",  desc: "Some competition exists. Strong differentiation required." },
  HIGH:   { label: "High Saturation",color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20",     desc: "Market is crowded. Premium positioning is essential." },
};

export default function TrafficSignalsPanel({ signals, insights }: TrafficSignalsProps) {
  const saturation = SATURATION_META[insights.marketSaturationLevel];

  return (
    <div className="space-y-6">
      {/* Estimated Traffic */}
      <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-slate-400 text-sm">Estimated Daily Traffic</div>
            <div className="text-4xl font-black text-white mt-1">
              {formatNumber(signals.estimatedDailyTraffic)}
            </div>
            <div className="text-slate-500 text-xs mt-1">vehicles passing this area per day</div>
          </div>
          <div className="text-6xl">🚗</div>
        </div>
        <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
            style={{
              width: `${Math.min((signals.estimatedDailyTraffic / 25000) * 100, 100)}%`,
              transition: "width 1.2s ease-out",
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>Low (2K/day)</span>
          <span>Target: 10K+/day</span>
          <span>High (25K/day)</span>
        </div>
      </div>

      {/* Traffic signals */}
      <div>
        <h4 className="text-white font-semibold text-sm mb-3">Nearby Traffic Generators</h4>
        <div className="space-y-3">
          {SIGNAL_META.map(({ key, label, icon, desc, max }) => {
            // Cap at max — extras beyond the max don't improve the score
            const raw = signals[key as keyof TrafficSignals] as number;
            const val = Math.min(raw, max);
            const pct = Math.round((val / max) * 100);
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <div>
                      <span className="text-white text-sm">{label}</span>
                      <span className="text-slate-600 text-xs ml-2">({desc})</span>
                    </div>
                  </div>
                  {/* Number always matches bar: "val / max (pct%)" */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-white font-bold text-sm">{val}</span>
                    <span className="text-slate-500 text-xs">/ {max}</span>
                    <span className="text-slate-600 text-xs ml-1">({pct}%)</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500/70 rounded-full"
                    style={{ width: `${pct}%`, transition: "width 1s ease-out" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market saturation */}
      <div className={`rounded-2xl p-5 border ${saturation.bg} ${saturation.border}`}>
        <div className="flex items-start gap-3">
          <div className="text-3xl">
            {insights.marketSaturationLevel === "LOW" ? "🟢" :
             insights.marketSaturationLevel === "MEDIUM" ? "🟡" : "🔴"}
          </div>
          <div>
            <div className={`font-bold text-base ${saturation.color}`}>
              {saturation.label}
            </div>
            <div className="text-slate-400 text-sm mt-0.5">{saturation.desc}</div>
          </div>
        </div>
      </div>

      {/* Missing services */}
      {insights.missingServices.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5">
          <h4 className="text-white font-semibold text-sm mb-3">
            🚀 Services Missing in This Market
          </h4>
          <div className="space-y-2">
            {insights.missingServices.map((service) => (
              <div key={service} className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-emerald-300">{service}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-3">
            These gaps represent direct opportunities to differentiate and capture market share.
          </p>
        </div>
      )}

      {/* Bonus insights */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-4 border ${insights.premiumOpportunity ? "bg-emerald-500/10 border-emerald-500/20" : "bg-slate-800/40 border-slate-700/30"}`}>
          <div className="text-2xl mb-1">{insights.premiumOpportunity ? "💎" : "📊"}</div>
          <div className={`text-sm font-semibold ${insights.premiumOpportunity ? "text-emerald-400" : "text-slate-400"}`}>
            {insights.premiumOpportunity ? "Premium Opportunity" : "Standard Market"}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {insights.premiumOpportunity
              ? "Low competitor quality = room to charge premium rates"
              : "Competitive market — match current pricing"}
          </div>
        </div>

        <div className={`rounded-xl p-4 border ${insights.unlimitedPlanDemand ? "bg-blue-500/10 border-blue-500/20" : "bg-slate-800/40 border-slate-700/30"}`}>
          <div className="text-2xl mb-1">♾️</div>
          <div className={`text-sm font-semibold ${insights.unlimitedPlanDemand ? "text-blue-400" : "text-slate-400"}`}>
            {insights.unlimitedPlanDemand ? "Unlimited Demand" : "Standard Demand"}
          </div>
          <div className="text-slate-500 text-xs mt-1">
            {insights.unlimitedPlanDemand
              ? "High volume signals — launch unlimited membership plan early"
              : "Build volume first before pushing subscriptions"}
          </div>
        </div>
      </div>
    </div>
  );
}
