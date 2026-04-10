"use client";

import { useState } from "react";
import { FileText, User, Map, DollarSign, Tag, AlertCircle, ExternalLink, CheckCircle } from "lucide-react";
import type { RegridParcelData } from "@/lib/types";

interface Props {
  parcel: RegridParcelData;
}

function fmt$(n: number | null | undefined): string {
  if (!n) return "Not on record";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "Not on record";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return d; }
}

const ZONING_CONTEXT: Record<string, string> = {
  "C-1": "Neighborhood Commercial — typically allows retail but may restrict drive-through services",
  "C-2": "General Commercial — usually permits car wash operations with conditional use permit",
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

export default function RegridParcelPanel({ parcel }: Props) {
  const [showRaw, setShowRaw] = useState(false);

  if (parcel.status === "unavailable") {
    return (
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-slate-300 text-sm font-semibold">Parcel data unavailable</p>
          <p className="text-slate-400 text-xs mt-1 leading-relaxed">{parcel.source}</p>
          {!parcel.source.includes("outside the United States") && (
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">
              Add <code className="bg-slate-700 px-1 rounded text-slate-200">REGRID_API_KEY</code> to{" "}
              <code className="bg-slate-700 px-1 rounded text-slate-200">.env.local</code> to enable parcel lookups.
              Get a key at <span className="text-blue-400">regrid.com</span>.
            </p>
          )}
        </div>
      </div>
    );
  }

  const hasLandValue = !!(parcel.assessedLandUSD || parcel.lastSalePrice || parcel.parcelMarketValueUSD);

  return (
    <div className="space-y-4">

      {/* ── Live badge ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1 text-xs text-emerald-400">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Regrid · County Assessor Record
        </div>
        <span className="text-slate-400 text-xs">fetched {new Date(parcel.fetchedAt).toLocaleTimeString()}</span>
        {parcel.parcelNumber && (
          <span className="text-slate-400 text-xs font-mono">APN: {parcel.parcelNumber}</span>
        )}
      </div>

      {/* ── Ownership & Address ─────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-blue-400" />
            <span className="text-slate-200 text-xs font-bold uppercase tracking-wider">Ownership</span>
          </div>
          <div className="text-white font-bold text-sm">{parcel.owner || "Not on record"}</div>
          {parcel.ownerMailingAddress && (
            <div className="text-slate-300 text-xs mt-1 leading-relaxed">{parcel.ownerMailingAddress}</div>
          )}
          <p className="text-slate-400 text-[10px] mt-2 leading-relaxed">
            Current owner of record per county assessor. Check for LLC ownership — many car wash sites are held in holding companies.
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
        </div>
      </div>

      {/* ── Lot Dimensions ─────────────────────────────────────────── */}
      {(parcel.lotSqFt || parcel.dimensions) && (
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/25 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span className="text-white font-bold text-sm">Lot Dimensions</span>
            <span className="text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/20 rounded-full px-2 py-0.5">
              from GIS parcel boundary
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
            <div className="mt-3 bg-blue-500/8 border border-blue-500/20 rounded-xl p-3">
              <p className="text-blue-300 text-xs leading-relaxed">
                <span className="font-semibold">These dimensions auto-populate the Lot Fit Checker above.</span>{" "}
                The bounding box of the parcel polygon gives a close approximation of usable frontage and depth.
                Actual buildable area may be smaller due to setbacks, easements, and utilities.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Land Valuation ─────────────────────────────────────────── */}
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
              {parcel.lastSaleDate && (
                <div className="text-slate-400 text-[10px] mt-0.5">{fmtDate(parcel.lastSaleDate)}</div>
              )}
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
          <p className="text-slate-400 text-sm">Valuation data not on record for this parcel.</p>
        )}

        <p className="text-slate-400 text-[10px] mt-3 leading-relaxed">
          County assessors typically value land at 80–90% of market value. Acquisition price will typically be 10–25% above assessed value depending on seller motivation and market conditions.
          The <span className="text-white">Suggested Investment Range</span> section uses the most accurate of these figures (last sale price preferred) to anchor the land cost line item.
        </p>
      </div>

      {/* ── Zoning ─────────────────────────────────────────────────── */}
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
            Always verify car wash is a permitted or conditional use with the local planning & zoning office before purchase.
            Many jurisdictions require a Conditional Use Permit (CUP) for drive-through vehicle service businesses.
          </p>
        </div>
      )}

      {/* ── Car Wash Feasibility ──────────────────────────────────── */}
      {parcel.dimensions && parcel.lotSqFt && (
        <div className="bg-slate-800/30 border border-slate-700/20 rounded-xl p-4">
          <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> Quick Feasibility Check
          </h4>
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className={`rounded-xl p-3 border ${parcel.lotSqFt >= 30_625 ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
              <div className={`font-bold mb-0.5 ${parcel.lotSqFt >= 30_625 ? "text-emerald-300" : "text-red-300"}`}>
                {parcel.lotSqFt >= 30_625 ? "✓ Express Tunnel" : "✗ Express Tunnel"}
              </div>
              <div className="text-slate-300">Needs ~30,625 sq ft min (245×125ft)</div>
            </div>
            <div className={`rounded-xl p-3 border ${parcel.lotSqFt >= 4_800 ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
              <div className={`font-bold mb-0.5 ${parcel.lotSqFt >= 4_800 ? "text-emerald-300" : "text-red-300"}`}>
                {parcel.lotSqFt >= 4_800 ? "✓ In-Bay Automatic" : "✗ In-Bay Automatic"}
              </div>
              <div className="text-slate-300">Needs ~2,400 sq ft min (30×80ft)</div>
            </div>
            <div className={`rounded-xl p-3 border ${parcel.lotSqFt >= 7_000 ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
              <div className={`font-bold mb-0.5 ${parcel.lotSqFt >= 7_000 ? "text-emerald-300" : "text-red-300"}`}>
                {parcel.lotSqFt >= 7_000 ? "✓ Self-Serve Bays" : "✗ Self-Serve Bays"}
              </div>
              <div className="text-slate-300">Needs ~7,000 sq ft min (4 bays)</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Source ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-slate-500 text-[10px] leading-relaxed flex-1">{parcel.source}</p>
        {parcel.path && (
          <a
            href={`https://app.regrid.com${parcel.path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 text-[10px] hover:text-blue-300 flex-shrink-0"
          >
            <ExternalLink className="w-3 h-3" /> View on Regrid
          </a>
        )}
      </div>
    </div>
  );
}
