"use client";

import type { CensusData, ProximityData, TrafficSignals } from "@/lib/types";
import { DEMOGRAPHICS_BENCHMARKS, TRADE_AREA } from "@/lib/industryBenchmarks";
import { CheckCircle, XCircle, Users, Car, ShoppingBag, Building2 } from "lucide-react";

interface Props {
  census?: CensusData | null;
  proximity?: ProximityData | null;
  trafficSignals: TrafficSignals;
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({
  icon, label, value, sub, met, showMet = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  met?: boolean;
  showMet?: boolean;
}) {
  return (
    <div className={`bg-slate-800/50 border rounded-xl p-4 space-y-2 ${
      met === true  ? "border-emerald-500/30" :
      met === false ? "border-red-500/20" :
      "border-slate-700/40"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          {icon}
          <span className="text-xs uppercase tracking-widest font-semibold">{label}</span>
        </div>
        {showMet && met !== undefined && (
          met
            ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            : <XCircle    className="w-4 h-4 text-red-400    flex-shrink-0" />
        )}
      </div>
      <div className="text-white font-black text-xl leading-none">{value}</div>
      {sub && <div className="text-slate-400 text-xs leading-relaxed">{sub}</div>}
    </div>
  );
}

// ── Signal Row ─────────────────────────────────────────────────────────────────
function SignalRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-700/25 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="text-base w-5 text-center">{icon}</span>
        <span className="text-slate-300 text-sm">{label}</span>
      </div>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function ProxyBar({ label, value, target, max, format, source }: {
  label: string; value: number; target: number; max: number;
  format: (v: number) => string; source: string;
}) {
  const pct    = Math.min((value / max) * 100, 100);
  const tgtPct = Math.min((target / max) * 100, 100);
  const met    = value >= target;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-slate-300 text-xs font-medium">{label}</span>
        <span className={`text-xs font-bold ${met ? "text-emerald-300" : "text-red-300"}`}>
          {format(value)}
        </span>
      </div>
      <div className="relative h-2 bg-slate-700/50 rounded-full overflow-visible">
        <div
          className={`h-full rounded-full transition-all duration-700 ${met ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/40 rounded-full"
          style={{ left: `${tgtPct}%` }}
          title={`Target: ${format(target)}`}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>Target: {format(target)}</span>
        <span className="text-slate-600">{source}</span>
      </div>
    </div>
  );
}

export default function PsychographicPanel({ census, proximity, trafficSignals }: Props) {
  const county = census?.county;

  // Vehicle ownership proxy (key psychographic signal for car wash)
  const vehiclesPerHH    = county?.vehiclesPerHousehold ?? null;
  const noVehiclePct     = county?.noVehiclePct         ?? null;
  const workingPopPct    = county?.laborForceParticipation ?? null;
  const hhIncomePct      = county?.hhIncomeOver35kPct    ?? null;
  const avgHHSize        = county?.avgHouseholdSize      ?? null;

  // Cotenant and proximity signal from OSM
  const transitStops     = proximity?.transitStops   ?? 0;
  const retailAnchors    = proximity?.retailAnchors  ?? 0;
  const diningPlaces     = proximity?.diningPlaces   ?? 0;
  const cotenantScore    = proximity?.cotenantScore  ?? null;
  const amenityScore     = proximity?.amenityScore   ?? null;

  // Commercial density from Google Places (traffic signals)
  const totalAnchors = trafficSignals.nearbyGasStations + trafficSignals.nearbyGroceryStores +
                       trafficSignals.nearbyFastFood    + trafficSignals.nearbyShopping;

  const hasData = !!county || proximity?.status === "live";

  return (
    <div className="space-y-6">
      {/* Source note */}
      <div className="flex items-start gap-2 bg-violet-500/8 border border-violet-500/20 rounded-xl px-3 py-2.5">
        <span className="text-violet-400 text-sm mt-0.5">🧠</span>
        <div>
          <p className="text-slate-300 text-xs leading-relaxed">
            <span className="text-violet-300 font-semibold">Consumer Behaviour Proxies</span>
            {" "}— derived from live US Census ACS data, Google Places commercial anchors, and OpenStreetMap
            proximity data. These signals approximate psychographic demand for professional car wash services
            without requiring enterprise psychographic APIs (Buxton/ESRI/Nielsen).
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              { label: "Census ACS", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
              { label: "Google Places", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
              { label: "OSM Overpass", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
            ].map(({ label, color }) => (
              <span key={label} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {!hasData && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Psychographic proxy data unavailable for this location.
          Ensure Census ACS API key is configured (US only).
        </div>
      )}

      {/* ── Vehicle Ownership (key demand signal) ──────────────────────────── */}
      {county && (
        <>
          <div>
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
              <Car className="w-3.5 h-3.5" />
              Vehicle Ownership Profile
              <span className="font-normal normal-case tracking-normal text-slate-500 text-[10px]">— Census ACS · {census?.countyName} County</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                icon={<Car className="w-3.5 h-3.5" />}
                label="Vehicles/HH"
                value={vehiclesPerHH != null ? vehiclesPerHH.toFixed(2) : "—"}
                sub={`Target ≥ ${DEMOGRAPHICS_BENCHMARKS.vehiclesPerHHTarget} (Buxton)`}
                met={vehiclesPerHH != null ? vehiclesPerHH >= DEMOGRAPHICS_BENCHMARKS.vehiclesPerHHTarget : undefined}
              />
              <MetricCard
                icon={<XCircle className="w-3.5 h-3.5" />}
                label="No Vehicle"
                value={noVehiclePct != null ? `${noVehiclePct.toFixed(1)}%` : "—"}
                sub={`Target < ${DEMOGRAPHICS_BENCHMARKS.noVehicleMaxPct}% HH`}
                met={noVehiclePct != null ? noVehiclePct < DEMOGRAPHICS_BENCHMARKS.noVehicleMaxPct : undefined}
              />
              <MetricCard
                icon={<Users className="w-3.5 h-3.5" />}
                label="Working Pop"
                value={workingPopPct != null ? `${workingPopPct.toFixed(1)}%` : "—"}
                sub={`Target ≥ ${DEMOGRAPHICS_BENCHMARKS.workingPopTargetPct}% (ICA)`}
                met={workingPopPct != null ? workingPopPct >= DEMOGRAPHICS_BENCHMARKS.workingPopTargetPct : undefined}
              />
              <MetricCard
                icon={<Users className="w-3.5 h-3.5" />}
                label="HH Size"
                value={avgHHSize != null ? avgHHSize.toFixed(2) : "—"}
                sub={`Target ≥ ${DEMOGRAPHICS_BENCHMARKS.hhSizeTarget} persons`}
                met={avgHHSize != null ? avgHHSize >= DEMOGRAPHICS_BENCHMARKS.hhSizeTarget : undefined}
              />
            </div>
          </div>

          {/* ── Income + demand proxy bars ──────────────────────────────────── */}
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-5 space-y-4">
            <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">
              Demand Proxy Indicators — County Level
            </div>
            {vehiclesPerHH != null && (
              <ProxyBar
                label="Vehicles per Household"
                value={vehiclesPerHH}
                target={DEMOGRAPHICS_BENCHMARKS.vehiclesPerHHTarget}
                max={3.5}
                format={(v) => v.toFixed(2)}
                source="Buxton · Census B08201"
              />
            )}
            {hhIncomePct != null && (
              <ProxyBar
                label="HH Income ≥ $35K (% of households)"
                value={hhIncomePct}
                target={DEMOGRAPHICS_BENCHMARKS.hhIncome35kExpressThresholdPct}
                max={90}
                format={(v) => `${v.toFixed(1)}%`}
                source="ICA Express · Census B19001"
              />
            )}
            {workingPopPct != null && (
              <ProxyBar
                label="Labor Force Participation (Working Pop %)"
                value={workingPopPct}
                target={DEMOGRAPHICS_BENCHMARKS.workingPopTargetPct}
                max={80}
                format={(v) => `${v.toFixed(1)}%`}
                source="ICA · Census B23025"
              />
            )}
          </div>
        </>
      )}

      {/* ── Cotenant & Proximity Signals ───────────────────────────────────── */}
      <div>
        <div className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
          <ShoppingBag className="w-3.5 h-3.5" />
          Commercial Cotenant & Proximity Signals
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Google Places anchors */}
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📍</span>
              <div>
                <div className="text-white text-sm font-bold">Google Places Anchors</div>
                <div className="text-slate-400 text-xs">Commercial density within search radius</div>
              </div>
            </div>
            <div className="space-y-0">
              <SignalRow icon="⛽" label="Gas Stations"    value={trafficSignals.nearbyGasStations.toString()}  color="text-blue-300" />
              <SignalRow icon="🛒" label="Grocery Stores"  value={trafficSignals.nearbyGroceryStores.toString()} color="text-emerald-300" />
              <SignalRow icon="🍔" label="Restaurants"     value={trafficSignals.nearbyFastFood.toString()}      color="text-amber-300" />
              <SignalRow icon="🏬" label="Shopping"        value={trafficSignals.nearbyShopping.toString()}      color="text-violet-300" />
              <SignalRow icon="🏫" label="Schools"         value={trafficSignals.nearbySchools.toString()}       color="text-slate-300" />
              <SignalRow icon="📊" label="Total Anchors"   value={totalAnchors.toString()}
                color={totalAnchors >= 15 ? "text-emerald-300" : totalAnchors >= 8 ? "text-amber-300" : "text-red-300"} />
            </div>
          </div>

          {/* OSM Proximity */}
          <div className={`bg-slate-800/40 border rounded-xl p-4 ${proximity?.status === "live" ? "border-slate-700/30" : "border-slate-700/20"}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🗺️</span>
              <div>
                <div className="text-white text-sm font-bold">OSM Proximity Data</div>
                <div className="text-slate-400 text-xs">
                  {proximity?.status === "live" ? "OpenStreetMap Overpass API · live" : "Unavailable"}
                </div>
              </div>
            </div>
            {proximity?.status === "live" ? (
              <div className="space-y-0">
                <SignalRow icon="🚌" label="Transit Stops"    value={transitStops.toString()}   color={transitStops > 0 ? "text-blue-300" : "text-slate-500"} />
                <SignalRow icon="🏪" label="Retail Anchors"   value={retailAnchors.toString()}  color={retailAnchors >= 3 ? "text-emerald-300" : retailAnchors > 0 ? "text-amber-300" : "text-slate-500"} />
                <SignalRow icon="🍽️" label="Dining Places"    value={diningPlaces.toString()}   color={diningPlaces >= 5 ? "text-emerald-300" : diningPlaces > 0 ? "text-amber-300" : "text-slate-500"} />
                <SignalRow icon="🅿️" label="Parking Areas"    value={(proximity.parkingAreas).toString()} color="text-slate-300" />
                <SignalRow icon="🏙️" label="Amenity Score"    value={`${amenityScore}/100`}
                  color={amenityScore != null && amenityScore >= 60 ? "text-emerald-300" : amenityScore != null && amenityScore >= 35 ? "text-amber-300" : "text-red-300"} />
                <SignalRow icon="🛍️" label="Cotenant Score"   value={`${cotenantScore}/100`}
                  color={cotenantScore != null && cotenantScore >= 60 ? "text-emerald-300" : cotenantScore != null && cotenantScore >= 30 ? "text-amber-300" : "text-red-300"} />
              </div>
            ) : (
              <div className="text-slate-500 text-xs text-center py-4">
                OSM proximity data unavailable at this location.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Trade Area context ──────────────────────────────────────────────── */}
      <div className="bg-slate-700/20 border border-slate-600/25 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-white text-sm font-bold mb-1">Industry Trade Area Standards</div>
            <div className="grid sm:grid-cols-3 gap-3 mt-2">
              {[
                { label: "Primary Zone", value: `${TRADE_AREA.primaryRadiusMiles}-mile radius`, sub: "Captures majority of express customers · ICA/Buxton" },
                { label: "Secondary Zone", value: `${TRADE_AREA.secondaryRadiusMiles}-mile radius`, sub: "Extended market reach · ICA/Buxton" },
                { label: "Drive-Time Zone", value: `${TRADE_AREA.driveTimeMinutes}-minute drive`, sub: "TomTom isochrone · live traffic" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-slate-800/40 border border-slate-700/30 rounded-lg p-3">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-0.5">{label}</div>
                  <div className="text-white font-bold text-sm">{value}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5 leading-relaxed">{sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-slate-500 text-[10px]">
        Vehicle ownership, income, and labor force data: US Census Bureau ACS 5-Year Estimates 2024.
        Proximity: OpenStreetMap via Overpass API (overpass-api.de) — free, no key required.
        Commercial density: Google Places API (live). Trade area: ICA 2024 / Buxton Company methodology.
        {proximity?.fetchedAt && ` OSM fetched: ${new Date(proximity.fetchedAt).toLocaleString()}.`}
      </p>
    </div>
  );
}
