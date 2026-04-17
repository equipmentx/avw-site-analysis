"use client";

import type { CensusData, CensusRingData } from "@/lib/types";
import { CheckCircle, XCircle, AlertCircle, Users } from "lucide-react";

interface Props {
  census: CensusData;
}

// ── Benchmark row ──────────────────────────────────────────────────────────────
function BenchmarkRow({
  label,
  tractValue,
  countyValue,
  target,
  tractMet,
  countyMet,
  format,
  note,
}: {
  label: string;
  tractValue: number;
  countyValue: number;
  target: number;
  tractMet: boolean;
  countyMet: boolean;
  format: (v: number) => string;
  note?: string;
}) {
  const Cell = ({ value, met }: { value: number; met: boolean }) => (
    <td className="py-3 px-4 text-right">
      <div className="flex items-center justify-end gap-2">
        <span className={`font-bold text-sm ${met ? "text-emerald-300" : "text-red-300"}`}>
          {format(value)}
        </span>
        {met
          ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        }
      </div>
    </td>
  );

  return (
    <tr className="border-b border-slate-600/30 hover:bg-slate-600/10 transition-colors">
      <td className="py-3 px-4">
        <div className="text-slate-200 text-sm font-medium">{label}</div>
        {note && <div className="text-slate-500 text-xs mt-0.5">{note}</div>}
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-slate-400 text-sm">{format(target)}</span>
      </td>
      <Cell value={tractValue} met={tractMet} />
      <Cell value={countyValue} met={countyMet} />
    </tr>
  );
}

// ── Bar indicator (for visual benchmark bars) ──────────────────────────────────
function BenchmarkBar({
  label,
  value,
  target,
  max,
  format,
  met,
}: {
  label: string;
  value: number;
  target: number;
  max: number;
  format: (v: number) => string;
  met: boolean;
}) {
  const pct    = Math.min((value / max) * 100, 100);
  const tgtPct = Math.min((target / max) * 100, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-xs font-medium">{label}</span>
        <span className={`text-xs font-bold ${met ? "text-emerald-300" : "text-red-300"}`}>
          {format(value)}
        </span>
      </div>
      <div className="relative h-2 bg-slate-600/40 rounded-full overflow-visible">
        {/* Actual value bar */}
        <div
          className={`h-full rounded-full transition-all duration-700 ${met ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/50 rounded-full"
          style={{ left: `${tgtPct}%` }}
          title={`Target: ${format(target)}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>0</span>
        <span className="text-slate-400">Target: {format(target)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-4 text-center">
      <div className="text-white font-black text-xl">{value}</div>
      <div className="text-slate-400 text-xs mt-0.5">{label}</div>
      {sub && <div className="text-slate-500 text-[10px] mt-1">{sub}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DemographicsPanel({ census }: Props) {
  const { tract, county } = census;

  const fmt$ = (v: number) => v.toLocaleString();
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;
  const fmtNum = (v: number) => v.toFixed(2);

  // ICA benchmark pass count
  const tractPassing  = Object.values(tract.benchmarks).filter((b) => b.met).length;
  const countyPassing = Object.values(county.benchmarks).filter((b) => b.met).length;

  return (
    <div className="space-y-6">
      {/* ── Source badge ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2.5">
        <span className="text-blue-400 text-sm mt-0.5">🏛️</span>
        <p className="text-slate-300 text-xs leading-relaxed">
          <span className="text-blue-300 font-semibold">US Census Bureau ACS 5-Year Estimates (2022)</span>
          {" "}— Census Tract data covers the immediate ~1–4 sq mile area around the site.
          County data covers the broader market. Benchmarks follow ICA express car wash site-selection
          criteria: HH size ≥ 2.1, working population ≥ 55%, and HH income ≥ $35K for ≥ 50% of households.
        </p>
      </div>

      {/* ── Quick stats row ────────────────────────────────────────────── */}
      <div>
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Quick Stats — {census.countyName} County
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="County Population"
            value={county.population.toLocaleString()}
            sub="ACS 2022 estimate"
          />
          <StatCard
            label="County Households"
            value={county.households.toLocaleString()}
            sub="occupied units"
          />
          <StatCard
            label="Vehicles Estimated"
            value={county.totalVehiclesEstimate.toLocaleString()}
            sub="county vehicle fleet"
          />
          <StatCard
            label="Vehicles / HH"
            value={county.vehiclesPerHousehold.toFixed(2)}
            sub="avg vehicles per household"
          />
        </div>
      </div>

      {/* ── Benchmark table ────────────────────────────────────────────── */}
      <div>
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
          <span>ICA Site-Selection Benchmarks</span>
          <span className="text-[10px] text-slate-500 normal-case tracking-normal font-normal">
            — green = target met, red = below target
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-600/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700/40 border-b border-slate-600/30">
                <th className="py-2.5 px-4 text-left text-slate-400 text-xs font-semibold">Metric</th>
                <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">Target</th>
                <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">
                  Tract
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">immediate area</div>
                </th>
                <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">
                  County
                  <div className="text-[10px] font-normal text-slate-500 mt-0.5">broader market</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              <BenchmarkRow
                label="Avg Household Size"
                note="ICA target: ≥ 2.1 persons/HH"
                tractValue={tract.benchmarks.hhSize.value}
                countyValue={county.benchmarks.hhSize.value}
                target={2.1}
                tractMet={tract.benchmarks.hhSize.met}
                countyMet={county.benchmarks.hhSize.met}
                format={fmtNum}
              />
              <BenchmarkRow
                label="Working Population"
                note="Labor force participation — ICA target: ≥ 55%"
                tractValue={tract.benchmarks.workingPop.value}
                countyValue={county.benchmarks.workingPop.value}
                target={55}
                tractMet={tract.benchmarks.workingPop.met}
                countyMet={county.benchmarks.workingPop.met}
                format={fmtPct}
              />
              <BenchmarkRow
                label="HH Income ≥ $35K"
                note="ICA target: ≥ 50% of households"
                tractValue={tract.benchmarks.hhIncome35k.value}
                countyValue={county.benchmarks.hhIncome35k.value}
                target={50}
                tractMet={tract.benchmarks.hhIncome35k.met}
                countyMet={county.benchmarks.hhIncome35k.met}
                format={fmtPct}
              />
              <tr className="border-b border-slate-600/30 bg-slate-700/10">
                <td className="py-3 px-4 text-slate-300 text-sm font-medium">Unemployment Rate</td>
                <td className="py-3 px-4 text-right text-slate-400 text-sm">—</td>
                <td className="py-3 px-4 text-right text-slate-300 text-sm font-semibold">{fmtPct(tract.unemploymentRate)}</td>
                <td className="py-3 px-4 text-right text-slate-300 text-sm font-semibold">{fmtPct(county.unemploymentRate)}</td>
              </tr>
              <tr className="border-b border-slate-600/30 bg-slate-700/10">
                <td className="py-3 px-4 text-slate-300 text-sm font-medium">Renter Occupied</td>
                <td className="py-3 px-4 text-right text-slate-400 text-sm">—</td>
                <td className="py-3 px-4 text-right text-slate-300 text-sm font-semibold">{fmtPct(tract.renterPct)}</td>
                <td className="py-3 px-4 text-right text-slate-300 text-sm font-semibold">{fmtPct(county.renterPct)}</td>
              </tr>
              <tr className="bg-slate-700/10">
                <td className="py-3 px-4 text-slate-300 text-sm font-medium">No Vehicle Available</td>
                <td className="py-3 px-4 text-right text-slate-400 text-sm">&lt; 10%</td>
                <td className="py-3 px-4 text-right text-slate-300 text-sm font-semibold">{fmtPct(tract.noVehiclePct)}</td>
                <td className="py-3 px-4 text-right text-slate-300 text-sm font-semibold">{fmtPct(county.noVehiclePct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Benchmark bar charts ───────────────────────────────────────── */}
      <div>
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Visual Benchmark Comparison — County Area
        </div>
        <div className="grid sm:grid-cols-3 gap-6 bg-slate-700/20 border border-slate-600/30 rounded-xl p-5">
          <BenchmarkBar
            label="Avg Household Size"
            value={county.avgHouseholdSize}
            target={2.1}
            max={4.0}
            format={fmtNum}
            met={county.benchmarks.hhSize.met}
          />
          <BenchmarkBar
            label="Working Population %"
            value={county.laborForceParticipation}
            target={55}
            max={80}
            format={fmtPct}
            met={county.benchmarks.workingPop.met}
          />
          <BenchmarkBar
            label="HH Income ≥ $35K %"
            value={county.hhIncomeOver35kPct}
            target={50}
            max={90}
            format={fmtPct}
            met={county.benchmarks.hhIncome35k.met}
          />
        </div>
      </div>

      {/* ── Benchmark score summary ────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={`rounded-xl p-4 border ${
          tractPassing >= 3
            ? "bg-emerald-500/8 border-emerald-500/25"
            : tractPassing >= 2
            ? "bg-amber-500/8 border-amber-500/25"
            : "bg-red-500/8 border-red-500/25"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {tractPassing >= 2
              ? <CheckCircle className="w-4 h-4 text-emerald-400" />
              : <AlertCircle className="w-4 h-4 text-amber-400" />
            }
            <span className="text-white text-sm font-bold">Census Tract</span>
            <span className="text-slate-400 text-xs">(immediate area)</span>
          </div>
          <p className={`text-xs font-semibold ${
            tractPassing >= 3 ? "text-emerald-300" :
            tractPassing >= 2 ? "text-amber-300" : "text-red-300"
          }`}>
            {tractPassing}/3 ICA benchmarks met
          </p>
          <p className="text-slate-400 text-[10px] mt-1">Census Tract {census.tractFips}</p>
        </div>

        <div className={`rounded-xl p-4 border ${
          countyPassing >= 3
            ? "bg-emerald-500/8 border-emerald-500/25"
            : countyPassing >= 2
            ? "bg-amber-500/8 border-amber-500/25"
            : "bg-red-500/8 border-red-500/25"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {countyPassing >= 2
              ? <CheckCircle className="w-4 h-4 text-emerald-400" />
              : <AlertCircle className="w-4 h-4 text-amber-400" />
            }
            <span className="text-white text-sm font-bold">County Market</span>
            <span className="text-slate-400 text-xs">(broader area)</span>
          </div>
          <p className={`text-xs font-semibold ${
            countyPassing >= 3 ? "text-emerald-300" :
            countyPassing >= 2 ? "text-amber-300" : "text-red-300"
          }`}>
            {countyPassing}/3 ICA benchmarks met
          </p>
          <p className="text-slate-400 text-[10px] mt-1">{census.countyName} County</p>
        </div>
      </div>

      <p className="text-slate-500 text-[10px]">
        Source: {tract.source} · Fetched {new Date(census.fetchedAt).toLocaleString()}
      </p>
    </div>
  );
}
