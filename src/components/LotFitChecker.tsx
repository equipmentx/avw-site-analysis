"use client";

import { useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Maximize2 } from "lucide-react";

/**
 * Lot Fit Checker — inspired by Tommy Car Wash Systems' Carwash Placer tool.
 *
 * Shows which car wash tunnel configurations fit within a given lot footprint.
 * Minimum lot dimensions sourced from Tommy Car Wash Systems layout specifications
 * (130ft Express line) and industry standard ICA / NACS site planning guides.
 */

interface Config {
  id:          string;
  name:        string;
  category:    "express-tunnel" | "flex-serve" | "in-bay" | "self-serve";
  tunnelFt:    number;
  minWidthFt:  number;
  minDepthFt:  number;
  payLanes:    number;
  vacuumRows:  number;
  throughput:  number; // cars/hr
  monthlyRev:  string; // USD range at typical ticket price
  icon:        string;
  desc:        string;
}

const CONFIGS: Config[] = [
  // ── Express Tunnel (Tommy layout specs) ────────────────────────────────────
  {
    id: "e2l1v",
    name: "130ft Express · 2 Pay Lanes · 1 Vacuum Row",
    category: "express-tunnel",
    tunnelFt: 130,
    minWidthFt: 125,
    minDepthFt: 245,
    payLanes: 2,
    vacuumRows: 1,
    throughput: 100,
    monthlyRev: "$180K – $260K",
    icon: "🚇",
    desc: "Entry-level express tunnel. Best for tighter lots with single-row vacuum area.",
  },
  {
    id: "e2l2v",
    name: "130ft Express · 2 Pay Lanes · 2 Vacuum Rows",
    category: "express-tunnel",
    tunnelFt: 130,
    minWidthFt: 150,
    minDepthFt: 245,
    payLanes: 2,
    vacuumRows: 2,
    throughput: 100,
    monthlyRev: "$200K – $290K",
    icon: "🚇",
    desc: "Same tunnel length, double vacuum row. Higher customer satisfaction — reduces queue backup.",
  },
  {
    id: "e3l1v",
    name: "130ft Express · 3 Pay Lanes · 1 Vacuum Row",
    category: "express-tunnel",
    tunnelFt: 130,
    minWidthFt: 137,
    minDepthFt: 245,
    payLanes: 3,
    vacuumRows: 1,
    throughput: 120,
    monthlyRev: "$220K – $310K",
    icon: "🚇",
    desc: "Three pay lanes feed the tunnel faster — ideal for high-traffic corridors.",
  },
  {
    id: "e3l2v",
    name: "130ft Express · 3 Pay Lanes · 2 Vacuum Rows",
    category: "express-tunnel",
    tunnelFt: 130,
    minWidthFt: 162,
    minDepthFt: 245,
    payLanes: 3,
    vacuumRows: 2,
    throughput: 120,
    monthlyRev: "$240K – $340K",
    icon: "🚇",
    desc: "Full express build-out. Maximum throughput and customer experience on a Tommy 130ft frame.",
  },
  {
    id: "e150-3l2v",
    name: "150ft Express · 3 Pay Lanes · 2 Vacuum Rows",
    category: "express-tunnel",
    tunnelFt: 150,
    minWidthFt: 165,
    minDepthFt: 270,
    payLanes: 3,
    vacuumRows: 2,
    throughput: 150,
    monthlyRev: "$280K – $400K",
    icon: "🚇",
    desc: "Longer tunnel with more equipment options (triple-foam, wheel blasters). Premium tier.",
  },
  // ── Flex-Serve ──────────────────────────────────────────────────────────────
  {
    id: "flex-full",
    name: "Flex-Serve Tunnel (Full-Service Option)",
    category: "flex-serve",
    tunnelFt: 120,
    minWidthFt: 180,
    minDepthFt: 280,
    payLanes: 2,
    vacuumRows: 3,
    throughput: 60,
    monthlyRev: "$220K – $350K",
    icon: "✨",
    desc: "Combines express machine wash with interior vacuuming service. Higher ticket, lower volume.",
  },
  // ── In-Bay Automatic ────────────────────────────────────────────────────────
  {
    id: "iba-single",
    name: "In-Bay Automatic (Single Bay)",
    category: "in-bay",
    tunnelFt: 0,
    minWidthFt: 30,
    minDepthFt: 80,
    payLanes: 1,
    vacuumRows: 0,
    throughput: 15,
    monthlyRev: "$15K – $35K",
    icon: "🏠",
    desc: "Car drives in, machine moves over it. Tiny footprint — works in gas stations and small lots.",
  },
  {
    id: "iba-triple",
    name: "In-Bay Automatic (3-Bay Row)",
    category: "in-bay",
    tunnelFt: 0,
    minWidthFt: 90,
    minDepthFt: 100,
    payLanes: 3,
    vacuumRows: 1,
    throughput: 45,
    monthlyRev: "$45K – $90K",
    icon: "🏠",
    desc: "Three side-by-side in-bay units. Good for smaller lots where a tunnel won't fit.",
  },
  // ── Self-Serve ──────────────────────────────────────────────────────────────
  {
    id: "ss-4bay",
    name: "Self-Serve (4 Bays)",
    category: "self-serve",
    tunnelFt: 0,
    minWidthFt: 100,
    minDepthFt: 70,
    payLanes: 4,
    vacuumRows: 1,
    throughput: 20,
    monthlyRev: "$8K – $20K",
    icon: "🔧",
    desc: "Customer-operated wand bays. Low build cost, minimal staffing, but low revenue ceiling.",
  },
];

const CATEGORY_LABELS: Record<Config["category"], string> = {
  "express-tunnel": "Express Tunnel",
  "flex-serve":     "Flex-Serve",
  "in-bay":         "In-Bay Automatic",
  "self-serve":     "Self-Serve",
};

const CATEGORY_COLOURS: Record<Config["category"], string> = {
  "express-tunnel": "text-blue-400 border-blue-500/30 bg-blue-500/5",
  "flex-serve":     "text-purple-400 border-purple-500/30 bg-purple-500/5",
  "in-bay":         "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
  "self-serve":     "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
};

type FitStatus = "fits" | "tight" | "nofits" | "unknown";

function getFit(config: Config, width: number, depth: number): FitStatus {
  const wOk = width  >= config.minWidthFt;
  const dOk = depth  >= config.minDepthFt;
  // Also check if swapped (landscape vs portrait) for in-bay / self-serve
  const wOkSwap = width  >= config.minDepthFt;
  const dOkSwap = depth  >= config.minWidthFt;

  if ((wOk && dOk) || (wOkSwap && dOkSwap)) return "fits";

  // Within 10% tolerance on either dimension = "tight" (possible with creative layout)
  const tolerance = 0.90;
  const wClose = width  >= config.minWidthFt * tolerance;
  const dClose = depth  >= config.minDepthFt * tolerance;
  const wCloseSwap = width  >= config.minDepthFt * tolerance;
  const dCloseSwap = depth  >= config.minWidthFt * tolerance;

  if ((wClose && dOk) || (wOk && dClose) || (wCloseSwap && dOkSwap) || (wOkSwap && dCloseSwap)) return "tight";
  return "nofits";
}

interface Props {
  prefilledWidthFt?: number;
  prefilledDepthFt?: number;
}

export default function LotFitChecker({ prefilledWidthFt, prefilledDepthFt }: Props) {
  const [widthFt, setWidthFt] = useState(prefilledWidthFt ? String(prefilledWidthFt) : "");
  const [depthFt, setDepthFt] = useState(prefilledDepthFt ? String(prefilledDepthFt) : "");
  const [unit, setUnit]       = useState<"ft" | "m">("ft");

  const toFeet = (val: string) => {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return 0;
    return unit === "m" ? Math.round(n * 3.28084) : n;
  };

  const w = toFeet(widthFt);
  const d = toFeet(depthFt);
  const hasInput = w > 0 && d > 0;

  const results = hasInput
    ? CONFIGS.map((c) => ({ config: c, status: getFit(c, w, d) }))
    : [];

  const fitCount   = results.filter((r) => r.status === "fits").length;
  const tightCount = results.filter((r) => r.status === "tight").length;

  // Group by category
  const grouped = CONFIGS.reduce<Record<string, Config[]>>((acc, c) => {
    acc[c.category] = [...(acc[c.category] ?? []), c];
    return acc;
  }, {});

  const statusOf = (id: string): FitStatus =>
    results.find((r) => r.config.id === id)?.status ?? "unknown";

  return (
    <div className="space-y-5">

      {/* ── Info bar ─────────────────────────────────────────────────── */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-3">
        <Maximize2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-300 text-xs leading-relaxed">
          {prefilledWidthFt && prefilledDepthFt
            ? <>
                <span className="text-emerald-300 font-semibold">Auto-filled from ATTOM parcel data</span> — dimensions
                from county assessor lot record. You can edit them manually below.{" "}
              </>
            : null}
          Minimum sizes are based on <span className="text-white font-semibold">Tommy Car Wash Systems</span> layout specs
          and ICA site-planning guidelines. <span className="text-white font-semibold">"Tight"</span> means within 10% — possible with a civil engineer's input.
        </p>
      </div>

      {/* ── Input ────────────────────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-bold text-sm">Enter Lot Dimensions</span>
          <div className="flex items-center gap-1 bg-slate-700/60 border border-slate-600/50 rounded-lg p-0.5">
            {(["ft", "m"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  unit === u ? "bg-blue-600 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                {u === "ft" ? "Feet" : "Metres"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-300 text-xs mb-1.5 block">Lot Width ({unit})</label>
            <input
              type="number"
              min={0}
              placeholder={unit === "ft" ? "e.g. 150" : "e.g. 46"}
              value={widthFt}
              onChange={(e) => setWidthFt(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-600/60 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>
          <div>
            <label className="text-slate-300 text-xs mb-1.5 block">Lot Depth ({unit})</label>
            <input
              type="number"
              min={0}
              placeholder={unit === "ft" ? "e.g. 260" : "e.g. 79"}
              value={depthFt}
              onChange={(e) => setDepthFt(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-600/60 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>
        </div>

        {hasInput && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-xs">
              Lot: <span className="text-white font-bold">{w}ft × {d}ft</span>
              {unit === "m" && <span className="text-slate-400"> ({Math.round(w / 3.28084)}m × {Math.round(d / 3.28084)}m)</span>}
            </span>
            {fitCount > 0 && (
              <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-bold">
                {fitCount} configuration{fitCount !== 1 ? "s" : ""} fit
              </span>
            )}
            {tightCount > 0 && (
              <span className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs px-2 py-0.5 rounded-full font-bold">
                {tightCount} tight
              </span>
            )}
            {fitCount === 0 && tightCount === 0 && (
              <span className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs px-2 py-0.5 rounded-full font-bold">
                No standard configurations fit this lot
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Results by category ──────────────────────────────────────── */}
      {(Object.keys(grouped) as Config["category"][]).map((cat) => (
        <div key={cat} className="space-y-2">
          <h4 className={`text-xs font-bold uppercase tracking-wider px-1 ${CATEGORY_COLOURS[cat].split(" ")[0]}`}>
            {CATEGORY_LABELS[cat]}
          </h4>
          <div className="space-y-2">
            {grouped[cat].map((config) => {
              const status = statusOf(config.id);
              const colClass =
                !hasInput        ? "border-slate-700/40 bg-slate-800/40" :
                status === "fits"   ? "border-emerald-500/30 bg-emerald-500/5" :
                status === "tight"  ? "border-yellow-500/30 bg-yellow-500/5" :
                                      "border-red-500/20 bg-slate-800/30 opacity-60";

              return (
                <div key={config.id} className={`border rounded-2xl p-4 transition-all ${colClass}`}>
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {!hasInput  ? <Maximize2 className="w-5 h-5 text-slate-500" /> :
                       status === "fits"  ? <CheckCircle className="w-5 h-5 text-emerald-400" /> :
                       status === "tight" ? <AlertCircle className="w-5 h-5 text-yellow-400" /> :
                                           <XCircle className="w-5 h-5 text-red-400" /> }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <span className="text-lg mr-1">{config.icon}</span>
                          <span className="text-white font-bold text-sm">{config.name}</span>
                        </div>
                        {hasInput && status !== "unknown" && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                            status === "fits"  ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/15" :
                            status === "tight" ? "text-yellow-300 border-yellow-500/30 bg-yellow-500/15" :
                                                "text-red-300 border-red-500/30 bg-red-500/10"
                          }`}>
                            {status === "fits" ? "✓ Fits" : status === "tight" ? "~ Tight" : "✗ Too small"}
                          </span>
                        )}
                      </div>

                      <p className="text-slate-300 text-xs mt-1 leading-relaxed">{config.desc}</p>

                      {/* Specs grid */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-slate-900/60 rounded-lg px-2.5 py-1.5">
                          <div className="text-slate-400 text-[10px]">Min lot size</div>
                          <div className="text-white font-bold text-xs">{config.minWidthFt}ft × {config.minDepthFt}ft</div>
                        </div>
                        {config.tunnelFt > 0 && (
                          <div className="bg-slate-900/60 rounded-lg px-2.5 py-1.5">
                            <div className="text-slate-400 text-[10px]">Tunnel length</div>
                            <div className="text-white font-bold text-xs">{config.tunnelFt}ft</div>
                          </div>
                        )}
                        <div className="bg-slate-900/60 rounded-lg px-2.5 py-1.5">
                          <div className="text-slate-400 text-[10px]">Throughput</div>
                          <div className="text-white font-bold text-xs">~{config.throughput} cars/hr</div>
                        </div>
                        <div className="bg-slate-900/60 rounded-lg px-2.5 py-1.5">
                          <div className="text-slate-400 text-[10px]">Est. monthly rev</div>
                          <div className="text-white font-bold text-xs">{config.monthlyRev}</div>
                        </div>
                      </div>

                      {/* Fit gap feedback */}
                      {hasInput && status === "nofits" && (
                        <p className="text-red-300/80 text-[10px] mt-2">
                          Needs {Math.max(0, config.minWidthFt - Math.max(w, d))}ft more width or {Math.max(0, config.minDepthFt - Math.min(w, d))}ft more depth.
                        </p>
                      )}
                      {hasInput && status === "tight" && (
                        <p className="text-yellow-300/80 text-[10px] mt-2">
                          Within 10% of minimum — consult a civil engineer. May require creative stacking or setback waivers.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── Source note ──────────────────────────────────────────────── */}
      <p className="text-slate-500 text-[10px] text-center leading-relaxed">
        Minimum lot dimensions from Tommy Car Wash Systems layout specifications (130ft Express line)
        and ICA / NACS site-planning standards. Throughput and revenue estimates are industry averages —
        actual results vary by location, pricing, and management.
      </p>
    </div>
  );
}
