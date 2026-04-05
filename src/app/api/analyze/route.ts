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
import type {
  PlaceResult,
  TrafficSignals,
  SiteAnalysisResult,
  InvestmentSuggestion,
} from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const BASE_URL = "https://maps.googleapis.com/maps/api";

// ── Country cost multipliers (relative to US = 1.0) ──────────────────────────
// Based on published construction cost indices, land valuations, and labor rates
const COUNTRY_DATA: Record<string, { multiplier: number; name: string; context: string }> = {
  US: { multiplier: 1.00, name: "United States",    context: "US market — benchmark pricing with high land and labor costs." },
  GB: { multiplier: 0.88, name: "United Kingdom",   context: "UK market — slightly lower land costs outside London, comparable equipment costs." },
  AU: { multiplier: 0.92, name: "Australia",         context: "Australian market — high labor costs but competitive equipment sourcing." },
  CA: { multiplier: 0.93, name: "Canada",            context: "Canadian market — similar to US with regional cost variations." },
  AE: { multiplier: 0.78, name: "UAE",               context: "UAE market — lower construction labor, moderate land costs in commercial zones." },
  SA: { multiplier: 0.72, name: "Saudi Arabia",      context: "Saudi market — lower labor costs, strong government infrastructure support." },
  ZA: { multiplier: 0.22, name: "South Africa",      context: "South African market — significantly lower land and labor costs vs US." },
  NG: { multiplier: 0.14, name: "Nigeria",           context: "Nigerian market — lower base costs but factor in generator, security, and import duties on equipment." },
  GH: { multiplier: 0.13, name: "Ghana",             context: "Ghanaian market — attractive entry costs, growing middle-class demand for car wash services." },
  KE: { multiplier: 0.11, name: "Kenya",             context: "Kenyan market — very low land and labor costs, but factor in equipment import duties." },
  IN: { multiplier: 0.18, name: "India",             context: "Indian market — low labor and construction costs, large urbanizing consumer base." },
  BR: { multiplier: 0.34, name: "Brazil",            context: "Brazilian market — moderate costs, strong car culture and urban density." },
  MX: { multiplier: 0.30, name: "Mexico",            context: "Mexican market — lower costs than US, proximity to US supply chains for equipment." },
  JP: { multiplier: 0.95, name: "Japan",             context: "Japanese market — high precision equipment standards, premium consumer expectations." },
  CN: { multiplier: 0.35, name: "China",             context: "Chinese market — low construction costs but rapidly rising land costs in Tier 1 cities." },
  DE: { multiplier: 0.82, name: "Germany",           context: "German market — high labor costs offset by efficient construction practices." },
  FR: { multiplier: 0.80, name: "France",            context: "French market — moderate land costs outside Paris, established car wash industry." },
  NL: { multiplier: 0.85, name: "Netherlands",       context: "Dutch market — premium real estate costs, environmentally regulated operations." },
  SG: { multiplier: 0.90, name: "Singapore",         context: "Singapore market — very high land costs, strong per-capita vehicle ownership." },
  EM: { multiplier: 0.50, name: "Emerging Market",   context: "Emerging market — estimate based on regional cost indices. Verify with local contractors." },
};

// ── Google Places helpers ─────────────────────────────────────────────────────
async function fetchPlacesNearby(lat: number, lng: number, type: string, radius = 5000): Promise<PlaceResult[]> {
  const url = new URL(`${BASE_URL}/place/nearbysearch/json`);
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", radius.toString());
  url.searchParams.set("type", type);
  url.searchParams.set("key", GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? [];
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const url = new URL(`${BASE_URL}/place/details/json`);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "place_id,name,vicinity,formatted_address,geometry,rating,user_ratings_total,reviews,opening_hours,photos,business_status,types,price_level");
  url.searchParams.set("key", GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return data.result ?? null;
}

async function geocodeAddress(address: string): Promise<{
  lat: number; lng: number; formattedAddress: string;
  countryCode: string; countryName: string; city: string;
} | null> {
  const url = new URL(`${BASE_URL}/geocode/json`);
  url.searchParams.set("address", address);
  url.searchParams.set("key", GOOGLE_API_KEY);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results?.[0]) return null;

  const components = data.results[0].address_components ?? [];
  const countryComp = components.find((c: any) => c.types.includes("country"));
  const cityComp    = components.find((c: any) => c.types.includes("locality"))
                   ?? components.find((c: any) => c.types.includes("administrative_area_level_1"));

  const countryCode = countryComp?.short_name ?? "US";
  const countryName = COUNTRY_DATA[countryCode]?.name ?? countryComp?.long_name ?? "Unknown";
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
  const country    = COUNTRY_DATA[countryCode] ?? COUNTRY_DATA["EM"];
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

    const commercialDensity = gasStations.length + grocery.length + fastFood.length;
    const estimatedDailyTraffic = Math.max(2000, Math.min(25000, commercialDensity * 600 + gasStations.length * 1500));

    const trafficSignals: TrafficSignals = {
      nearbyGasStations:   gasStations.length,
      nearbyGroceryStores: grocery.length,
      nearbyFastFood:      fastFood.length,
      nearbyShopping:      shopping.length,
      nearbySchools:       schools.length,
      estimatedDailyTraffic,
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

    // Financial model
    const investmentBudget = budget ? parseFloat(budget) : undefined;
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
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json({ error: "Internal server error during analysis" }, { status: 500 });
  }
}
