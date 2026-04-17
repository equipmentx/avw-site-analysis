"use client";

import type { CensusData, TomTomSiteData } from "@/lib/types";

interface Props {
  census?: CensusData;
  tomtom?: TomTomSiteData;
  aadt?: number;  // fallback daily traffic from scoring
}

// ICA express car wash capture rates (% of 5-mile vehicle fleet per week)
const CAPTURE_RATES = [
  { label: "Year 1",  rate: 0.0104, color: "#60a5fa", bgColor: "bg-blue-500/15",   border: "border-blue-500/30" },
  { label: "Year 2",  rate: 0.0138, color: "#a78bfa", bgColor: "bg-violet-500/15", border: "border-violet-500/30" },
  { label: "Mature",  rate: 0.0166, color: "#34d399", bgColor: "bg-emerald-500/15",border: "border-emerald-500/30" },
] as const;

// Price points for revenue estimation
const PRICE_POINTS = [
  { label: "Basic",   price: 8  },
  { label: "Deluxe",  price: 14 },
  { label: "Premium", price: 20 },
];

export default function WashVolumeEstimate({ census, tomtom: _tomtom, aadt: _aadt }: Props) {
  // ── Require Census county vehicle data — no fabricated proxies ───────────
  const countyVehicles = census?.county?.totalVehiclesEstimate ?? 0;
  const censusAvailable = countyVehicles > 1000;

  if (!censusAvailable) {
    return (
      <div className="bg-slate-700/20 border border-slate-600/25 rounded-3xl p-8 text-center">
        <div className="text-5xl mb-4">🚗</div>
        <h3 className="text-white font-bold text-lg mb-2">Census Data Required</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
          Wash volume estimates require US Census Bureau vehicle fleet data for{" "}
          {census ? `${census.countyName} County` : "this location"}.
          Ensure <span className="text-slate-200 font-mono text-xs">CENSUS_ACS_API_KEY</span> is
          set and the location is within the US.
        </p>
      </div>
    );
  }

  const fleet = countyVehicles;
  const fleetSource = `Census county fleet — ${census!.countyName} County (${countyVehicles.toLocaleString()} vehicles)`;

  // ── Compute wash volumes ──────────────────────────────────────────────────
  const volumes = CAPTURE_RATES.map(({ label, rate, color, bgColor, border }) => {
    const weeklyWashes = fleet * rate;
    const annualWashes = Math.round(weeklyWashes * 52);
    return { label, rate, color, bgColor, border, weeklyWashes: Math.round(weeklyWashes), annualWashes };
  });

  const maxAnnual = volumes[volumes.length - 1].annualWashes;

  // ── Revenue table ─────────────────────────────────────────────────────────
  const revenueRows = volumes.map(({ label, annualWashes }) => ({
    label,
    annualWashes,
    revenues: PRICE_POINTS.map(({ price }) => annualWashes * price),
  }));

  const fmt  = (v: number) => v.toLocaleString();
  const fmt$ = (v: number) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(2)}M`
      : `$${(v / 1_000).toFixed(0)}K`;

  return (
    <div className="space-y-6">
      {/* ── Methodology note ─────────────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5">
        <span className="text-blue-400 text-sm mt-0.5">📐</span>
        <p className="text-slate-300 text-xs leading-relaxed">
          <span className="text-blue-300 font-semibold">ICA capture rate model.</span>{" "}
          Annual wash volume = vehicle fleet × weekly capture rate × 52 weeks.
          Year 1 = 1.04%, Year 2 = 1.38%, Mature = 1.66%. Fleet source:{" "}
          <span className="text-slate-200">{fleetSource}.</span>
        </p>
      </div>

      {/* ── Fleet size display ───────────────────────────────────────── */}
      <div className="flex items-center gap-4 bg-slate-700/30 border border-slate-600/30 rounded-xl px-5 py-4">
        <div className="text-4xl">🚗</div>
        <div>
          <div className="text-white font-black text-2xl">{fleet.toLocaleString()}</div>
          <div className="text-slate-400 text-xs">Vehicles in market area (fleet basis)</div>
          <div className="text-slate-500 text-[10px] mt-0.5">{fleetSource}</div>
        </div>
      </div>

      {/* ── Annual wash volume bars ──────────────────────────────────── */}
      <div>
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-4">
          Projected Annual Wash Volume
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {volumes.map(({ label, rate, annualWashes, weeklyWashes, bgColor, border, color }) => {
            const barPct = Math.min((annualWashes / (maxAnnual * 1.1)) * 100, 100);
            return (
              <div key={label} className={`${bgColor} ${border} border rounded-2xl p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">{label}</span>
                  <span className="text-slate-400 text-xs">{(rate * 100).toFixed(2)}%/wk</span>
                </div>
                <div>
                  <div className="text-white font-black text-3xl">{fmt(annualWashes)}</div>
                  <div className="text-slate-400 text-xs mt-0.5">washes / year</div>
                </div>
                <div className="h-2 bg-slate-700/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${barPct}%`, backgroundColor: color }}
                  />
                </div>
                <div className="text-slate-500 text-[10px]">
                  {fmt(weeklyWashes)} washes / week
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Revenue estimate table ───────────────────────────────────── */}
      <div>
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Revenue Scenarios by Price Point
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-600/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/40 border-b border-slate-600/30">
                <th className="py-2.5 px-4 text-left text-slate-400 text-xs font-semibold">Year</th>
                <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">Annual Washes</th>
                {PRICE_POINTS.map(({ label, price }) => (
                  <th key={label} className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">
                    {label} (${price}/wash)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revenueRows.map(({ label, annualWashes, revenues }, i) => (
                <tr key={label} className={`border-b border-slate-700/20 ${i % 2 === 0 ? "" : "bg-slate-700/10"}`}>
                  <td className="py-3 px-4 text-white font-semibold text-sm">{label}</td>
                  <td className="py-3 px-4 text-right text-slate-300 text-sm">{fmt(annualWashes)}</td>
                  {revenues.map((rev, j) => (
                    <td key={j} className="py-3 px-4 text-right text-emerald-300 font-semibold text-sm">
                      {fmt$(rev)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-[10px] mt-2">
          Revenue = annual washes × average ticket price. Does not account for membership mix, variable costs, or operating expenses.
          Use the 5-Year Financial Projection for full P&L modeling.
        </p>
      </div>

      {/* ── Capacity check ────────────────────────────────────────────── */}
      {(() => {
        const expressCapacity = 100 * 12 * 365; // 100 cars/hr × 12hrs × 365 days
        const matureVol = volumes[2].annualWashes;
        const capacityPct = Math.round((matureVol / expressCapacity) * 100);
        const withinCapacity = matureVol <= expressCapacity;
        return (
          <div className={`flex items-start gap-3 rounded-xl p-4 border ${
            withinCapacity ? "bg-emerald-500/8 border-emerald-500/25" : "bg-amber-500/8 border-amber-500/25"
          }`}>
            <span className="text-lg mt-0.5">{withinCapacity ? "✅" : "⚠️"}</span>
            <div>
              <p className={`text-sm font-semibold ${withinCapacity ? "text-emerald-300" : "text-amber-300"}`}>
                {withinCapacity
                  ? `Mature volume (${fmt(matureVol)} washes/yr) is ${capacityPct}% of a single-lane express tunnel capacity`
                  : `Mature volume (${fmt(matureVol)} washes/yr) exceeds single-lane express tunnel capacity`}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Single-lane express tunnel benchmark: ~{fmt(expressCapacity)} washes/year (100 cars/hr × 12 hrs × 365 days).
                {withinCapacity ? " This site can be served by a single tunnel." : " Consider a dual-lane or multi-bay configuration."}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
