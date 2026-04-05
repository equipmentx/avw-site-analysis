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
    const { address, placeId, lat, lng, budget } = body;

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

    // Nearby car washes
    const carWashResults = await fetchPlacesNearby(centerLat, centerLng, "car_wash", 8047);
    const competitorDetails = await Promise.all(
      carWashResults.slice(0, 10).map((p) => fetchPlaceDetails(p.place_id))
    );
    const competitors = competitorDetails
      .filter((d): d is PlaceResult => d !== null)
      .map((place) => {
        const distMiles = calcDistanceMiles(centerLat, centerLng, place.geometry.location.lat, place.geometry.location.lng);
        return analyzeCompetitor(place, parseFloat(distMiles.toFixed(2)));
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    // Traffic signals
    const [gasStations, grocery, fastFood, shopping, schools] = await Promise.all([
      fetchPlacesNearby(centerLat, centerLng, "gas_station",             3219),
      fetchPlacesNearby(centerLat, centerLng, "grocery_or_supermarket",  3219),
      fetchPlacesNearby(centerLat, centerLng, "restaurant",              1609),
      fetchPlacesNearby(centerLat, centerLng, "shopping_mall",           4828),
      fetchPlacesNearby(centerLat, centerLng, "school",                  3219),
    ]);

    // ── Live traffic estimation using Google Places review volume ────────────
    // Review counts on Google Maps correlate strongly with actual foot/vehicle traffic:
    // a gas station with 3,000+ reviews is on a major arterial; one with 50 reviews is quiet.
    // We use the average review count per place type as a per-location traffic signal.
    const avgGasReviews  = gasStations.length
      ? gasStations.reduce((s, p) => s + (p.user_ratings_total ?? 0), 0) / gasStations.length : 0;
    const avgFoodReviews = fastFood.length
      ? fastFood.reduce((s, p) => s + (p.user_ratings_total ?? 0), 0) / fastFood.length : 0;
    const avgGroceryReviews = grocery.length
      ? grocery.reduce((s, p) => s + (p.user_ratings_total ?? 0), 0) / grocery.length : 0;
    const avgShoppingReviews = shopping.length
      ? shopping.reduce((s, p) => s + (p.user_ratings_total ?? 0), 0) / shopping.length : 0;

    // Calibration: avg gas station reviews map to US AADT benchmarks:
    //   <100 reviews  → quiet local road  (~2,000–4,000 AADT)
    //   100–500        → suburban arterial (~4,000–10,000 AADT)
    //   500–1500       → busy commercial  (~10,000–18,000 AADT)
    //   1500+          → major corridor   (~18,000–25,000 AADT)
    const reviewBasedTraffic = Math.round(
      avgGasReviews     * 9.5 +   // gas stations: strongest traffic signal
      avgFoodReviews    * 3.2 +   // fast food: commuter stops
      avgGroceryReviews * 4.5 +   // grocery: regular destination traffic
      avgShoppingReviews * 2.0    // shopping: destination/weekend traffic
    );

    // Density floor (in case area has 0 reviews — new or sparse listings)
    const densityFloor =
      gasStations.length * 800 + grocery.length * 500 +
      fastFood.length * 200 + shopping.length * 400 + schools.length * 150;

    // Blend: 70% review-based (real data) + 30% density floor (safety net)
    const estimatedDailyTraffic = Math.max(2_000, Math.min(25_000,
      Math.round(reviewBasedTraffic * 0.7 + densityFloor * 0.3)
    ));

    const trafficEstimationMethod =
      `Estimated from live Google Maps review volume for this area: ` +
      `avg gas station reviews: ${Math.round(avgGasReviews)} · ` +
      `avg restaurant reviews: ${Math.round(avgFoodReviews)} · ` +
      `avg grocery reviews: ${Math.round(avgGroceryReviews)}. ` +
      `Higher review counts = busier road. ` +
      `Formula: review signal ×70% + place density ×30%, capped at 25,000/day.`;

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
    const financial = runFinancialModel(estimatedDailyTraffic, investmentBudget);
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
      competitors,
      trafficSignals,
      score,
      financialProjection: financial,
      reviewInsights,
      recommendations,
      investmentSuggestion,
      budgetUSD: investmentBudget,
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
