"use client";

import type { TradeAreaDemographics, TradeAreaZoneData } from "@/lib/types";
import { DEMOGRAPHICS_BENCHMARKS } from "@/lib/industryBenchmarks";

interface Props {
  data: TradeAreaDemographics;
}

function fmt(n: number | undefined | null, decimals = 0): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function pct(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toFixed(1)}%`;
}

interface MetricRowProps {
  label: string;
  value: string;
  benchmark?: string;
  met?: boolean | null;
}

function MetricRow({ label, value, benchmark, met }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        {benchmark && met != null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            met ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}>
            {met ? "✓" : "✗"} {benchmark}
          </span>
        )}
        <span className="text-xs font-semibold text-white tabular-nums">{value}</span>
      </div>
    </div>
  );
}

function ZoneCard({ zone }: { zone: TradeAreaZoneData }) {
  const D = DEMOGRAPHICS_BENCHMARKS;
  const hhSizeMet     = zone.avgHouseholdSize     >= D.hhSizeTarget;
  const laborMet      = zone.laborForceParticipationPct >= D.workingPopTargetPct;
  const incomeMet     = zone.hhIncomeOver35kPct   >= D.hhIncome35kExpressThresholdPct;
  const vehiclesMet   = zone.vehiclesPerHousehold >= D.vehiclesPerHHTarget;
  const noVehicleOk   = zone.noVehiclePct         <= D.noVehicleMaxPct;
  const unemployOk    = zone.unemploymentRatePct  <= D.unemploymentMaxPct;

  const benchmarksMet    = [hhSizeMet, laborMet, incomeMet].filter(Boolean).length;
  const benchmarksTotal  = 3;
  const allMet           = benchmarksMet === benchmarksTotal;
  const noneMet          = benchmarksMet === 0;

  const borderColor = allMet
    ? "border-emerald-500/30"
    : noneMet
    ? "border-red-500/30"
    : "border-yellow-500/30";

  const badgeColor = allMet
    ? "bg-emerald-500/15 text-emerald-400"
    : noneMet
    ? "bg-red-500/15 text-red-400"
    : "bg-yellow-500/15 text-yellow-400";

  return (
    <div className={`rounded-xl border ${borderColor} bg-zinc-900/60 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white">{zone.label}</h4>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {fmt(zone.population)} residents · {fmt(zone.households)} households
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${badgeColor}`}>
          {benchmarksMet}/{benchmarksTotal} benchmarks
        </span>
      </div>

      <div className="space-y-0">
        <MetricRow
          label="Avg Household Size"
          value={fmt(zone.avgHouseholdSize, 2)}
          benchmark={`≥ ${D.hhSizeTarget}`}
          met={hhSizeMet}
        />
        <MetricRow
          label="Labor Force Participation"
          value={pct(zone.laborForceParticipationPct)}
          benchmark={`≥ ${D.workingPopTargetPct}%`}
          met={laborMet}
        />
        <MetricRow
          label="HH Income ≥ $35K"
          value={pct(zone.hhIncomeOver35kPct)}
          benchmark={`≥ ${D.hhIncome35kExpressThresholdPct}%`}
          met={incomeMet}
        />
        <MetricRow
          label="Vehicles per Household"
          value={fmt(zone.vehiclesPerHousehold, 2)}
          benchmark={`≥ ${D.vehiclesPerHHTarget}`}
          met={vehiclesMet}
        />
        <MetricRow
          label="No-Vehicle Households"
          value={pct(zone.noVehiclePct)}
          benchmark={`< ${D.noVehicleMaxPct}%`}
          met={noVehicleOk}
        />
        <MetricRow
          label="Unemployment Rate"
          value={pct(zone.unemploymentRatePct)}
          benchmark={`< ${D.unemploymentMaxPct}%`}
          met={unemployOk}
        />
        <MetricRow
          label="Renter Occupied"
          value={pct(zone.renterPct)}
        />
        <MetricRow
          label="Est. Total Vehicles"
          value={fmt(zone.totalVehiclesEstimate)}
        />
      </div>

      <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
        {zone.tractsAnalyzed} census tract{zone.tractsAnalyzed !== 1 ? "s" : ""} · {zone.source}
      </p>
    </div>
  );
}

export default function TradeAreaDemographicsPanel({ data }: Props) {
  const zones = [data.fiveMin, data.tenMin, data.fifteenMin].filter(
    (z): z is TradeAreaZoneData => !!z
  );

  if (!zones.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Drive-Time Trade Area Demographics</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Census ACS 5-Year data aggregated by TomTom isochrone zone
          </p>
        </div>
        {data.status === "partial" && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">
            Partial data
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {zones.map((zone) => (
          <ZoneCard key={zone.driveTimeMinutes} zone={zone} />
        ))}
      </div>

      <p className="text-[10px] text-zinc-600 leading-relaxed">{data.note}</p>
    </div>
  );
}
