"use client";

import { AlertTriangle, TrendingUp, TrendingDown, Minus, ShieldCheck } from "lucide-react";
import type { CompetitorIntelligence } from "@/lib/types";

interface Props {
  data: CompetitorIntelligence;
  siteAddress: string;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

// Three-tier signal based on road traffic variance
function getSignal(pct: number | null): {
  label: string; color: string; bg: string; border: string; icon: React.ReactNode;
} {
  if (pct == null)  return { label: "No data",       color: "text-slate-500",   bg: "bg-slate-700/30",    border: "border-slate-600/30",  icon: <Minus className="w-3 h-3" /> };
  if (pct >= 15)    return { label: "FLAG — taking share risk", color: "text-red-300",     bg: "bg-red-500/10",      border: "border-red-500/25",    icon: <AlertTriangle className="w-3 h-3" /> };
  if (pct >= 3)     return { label: "Slight edge",   color: "text-amber-300",   bg: "bg-amber-500/10",    border: "border-amber-500/25",  icon: <TrendingUp className="w-3 h-3" /> };
  if (pct <= -3)    return { label: "You lead",       color: "text-emerald-300", bg: "bg-emerald-500/10",  border: "border-emerald-500/25",icon: <ShieldCheck className="w-3 h-3" /> };
  return               { label: "Neutral",            color: "text-slate-300",   bg: "bg-slate-700/30",    border: "border-slate-600/30",  icon: <TrendingDown className="w-3 h-3 rotate-180" /> };
}

export default function CompetitorIntelligencePanel({ data, siteAddress }: Props) {
  const { siteRoadVpd, marketVolume, flaggedCount, trafficFetched } = data;
  const { siteAnnualCarsEstimate, totalAreaCarsEstimate, siteMarketSharePct,
          competitors, dominantPlayerName, dominantPlayerSharePct } = marketVolume;

  const tableRows  = competitors.slice(0, 15);
  const shareRows  = [...competitors]
    .filter(c => c.marketSharePct != null)
    .sort((a, b) => (b.marketSharePct ?? 0) - (a.marketSharePct ?? 0))
    .slice(0, 10);

  const hasMarketData  = totalAreaCarsEstimate > 0 && siteAnnualCarsEstimate > 0;
  const hasTrafficData = trafficFetched && competitors.some(c => c.roadVpd != null);
  const shortName      = siteAddress.split(",")[0] ?? "Your Site";

  // Count by tier
  const slightEdgeCount = competitors.filter(c => (c.trafficVariancePct ?? 0) >= 3 && (c.trafficVariancePct ?? 0) < 15).length;

  return (
    <div className="space-y-6">

      {/* ── Why this method ──────────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-600/40 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-white font-bold text-sm">Why we compare road traffic (AADT), not review counts</span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          The alternative — estimating weekly wash volumes from Google review counts — carries a
          <span className="text-amber-300 font-semibold"> ±50% error margin</span>. A business with
          200 reviews might be 18 months old or 4 years old; we can't tell. At that accuracy, a 3% volume
          difference is pure noise.
        </p>
        <p className="text-slate-300 text-xs leading-relaxed">
          Road traffic from TomTom is <span className="text-emerald-300 font-semibold">real sensor data</span> —
          recorded by road-speed detectors and processed via the BPR/HCM formula used by traffic engineers.
          A competitor on a road with more vehicles passing per day has more potential customers seeing their
          site every single day. That is the <span className="text-white font-semibold">mechanism</span> by
          which a competitor takes share: more exposure → more impulse visits. We flag that directly.
        </p>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { label: "≥15% more traffic", badge: "FLAG", bc: "bg-red-500/15 border-red-500/30 text-red-300", desc: "Structural advantage — likely pulling customers from your trade area" },
            { label: "3–15% more traffic", badge: "Slight edge", bc: "bg-amber-500/15 border-amber-500/30 text-amber-300", desc: "Minor advantage — worth monitoring but not an immediate threat" },
            { label: "<3% either way", badge: "Neutral", bc: "bg-slate-600/40 border-slate-500/30 text-slate-300", desc: "Comparable road exposure — competition is on even footing" },
          ].map(({ label, badge, bc, desc }) => (
            <div key={badge} className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-3 space-y-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bc}`}>{badge}</span>
              <div className="text-white text-[11px] font-semibold leading-tight">{label}</div>
              <div className="text-slate-400 text-[10px] leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-blue-300">
            {hasMarketData ? `${siteMarketSharePct}%` : "—"}
          </div>
          <div className="text-slate-300 text-[11px] mt-1 leading-tight">Your est. market share</div>
        </div>
        <div className="bg-slate-700/40 border border-slate-600/30 rounded-xl p-4 text-center">
          <div className="text-2xl font-black text-white">
            {fmtK(siteRoadVpd)}
          </div>
          <div className="text-slate-300 text-[11px] mt-1 leading-tight">Your road AADT (vpd)</div>
        </div>
        <div className={`rounded-xl p-4 text-center border ${flaggedCount > 0 ? "bg-red-500/8 border-red-500/20" : "bg-emerald-500/8 border-emerald-500/20"}`}>
          <div className={`text-2xl font-black ${flaggedCount > 0 ? "text-red-300" : "text-emerald-300"}`}>
            {flaggedCount}
          </div>
          <div className="text-slate-300 text-[11px] mt-1 leading-tight">
            Flagged competitors<br/>
            <span className="text-slate-400 text-[10px]">(&gt;15% traffic edge)</span>
          </div>
        </div>
        <div className={`rounded-xl p-4 text-center border ${slightEdgeCount > 0 ? "bg-amber-500/8 border-amber-500/20" : "bg-slate-700/40 border-slate-600/30"}`}>
          <div className={`text-2xl font-black ${slightEdgeCount > 0 ? "text-amber-300" : "text-slate-300"}`}>
            {slightEdgeCount}
          </div>
          <div className="text-slate-300 text-[11px] mt-1 leading-tight">
            Slight edge (3–15%)<br/>
            <span className="text-slate-400 text-[10px]">monitor these</span>
          </div>
        </div>
      </div>

      {/* ── Road Traffic Comparison Table ─────────────────────────────── */}
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-white font-bold text-sm">Road Traffic Comparison</h4>
          {!hasTrafficData && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              TomTom key not set — traffic unavailable
            </span>
          )}
        </div>
        <p className="text-slate-400 text-xs mb-4">
          Live TomTom AADT at each competitor's nearest road vs your site's road ({fmtK(siteRoadVpd)} vpd).
          Variance = how many more (or fewer) vehicles pass their location per day.
        </p>

        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left text-slate-400 font-semibold py-2.5 px-2">Competitor</th>
                <th className="text-right text-slate-400 font-semibold py-2.5 px-2">Distance</th>
                <th className="text-right text-slate-400 font-semibold py-2.5 px-2">Road AADT</th>
                <th className="text-right text-slate-400 font-semibold py-2.5 px-2">vs Your Road</th>
                <th className="text-left text-slate-400 font-semibold py-2.5 px-2 pl-4">Signal</th>
              </tr>
            </thead>
            <tbody>
              {/* Your site row */}
              <tr className="border-b border-slate-700/20 bg-blue-500/5">
                <td className="py-2.5 px-2 text-blue-300 font-semibold">★ {shortName}</td>
                <td className="py-2.5 px-2 text-right text-slate-400">—</td>
                <td className="py-2.5 px-2 text-right text-blue-300 font-bold">{fmtK(siteRoadVpd)}</td>
                <td className="py-2.5 px-2 text-right text-slate-500">baseline</td>
                <td className="py-2.5 px-2 pl-4">
                  <span className="text-[10px] text-slate-400">your site</span>
                </td>
              </tr>

              {tableRows.map((comp) => {
                const sig = getSignal(comp.trafficVariancePct);
                return (
                  <tr
                    key={comp.placeId}
                    className={`border-b border-slate-700/15 ${comp.trafficAdvantageFlag ? "bg-red-500/5" : ""}`}
                  >
                    <td className="py-2.5 px-2">
                      <span className={`font-medium ${comp.trafficAdvantageFlag ? "text-red-300" : "text-slate-200"}`}>
                        {comp.name}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-400">{comp.distanceMiles.toFixed(1)} mi</td>
                    <td className="py-2.5 px-2 text-right">
                      {comp.roadVpd != null
                        ? <span className={sig.color}>{fmtK(comp.roadVpd)}</span>
                        : <span className="text-slate-600">—</span>
                      }
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {comp.trafficVariancePct != null ? (
                        <span className={`font-semibold ${sig.color}`}>
                          {comp.trafficVariancePct > 0 ? "+" : ""}{comp.trafficVariancePct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 pl-4">
                      <div className={`flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full border ${sig.bg} ${sig.border}`}>
                        <span className={sig.color}>{sig.icon}</span>
                        <span className={`text-[10px] font-semibold ${sig.color}`}>{sig.label}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {competitors.length > 15 && (
          <p className="text-slate-500 text-[10px] mt-3">
            Showing nearest 15 of {competitors.length} competitors. TomTom road traffic fetched for all shown.
          </p>
        )}
      </div>

      {/* ── Market Share (supplementary) ──────────────────────────────── */}
      {hasMarketData && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
          <h4 className="text-white font-bold text-sm mb-1">Estimated Market Share</h4>
          <p className="text-slate-400 text-[11px] mb-4 leading-relaxed">
            Supplementary context only — derived from Google review counts (rough ±50% accuracy).
            Use road traffic above as the primary competitive signal.
            {dominantPlayerName && dominantPlayerSharePct != null && (
              <span className="text-amber-300">
                {" "}Dominant player: <strong>{dominantPlayerName}</strong> holds ~{dominantPlayerSharePct}% of estimated area market.
              </span>
            )}
          </p>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-blue-300 text-xs font-semibold truncate max-w-[60%]">★ {shortName}</span>
                <span className="text-blue-300 text-xs font-bold">{siteMarketSharePct}%</span>
              </div>
              <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                  style={{ width: `${Math.max(2, siteMarketSharePct)}%` }}
                />
              </div>
              <div className="text-slate-500 text-[10px] mt-0.5">{fmtK(siteAnnualCarsEstimate)} cars/yr projected</div>
            </div>

            {shareRows.map((comp) => {
              const pct = comp.marketSharePct ?? 0;
              return (
                <div key={comp.placeId}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-medium truncate max-w-[60%] ${comp.trafficAdvantageFlag ? "text-red-300" : "text-slate-200"}`}>
                      {comp.trafficAdvantageFlag && "🚨 "}{comp.name}
                      <span className="text-slate-500 ml-1.5 font-normal">{comp.distanceMiles.toFixed(1)} mi</span>
                    </span>
                    <span className={`text-xs font-bold ${comp.trafficAdvantageFlag ? "text-red-300" : "text-slate-400"}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${comp.trafficAdvantageFlag ? "bg-red-500/60" : "bg-slate-500/50"}`}
                      style={{ width: `${Math.max(1, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
