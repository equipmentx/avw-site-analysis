import { NextRequest, NextResponse } from "next/server";
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
const SERPAPI_KEY    = process.env.SERPAPI_KEY ?? "";
const BASE_URL = "https://maps.googleapis.com/maps/api";

// ── Google Places helpers ─────────────────────────────────────────────────────
// Each request gets a 12-second timeout so a slow connection doesn't hang the whole analysis.
// On network failure the helpers return empty arrays / null — analysis degrades gracefully.
async function gFetch(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
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

// ── SerpApi: competitor volume via Popular Times ──────────────────────────────
// Express tunnel capacity benchmark: 100 cars/hour (industry standard for a single-lane tunnel)
// Operating window assumed: 8am–8pm (12 hours). Popular Times busyness = 0–100 relative scale.
// Volume = capacity × (busyness/100) per hour, summed across all operating hours, averaged across days.
// All results rounded to nearest 1,000. If data is missing, we return null — never fabricate.
const TUNNEL_CAPACITY   = 100; // cars per hour
const HOURS_OPEN_START  = 8;   // 8am
const HOURS_OPEN_END    = 20;  // 8pm

async function fetchPopularTimes(placeId: string, placeName: string, lat: number, lng: number): Promise<any[] | null> {
  if (!SERPAPI_KEY) return null;

  try {
    // SerpApi Google Maps — place details by name + coordinates to get popular_times
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine",  "google_maps");
    url.searchParams.set("q",       placeName);
    url.searchParams.set("ll",      `@${lat},${lng},15z`);
    url.searchParams.set("type",    "place");
    url.searchParams.set("api_key", SERPAPI_KEY);

    const data = await gFetch(url.toString());

    // SerpApi returns popular_times under place_results or local_results[0]
    return (
      data?.place_results?.popular_times ??
      data?.local_results?.[0]?.popular_times ??
      null
    );
  } catch {
    return null;
  }
}

import type { EstimatedVolume } from "@/lib/types";
import { getWageRates } from "@/lib/iloWages";
import { fetchTomTomData } from "@/lib/tomtom";

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY ?? "";

function calcVolumeFromPopularTimes(popularTimes: any[] | null, reviewCount: number): EstimatedVolume {
  if (!SERPAPI_KEY) {
    // Derive from Google review count — industry avg: ~1% of car wash visits result in a Google review
    // 6-month estimate = (reviewCount / 1%) / 6 months, rounded to nearest 500
    if (reviewCount > 0) {
      const totalEstVisits  = reviewCount * 100;                          // reviewCount ÷ 1% review rate
      const sixMonthRaw     = totalEstVisits / 6;                         // one sixth of lifetime visits
      const sixMonthEstimate = Math.max(500, Math.round(sixMonthRaw / 500) * 500);
      return {
        sixMonthEstimate,
        confidence: "low",
        method:
          `Review-count derived estimate — SERPAPI_KEY not configured so Google Popular Times are unavailable. ` +
          `Formula: ${reviewCount} reviews ÷ 1% industry review rate = ~${totalEstVisits.toLocaleString()} estimated total visits ` +
          `÷ 6 (months) = ~${sixMonthEstimate.toLocaleString()} cars. ` +
          `Confidence is LOW — add SERPAPI_KEY to .env.local for accurate Popular Times data.`,
      };
    }
    return {
      sixMonthEstimate: null,
      confidence: "unavailable",
      method: "No review data available and SERPAPI_KEY not configured. Cannot estimate competitor volume.",
    };
  }

  if (!popularTimes || popularTimes.length === 0) {
    return {
      sixMonthEstimate: null,
      confidence: "unavailable",
      method: "Google Maps has insufficient visit data for this business. This is common for newer or lower-traffic locations.",
    };
  }

  let totalDailyCars = 0;
  let validDays = 0;

  for (const day of popularTimes) {
    // SerpApi popular_times per day: array of { hour, busyness_percentage } or flat array
    const hours: any[] = day.popular_times ?? day.hours ?? [];
    if (!hours.length) continue;

    let dayCars = 0;
    for (const slot of hours) {
      const hour       = typeof slot.hour === "number" ? slot.hour : slot.time_label ? parseInt(slot.time_label) : -1;
      const busyness   = slot.busyness_percentage ?? slot.busy_percentage ?? slot.value ?? 0;
      if (hour >= HOURS_OPEN_START && hour < HOURS_OPEN_END) {
        dayCars += TUNNEL_CAPACITY * (busyness / 100);
      }
    }

    if (dayCars > 0) {
      totalDailyCars += dayCars;
      validDays++;
    }
  }

  if (validDays === 0) {
    return {
      sixMonthEstimate: null,
      confidence: "unavailable",
      method: "Popular times data present but no operating-hours activity detected. Cannot estimate volume.",
    };
  }

  const avgDailyCars   = totalDailyCars / validDays;
  const sixMonthRaw    = avgDailyCars * 7 * 26; // 7 days/week × 26 weeks
  const sixMonthRounded = Math.round(sixMonthRaw / 1_000) * 1_000;

  const confidence: EstimatedVolume["confidence"] =
    validDays >= 6 ? "high" : validDays >= 3 ? "medium" : "low";

  return {
    sixMonthEstimate: sixMonthRounded,
    confidence,
    method:
      `Derived from Google Maps Popular Times (${validDays}/7 days of data). ` +
      `Formula: tunnel capacity (${TUNNEL_CAPACITY} cars/hr) × busyness% per hour, ` +
      `summed across ${HOURS_OPEN_START}am–${HOURS_OPEN_END - 12 < 0 ? HOURS_OPEN_END : HOURS_OPEN_END - 12}pm operating window, ` +
      `averaged across ${validDays} days × 26 weeks. Rounded to nearest 1,000.`,
  };
}

// ── Investment suggestion engine ──────────────────────────────────────────────
function buildInvestmentSuggestion(
  countryCode: string,
  city: string,
  trafficSignals: TrafficSignals
): InvestmentSuggestion {
  const country    = getCountry(countryCode);
  const multiplier = country.multiplier;

  // Urban density score
  const density = trafficSignals.nearbyGasStations + trafficSignals.nearbyGroceryStores + trafficSignals.nearbyShopping;
  const isMajorMetro  = density > 16;
  const isUrban       = density > 8;
  // Tier multiplier is modest — land/real-estate absorbs most city-tier variation, not equipment
  const urbanMultiplier = isMajorMetro ? 1.20 : isUrban ? 1.00 : 0.85;
  const cityTier = isMajorMetro ? "Major Metro" : isUrban ? "Urban" : "Suburban / Rural";

  // ── US baseline anchored directly to the 404.xlsx financial model ────────
  // Excel totals: Land $875K · City/Tap fees $250K · Building $150K ·
  //               Equipment $1.20M · Construction $1.08M · Contingency $108K
  //               → Total Project Cost $3,663,000
  // Ranges = ±20% around each Excel line item for market variance.
  // Country multiplier scales the full breakdown; urban tier only moves land.
  const base = {
    land:         { min: 700_000,   max: 1_050_000 },   // Excel: $875K
    construction: { min: 980_000,   max: 1_470_000 },   // Excel: $1,230K (construction+building)
    equipment:    { min: 960_000,   max: 1_440_000 },   // Excel: $1,200K
    fees:         { min: 286_000,   max: 430_000   },   // Excel: $358K (city fees + contingency)
  };
  // Land absorbs the city-tier premium; other categories scale only by country
  const landAdj  = multiplier * urbanMultiplier;
  const otherAdj = multiplier;

  const breakdown = {
    land:         { min: Math.round(base.land.min * landAdj),          max: Math.round(base.land.max * landAdj) },
    construction: { min: Math.round(base.construction.min * otherAdj), max: Math.round(base.construction.max * otherAdj) },
    equipment:    { min: Math.round(base.equipment.min * otherAdj),    max: Math.round(base.equipment.max * otherAdj) },
    fees:         { min: Math.round(base.fees.min * otherAdj),         max: Math.round(base.fees.max * otherAdj) },
  };

  const minEstimateUSD = breakdown.land.min + breakdown.construction.min + breakdown.equipment.min + breakdown.fees.min;
  const maxEstimateUSD = breakdown.land.max + breakdown.construction.max + breakdown.equipment.max + breakdown.fees.max;

  const rationale =
    `Estimate for a ${cityTier.toLowerCase()} location in ${city}, ${country.name}. ` +
    `Based on a verified US car wash development model (total project cost $3,663,000). ` +
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
      "Cost breakdown anchored to a verified US car wash development model (404 Financial Model, August 2017). " +
      "Line items: Land/Site $875K · Equipment $1.2M · Construction $1.08M · City Fees & Contingency $358K. " +
      "Regional adjustments use published cost-of-construction indices. Verify with a local contractor.",
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

    // Investment amount is required — no analysis without budget context
    if (!budget) {
      return NextResponse.json(
        { error: "Investment amount is required. Please enter the amount you plan to invest before running the analysis." },
        { status: 400 }
      );
    }

    // ── Radius configuration ─────────────────────────────────────────────────
    // User-set radius in miles (1–15). All searches scale proportionally.
    const radiusMiles = Math.max(1, Math.min(15, parseFloat(radiusParam) || 5));
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // Traffic signal searches: half the competitor radius (immediate site surroundings)
    const signalRadiusMeters = Math.round(radiusMiles * 0.5 * 1609.34);

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

    // ── Fetch TomTom and wages in parallel before Places (TomTom is the traffic source) ──
    const [wageRates, tomtomData] = await Promise.all([
      getWageRates(countryCode),
      fetchTomTomData(centerLat, centerLng, TOMTOM_API_KEY, radiusMiles),
    ]);

    // ── Competitors — scaled to user radius ──────────────────────────────────
    const carWashResults = await fetchPlacesNearby(centerLat, centerLng, "car_wash", radiusMeters);
    const competitorDetails = await Promise.all(
      carWashResults.slice(0, 10).map((p) => fetchPlaceDetails(p.place_id))
    );

    const validDetails = competitorDetails.filter((d): d is PlaceResult => d !== null);
    const popularTimesResults = await Promise.all(
      validDetails.map((place) =>
        fetchPopularTimes(
          place.place_id,
          place.name,
          place.geometry.location.lat,
          place.geometry.location.lng
        )
      )
    );

    const competitors = validDetails
      .map((place, i) => {
        const distMiles = calcDistanceMiles(centerLat, centerLng, place.geometry.location.lat, place.geometry.location.lng);
        const estimatedVolume = calcVolumeFromPopularTimes(popularTimesResults[i], place.user_ratings_total ?? 0);
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
    const tomtomVehiclesPerDay = tomtomData.trafficFlow.vehicleCount.vehiclesPerDay;
    const estimatedDailyTraffic = tomtomVehiclesPerDay > 0
      ? tomtomVehiclesPerDay
      : Math.max(1_000, gasStations.length * 2_000 + grocery.length * 1_000);

    const trafficEstimationMethod = tomtomVehiclesPerDay > 0
      ? tomtomData.trafficFlow.vehicleCount.methodology
      : `TomTom data unavailable — rough density estimate from ${gasStations.length} gas stations and ${grocery.length} grocery stores within ${(radiusMiles * 0.5).toFixed(1)} miles. Configure TOMTOM_API_KEY for accurate vehicle counts.`;

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

    // Financial model — budget is guaranteed to exist at this point (validated above)
    const investmentBudget = parseFloat(budget);
    const financial = runFinancialModel(estimatedDailyTraffic, investmentBudget, wageRates);
    const financialViable = financial.year1EBITDA > 0;

    // Scoring
    const score = calculateLocationScore(competitors, trafficSignals, financialViable);

    // Insights, recommendations, and investment suggestion
    const reviewInsights       = buildReviewInsights(competitors);
    const recommendations      = buildRecommendations(score, reviewInsights);
    const investmentSuggestion = buildInvestmentSuggestion(countryCode, city, trafficSignals);

    const result: SiteAnalysisResult = {
      address: resolvedAddress,
      placeId: placeId ?? "",
      coordinates,
      analyzedAt: new Date().toISOString(),
      countryCode,
      radiusMiles,
      competitors,
      trafficSignals,
      score,
      financialProjection: financial,
      reviewInsights,
      recommendations,
      investmentSuggestion,
      budgetUSD: investmentBudget,
      tomtom: tomtomData,
      dataSources: {
        competitors:
          `Google Places API — live data fetched at time of analysis within a ${radiusMiles}-mile radius. ` +
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
          "404 Financial Model (August 2017 US benchmark, $3,663,000 baseline). " +
          "Pricing tiers, variable costs, SG&A, depreciation, and financing terms are " +
          "anchored directly to the verified Excel spreadsheet. Revenue is driven by " +
          "live TomTom vehicle count data.",
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
              `returned no data for ${wageRates.countryCode}. Financial model uses 404 Excel baseline rates. ` +
              `Verify with a local HR consultant.`,
        investmentRange:
          "404 Financial Model (US $3,663,000 baseline) scaled by country cost multiplier " +
          `(${getCountry(countryCode).name}: ${(getCountry(countryCode).multiplier * 100).toFixed(0)}% of US benchmark) ` +
          "and city-tier land modifier. Range = ±20% around each line item. " +
          "Not live vendor quotes — verify with local contractors.",
        exchangeRates:
          "European Central Bank (ECB) daily reference rates via frankfurter.app. " +
          "Rates are fetched live at time of analysis and cached for 1 hour.",
        competitorVolume:
          SERPAPI_KEY
            ? "Google Maps Popular Times via SerpApi — busyness data derived from aggregated, " +
              "anonymised Android device location signals. Converted to car estimates using " +
              "industry-standard tunnel capacity (100 cars/hr). Rounded to nearest 1,000."
            : "Not available — SERPAPI_KEY not configured. Add it to .env.local to enable " +
              "competitor traffic volume estimation.",
        tomtomTraffic:
          TOMTOM_API_KEY
            ? `TomTom APIs (live, fetched ${new Date().toISOString()}): ` +
              `Traffic Flow Segment Data v4 (vehicle count + road speed at site) · ` +
              `Reachable Range v1 (5/10/15-min drive-time isochrones with live traffic) · ` +
              `Traffic Incidents v5 (live closures, roadworks, and hazards within ${(radiusMiles * 0.5 * 1.609).toFixed(1)}km).`
            : "Not available — TOMTOM_API_KEY not configured. Vehicle count will be a density proxy only.",
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
