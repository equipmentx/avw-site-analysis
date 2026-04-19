"use client";

import { useState } from "react";
import { AlertTriangle, Zap, Navigation, Clock, Shield, Car } from "lucide-react";
import type { TomTomSiteData } from "@/lib/types";

interface TomTomPanelProps {
  data: TomTomSiteData;
}

// ── Congestion styling ────────────────────────────────────────────────────────
const CONGESTION_STYLES = {
  FREE_FLOW: { label: "Free Flow",   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", bar: "#10b981" },
  LIGHT:     { label: "Light",       color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    bar: "#3b82f6" },
  MODERATE:  { label: "Moderate",    color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20",  bar: "#f59e0b" },
  HEAVY:     { label: "Heavy",       color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20",     bar: "#ef4444" },
};

const RISK_STYLES = {
  LOW:    { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "✅" },
  MEDIUM: { color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20",  icon: "⚠️" },
  HIGH:   { color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20",     icon: "🚨" },
};

const INCIDENT_TYPE_EMOJI: Record<string, string> = {
  "Accident":             "💥",
  "Road Closed":          "🚫",
  "Lane Closed":          "🔒",
  "Roadworks":            "🚧",
  "Congestion":           "🚗",
  "Fog":                  "🌫️",
  "Flooding":             "🌊",
  "Hazard":               "⚠️",
  "Broken Down Vehicle":  "🔧",
  "Wind":                 "💨",
  "Ice":                  "🧊",
  "Rain":                 "🌧️",
  "Unknown":              "❓",
};

// ── FRC road class suitability for car wash ────────────────────────────────
const FRC_SUITABILITY: Record<string, { label: string; score: string; color: string }> = {
  FRC0: { label: "Motorway",   score: "Poor — Too fast for impulse stops",  color: "text-red-400" },
  FRC1: { label: "National",   score: "Good — High-volume arterial",         color: "text-emerald-400" },
  FRC2: { label: "Regional",   score: "Excellent — Prime car wash road",     color: "text-emerald-400" },
  FRC3: { label: "Secondary",  score: "Good — Solid local arterial",         color: "text-blue-400" },
  FRC4: { label: "Connecting", score: "Moderate — Lower traffic volume",     color: "text-yellow-400" },
  FRC5: { label: "Local",      score: "Low — Limited passing traffic",       color: "text-orange-400" },
  FRC6: { label: "Minor",      score: "Poor — Insufficient traffic volume",  color: "text-red-400" },
  FRC7: { label: "Track",      score: "Very Poor — Unsuitable road type",    color: "text-red-400" },
};

export default function TomTomPanel({ data }: TomTomPanelProps) {
  const [activeIsochrone, setActiveIsochrone] = useState<5 | 10 | 15>(10);

  const { trafficFlow, isochrones, incidents } = data;
  const congestionStyle = CONGESTION_STYLES[trafficFlow.congestionLevel] ?? CONGESTION_STYLES.FREE_FLOW;
  const riskStyle       = RISK_STYLES[incidents.accessRiskLevel];
  const frcSuitability  = FRC_SUITABILITY[trafficFlow.roadClass];

  const activeIso =
    activeIsochrone === 5  ? isochrones.fiveMin :
    activeIsochrone === 10 ? isochrones.tenMin  :
                             isochrones.fifteenMin;

  const speedPct = trafficFlow.freeFlowSpeedKmh > 0
    ? Math.round((trafficFlow.currentSpeedKmh / trafficFlow.freeFlowSpeedKmh) * 100)
    : 100;

  const { vehicleCount } = trafficFlow;

  return (
    <div className="space-y-5">

      {/* Live badge */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1 text-xs text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live TomTom data
        </div>
        <span className="text-slate-300 text-xs">
          fetched {new Date(data.fetchedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* ── Vehicle Count — primary hero metric ─────────────────────────── */}
      {trafficFlow.status === "live" && (
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/25 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <Car className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <span className="text-white font-bold text-sm">Vehicles Passing This Location</span>
              <span className="ml-2 text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/20 rounded-full px-2 py-0.5">
                TomTom live · BPR/HCM methodology
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-black text-white tabular-nums">
                {vehicleCount.vehiclesPerHour > 0
                  ? vehicleCount.vehiclesPerHour.toLocaleString()
                  : "—"}
              </div>
              <div className="text-blue-300 text-xs font-semibold mt-0.5">vehicles/hour</div>
              <div className="text-slate-300 text-[10px] mt-0.5">current flow</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white tabular-nums">
                {vehicleCount.vehiclesPerDay > 0
                  ? vehicleCount.vehiclesPerDay.toLocaleString()
                  : "—"}
              </div>
              <div className="text-purple-300 text-xs font-semibold mt-0.5">vehicles/day</div>
              <div className="text-slate-300 text-[10px] mt-0.5">AADT estimate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white tabular-nums">
                {vehicleCount.vcRatio > 0
                  ? `${Math.round(vehicleCount.vcRatio * 100)}%`
                  : "—"}
              </div>
              <div className="text-yellow-300 text-xs font-semibold mt-0.5">v/c ratio</div>
              <div className="text-slate-300 text-[10px] mt-0.5">capacity used</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black text-white tabular-nums">
                {vehicleCount.roadCapacityPerHour > 0
                  ? `${(vehicleCount.roadCapacityPerHour / 1000).toFixed(0)}K`
                  : "—"}
              </div>
              <div className="text-emerald-300 text-xs font-semibold mt-0.5">road capacity</div>
              <div className="text-slate-300 text-[10px] mt-0.5">veh/hr (HCM)</div>
            </div>
          </div>

          {/* Car wash suitability callout */}
          {vehicleCount.vehiclesPerDay > 0 && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-xs leading-relaxed border ${
              vehicleCount.vehiclesPerDay >= 15_000
                ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
                : vehicleCount.vehiclesPerDay >= 8_000
                ? "bg-blue-500/8 border-blue-500/20 text-blue-300"
                : vehicleCount.vehiclesPerDay >= 4_000
                ? "bg-yellow-500/8 border-yellow-500/20 text-yellow-300"
                : "bg-red-500/8 border-red-500/20 text-red-300"
            }`}>
              <strong>Car wash viability:</strong>{" "}
              {vehicleCount.vehiclesPerDay >= 15_000
                ? `${vehicleCount.vehiclesPerDay.toLocaleString()} vehicles/day is strong. Industry benchmark for a profitable express tunnel is 15,000+ veh/day. This site passes.`
                : vehicleCount.vehiclesPerDay >= 8_000
                ? `${vehicleCount.vehiclesPerDay.toLocaleString()} vehicles/day is acceptable. A profitable car wash typically needs 15,000+ veh/day; this site may work with strong membership sales.`
                : vehicleCount.vehiclesPerDay >= 4_000
                ? `${vehicleCount.vehiclesPerDay.toLocaleString()} vehicles/day is below the 15,000 veh/day benchmark. A self-serve or in-bay format may be more suitable than a full tunnel.`
                : `${vehicleCount.vehiclesPerDay.toLocaleString()} vehicles/day is low. Car wash sites typically require 8,000–15,000+ veh/day minimum for viable operations.`}
            </div>
          )}

          <div className="mt-3 text-slate-300 text-[10px] leading-relaxed">
            {vehicleCount.methodology}
          </div>
        </div>
      )}

      {/* ── Four headline metric cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Road Classification */}
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Navigation className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-slate-200 text-xs font-semibold uppercase tracking-wider">Road Class</span>
          </div>
          {trafficFlow.status === "live" ? (
            <>
              <div className="text-white font-bold text-base leading-tight mb-1">
                {trafficFlow.roadClassLabel}
              </div>
              {frcSuitability && (
                <div className={`text-xs mt-1 leading-relaxed ${frcSuitability.color}`}>
                  {frcSuitability.score}
                </div>
              )}
              <div className="text-slate-300 text-[10px] mt-2">{trafficFlow.roadClass}</div>
            </>
          ) : (
            <div className="text-slate-300 text-sm">Data unavailable</div>
          )}
        </div>

        {/* Traffic Flow */}
        <div className={`border rounded-2xl p-4 ${congestionStyle.bg} ${congestionStyle.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-slate-700/50 rounded-xl flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-400" />
            </div>
            <span className="text-slate-200 text-xs font-semibold uppercase tracking-wider">Traffic Flow</span>
          </div>
          {trafficFlow.status === "live" ? (
            <>
              <div className={`font-bold text-base mb-1 ${congestionStyle.color}`}>
                {congestionStyle.label}
              </div>
              <div className="text-white text-sm font-semibold">
                {trafficFlow.currentSpeedKmh} km/h
                <span className="text-slate-300 text-xs font-normal ml-1">
                  / {trafficFlow.freeFlowSpeedKmh} km/h free flow
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(speedPct, 100)}%`, backgroundColor: congestionStyle.bar }}
                />
              </div>
              <div className="text-slate-300 text-[10px] mt-1">{speedPct}% of free-flow speed</div>
            </>
          ) : (
            <div className="text-slate-300 text-sm">Data unavailable</div>
          )}
        </div>

        {/* Access Risk */}
        <div className={`border rounded-2xl p-4 ${riskStyle.bg} ${riskStyle.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-slate-700/50 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-slate-400" />
            </div>
            <span className="text-slate-200 text-xs font-semibold uppercase tracking-wider">Access Risk</span>
          </div>
          <div className={`font-bold text-base mb-1 ${riskStyle.color}`}>
            {riskStyle.icon} {incidents.accessRiskLevel}
          </div>
          <div className="text-slate-200 text-xs leading-relaxed">
            {incidents.accessRiskReason}
          </div>
          {incidents.totalCount > 0 && (
            <div className="text-slate-300 text-[10px] mt-2">
              {incidents.closureCount} closure{incidents.closureCount !== 1 ? "s" : ""} ·{" "}
              {incidents.roadworksCount} roadwork{incidents.roadworksCount !== 1 ? "s" : ""} ·{" "}
              {incidents.totalCount} total
            </div>
          )}
        </div>
      </div>

      {/* ── Drive-Time Trade Area (Isochrone) ───────────────────────────── */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-purple-400" />
          <h3 className="text-white font-bold text-sm">Drive-Time Trade Area</h3>
        </div>
        <p className="text-slate-300 text-xs mb-4 leading-relaxed">
          The area customers can realistically drive to reach your site. Industry rule: a car wash
          captures most of its revenue from within a 5–10 minute drive.
        </p>

        {/* Isochrone selector */}
        <div className="flex gap-2 mb-4">
          {([5, 10, 15] as const).map((min) => {
            const iso = min === 5 ? isochrones.fiveMin : min === 10 ? isochrones.tenMin : isochrones.fifteenMin;
            return (
              <button
                key={min}
                onClick={() => setActiveIsochrone(min)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  activeIsochrone === min
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-slate-700/30 border-slate-700/40 text-slate-500 hover:text-slate-300"
                }`}
              >
                {min} min
                {iso.status === "live" && (
                  <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                    {iso.boundaryPoints} points
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeIso.status === "live" ? (
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-purple-300 font-bold text-2xl">
                  {activeIsochrone}-min
                  <span className="text-slate-400 text-sm font-normal ml-1">drive-time boundary</span>
                </div>
                <div className="text-slate-300 text-xs mt-1">
                  {activeIso.boundaryPoints} boundary coordinates computed with live traffic
                </div>
              </div>
              <div className="text-right">
                <div className="text-slate-300 text-xs">What this means</div>
                <div className="text-white text-xs font-semibold mt-0.5 max-w-[200px] leading-relaxed">
                  {activeIsochrone === 5
                    ? "Primary trade area — highest repeat visit frequency"
                    : activeIsochrone === 10
                    ? "Core catchment — most revenue generated here"
                    : "Extended trade area — membership plan territory"}
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-purple-500/10 text-[10px] text-slate-400">
              {activeIso.source}
            </div>
          </div>
        ) : (
          <div className="bg-slate-700/20 border border-slate-700/30 rounded-xl p-4">
            <div className="text-slate-300 text-sm">{activeIso.source}</div>
          </div>
        )}
      </div>

      {/* ── Live Incidents ───────────────────────────────────────────────── */}
      {incidents.status === "live" && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h3 className="text-white font-bold text-sm">
              Live Incidents Near Site
            </h3>
            <span className="ml-auto text-slate-300 text-xs">{incidents.totalCount} found within 2km</span>
          </div>

          {incidents.incidents.length === 0 ? (
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
              <span className="text-2xl">✅</span>
              <div>
                <div className="text-emerald-300 font-semibold text-sm">No active incidents</div>
                <div className="text-slate-300 text-xs mt-0.5">
                  Roads near this site are clear at time of analysis.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.incidents.map((inc) => {
                const sev = inc.severity;
                const severityColor =
                  sev >= 3 ? "border-red-500/20 bg-red-500/5" :
                  sev >= 2 ? "border-yellow-500/20 bg-yellow-500/5" :
                             "border-slate-700/30 bg-slate-700/10";
                const severityText  =
                  sev >= 3 ? "text-red-400" : sev >= 2 ? "text-yellow-400" : "text-slate-400";

                return (
                  <div key={inc.id} className={`flex items-start gap-3 border rounded-xl p-3 ${severityColor}`}>
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {INCIDENT_TYPE_EMOJI[inc.type] ?? "❓"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white text-xs font-semibold">{inc.type}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800/60 ${severityText}`}>
                          {inc.severityLabel}
                        </span>
                        {inc.roadNumbers && inc.roadNumbers.length > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/25">
                            {inc.roadNumbers.join(" / ")}
                          </span>
                        )}
                      </div>
                      <div className="text-slate-200 text-xs mt-0.5 leading-relaxed line-clamp-2">
                        {inc.description}
                      </div>
                      {/* Road location: from / to segment names */}
                      {(inc.roadFrom || inc.roadTo) && (
                        <div className="text-slate-300 text-[10px] mt-1 flex items-center gap-1">
                          {inc.roadFrom && (
                            <span className="bg-slate-700/60 rounded px-1.5 py-0.5">
                              From: <span className="text-white font-medium">{inc.roadFrom}</span>
                            </span>
                          )}
                          {inc.roadFrom && inc.roadTo && <span className="text-slate-500">→</span>}
                          {inc.roadTo && (
                            <span className="bg-slate-700/60 rounded px-1.5 py-0.5">
                              To: <span className="text-white font-medium">{inc.roadTo}</span>
                            </span>
                          )}
                        </div>
                      )}
                      {(inc.startTime || inc.endTime) && (
                        <div className="text-slate-400 text-[10px] mt-1">
                          {inc.startTime ? `From: ${new Date(inc.startTime).toLocaleString()}` : ""}
                          {inc.endTime   ? ` · To: ${new Date(inc.endTime).toLocaleTimeString()}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-slate-400 text-[10px]">{incidents.source}</div>
        </div>
      )}

      {/* Car Wash Road Suitability Explainer */}
      {trafficFlow.status === "live" && (
        <div className="bg-slate-800/30 border border-slate-700/20 rounded-xl p-4">
          <p className="text-slate-300 text-[10px] leading-relaxed">
            <span className="text-slate-200 font-semibold">Car Wash Road Suitability:</span>{" "}
            The ideal car wash road is a <strong className="text-white">major regional arterial (FRC2–FRC3)</strong> with
            free-flowing traffic at 40–65 km/h, giving drivers enough time to notice and turn in.
            Motorways (FRC0) are too fast for impulse stops. Minor local roads (FRC5–7) lack the
            volume. Your site is on a <strong className="text-white">{trafficFlow.roadClassLabel}</strong> running
            at {trafficFlow.currentSpeedKmh} km/h.
          </p>
          <p className="text-slate-400 text-[10px] mt-2">{trafficFlow.source}</p>
        </div>
      )}
    </div>
  );
}
