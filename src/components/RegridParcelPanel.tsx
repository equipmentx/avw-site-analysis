"use client";

import { useState } from "react";
import { FileText, User, Map, DollarSign, Tag, AlertCircle, CheckCircle, Home, TrendingUp, Droplets, AlertTriangle, History, Shield } from "lucide-react";
import type { RegridParcelData } from "@/lib/types";

interface OSMBuildingInfo {
  polygon:       Array<{ lat: number; lng: number }>;
  footprintSqFt: number | null;
  footprintSqM:  number | null;
  osmWayId:      number | null;
  buildingType:  string | null;
  status:        "live" | "unavailable";
  source:        string;
  fetchedAt:     string;
}

interface Props {
  parcel:       RegridParcelData;
  osmBuilding?: OSMBuildingInfo;
}

function fmt$(n: number | null | undefined): string {
  if (!n) return "Not on record";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "Not on record";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
}

const ZONING_CONTEXT: Record<string, string> = {
  "C-1": "Neighborhood Commercial — may restrict drive-through services; verify CUP required",
  "C-2": "General Commercial — usually permits car wash with conditional use permit",
  "C-3": "Highway Commercial / Arterial — most permissive for high-traffic car wash sites",
  "B-2": "General Business — verify car wash is a permitted or conditional use",
  "B-3": "Highway Business — typically permits car washes, gas stations, auto services",
  "HC":  "Highway Commercial — strong fit for express tunnel car wash",
  "GC":  "General Commercial — likely permits car wash with CUP",
  "NC":  "Neighborhood Commercial — may require variance for car wash tunnel",
  "I-1": "Light Industrial — car wash permitted in most jurisdictions",
  "MU":  "Mixed Use — verify auto service use is permitted",
};

function getZoningContext(code: string): string {
  const upper = code.toUpperCase();
  for (const [key, val] of Object.entries(ZONING_CONTEXT)) {
    if (upper.includes(key)) return val;
  }
  return "Contact the local planning department to confirm car wash is a permitted or conditional use under this zoning code.";
}

export default function RegridParcelPanel({ parcel, osmBuilding }: Props) {
  const [showHistory, setShowHistory] = useState(false);

  if (parcel.status === "unavailable") {
    const isNoRecord = parcel.source.includes("No parcel record") || parcel.source.includes("no parcel record");
    const isNonUS    = parcel.source.includes("outside the United States") || parcel.source.includes("US parcels only");
    const isNoKey    = parcel.source.includes("not configured");

    return (
      <div className="space-y-3">
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isNoRecord ? "text-amber-400" : "text-slate-400"}`} />
          <div>
            <p className="text-slate-300 text-sm font-semibold">
              {isNoRecord ? "No parcel record found" : isNonUS ? "Outside ATTOM coverage area" : "Parcel data unavailable"}
            </p>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              {isNoRecord
                ? "No record found at this location in ATTOM's county assessor database. Try adjusting the pin to the centre of the target parcel."
                : isNonUS
                ? "ATTOM covers US parcels only (all 50 states + DC)."
                : parcel.source}
            </p>
            {isNoKey && (
              <p className="text-slate-400 text-xs mt-2">
                Add <code className="bg-slate-700 px-1 rounded text-slate-200">ATTOM_API_KEY</code> to{" "}
                <code className="bg-slate-700 px-1 rounded text-slate-200">.env.local</code>.
              </p>
            )}
          </div>
        </div>
        {osmBuilding?.status === "live" && osmBuilding.footprintSqFt && (
          <OSMFootprintCard osm={osmBuilding} />
        )}
      </div>
    );
  }

  const hasLandValue = !!(parcel.assessedLandUSD || parcel.lastSalePrice || parcel.parcelMarketValueUSD);
  const hasAVM       = !!(parcel.avmEstimateUSD);
  const hasBuilding  = !!(parcel.buildingSqFt || parcel.yearBuilt || parcel.buildingCondition);
  const hasDueDil    = !!(parcel.activeLienCount || parcel.hasForeclosure || parcel.hasNOD);
  const hasUtilities = !!(parcel.sewerType || parcel.waterType);
  const saleHistItems = parcel.saleHistory ?? [];

  // Utility flags for car wash feasibility
  const sewerOk = parcel.sewerType?.toLowerCase().includes("municipal") || parcel.sewerType?.toLowerCase().includes("public");
  const waterOk = parcel.waterType?.toLowerCase().includes("municipal") || parcel.waterType?.toLowerCase().includes("public");

  return (
    <div className="space-y-4">

      {/* ── Live badge ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1 text-xs text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live ATTOM · County Assessor Record
        </div>
        <span className="text-slate-400 text-xs">fetched {new Date(parcel.fetchedAt).toLocaleTimeString()}</span>
        {parcel.parcelNumber && <span className="text-slate-400 text-xs font-mono">APN: {parcel.parcelNumber}</span>}
        {parcel.attomId      && <span className="text-slate-500 text-[10px] font-mono">ATTOM: {parcel.attomId}</span>}
      </div>

      {/* ── Flags row — corner lot, absentee, foreclosure ───────────── */}
      {(parcel.cornerLot || parcel.absenteeOwner || parcel.hasForeclosure || parcel.hasNOD || parcel.corporateOwner) && (
        <div className="flex flex-wrap gap-2">
          {parcel.cornerLot && (
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full">
              ⭐ Corner Lot
            </span>
          )}
          {parcel.absenteeOwner === true && (
            <span className="bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">
              🏚 Absentee Owner
            </span>
          )}
          {parcel.absenteeOwner === false && (
            <span className="bg-slate-700/30 border border-slate-600/30 text-slate-400 text-xs px-2.5 py-1 rounded-full">
              Owner-Occupied
            </span>
          )}
          {parcel.corporateOwner && (
            <span className="bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs px-2.5 py-1 rounded-full">
              🏢 Corporate Owner
            </span>
          )}
          {parcel.hasForeclosure && (
            <span className="bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-bold px-2.5 py-1 rounded-full">
              ⚠ Active Foreclosure
            </span>
          )}
          {parcel.hasNOD && !parcel.hasForeclosure && (
            <span className="bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-bold px-2.5 py-1 rounded-full">
              ⚠ Notice of Default Filed
            </span>
          )}
        </div>
      )}

      {/* ── Existing structure warning ───────────────────────────────── */}
      {parcel.assessedImprovementUSD && parcel.assessedImprovementUSD > 0 && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-sm font-bold">Existing Structure Detected</p>
            <p className="text-amber-200/80 text-xs mt-1 leading-relaxed">
              Assessor records <span className="font-semibold">{fmt$(parcel.assessedImprovementUSD)}</span> in improvements
              {parcel.yearBuilt ? ` (built ${parcel.yearBuilt}${parcel.yearBuiltEffective && parcel.yearBuiltEffective !== parcel.yearBuilt ? `, renovated ${parcel.yearBuiltEffective}` : ""})` : ""}.
              {parcel.buildingSqFt ? ` Building footprint: ${parcel.buildingSqFt.toLocaleString()} sq ft.` : ""}
              {" "}Factor demolition, hazmat survey, and site clearing costs into your pro forma.
            </p>
          </div>
        </div>
      )}

      {/* ── Utilities — CRITICAL for car wash ───────────────────────── */}
      {hasUtilities && (
        <div className={`border rounded-2xl p-5 ${sewerOk && waterOk ? "bg-emerald-500/8 border-emerald-500/25" : "bg-amber-500/8 border-amber-500/25"}`}>
          <div className="flex items-center gap-2 mb-3">
            <Droplets className={`w-4 h-4 ${sewerOk && waterOk ? "text-emerald-400" : "text-amber-400"}`} />
            <h3 className="text-white font-bold text-sm">Utilities — Car Wash Critical</h3>
            <span className={`text-xs rounded-full px-2 py-0.5 border font-semibold ${sewerOk && waterOk ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-amber-500/15 text-amber-300 border-amber-500/25"}`}>
              {sewerOk && waterOk ? "✓ Both utilities municipal" : "⚠ Verify before proceeding"}
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {parcel.sewerType && (
              <div className={`rounded-xl p-3 border ${sewerOk ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <div className="text-slate-300 text-[10px] mb-1 font-semibold uppercase tracking-wider">Sewer</div>
                <div className={`font-bold text-sm ${sewerOk ? "text-emerald-300" : "text-red-300"}`}>{parcel.sewerType}</div>
                <div className="text-slate-400 text-[10px] mt-1">
                  {sewerOk
                    ? "✓ Municipal sewer required for car wash wastewater compliance"
                    : "⚠ Car wash requires municipal sewer — private septic is not code-compliant for commercial wastewater"}
                </div>
              </div>
            )}
            {parcel.waterType && (
              <div className={`rounded-xl p-3 border ${waterOk ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <div className="text-slate-300 text-[10px] mb-1 font-semibold uppercase tracking-wider">Water Supply</div>
                <div className={`font-bold text-sm ${waterOk ? "text-emerald-300" : "text-red-300"}`}>{parcel.waterType}</div>
                <div className="text-slate-400 text-[10px] mt-1">
                  {waterOk
                    ? "✓ Municipal water supply needed for car wash volume (100–150 gal/car)"
                    : "⚠ Car wash needs municipal supply — well capacity may be insufficient for high-volume operations"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Ownership ───────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-blue-400" />
            <span className="text-slate-200 text-xs font-bold uppercase tracking-wider">Ownership</span>
          </div>
          <div className="text-white font-bold text-sm">{parcel.owner || "Not on record"}</div>
          {parcel.owner2 && <div className="text-slate-300 text-xs mt-0.5">+ {parcel.owner2}</div>}
          {parcel.ownerMailingAddress && (
            <div className="text-slate-300 text-xs mt-1 leading-relaxed">{parcel.ownerMailingAddress}</div>
          )}
          {parcel.annualTaxUSD && (
            <div className="mt-2 text-xs">
              Annual tax <span className="text-white font-semibold">{fmt$(parcel.annualTaxUSD)}</span>
              {parcel.taxYear ? <span className="text-slate-500 ml-1">({parcel.taxYear})</span> : null}
              {parcel.taxExemption ? <span className="text-slate-400 ml-1">· {parcel.taxExemption} exempt</span> : null}
            </div>
          )}
          <p className="text-slate-400 text-[10px] mt-2">
            {parcel.absenteeOwner === true
              ? "Absentee owner — not occupying the property. Often more motivated to sell at market price."
              : parcel.absenteeOwner === false
              ? "Owner-occupied. Expect higher emotional attachment and potentially longer negotiation."
              : "Check for LLC ownership — many commercial sites are held in holding companies."}
          </p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Map className="w-4 h-4 text-purple-400" />
            <span className="text-slate-200 text-xs font-bold uppercase tracking-wider">Parcel Address</span>
          </div>
          <div className="text-white font-bold text-sm">{parcel.address || "Not listed"}</div>
          <div className="text-slate-300 text-xs mt-0.5">{[parcel.city, parcel.state, parcel.zip].filter(Boolean).join(", ")}</div>
          {parcel.landUse && (
            <div className="mt-2 inline-flex items-center gap-1 bg-slate-700/60 rounded-lg px-2 py-1">
              <span className="text-slate-300 text-[10px]">Current use:</span>
              <span className="text-white text-[10px] font-semibold">{parcel.landUse}</span>
            </div>
          )}
          {parcel.legalDesc && (
            <div className="mt-2 text-slate-400 text-[10px] leading-relaxed line-clamp-2" title={parcel.legalDesc}>
              {parcel.legalDesc}
            </div>
          )}
        </div>
      </div>

      {/* ── Lot Dimensions ──────────────────────────────────────────── */}
      {(parcel.lotSqFt || parcel.dimensions) && (
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/25 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-sm">Lot Dimensions</span>
            <span className="text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 rounded-full px-2 py-0.5">
              ATTOM assessor record
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {parcel.lotSqFt && (
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <div className="text-white font-black text-xl">{parcel.lotSqFt.toLocaleString()}</div>
                <div className="text-cyan-300 text-[10px] font-semibold">sq ft</div>
              </div>
            )}
            {parcel.lotAcres && (
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <div className="text-white font-black text-xl">{parcel.lotAcres}</div>
                <div className="text-cyan-300 text-[10px] font-semibold">acres</div>
              </div>
            )}
            {parcel.dimensions && (
              <>
                <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <div className="text-white font-black text-xl">{parcel.dimensions.widthFt.toLocaleString()}<span className="text-sm font-normal">ft</span></div>
                  <div className="text-cyan-300 text-[10px] font-semibold">road frontage (est.)</div>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                  <div className="text-white font-black text-xl">{parcel.dimensions.depthFt.toLocaleString()}<span className="text-sm font-normal">ft</span></div>
                  <div className="text-cyan-300 text-[10px] font-semibold">lot depth (est.)</div>
                </div>
              </>
            )}
          </div>
          {parcel.dimensions && (
            <p className="text-blue-300 text-xs mt-3 leading-relaxed bg-blue-500/8 border border-blue-500/20 rounded-xl p-3">
              <strong>These dimensions auto-populate the Lot Fit Checker.</strong>{" "}
              Frontage and depth from ATTOM assessor lot data. Actual buildable area may be smaller due to setbacks, easements, and utilities.
            </p>
          )}
        </div>
      )}

      {/* ── Building Details ─────────────────────────────────────────── */}
      {hasBuilding && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-4 h-4 text-orange-400" />
            <h3 className="text-white font-bold text-sm">Existing Structure</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {parcel.buildingSqFt && (
              <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{parcel.buildingSqFt.toLocaleString()}</div>
                <div className="text-orange-300 text-[10px]">building sq ft</div>
              </div>
            )}
            {parcel.yearBuilt && (
              <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{parcel.yearBuilt}</div>
                <div className="text-orange-300 text-[10px]">year built{parcel.yearBuiltEffective && parcel.yearBuiltEffective !== parcel.yearBuilt ? ` (ren. ${parcel.yearBuiltEffective})` : ""}</div>
              </div>
            )}
            {parcel.buildingStories && (
              <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{parcel.buildingStories}</div>
                <div className="text-orange-300 text-[10px]">stories</div>
              </div>
            )}
            {parcel.existingParkingSpaces && (
              <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                <div className="text-white font-bold text-lg">{parcel.existingParkingSpaces}</div>
                <div className="text-orange-300 text-[10px]">parking spaces</div>
              </div>
            )}
          </div>
          {(parcel.buildingCondition || parcel.buildingQuality) && (
            <div className="flex gap-3 mt-3">
              {parcel.buildingCondition && (
                <span className="bg-slate-700/50 text-slate-200 text-xs px-2.5 py-1 rounded-lg">
                  Condition: <strong>{parcel.buildingCondition}</strong>
                </span>
              )}
              {parcel.buildingQuality && (
                <span className="bg-slate-700/50 text-slate-200 text-xs px-2.5 py-1 rounded-lg">
                  Quality: <strong>{parcel.buildingQuality}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── OSM Building Footprint ──────────────────────────────────── */}
      {osmBuilding?.status === "live" && osmBuilding.footprintSqFt && (
        <OSMFootprintCard osm={osmBuilding} />
      )}

      {/* ── Land Valuation ──────────────────────────────────────────── */}
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h3 className="text-white font-bold text-sm">Land Valuation (County Assessor)</h3>
        </div>
        {hasLandValue ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 rounded-xl p-3">
              <div className="text-slate-300 text-[10px] mb-1">Last Sale Price</div>
              <div className="text-white font-bold text-base">{fmt$(parcel.lastSalePrice)}</div>
              {parcel.lastSaleDate && <div className="text-slate-400 text-[10px] mt-0.5">{fmtDate(parcel.lastSaleDate)}</div>}
              {parcel.saleTransactionType && <div className="text-slate-500 text-[10px] mt-0.5">{parcel.saleTransactionType}</div>}
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3">
              <div className="text-slate-300 text-[10px] mb-1">Assessed Land Value</div>
              <div className="text-white font-bold text-base">{fmt$(parcel.assessedLandUSD)}</div>
              <div className="text-slate-400 text-[10px] mt-0.5">Land only, excl. buildings</div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3">
              <div className="text-slate-300 text-[10px] mb-1">Assessed Total</div>
              <div className="text-white font-bold text-base">{fmt$(parcel.assessedTotalUSD)}</div>
              <div className="text-slate-400 text-[10px] mt-0.5">Land + improvements</div>
            </div>
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
              <div className="text-emerald-300 text-[10px] mb-1">Market Value (Assessor)</div>
              <div className="text-white font-bold text-base">{fmt$(parcel.parcelMarketValueUSD)}</div>
              <div className="text-slate-400 text-[10px] mt-0.5">Used in investment range</div>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Valuation not on record for this parcel.</p>
        )}
        <p className="text-slate-400 text-[10px] mt-3 leading-relaxed">
          Assessors typically value at 80–90% of market. Acquisition price is usually 10–25% above assessed value.
          The Suggested Investment Range section anchors land cost to the most accurate figure above (last sale preferred).
        </p>
      </div>

      {/* ── AVM ─────────────────────────────────────────────────────── */}
      {hasAVM && (
        <div className="bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/25 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <h3 className="text-white font-bold text-sm">Automated Valuation (AVM)</h3>
            <span className="text-xs bg-violet-500/15 text-violet-300 border border-violet-500/20 rounded-full px-2 py-0.5">ATTOM live</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {parcel.avmLowUSD && (
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <div className="text-slate-400 text-[10px] mb-1">Low</div>
                <div className="text-white font-bold text-base">{fmt$(parcel.avmLowUSD)}</div>
              </div>
            )}
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-center">
              <div className="text-violet-300 text-[10px] mb-1 font-semibold">AVM Estimate</div>
              <div className="text-white font-black text-xl">{fmt$(parcel.avmEstimateUSD)}</div>
            </div>
            {parcel.avmHighUSD && (
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <div className="text-slate-400 text-[10px] mb-1">High</div>
                <div className="text-white font-bold text-base">{fmt$(parcel.avmHighUSD)}</div>
              </div>
            )}
          </div>
          <p className="text-slate-400 text-[10px] mt-3">
            {parcel.avmDate && `Computed ${fmtDate(parcel.avmDate)}. `}
            {parcel.avmFSD != null && `Forecast Std Deviation: ${parcel.avmFSD.toFixed(2)} (lower = more confident). `}
            Automated estimate — not a certified appraisal. Verify with a licensed commercial appraiser.
          </p>
        </div>
      )}

      {/* ── Sale History ─────────────────────────────────────────────── */}
      {saleHistItems.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
          <button
            className="flex items-center gap-2 w-full text-left"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-bold text-sm flex-1">
              Transaction History ({saleHistItems.length} records)
            </h3>
            <span className="text-slate-400 text-xs">{showHistory ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {showHistory && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700/30">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-700/40 border-b border-slate-600/30">
                    <th className="py-2 px-3 text-left text-slate-400 font-semibold">Date</th>
                    <th className="py-2 px-3 text-right text-slate-400 font-semibold">Price</th>
                    <th className="py-2 px-3 text-left text-slate-400 font-semibold">Type</th>
                    <th className="py-2 px-3 text-left text-slate-400 font-semibold">$/sq ft</th>
                  </tr>
                </thead>
                <tbody>
                  {saleHistItems.map((s, i) => (
                    <tr key={i} className="border-b border-slate-700/20 hover:bg-slate-700/10">
                      <td className="py-2 px-3 text-slate-300">{fmtDate(s.date)}</td>
                      <td className="py-2 px-3 text-right text-white font-semibold">{fmt$(s.price)}</td>
                      <td className="py-2 px-3 text-slate-400">{s.transType ?? "—"}</td>
                      <td className="py-2 px-3 text-slate-400">{s.pricePerSqFt ? `$${s.pricePerSqFt}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!showHistory && (
            <p className="text-slate-400 text-[10px] mt-2">
              Most recent: {fmt$(saleHistItems[0]?.price)} on {fmtDate(saleHistItems[0]?.date)}.
              Expand to see price trend and buyer/seller type.
            </p>
          )}
        </div>
      )}

      {/* ── Due Diligence — Liens & Encumbrances ─────────────────────── */}
      {(hasDueDil || (parcel.lienTypes ?? []).length > 0) && (
        <div className={`border rounded-2xl p-5 ${hasDueDil ? "bg-red-500/8 border-red-500/25" : "bg-slate-800/40 border-slate-700/30"}`}>
          <div className="flex items-center gap-2 mb-3">
            <Shield className={`w-4 h-4 ${hasDueDil ? "text-red-400" : "text-slate-400"}`} />
            <h3 className="text-white font-bold text-sm">Due Diligence — Title & Encumbrances</h3>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mb-3">
            <div className={`rounded-xl p-3 text-center border ${(parcel.activeLienCount ?? 0) > 0 ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/8 border-emerald-500/20"}`}>
              <div className={`font-black text-2xl ${(parcel.activeLienCount ?? 0) > 0 ? "text-red-300" : "text-emerald-300"}`}>
                {parcel.activeLienCount ?? 0}
              </div>
              <div className="text-slate-300 text-[10px] mt-0.5">Active liens</div>
            </div>
            <div className={`rounded-xl p-3 text-center border ${parcel.hasForeclosure ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/8 border-emerald-500/20"}`}>
              <div className={`font-black text-sm ${parcel.hasForeclosure ? "text-red-300" : "text-emerald-300"}`}>
                {parcel.hasForeclosure ? "Yes ⚠" : "No ✓"}
              </div>
              <div className="text-slate-300 text-[10px] mt-0.5">Foreclosure</div>
            </div>
            <div className={`rounded-xl p-3 text-center border ${parcel.hasNOD ? "bg-orange-500/10 border-orange-500/20" : "bg-emerald-500/8 border-emerald-500/20"}`}>
              <div className={`font-black text-sm ${parcel.hasNOD ? "text-orange-300" : "text-emerald-300"}`}>
                {parcel.hasNOD ? "Yes ⚠" : "No ✓"}
              </div>
              <div className="text-slate-300 text-[10px] mt-0.5">Notice of Default</div>
            </div>
          </div>
          {(parcel.lienTypes ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {(parcel.lienTypes ?? []).map((t) => (
                <span key={t} className="bg-red-500/15 border border-red-500/25 text-red-300 text-[10px] px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          )}
          {parcel.openMortgageAmount && (
            <p className="text-slate-300 text-xs">
              Open mortgage balance: <span className="text-white font-semibold">{fmt$(parcel.openMortgageAmount)}</span>
            </p>
          )}
          <p className="text-slate-400 text-[10px] mt-2 leading-relaxed">
            Lien data from ATTOM allevents records. Always commission a full title search before closing.
            {hasDueDil ? " Active liens or foreclosure must be cleared at or before settlement." : ""}
          </p>
        </div>
      )}

      {/* ── Zoning ──────────────────────────────────────────────────── */}
      {parcel.zoning && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-yellow-400" />
            <h3 className="text-white font-bold text-sm">Zoning</h3>
          </div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 font-black text-lg px-3 py-1 rounded-xl">
              {parcel.zoning}
            </span>
            {parcel.zoningDescription && (
              <span className="text-slate-200 text-sm">{parcel.zoningDescription}</span>
            )}
          </div>
          <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-3">
            <p className="text-yellow-200 text-xs leading-relaxed">{getZoningContext(parcel.zoning)}</p>
          </div>
          <p className="text-slate-400 text-[10px] mt-3">
            Always verify car wash is permitted with the local planning office before purchase.
            Most jurisdictions require a CUP for drive-through vehicle service businesses.
          </p>
        </div>
      )}

      {/* ── Quick Feasibility Check ──────────────────────────────────── */}
      {parcel.dimensions && parcel.lotSqFt && (
        <div className="bg-slate-800/30 border border-slate-700/20 rounded-xl p-4">
          <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Quick Feasibility Check
          </h4>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            {[
              { label: "Express Tunnel",  pass: parcel.lotSqFt >= 30_625, note: "~30,625 sq ft min (245×125ft)" },
              { label: "In-Bay Automatic",pass: parcel.lotSqFt >= 4_800,  note: "~2,400 sq ft min (30×80ft)" },
              { label: "Self-Serve Bays", pass: parcel.lotSqFt >= 7_000,  note: "~7,000 sq ft min (4 bays)" },
            ].map(({ label, pass, note }) => (
              <div key={label} className={`rounded-xl p-3 border ${pass ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                <div className={`font-bold mb-0.5 ${pass ? "text-emerald-300" : "text-red-300"}`}>
                  {pass ? "✓" : "✗"} {label}
                </div>
                <div className="text-slate-300">{note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Source note ─────────────────────────────────────────────── */}
      <p className="text-slate-500 text-[10px] leading-relaxed">{parcel.source}</p>
    </div>
  );
}

// ── OSM Building Footprint card ───────────────────────────────────────────────
function OSMFootprintCard({ osm }: { osm: OSMBuildingInfo }) {
  return (
    <div className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/25 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Home className="w-4 h-4 text-teal-400" />
        <span className="text-white font-bold text-sm">Building Footprint</span>
        <span className="text-xs bg-teal-500/15 text-teal-300 border border-teal-500/20 rounded-full px-2 py-0.5">OpenStreetMap · live</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {osm.footprintSqFt && (
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-white font-black text-xl">{osm.footprintSqFt.toLocaleString()}</div>
            <div className="text-teal-300 text-[10px] font-semibold">building sq ft</div>
          </div>
        )}
        {osm.footprintSqM && (
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-white font-black text-xl">{osm.footprintSqM.toLocaleString()}</div>
            <div className="text-teal-300 text-[10px] font-semibold">m²</div>
          </div>
        )}
        {osm.buildingType && osm.buildingType !== "yes" && (
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-sm capitalize">{osm.buildingType}</div>
            <div className="text-teal-300 text-[10px] font-semibold">type</div>
          </div>
        )}
        {osm.osmWayId && (
          <div className="bg-slate-800/60 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-sm">{osm.polygon.length}</div>
            <div className="text-teal-300 text-[10px] font-semibold">polygon nodes</div>
          </div>
        )}
      </div>
      <p className="text-slate-400 text-[10px] mt-3 leading-relaxed">
        OSM building polygon · Area via Shoelace formula · Verify with site visit
        {osm.osmWayId ? ` · Way ${osm.osmWayId}` : ""}.
      </p>
    </div>
  );
}
