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
} from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const BASE_URL = "https://maps.googleapis.com/maps/api";

async function fetchPlacesNearby(
  lat: number,
  lng: number,
  type: string,
  radius: number = 5000
): Promise<PlaceResult[]> {
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
  url.searchParams.set(
    "fields",
    "place_id,name,vicinity,formatted_address,geometry,rating,user_ratings_total,reviews,opening_hours,photos,business_status,types,price_level"
  );
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  return data.result ?? null;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  const url = new URL(`${BASE_URL}/geocode/json`);
  url.searchParams.set("address", address);
  url.searchParams.set("key", GOOGLE_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results?.[0]) return null;

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng, formattedAddress: data.results[0].formatted_address };
}

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

    // ── Resolve coordinates ──────────────────────────────────────────────────
    let coordinates: { lat: number; lng: number };
    let resolvedAddress = address;

    if (lat && lng) {
      coordinates = { lat, lng };
    } else if (address) {
      const geo = await geocodeAddress(address);
      if (!geo) {
        return NextResponse.json({ error: "Could not geocode address" }, { status: 400 });
      }
      coordinates = { lat: geo.lat, lng: geo.lng };
      resolvedAddress = geo.formattedAddress;
    } else {
      return NextResponse.json({ error: "Address or coordinates required" }, { status: 400 });
    }

    const { lat: centerLat, lng: centerLng } = coordinates;

    // ── Fetch nearby car washes (5km radius) ─────────────────────────────────
    const carWashResults = await fetchPlacesNearby(centerLat, centerLng, "car_wash", 8047); // 5 miles

    // ── Fetch details + reviews for each competitor ────────────────────────
    const competitorDetails = await Promise.all(
      carWashResults.slice(0, 10).map((place) => fetchPlaceDetails(place.place_id))
    );

    const competitors = competitorDetails
      .filter((d): d is PlaceResult => d !== null)
      .map((place) => {
        const distMiles = calcDistanceMiles(
          centerLat, centerLng,
          place.geometry.location.lat,
          place.geometry.location.lng
        );
        return analyzeCompetitor(place, parseFloat(distMiles.toFixed(2)));
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    // ── Fetch traffic signal places ───────────────────────────────────────
    const [gasStations, grocery, fastFood, shopping, schools] = await Promise.all([
      fetchPlacesNearby(centerLat, centerLng, "gas_station",    3219), // 2mi
      fetchPlacesNearby(centerLat, centerLng, "grocery_or_supermarket", 3219),
      fetchPlacesNearby(centerLat, centerLng, "restaurant",     1609), // 1mi
      fetchPlacesNearby(centerLat, centerLng, "shopping_mall",  4828), // 3mi
      fetchPlacesNearby(centerLat, centerLng, "school",         3219),
    ]);

    // Estimate daily traffic based on commercial density
    const commercialDensity = gasStations.length + grocery.length + fastFood.length;
    const estimatedDailyTraffic = Math.max(
      2000,
      Math.min(25000, commercialDensity * 600 + gasStations.length * 1500)
    );

    const trafficSignals: TrafficSignals = {
      nearbyGasStations:    gasStations.length,
      nearbyGroceryStores:  grocery.length,
      nearbyFastFood:       fastFood.length,
      nearbyShopping:       shopping.length,
      nearbySchools:        schools.length,
      estimatedDailyTraffic,
      trafficScore:         scoreTrafficSignals({
        nearbyGasStations: gasStations.length,
        nearbyGroceryStores: grocery.length,
        nearbyFastFood: fastFood.length,
        nearbyShopping: shopping.length,
        nearbySchools: schools.length,
        estimatedDailyTraffic,
        trafficScore: 0,
      }),
    };

    // ── Financial model ───────────────────────────────────────────────────
    const investmentBudget = budget ? parseFloat(budget) : undefined;
    const financial = runFinancialModel(estimatedDailyTraffic, investmentBudget);
    const financialViable = financial.year1EBITDA > 0;

    // ── Location scoring ──────────────────────────────────────────────────
    const score = calculateLocationScore(competitors, trafficSignals, financialViable);

    // ── Review insights & recommendations ─────────────────────────────────
    const reviewInsights = buildReviewInsights(competitors);
    const recommendations = buildRecommendations(score, reviewInsights);

    const result: SiteAnalysisResult = {
      address: resolvedAddress,
      placeId: placeId ?? "",
      coordinates,
      analyzedAt: new Date().toISOString(),
      competitors,
      trafficSignals,
      score,
      financialProjection: financial,
      reviewInsights,
      recommendations,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Internal server error during analysis" },
      { status: 500 }
    );
  }
}
