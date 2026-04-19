import { NextRequest, NextResponse } from "next/server";
import https from "https";
import {
  analyzeCompetitor,
  buildReviewInsights,
  buildRecommendations,
  calculateLocationScore,
  calcDistanceMiles,
  scoreTrafficSignals,
} from "@/lib/scoring";
import { runFinancialModel } from "@/lib/financialModel";
import { getCountry } from "@/lib/countryData";
import type {
  PlaceResult,
  TrafficSignals,
  SiteAnalysisResult,
  InvestmentSuggestion,
} from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const BASE_URL = "https://maps.googleapis.com/maps/api";

// ── Startup diagnostics — printed once when the server starts ─────────────────
const _openaiKey    = process.env.OPENAI_API_KEY    ?? "";
const _anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";
const _censusKey    = process.env.CENSUS_ACS_API_KEY ?? "";
const _attomKey     = process.env.ATTOM_API_KEY     ?? "";

console.log("[AVW] API keys loaded:");
console.log("  GOOGLE_MAPS_API_KEY:  ", GOOGLE_API_KEY  ? `✅ (${GOOGLE_API_KEY.slice(0,8)}...)`  : "❌ MISSING — required");
console.log("  TOMTOM_API_KEY:       ", process.env.TOMTOM_API_KEY ? `✅ (${(process.env.TOMTOM_API_KEY).slice(0,8)}...)` : "⚠️  not set  — AADT will use density proxy");
console.log("  ATTOM_API_KEY:        ", _attomKey       ? `✅ (${_attomKey.slice(0,8)}...)`        : "⚠️  not set  — parcel data unavailable");
console.log("  CENSUS_ACS_API_KEY:   ", _censusKey      ? `✅ (${_censusKey.slice(0,8)}...)`      : "⚠️  not set  — demographics unavailable");
console.log("  OPENAI_API_KEY:       ", _openaiKey      ? `✅ (${_openaiKey.slice(0,8)}...)`      : "⚠️  not set  — decision panel uses rules only");
console.log("  ANTHROPIC_API_KEY:    ", _anthropicKey   ? `✅ (${_anthropicKey.slice(0,8)}...)`   : "⚠️  not set  — decision panel uses rules only");

// ── BLS CPI: live inflation factor for construction cost adjustment ────────────
//
// Series: CUUR0000SA0 — CPI-U All Items (Bureau of Labor Statistics)
// Used to adjust the 404 Excel model base (August 2017) to current prices.
//
// API tiers:
//   No key  → v1 API → 25 req/day, 3 years of data
//   With key → v2 API → 500 req/day, 20 years of data
//   Register free at: https://data.bls.gov/registrationEngine/
//
// Server-side cache: 24-hour TTL — CPI only updates monthly, no need to re-fetch per analysis.
// This keeps daily API usage at 1 regardless of how many analyses are run.

const BLS_SERIES    = "CUUR0000SA0"; // CPI-U All Items — guaranteed valid, monthly
const BLS_API_KEY   = process.env.BLS_API_KEY ?? "";
const BLS_BASE_YEAR = "2017";
const BLS_BASE_MTH  = "M08"; // August 2017 — date of the 404 Excel financial model

// 24-hour server-side cache — survives across requests in the same Node.js process
let blsCache: { result: PPIResult; fetchedAt: number } | null = null;
const BLS_CACHE_TTL = 24 * 60 * 60 * 1_000;

interface PPIResult {
  inflationFactor: number;
  baseValue:       number;
  currentValue:    number;
  currentPeriod:   string;
  source:          string;
}

function blsNativeGet(url: string, body?: string): Promise<any | null> {
  return new Promise((resolve) => {
    const isPost = !!body;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method:   isPost ? "POST" : "GET",
      headers: {
        "User-Agent":   "AVW-Site-Intel/1.0",
        "Accept":       "application/json",
        "Content-Type": "application/json",
        ...(isPost ? { "Content-Length": Buffer.byteLength(body!) } : {}),
      },
    };

    const timer = setTimeout(() => { resolve(null); }, 20_000); // 20s — BLS can be slow

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) { resolve(null); return; }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });

    req.on("error", () => { clearTimeout(timer); resolve(null); });
    if (isPost && body) req.write(body);
    req.end();
  });
}

async function fetchBLSConstructionPPI(): Promise<PPIResult | null> {
  // Return cached result if still fresh (CPI updates monthly — 24h cache is safe)
  if (blsCache && Date.now() - blsCache.fetchedAt < BLS_CACHE_TTL) {
    return blsCache.result;
  }

  let json: any = null;

  if (BLS_API_KEY) {
    // v2 API: POST, 500 req/day, up to 20 years of data — can reach Aug 2017 directly
    const body = JSON.stringify({
      seriesid:        [BLS_SERIES],
      startyear:       BLS_BASE_YEAR,
      endyear:         new Date().getFullYear().toString(),
      registrationkey: BLS_API_KEY,
    });
    json = await blsNativeGet("https://api.bls.gov/publicAPI/v2/timeseries/data/", body);
    console.log(`[AVW] BLS v2 API used (key: ${BLS_API_KEY.slice(0, 6)}...)`);
  } else {
    // v1 API: GET, 25 req/day, 3 years of data — Aug 2017 may be out of range
    // The cache means this only fires once per day, so 25 req/day is sufficient
    json = await blsNativeGet(`https://api.bls.gov/publicAPI/v1/timeseries/data/${BLS_SERIES}`);
    console.log("[AVW] BLS v1 API used (no key — 25 req/day limit, cached 24h)");
  }

  if (json?.status !== "REQUEST_SUCCEEDED") {
    console.warn("[AVW] BLS API returned:", json?.status, json?.message);
    return null;
  }

  const dataPoints: Array<{ year: string; period: string; value: string }> =
    json?.Results?.series?.[0]?.data ?? [];
  if (!dataPoints.length) return null;

  // Find August 2017 base (available if v2 key used or if within 3-year v1 window)
  const basePoint = dataPoints.find(
    (d) => d.year === BLS_BASE_YEAR && d.period === BLS_BASE_MTH
  ) ?? dataPoints[dataPoints.length - 1]; // oldest available if 2017 not in range

  const latest   = dataPoints[0]; // BLS returns newest first
  const baseVal  = parseFloat(basePoint.value);
  const curVal   = parseFloat(latest.value);

  if (!baseVal || !curVal || baseVal <= 0) return null;

  const apiTier = BLS_API_KEY ? "v2 (500 req/day)" : "v1 (25 req/day, cached 24h)";
  const result: PPIResult = {
    inflationFactor: curVal / baseVal,
    baseValue:       baseVal,
    currentValue:    curVal,
    currentPeriod:   `${latest.year}/${latest.period.replace("M", "M")}`,
    source:
      `BLS CPI-U All Items (${BLS_SERIES}), ${apiTier}. ` +
      `Base: ${basePoint.year}/${basePoint.period} index ${baseVal.toFixed(1)}. ` +
      `Current: ${latest.year}/${latest.period} index ${curVal.toFixed(1)}. ` +
      `Factor: ${(curVal / baseVal).toFixed(3)}× (+${((curVal / baseVal - 1) * 100).toFixed(1)}% since ${BLS_BASE_YEAR}). ` +
      `Source: api.bls.gov`,
  };

  blsCache = { result, fetchedAt: Date.now() };
  return result;
}

// ── Google Places helpers ─────────────────────────────────────────────────────
// Each request gets a 12-second timeout so a slow connection doesn't hang the whole analysis.
// On network failure the helpers return empty arrays / null — analysis degrades gracefully.
async function gFetch(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const domain = new URL(url).hostname;
      console.warn(`[AVW] ${domain} returned HTTP ${res.status}:`, body.slice(0, 200));
      return null;
    }
    return await res.json();
  } catch (err: any) {
    const domain = new URL(url).hostname;
    console.warn(`[AVW] ${domain} fetch failed:`, err?.message ?? err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPlacesNearby(lat: number, lng: number, type: string, radius = 5000): Promise<PlaceResult[]> {
  const url = new URL(`${BASE_URL}/place/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", radius.toString());
  url.searchParams.set("type", type);
  url.searchParams.set("key", GOOGLE_API_KEY);
  const data = await gFetch(url.toString());
  return data?.results ?? [];
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const url = new URL(`${BASE_URL}/place/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "place_id,name,vicinity,formatted_address,geometry,rating,user_ratings_total,reviews,opening_hours,photos,business_status,types,price_level");
  url.searchParams.set("key", GOOGLE_API_KEY);
  const data = await gFetch(url.toString());
  return data?.result ?? null;
}

async function geocodeAddress(address: string): Promise<{
  lat: number; lng: number; formattedAddress: string;
  countryCode: string; countryName: string; city: string;
} | null> {
  const url = new URL(`${BASE_URL}/geocode/json`);
  url.searchParams.set("address", address);
  url.searchParams.set("key", GOOGLE_API_KEY);
  const data = await gFetch(url.toString());
  if (!data?.results?.[0]) return null;

  const components = data.results[0].address_components ?? [];
  const countryComp = components.find((c: any) => c.types.includes("country"));
  const cityComp    = components.find((c: any) => c.types.includes("locality"))
                   ?? components.find((c: any) => c.types.includes("administrative_area_level_1"));

  const countryCode = countryComp?.short_name ?? "US";
  const countryName = getCountry(countryCode).name ?? countryComp?.long_name ?? "Unknown";
  const city        = cityComp?.long_name ?? "this city";

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng, formattedAddress: data.results[0].formatted_address, countryCode, countryName, city };
}

// ── Competitor volume — derived from Google review count ──────────────────────
// SerpAPI (Popular Times) was removed: it requires a paid subscription and returned
// unreliable data. Review count is a reliable, free proxy for relative popularity.
//
// Methodology:
//   Industry research shows Google reviews ≈ 0.5–1.5% of actual service visits.
//   Using 1% as a conservative midpoint. Assuming a median 3-year business age for
//   active businesses (typical for established car washes in Google's index).
//   6-month estimate = (reviewCount / 0.01) / 36 months × 6 months.
//   Rounded to nearest 500. Rating adjusts confidence tier only.
//   Source: Local SEO Guide Review Rate Study, BrightLocal Consumer Survey 2024.

import type { EstimatedVolume } from "@/lib/types";
import { getWageRates } from "@/lib/iloWages";
import { fetchTomTomData } from "@/lib/tomtom";
import { fetchATTOMParcel, type ATTOMParcelData } from "@/lib/attom";
import { fetchOSMBuilding } from "@/lib/osm";
import type { RegridParcelData } from "@/lib/types";
import { fetchCensusData } from "@/lib/census";

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY ?? "";
const ATTOM_API_KEY  = process.env.ATTOM_API_KEY  ?? "";
const CENSUS_API_KEY = process.env.CENSUS_ACS_API_KEY ?? "";

function estimateVolumeFromReviews(reviewCount: number, rating: number): EstimatedVolume {
  if (reviewCount <= 0) {
    return {
      sixMonthEstimate: null,
      confidence: "unavailable",
      method: "No Google review data for this business — volume cannot be estimated.",
    };
  }

  // Review rate: industry research shows ≈1% of service visits result in a Google review.
  // Assumed median business age: 3 years (36 months) for active Google-indexed car washes.
  // 6-month estimate = (reviewCount / 0.01) / 36 × 6
  const totalVisitsEstimate   = reviewCount / 0.01;
  const monthlyVisits         = totalVisitsEstimate / 36;
  const sixMonthRaw           = monthlyVisits * 6;
  // Round to nearest 500 to avoid false precision
  const sixMonthEstimate      = Math.max(500, Math.round(sixMonthRaw / 500) * 500);

  // Confidence is inherently low for this method — be honest about it
  const confidence: EstimatedVolume["confidence"] =
    reviewCount >= 500 ? "low" : "low";

  return {
    sixMonthEstimate,
    confidence,
    method:
      `Estimated from ${reviewCount.toLocaleString()} Google reviews` +
      (rating ? ` (${rating.toFixed(1)}★)` : "") +
      `. Methodology: reviews ≈ 1% of visits (BrightLocal Consumer Survey 2024 benchmark) × ` +
      `assumed 3-year median business age. Treat as directional only — actual volume varies significantly. ` +
      `Source: Google Places API (live review count).`,
  };
}

// ── Investment suggestion engine ──────────────────────────────────────────────
function buildInvestmentSuggestion(
  countryCode: string,
  city: string,
  trafficSignals: TrafficSignals,
  ppi:    PPIResult | null,
  parcel: RegridParcelData | ATTOMParcelData | null,
  sharedLandCost?: number | null,
  sharedLandSource?: import("@/lib/types").FinancialAssumptions["landCostSource"],
): InvestmentSuggestion {
  const country    = getCountry(countryCode);
  const multiplier = country.multiplier;
  // Apply live BLS construction cost inflation if available
  // Only applies to construction + equipment (labour/materials); land is market-priced separately
  const ppiMultiplier = ppi ? ppi.inflationFactor : 1.0;

  // Urban density score
  const density = trafficSignals.nearbyGasStations + trafficSignals.nearbyGroceryStores + trafficSignals.nearbyShopping;
  const isMajorMetro  = density > 16;
  const isUrban       = density > 8;
  // Tier multiplier is modest — land/real-estate absorbs most city-tier variation, not equipment
  const urbanMultiplier = isMajorMetro ? 1.20 : isUrban ? 1.00 : 0.85;
  const cityTier = isMajorMetro ? "Major Metro" : isUrban ? "Urban" : "Suburban / Rural";

  // ── Land cost: use ATTOM actual market value if available ────────────────
  // ATTOM gives us the county assessor's market value for this specific parcel.
  // We prefer: lastSalePrice > parcelMarketValueUSD > assessedTotalUSD > pro forma estimate.
  // A 20% premium over assessor value is typical for acquisition (negotiation buffer).
  // Use the shared land cost already computed in the route handler — ensures both
  // the Investment Suggestion panel and Financial Model always show the same land figure.
  const parcelLandValue = sharedLandCost ?? null;

  // ── US baseline — 2024-2025 industry benchmarks ──────────────────────────
  // Source: MMCG Invest / Motor City Wash Works 2024 project cost data.
  // Express tunnel range: $3.5M–$6.0M suburban US.
  // Ranges = ±18% around 2025 midpoints for market variance.
  // Construction/equipment adjusted upward by live BLS CPI from 2024 base.
  // Country multiplier scales the full breakdown; urban tier only moves land.
  const base = {
    land:         { min: 900_000,   max: 1_350_000 },   // 2025 suburban US: ~$1.1M midpoint
    construction: { min: 1_150_000, max: 1_720_000 },   // 2025: ~$1.44M midpoint (tunnel build + site)
    equipment:    { min: 1_050_000, max: 1_580_000 },   // 2025: ~$1.32M midpoint (tunnel + ancillary)
    fees:         { min: 320_000,   max: 480_000   },   // 2025: ~$400K (permits, engineering, contingency)
  };
  // Land absorbs the city-tier premium; other categories scale only by country
  const landAdj  = multiplier * urbanMultiplier;
  const otherAdj = multiplier;

  // If ATTOM gives us actual land value, use it for both min and max of land line item
  const landBreakdown = parcelLandValue
    ? { min: Math.round(parcelLandValue * 0.90), max: Math.round(parcelLandValue * 1.10) }
    : { min: Math.round(base.land.min * landAdj), max: Math.round(base.land.max * landAdj) };

  const breakdown = {
    land:         landBreakdown,
    construction: { min: Math.round(base.construction.min * otherAdj * ppiMultiplier), max: Math.round(base.construction.max * otherAdj * ppiMultiplier) },
    equipment:    { min: Math.round(base.equipment.min * otherAdj * ppiMultiplier),    max: Math.round(base.equipment.max * otherAdj * ppiMultiplier) },
    fees:         { min: Math.round(base.fees.min * otherAdj),                         max: Math.round(base.fees.max * otherAdj) },
  };

  const minEstimateUSD = breakdown.land.min + breakdown.construction.min + breakdown.equipment.min + breakdown.fees.min;
  const maxEstimateUSD = breakdown.land.max + breakdown.construction.max + breakdown.equipment.max + breakdown.fees.max;

  const rationale =
    `Estimate for a ${cityTier.toLowerCase()} location in ${city}, ${country.name}. ` +
    `Based on 2024-2025 US express car wash project cost benchmarks ($3.5M–$6.0M range, MMCG 2024). ` +
    `Regional cost index applied: ${(multiplier * 100).toFixed(0)}% of US benchmark. ` +
    `City-tier land modifier: ${(urbanMultiplier * 100).toFixed(0)}%.`;

  return {
    minEstimateUSD,
    maxEstimateUSD,
    cityTier,
    countryCode,
    countryName: country.name,
    breakdown,
    rationale,
    marketContext: country.context,
    dataTimestamp: new Date().toISOString(),
    sourceNote:
      "Cost breakdown based on 2024-2025 US express car wash project cost benchmarks (MMCG Invest / Motor City Wash Works 2024 data). " +
      "2025 midpoints: Land ~$1.1M · Equipment ~$1.32M · Construction ~$1.44M · Fees & Contingency ~$400K. " +
      (parcelLandValue
        ? sharedLandSource === "attom-sale"
          ? `Land cost from live ATTOM last-sale price (+ 15% market appreciation) for this parcel. `
          : sharedLandSource === "attom-market"
          ? `Land cost from live ATTOM assessor market value (+ 10% acquisition buffer) for this parcel. `
          : sharedLandSource === "attom-assessed"
          ? `Land cost from live ATTOM assessed land value (+ 20% to reflect market) for this parcel. `
          : `Land cost estimated from ATTOM AVM whole-property estimate × 30% commercial land ratio. `
        : "Land cost estimated from pro forma baseline + regional index (ATTOM parcel data unavailable or non-US location). ") +
      (ppi
        ? `Construction & equipment inflation-adjusted via live BLS CPI-U (CUUR0000SA0, ${ppi.currentPeriod}): ` +
          `${(ppi.inflationFactor * 100 - 100).toFixed(1)}% above August 2017 base. `
        : "BLS CPI inflation adjustment unavailable — costs shown at 2017 base. ") +
      "Verify all figures with a local contractor and real estate broker.",
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, placeId, lat, lng, budget, radiusMiles: radiusParam } = body;

    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
      return NextResponse.json(
        { error: "Google Maps API key not configured. Please add GOOGLE_MAPS_API_KEY to .env.local" },
        { status: 400 }
      );
    }

    // ── Radius configuration ─────────────────────────────────────────────────
    // Google Places nearbysearch hard cap: 50,000m ≈ 31.07 miles.
    // Requests beyond this are silently clamped by the API, so we enforce 31 mi max here.
    const radiusMiles = Math.max(5, Math.min(31, parseFloat(radiusParam) || 5));
    const radiusMeters = Math.round(radiusMiles * 1609.34); // ≤ 50,000m — within API limit
    const displayRadiusMiles = radiusMiles; // kept for response — used for map circle

    // Traffic signal searches: 40% of competitor radius, capped at 40km
    const signalRadiusMeters = Math.min(Math.round(radiusMiles * 0.4 * 1609.34), 40_000);

    // Resolve coordinates + country
    let coordinates: { lat: number; lng: number };
    let resolvedAddress = address;
    let countryCode = "US";
    let city = "this location";

    if (lat && lng) {
      coordinates = { lat, lng };
    } else if (address) {
      const geo = await geocodeAddress(address);
      if (!geo) return NextResponse.json({ error: "Could not geocode address" }, { status: 400 });
      coordinates    = { lat: geo.lat, lng: geo.lng };
      resolvedAddress = geo.formattedAddress;
      countryCode    = geo.countryCode;
      city           = geo.city;
    } else {
      return NextResponse.json({ error: "Address or coordinates required" }, { status: 400 });
    }

    const { lat: centerLat, lng: centerLng } = coordinates;

    // ── Fetch TomTom, wages, BLS PPI, ATTOM, OSM, and Census in parallel ─────
    const [wageRates, tomtomData, constructionPPI, parcelData, osmBuilding, censusData] = await Promise.all([
      getWageRates(countryCode),
      fetchTomTomData(centerLat, centerLng, TOMTOM_API_KEY, radiusMiles),
      fetchBLSConstructionPPI(),
      countryCode === "US" ? fetchATTOMParcel(centerLat, centerLng, ATTOM_API_KEY) : Promise.resolve(null),
      // OSM building footprint — free, US + worldwide
      fetchOSMBuilding(centerLat, centerLng),
      // Census only available for US — returns null for non-US addresses
      countryCode === "US" ? fetchCensusData(centerLat, centerLng) : Promise.resolve(null),
    ]);

    // Merge OSM polygon into parcel data if ATTOM returned an empty polygon
    if (parcelData && osmBuilding?.status === "live" && osmBuilding.polygon.length > 0) {
      if (parcelData.polygon.length === 0) {
        parcelData.polygon = osmBuilding.polygon;
      }
    }

    // ── Competitors — scaled to user radius ──────────────────────────────────
    const carWashResults = await fetchPlacesNearby(centerLat, centerLng, "car_wash", radiusMeters);
    const competitorDetails = await Promise.all(
      carWashResults.slice(0, 10).map((p) => fetchPlaceDetails(p.place_id))
    );

    const validDetails = competitorDetails
      .filter((d): d is PlaceResult => d !== null)
      // Strictly require car_wash in the place types — removes gas stations / auto-detailers
      // that Google sometimes returns when they happen to offer a wash service
      .filter((d) => (d.types ?? []).includes("car_wash"))
      // Remove permanently closed locations
      .filter((d) => d.business_status !== "CLOSED_PERMANENTLY");
    const competitors = validDetails
      .map((place) => {
        const distMiles = calcDistanceMiles(centerLat, centerLng, place.geometry.location.lat, place.geometry.location.lng);
        const estimatedVolume = estimateVolumeFromReviews(place.user_ratings_total ?? 0, place.rating ?? 0);
        return analyzeCompetitor(place, parseFloat(distMiles.toFixed(2)), estimatedVolume);
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    // ── Traffic signals — scaled to signal radius ────────────────────────────
    const [gasStations, grocery, fastFood, shopping, schools] = await Promise.all([
      fetchPlacesNearby(centerLat, centerLng, "gas_station",            signalRadiusMeters),
      fetchPlacesNearby(centerLat, centerLng, "grocery_or_supermarket", signalRadiusMeters),
      fetchPlacesNearby(centerLat, centerLng, "restaurant",             signalRadiusMeters),
      fetchPlacesNearby(centerLat, centerLng, "shopping_mall",          signalRadiusMeters),
      fetchPlacesNearby(centerLat, centerLng, "school",                 signalRadiusMeters),
    ]);

    // ── Vehicle count — TomTom is the primary source ─────────────────────────
    // TomTom Flow Segment Data gives live road speed → BPR function → AADT.
    // This is the industry-standard approach (HCM 6th Ed.), not estimation.
    //
    // Proximity check: if the nearest TomTom road segment is > 1.5 miles from
    // the queried coordinates, it is likely sampling a different road entirely.
    // In that case we discard the TomTom count and fall back to the density proxy
    // to avoid inflated scores for rural/off-road locations.
    const rawTomtomVPD       = tomtomData.trafficFlow.vehicleCount.vehiclesPerDay;
    const segDistMiles       = tomtomData.trafficFlow.roadSegmentDistanceMiles ?? 0;
    const segTooFar          = segDistMiles > 1.5;

    // If segment is between 0.5–1.5 miles away, apply a confidence damping factor
    const dampFactor =
      segDistMiles > 1.5 ? 0 :
      segDistMiles > 0.5 ? Math.max(0.25, 1 - (segDistMiles - 0.5) * 0.75) :
      1.0;

    const tomtomVehiclesPerDay = rawTomtomVPD > 0 && !segTooFar
      ? Math.round(rawTomtomVPD * dampFactor)
      : 0;

    const estimatedDailyTraffic = tomtomVehiclesPerDay > 0
      ? tomtomVehiclesPerDay
      : gasStations.length * 2_000 + grocery.length * 1_000;

    const segWarn = tomtomData.trafficFlow.segmentWarning;
    const trafficEstimationMethod =
      tomtomVehiclesPerDay > 0 && dampFactor < 1.0
        ? `${tomtomData.trafficFlow.vehicleCount.methodology} ⚠️ Confidence adjusted: TomTom segment is ${segDistMiles.toFixed(1)} miles from site (${Math.round(dampFactor * 100)}% weight applied).`
        : tomtomVehiclesPerDay > 0
        ? tomtomData.trafficFlow.vehicleCount.methodology
        : segTooFar && rawTomtomVPD > 0
        ? `TomTom segment rejected — nearest road is ${segDistMiles.toFixed(1)} miles from this location (likely a different road). Falling back to density proxy. ${segWarn ?? ""}`
        : estimatedDailyTraffic > 0
        ? `TomTom data unavailable — surrogate density estimate from ${gasStations.length} gas station(s) and ${grocery.length} grocery store(s) within ${(radiusMiles * 0.5).toFixed(1)} miles. Configure TOMTOM_API_KEY for accurate vehicle counts. THIS IS AN APPROXIMATION ONLY.`
        : `Vehicle count unavailable — TomTom API key not configured and no traffic-proxy anchors (gas stations / grocery stores) were found near this location. Financial projections cannot be generated without a traffic count.`;

    const trafficSignals: TrafficSignals = {
      nearbyGasStations:   gasStations.length,
      nearbyGroceryStores: grocery.length,
      nearbyFastFood:      fastFood.length,
      nearbyShopping:      shopping.length,
      nearbySchools:       schools.length,
      estimatedDailyTraffic,
      trafficEstimationMethod,
      trafficScore: scoreTrafficSignals({
        nearbyGasStations: gasStations.length,
        nearbyGroceryStores: grocery.length,
        nearbyFastFood: fastFood.length,
        nearbyShopping: shopping.length,
        nearbySchools: schools.length,
        estimatedDailyTraffic,
        trafficScore: 0,
      }),
    };

    // ── ATTOM land value — shared between financial model and investment suggestion ──
    // Both panels must show the same land cost figure. We derive it once here.
    const attomParcel     = parcelData?.status === "live" ? parcelData : null;
    const attomAvm        = (attomParcel as ATTOMParcelData)?.avmEstimateUSD ?? null;
    const sharedLandCostUSD: number | null =
      attomParcel?.lastSalePrice
        ? Math.round(attomParcel.lastSalePrice * 1.15)
        : attomParcel?.parcelMarketValueUSD
        ? Math.round(attomParcel.parcelMarketValueUSD * 1.10)
        : attomParcel?.assessedLandUSD
        ? Math.round(attomParcel.assessedLandUSD * 1.20)
        : attomAvm
        ? Math.round(attomAvm * 0.30)
        : null;

    const sharedLandSource: import("@/lib/types").FinancialAssumptions["landCostSource"] =
      attomParcel?.lastSalePrice     ? "attom-sale"
      : attomParcel?.parcelMarketValueUSD ? "attom-market"
      : attomParcel?.assessedLandUSD     ? "attom-assessed"
      : attomAvm                          ? "attom-avm"
      : "pro-forma-ratio";

    // Financial model — budget is optional; pass 0 if not provided
    const investmentBudget = budget ? parseFloat(budget) : 0;
    const financial = runFinancialModel(
      estimatedDailyTraffic, investmentBudget, wageRates,
      sharedLandCostUSD, sharedLandSource,
    );
    const financialViable = financial.year1EBITDA > 0;

    // Scoring
    const score = calculateLocationScore(competitors, trafficSignals, financialViable);

    // Insights, recommendations, and investment suggestion
    const reviewInsights       = buildReviewInsights(competitors);
    const recommendations      = buildRecommendations(score, reviewInsights);
    const investmentSuggestion = buildInvestmentSuggestion(
      countryCode, city, trafficSignals, constructionPPI,
      attomParcel,
      sharedLandCostUSD,
      sharedLandSource,
    );

    const result: SiteAnalysisResult = {
      address: resolvedAddress,
      placeId: placeId ?? "",
      coordinates,
      analyzedAt: new Date().toISOString(),
      countryCode,
      radiusMiles: displayRadiusMiles,
      competitors,
      trafficSignals,
      score,
      financialProjection: financial,
      reviewInsights,
      recommendations,
      investmentSuggestion,
      budgetUSD: investmentBudget,
      tomtom: tomtomData,
      parcel: parcelData ?? undefined,
      osmBuilding: osmBuilding ?? undefined,
      census: censusData ?? undefined,
      dataSources: {
        competitors:
          `Google Places API — live data fetched at time of analysis within a ${displayRadiusMiles}-mile radius ` +
          `(Google Places nearbysearch API capped at ~31 miles; selected radius: ${displayRadiusMiles} mi). ` +
          "Includes name, rating, review count, photos, opening hours, and distance.",
        traffic:
          tomtomVehiclesPerDay > 0
            ? `TomTom Traffic Flow Segment Data API v4 (live). ` +
              `BPR volume-delay function applied to real road speed data → ` +
              `${tomtomVehiclesPerDay.toLocaleString()} vehicles/day AADT. ` +
              `Same methodology used by traffic engineers (HCM 6th Ed.). ` +
              `This is the actual vehicle count passing the site — not an estimate.`
            : "TomTom unavailable — rough density proxy used. Configure TOMTOM_API_KEY for real vehicle counts.",
        financialModel:
          "Express Car Wash Investment Pro Forma — updated to 2024-2025 industry benchmarks " +
          "(ICA 2024, Rinsed Q4 2024, ZipRecruiter/BLS 2024, MMCG Invest 2024). " +
          "Pricing, variable costs, wages, and SG&A reflect current US market data. " +
          "Revenue is driven by live TomTom vehicle count data.",
        wageData:
          wageRates.source === "ilo-occupation"
            ? `ILO ILOSTAT live data (${wageRates.period}) — EAR_MEES_NOC_NB, ` +
              `mean nominal monthly earnings, service & sales workers (ISCO-08 Group 5), USD. ` +
              `Source: ilostat.ilo.org`
            : wageRates.source === "ilo-all-workers"
            ? `ILO ILOSTAT live data (${wageRates.period}) — EAR_MEES_NB (all workers), ` +
              `adjusted to service sector (×0.80, per ILO Global Wage Report 2022/23). ` +
              `Source: ilostat.ilo.org`
            : wageRates.source === "world-bank-derived"
            ? `World Bank Open Data (${wageRates.period}) — NY.GNP.PCAP.CD (GNI per capita) ` +
              `→ derived monthly service-sector wage. ILO direct data unavailable for ${wageRates.countryCode}. ` +
              `Source: data.worldbank.org`
            : `Wage data unavailable — all three live sources (ILO occupation, ILO all-workers, World Bank) ` +
              `returned no data for ${wageRates.countryCode}. Financial model uses 2024-2025 US industry baseline rates. ` +
              `Verify with a local HR consultant.`,
        investmentRange:
          "2024-2025 express car wash project cost benchmarks (MMCG Invest 2024) scaled by country cost multiplier " +
          `(${getCountry(countryCode).name}: ${(getCountry(countryCode).multiplier * 100).toFixed(0)}% of US benchmark) ` +
          "and city-tier land modifier. Construction/equipment adjusted by live BLS CPI data. " +
          "Not live vendor quotes — verify with local contractors and lenders.",
        parcelData:
          parcelData?.status === "live"
            ? `ATTOM Property API (api.gateway.attomdata.com). ` +
              `ATTOM ID ${(parcelData as ATTOMParcelData).attomId ?? "N/A"}. ` +
              `Fields: ownership, lot size, zoning, assessed value, AVM estimate, last sale, annual tax. ` +
              `County assessor records — timeliness varies by county.`
            : countryCode === "US"
            ? ATTOM_API_KEY
              ? "ATTOM fetch failed — no parcel record found at this location, or API error."
              : "Not available — ATTOM_API_KEY not configured."
            : "ATTOM covers US only — parcel data not available for this location.",
        buildingFootprint:
          osmBuilding?.status === "live"
            ? `OpenStreetMap via Overpass API (overpass-api.de). ` +
              `OSM way ${osmBuilding.osmWayId}. ` +
              `Footprint: ${osmBuilding.footprintSqFt?.toLocaleString() ?? "?"} sq ft ` +
              `(${osmBuilding.footprintSqM?.toLocaleString() ?? "?"} m²). ` +
              `Area computed via Shoelace formula from OSM polygon. Free, no API key required.`
            : "Building footprint not found in OpenStreetMap at this location.",
        exchangeRates:
          "US Federal Reserve FRED H.10 Foreign Exchange Rates (primary source) · " +
          "Open Exchange Rates / er-api.com (secondary, for NGN/GHS/KES and FRED fallback). " +
          "All rates USD-based, fetched live and cached for 1 hour.",
        competitorVolume:
          "Estimated from Google Places review count (live). " +
          "Methodology: reviews ≈ 1% of service visits (BrightLocal 2024 benchmark) × 3-year median business age. " +
          "Directional estimate only — treat as a relative popularity indicator, not an exact figure.",
        tomtomTraffic:
          TOMTOM_API_KEY
            ? `TomTom APIs (live, fetched ${new Date().toISOString()}): ` +
              `Traffic Flow Segment Data v4 (vehicle count + road speed at site) · ` +
              `Reachable Range v1 (5/10/15-min drive-time isochrones with live traffic) · ` +
              `Traffic Incidents v5 (live closures, roadworks, and hazards within ${(radiusMiles * 0.5 * 1.609).toFixed(1)}km).`
            : "Not available — TOMTOM_API_KEY not configured. Vehicle count will be a density proxy only.",
        demographics:
          censusData?.status === "live"
            ? `US Census Bureau ACS 5-Year Estimates 2024 (2020–2024), via Census Reporter. ` +
              `Census Tract ${censusData.tractFips} and ${censusData.countyName} County data. ` +
              `Variables: B01003 (population), B23025 (labor force), B19001 (income distribution), ` +
              `B25003 (tenure), B08201 (vehicle availability), B25010 (household size). ` +
              `Primary source: api.censusreporter.org · Fallback: api.census.gov`
            : countryCode === "US"
            ? "Census ACS data unavailable — Census Reporter or direct ACS fetch failed. Check server logs for details."
            : `Census ACS not available for ${countryCode} — US only.`,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Analysis error:", message, err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? message : "Internal server error during analysis" },
      { status: 500 }
    );
  }
}
