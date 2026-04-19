"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Circle, Car, TrendingUp, Info, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  coordinates: { lat: number; lng: number };
}

interface RadiusData {
  milesRadius:      number;
  vehiclesPerDay:   number;
  avgRoadVehicles:  number;
  pointsSampled:    number;
  totalPointsTried: number;
  note:             string;
  error?:           string;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

const RADIUS_STEPS = [1, 2, 3, 5, 7, 10, 15, 20, 25];

// Approximate how long the API will take: ~90 sample points × 100ms stagger
function estimateSecs(miles: number): number {
  const spacing   = Math.max(0.12, miles * Math.sqrt(Math.PI / 90));
  const rowCount  = Math.ceil(miles / spacing) + 1;
  const colCount  = rowCount;
  const approxPts = Math.min(90, (2 * rowCount + 1) * (2 * colCount + 1));
  return Math.round((approxPts * 0.1) + 2); // 100ms/point + 2s overhead
}

export default function RadiusTrafficPanel({ coordinates }: Props) {
  const [miles, setMiles]       = useState(3);
  const [data, setData]         = useState<RadiusData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [elapsed, setElapsed]   = useState(0);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasCoords = coordinates?.lat != null && coordinates?.lng != null
    && !isNaN(coordinates.lat) && !isNaN(coordinates.lng);

  const doFetch = useCallback((m: number) => {
    if (!hasCoords) return;

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // Clear elapsed timer
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(0);

    setLoading(true);
    setError("");

    // Start elapsed counter
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    fetch(
      `/api/traffic-radius?lat=${coordinates.lat}&lng=${coordinates.lng}&miles=${m}`,
      { signal: abortRef.current.signal }
    )
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((d: RadiusData) => {
        if (d.error && !d.vehiclesPerDay) {
          setError(d.error);
        } else {
          setData(d);
          setError("");
        }
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return; // user changed radius — ignore
        setError(e.message || "Traffic data could not be loaded. Please try again.");
      })
      .finally(() => {
        setLoading(false);
        if (timerRef.current) clearInterval(timerRef.current);
      });
  }, [coordinates, hasCoords]);

  // Debounce slider changes; fetch immediately on mount
  useEffect(() => {
    if (!hasCoords) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(miles), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [miles, doFetch, hasCoords]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const estSecs  = estimateSecs(miles);
  const progress = loading ? Math.min(95, (elapsed / estSecs) * 100) : 0;

  // Colour scale: more vehicles = warmer
  function barColour(pct: number): string {
    if (pct >= 0.8) return "from-red-500 to-orange-400";
    if (pct >= 0.5) return "from-orange-400 to-yellow-400";
    if (pct >= 0.25) return "from-yellow-400 to-emerald-400";
    return "from-emerald-400 to-cyan-400";
  }

  const maxKnown = 2_000_000;
  const pct      = data?.vehiclesPerDay ? Math.min(1, data.vehiclesPerDay / maxKnown) : 0;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-300 text-xs leading-relaxed">
          Adjust the radius slider to see how many vehicles pass through your trade area per day.
          Data is sampled from live TomTom traffic flow at multiple road points inside the radius —
          as the radius grows, more roads are covered so the count increases.
          Powered by TomTom Traffic Flow API + BPR/HCM road capacity methodology.
        </p>
      </div>

      {/* ── Radius Slider ──────────────────────────────────────────── */}
      <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Circle className="w-4 h-4 text-blue-400" />
            <span className="text-white font-bold text-sm">Trade Area Radius</span>
          </div>
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-xl px-4 py-1.5 flex items-center gap-1">
            <span className="text-blue-300 font-black text-xl">{miles}</span>
            <span className="text-blue-400 text-xs">miles</span>
            {loading && <Loader2 className="w-3 h-3 text-blue-400 animate-spin ml-1" />}
          </div>
        </div>

        {/* Step slider */}
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={RADIUS_STEPS.length - 1}
            step={1}
            value={RADIUS_STEPS.indexOf(miles) >= 0 ? RADIUS_STEPS.indexOf(miles) : 2}
            onChange={(e) => setMiles(RADIUS_STEPS[parseInt(e.target.value)])}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            {RADIUS_STEPS.map((s) => (
              <span
                key={s}
                className={`cursor-pointer transition-colors ${s === miles ? "text-blue-400 font-bold" : "hover:text-slate-200"}`}
                onClick={() => setMiles(s)}
              >
                {s}mi
              </span>
            ))}
          </div>
        </div>

        {/* Quick-select */}
        <div className="flex flex-wrap gap-2">
          {[1, 3, 5, 10, 15].map((m) => (
            <button
              key={m}
              onClick={() => setMiles(m)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                miles === m
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-slate-700/50 border-slate-600/50 text-slate-300 hover:text-white hover:border-slate-500"
              }`}
            >
              {m} mile{m !== 1 ? "s" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading progress ───────────────────────────────────────── */}
      {loading && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-400 animate-bounce" />
              <span className="text-slate-300 text-sm">
                Sampling traffic across {miles}-mile radius…
              </span>
            </div>
            <span className="text-slate-400 text-xs">{elapsed}s / ~{estSecs}s</span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-slate-500 text-[10px]">
            Querying {Math.round(90 * Math.min(1, miles / 3))}+ road segments via TomTom Traffic Flow API
          </p>
          {/* Show stale data dimmed while loading */}
          {data && data.milesRadius !== miles && (
            <p className="text-slate-500 text-[10px]">Showing {data.milesRadius}-mile data while {miles}-mile loads…</p>
          )}
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-red-300 text-sm font-semibold">Traffic data unavailable</p>
              <p className="text-slate-400 text-xs mt-1 break-words">{error}</p>
            </div>
          </div>
          <button
            onClick={() => doFetch(miles)}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl py-2 text-slate-300 text-xs font-semibold transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* ── No coordinates ──────────────────────────────────────────── */}
      {!hasCoords && !loading && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6 text-center">
          <p className="text-slate-400 text-sm">Location coordinates required to sample traffic data.</p>
        </div>
      )}

      {/* ── Result ─────────────────────────────────────────────────── */}
      {data && !error && (
        <div className={`space-y-4 transition-opacity duration-300 ${loading && data.milesRadius !== miles ? "opacity-40" : "opacity-100"}`}>

          {/* Big number */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 border border-slate-700/50 rounded-2xl p-6 text-center">
            <div className="text-slate-300 text-xs uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
              <Car className="w-4 h-4" />
              Vehicles / Day within {data.milesRadius}-mile radius
            </div>
            <div
              className="text-5xl font-black mb-1"
              style={{
                background: "linear-gradient(135deg, #60a5fa 0%, #34d399 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {fmtNum(data.vehiclesPerDay)}
            </div>
            <div className="text-slate-400 text-xs">estimated vehicle passes per day</div>

            {/* Visual bar */}
            <div className="mt-4 h-2 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${barColour(pct)} transition-all duration-700`}
                style={{ width: `${Math.max(4, pct * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Low</span>
              <span>High density corridor</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
              <div className="text-white font-bold text-lg">{fmtNum(data.avgRoadVehicles)}</div>
              <div className="text-slate-300 text-[10px]">Avg per road sampled</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
              <div className="text-white font-bold text-lg">{data.pointsSampled}</div>
              <div className="text-slate-300 text-[10px]">Road points sampled</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 text-center">
              <div className="text-white font-bold text-lg">
                {Math.round(data.vehiclesPerDay / 12).toLocaleString()}
              </div>
              <div className="text-slate-300 text-[10px]">Avg vehicles / hr (12h day)</div>
            </div>
          </div>

          {/* Car wash capture potential */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 font-bold text-sm">Car Wash Capture Potential</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Conservative", sublabel: "0.5% capture", rate: 0.005 },
                { label: "Typical",      sublabel: "1.0% capture", rate: 0.010 },
                { label: "Excellent",    sublabel: "2.0% capture", rate: 0.020 },
              ].map(({ label, sublabel, rate }) => (
                <div key={label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <div className="text-white font-bold text-sm">
                    {Math.round(data.vehiclesPerDay * rate).toLocaleString()}
                  </div>
                  <div className="text-emerald-400 text-[10px] font-semibold mt-0.5">{label}</div>
                  <div className="text-slate-500 text-[10px]">{sublabel}</div>
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-[10px] mt-3 leading-relaxed">
              Industry capture rate: % of passing vehicles that use a car wash on any given day.
              0.5% = low-visibility site; 1.0% = average; 2.0% = high-visibility corner with strong anchor tenants.
            </p>
          </div>

          {/* Data note */}
          <p className="text-slate-500 text-[10px] text-center leading-relaxed">{data.note}</p>
        </div>
      )}
    </div>
  );
}
