/**
 * Regrid Parcel Data — AVW Site Intel
 *
 * Fetches land parcel data for a given lat/lng from the Regrid API v2.
 * Regrid aggregates county assessor records across the US — parcel boundaries,
 * ownership, assessed value, last sale price, zoning, and land use.
 *
 * Coverage: United States only (all 50 states, 3,000+ counties).
 * For non-US coordinates, returns status:"unavailable" with a clear message.
 *
 * API docs: https://regrid.com/docs/api/v2
 * Auth: Bearer token in Authorization header (REGRID_API_KEY)
 *
 * Key fields used:
 *   ll_gissqft   — GIS-computed lot size in square feet
 *   ll_gisacre   — GIS-computed lot size in acres
 *   aval         — total assessed value (USD)
 *   agval        — assessed land value (USD, land only)
 *   improvval    — assessed improvement value (building)
 *   parval       — total parcel value (assessor's market estimate)
 *   saleprice    — last recorded sale price (USD)
 *   saledate     — last recorded sale date
 *   owner        — owner name on record
 *   zoning       — zoning code
 *   usedesc      — land use description
 *   parcelnumb   — assessor parcel number (APN)
 */

import https from "https";

const REGRID_BASE = "https://app.regrid.com/api/v2";
const TIMEOUT_MS  = 15_000;

// US bounding box — Regrid only covers the 50 US states + DC
const US_BOUNDS = { minLat: 24.0, maxLat: 71.5, minLng: -180, maxLng: -66 };

function isInUS(lat: number, lng: number): boolean {
  return (
    lat >= US_BOUNDS.minLat && lat <= US_BOUNDS.maxLat &&
    lng >= US_BOUNDS.minLng && lng <= US_BOUNDS.maxLng
  );
}

function regridGet(url: string, token: string): Promise<any | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn("[AVW] Regrid timeout →", url.replace(token, "***"));
      resolve(null);
    }, TIMEOUT_MS);

    const opts = {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept":        "application/json",
        "User-Agent":    "AVW-Site-Intel/1.0",
      },
    };

    const req = https.get(url, opts, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) {
          console.warn(`[AVW] Regrid HTTP ${res.statusCode}:`, raw.slice(0, 200));
          resolve(null);
          return;
        }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      console.warn("[AVW] Regrid error:", err.message);
      resolve(null);
    });

    req.end();
  });
}

/**
 * Compute approximate lot dimensions (width × depth in feet) from a GeoJSON polygon.
 *
 * Takes the bounding box of the polygon and converts degrees to feet using
 * flat-earth approximation (accurate to <1% for typical parcel sizes).
 *
 * Returns the LARGER dimension as "depth" (the direction cars would stack) and
 * SMALLER as "width" (the road-facing frontage) — standard site-planning convention.
 */
function polygonToDimensions(
  coordinates: number[][][],
  centerLat: number
): { widthFt: number; depthFt: number; frontageEstimateFt: number } | null {
  if (!coordinates?.[0]?.length) return null;

  const ring = coordinates[0];
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const [lng, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  // 1° latitude ≈ 364,320 ft everywhere (spherical approximation)
  const DEG_LAT_TO_FT = 364_320;
  // 1° longitude shrinks toward poles: multiply by cos(lat)
  const DEG_LNG_TO_FT = 364_320 * Math.cos((centerLat * Math.PI) / 180);

  const dimA = Math.round((maxLat - minLat) * DEG_LAT_TO_FT);
  const dimB = Math.round((maxLng - minLng) * DEG_LNG_TO_FT);

  if (dimA <= 0 || dimB <= 0) return null;

  // Convention: depth = longer dimension (stacking cars), width = shorter (road frontage)
  const widthFt  = Math.min(dimA, dimB);
  const depthFt  = Math.max(dimA, dimB);

  // Road frontage estimate — the dimension parallel to the nearest road
  // (approximated as whichever side is shorter — standard commercial lot shape)
  return { widthFt, depthFt, frontageEstimateFt: widthFt };
}

// ── Exported types ─────────────────────────────────────────────────────────────

export interface RegridParcelData {
  // Identification
  parcelNumber:    string;
  path:            string;        // Regrid internal path (state/county/id)

  // Location
  address:         string;
  city:            string;
  state:           string;
  zip:             string;

  // Ownership
  owner:           string;
  ownerMailingAddress: string;

  // Lot dimensions (computed from GIS polygon)
  lotSqFt:         number | null;
  lotAcres:        number | null;
  dimensions: {
    widthFt:          number;
    depthFt:          number;
    frontageEstimateFt: number;
  } | null;

  // Valuation (all USD, from county assessor records)
  assessedTotalUSD:       number | null;  // aval — total assessed value
  assessedLandUSD:        number | null;  // agval — land-only assessed value
  assessedImprovementUSD: number | null;  // improvval — building value
  parcelMarketValueUSD:   number | null;  // parval — assessor's market estimate

  // Transaction history
  lastSalePrice:   number | null;
  lastSaleDate:    string | null;

  // Land classification
  zoning:          string;
  zoningDescription: string;
  landUse:         string;

  // GIS polygon (boundary of the parcel)
  polygon:         Array<{ lat: number; lng: number }>;

  // Metadata
  status:          "live" | "unavailable";
  source:          string;
  fetchedAt:       string;
}

/**
 * Fetch parcel data for a lat/lng coordinate.
 * Returns null for the data fields if outside the US or if the API fails.
 */
export async function fetchRegridParcel(
  lat: number,
  lng: number,
  token: string
): Promise<RegridParcelData> {
  const unavailable = (reason: string): RegridParcelData => ({
    parcelNumber: "", path: "",
    address: "", city: "", state: "", zip: "",
    owner: "", ownerMailingAddress: "",
    lotSqFt: null, lotAcres: null, dimensions: null,
    assessedTotalUSD: null, assessedLandUSD: null,
    assessedImprovementUSD: null, parcelMarketValueUSD: null,
    lastSalePrice: null, lastSaleDate: null,
    zoning: "", zoningDescription: "", landUse: "",
    polygon: [],
    status: "unavailable",
    source: reason,
    fetchedAt: new Date().toISOString(),
  });

  if (!token) return unavailable("Regrid API key not configured (REGRID_API_KEY).");
  if (!isInUS(lat, lng)) return unavailable("Regrid covers US parcels only. This location is outside the United States.");

  // Regrid accepts auth via Bearer header OR ?token= param.
  // Include both to maximize compatibility across plan tiers.
  const url =
    `${REGRID_BASE}/parcels/point` +
    `?lat=${lat}&lon=${lng}` +
    `&token=${encodeURIComponent(token)}` +
    `&return_custom=false&return_field_labels=false`;

  const json = await regridGet(url, token);
  if (!json) return unavailable("Regrid API request failed or timed out.");

  // Regrid returns a FeatureCollection under json.parcels
  const features: any[] = json?.parcels?.features ?? [];
  if (!features.length) return unavailable("No parcel record found at this location in Regrid's database.");

  // Take the first (closest) parcel
  const feature = features[0];
  const f       = feature?.properties?.fields ?? {};
  const geom    = feature?.geometry;

  // Compute lot dimensions from polygon if available
  const dims = geom?.type === "Polygon"
    ? polygonToDimensions(geom.coordinates, lat)
    : null;

  // Build polygon for display
  const polygon: Array<{ lat: number; lng: number }> = [];
  if (geom?.type === "Polygon" && Array.isArray(geom.coordinates?.[0])) {
    for (const [lng2, lat2] of geom.coordinates[0]) {
      if (typeof lat2 === "number" && typeof lng2 === "number") {
        polygon.push({ lat: lat2, lng: lng2 });
      }
    }
  }

  const dollar = (v: any): number | null => {
    const n = parseFloat(v);
    return isNaN(n) || n <= 0 ? null : Math.round(n);
  };

  const parcel: RegridParcelData = {
    parcelNumber:    f.parcelnumb ?? f.parno ?? "",
    path:            feature?.properties?.path ?? "",

    address:         f.addr ?? f.address ?? "",
    city:            f.scity ?? f.city ?? "",
    state:           f.state2 ?? "",
    zip:             f.szip ?? f.zip ?? "",

    owner:           f.owner ?? f.ownname ?? "Not on record",
    ownerMailingAddress:
      [f.mailadd, f.mail_city, f.mail_state2, f.mail_zip].filter(Boolean).join(", "),

    lotSqFt:         dollar(f.ll_gissqft ?? f.sqft),
    lotAcres:        f.ll_gisacre ? parseFloat(parseFloat(f.ll_gisacre).toFixed(3)) : null,
    dimensions:      dims,

    assessedTotalUSD:       dollar(f.aval),
    assessedLandUSD:        dollar(f.agval ?? f.landval),
    assessedImprovementUSD: dollar(f.improvval ?? f.bldgval),
    parcelMarketValueUSD:   dollar(f.parval ?? f.mktval),

    lastSalePrice:   dollar(f.saleprice),
    lastSaleDate:    f.saledate ?? null,

    zoning:          f.zoning ?? "",
    zoningDescription: f.zoning_description ?? f.zoning_class ?? "",
    landUse:         f.usedesc ?? f.lbcs_activity_desc ?? f.primary_use_description ?? "",

    polygon,

    status:    "live",
    source:    `Regrid Parcel API v2 (app.regrid.com). Assessor parcel record for ${f.parcelnumb ?? "this location"}. Data sourced from county assessor records — timeliness varies by county.`,
    fetchedAt: new Date().toISOString(),
  };

  return parcel;
}
