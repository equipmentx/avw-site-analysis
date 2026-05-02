/**
 * OSM Overpass proximity query — shared utility used by both the analyze
 * route (direct call) and the /api/proximity REST endpoint.
 *
 * Uses Node.js native https module (not fetch) because Next.js server-side
 * fetch has inconsistent behaviour with POST bodies to third-party APIs.
 *
 * Free, no API key. Data © OpenStreetMap contributors (ODbL).
 */

import https from "https";
import type { ProximityData } from "@/lib/types";

// Overpass endpoints — tried in order until one succeeds
const OVERPASS_ENDPOINTS = [
  { host: "overpass-api.de",        path: "/api/interpreter" },
  { host: "overpass.kumi.systems",  path: "/api/interpreter" },
  { host: "overpass.private.coffee", path: "/api/interpreter" },
];
const TIMEOUT_MS = 25_000;

// Radii tuned for car wash site analysis
const TRANSIT_RADIUS = 800;
const RETAIL_RADIUS  = 1200;
const DINING_RADIUS  = 600;
const PARKING_RADIUS = 400;

function buildQuery(lat: number, lng: number): string {
  return `
[out:json][timeout:20];
(
  node["public_transport"="stop_position"](around:${TRANSIT_RADIUS},${lat},${lng});
  node["highway"="bus_stop"](around:${TRANSIT_RADIUS},${lat},${lng});
  node["railway"="station"](around:${TRANSIT_RADIUS},${lat},${lng});
  node["railway"="halt"](around:${TRANSIT_RADIUS},${lat},${lng});
  node["amenity"="bus_station"](around:${TRANSIT_RADIUS},${lat},${lng});
  node["shop"~"supermarket|department_store|mall|convenience|car_parts|automotive"](around:${RETAIL_RADIUS},${lat},${lng});
  way["shop"~"supermarket|department_store|mall"](around:${RETAIL_RADIUS},${lat},${lng});
  node["amenity"~"fast_food|restaurant|cafe|food_court"](around:${DINING_RADIUS},${lat},${lng});
  node["amenity"="parking"](around:${PARKING_RADIUS},${lat},${lng});
  way["amenity"="parking"](around:${PARKING_RADIUS},${lat},${lng});
);
out tags;
`.trim();
}

function scoreAmenities(transitStops: number, retailAnchors: number, diningPlaces: number, parkingAreas: number) {
  const transitScore = Math.min(transitStops / 5, 1) * 40;
  const diningScore  = Math.min(diningPlaces  / 8, 1) * 30;
  const parkingScore = Math.min(parkingAreas  / 3, 1) * 30;
  const amenityScore = Math.round(transitScore + diningScore + parkingScore);
  const cotenantScore = Math.min(Math.round((retailAnchors / 6) * 100), 100);
  return { amenityScore, cotenantScore };
}

function httpsPost(host: string, path: string, body: string): Promise<any | null> {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      path,
      method: "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent":    "AVW-Site-Intel/1.0 (car wash site analysis)",
        "Accept":        "application/json",
      },
    };

    const timer = setTimeout(() => {
      console.warn(`[AVW/proximity] Timeout after ${TIMEOUT_MS}ms — ${host}`);
      resolve(null);
    }, TIMEOUT_MS);

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) {
          console.warn(`[AVW/proximity] ${host} returned HTTP ${res.statusCode}`);
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          console.warn(`[AVW/proximity] ${host} returned non-JSON response`);
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      console.warn(`[AVW/proximity] ${host} request error:`, err.message);
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

export async function fetchProximityFromOverpass(lat: number, lng: number): Promise<ProximityData> {
  const unavailable: ProximityData = {
    transitStops: 0, retailAnchors: 0, diningPlaces: 0, parkingAreas: 0,
    amenityScore: 0, cotenantScore: 0,
    osmSource: "OpenStreetMap via Overpass API — fetch failed or timed out",
    fetchedAt: new Date().toISOString(),
    status: "unavailable",
  };

  const query = buildQuery(lat, lng);
  const body  = `data=${encodeURIComponent(query)}`;
  let data: any = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    console.log(`[AVW/proximity] Trying Overpass endpoint: ${endpoint.host}`);
    // Try each endpoint twice before moving on — handles transient timeouts
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await httpsPost(endpoint.host, endpoint.path, body);
      if (result?.elements) {
        console.log(`[AVW/proximity] Success from ${endpoint.host} (attempt ${attempt}) — ${result.elements.length} elements`);
        data = result;
        break;
      }
      if (attempt === 1) {
        console.warn(`[AVW/proximity] ${endpoint.host} attempt 1 failed — retrying in 1.5s`);
        await new Promise(r => setTimeout(r, 1_500));
      }
    }
    if (data?.elements) break;
    console.warn(`[AVW/proximity] ${endpoint.host} — both attempts failed, trying next endpoint`);
  }

  if (!data?.elements) {
    console.warn("[AVW/proximity] All Overpass endpoints failed — returning unavailable");
    return unavailable;
  }

  const transitTypes = new Set(["stop_position", "bus_stop", "station", "halt", "bus_station"]);
  const retailTags   = new Set(["supermarket", "department_store", "mall", "convenience", "car_parts", "automotive"]);
  const diningTypes  = new Set(["fast_food", "restaurant", "cafe", "food_court"]);

  let transitStops = 0, retailAnchors = 0, diningPlaces = 0, parkingAreas = 0;

  for (const el of data.elements as any[]) {
    const tags = el.tags ?? {};
    if      (tags.public_transport && transitTypes.has(tags.public_transport)) transitStops++;
    else if (tags.highway === "bus_stop")                                       transitStops++;
    else if (tags.railway && transitTypes.has(tags.railway))                   transitStops++;
    else if (tags.amenity === "bus_station")                                    transitStops++;
    else if (tags.shop && retailTags.has(tags.shop))                           retailAnchors++;
    else if (tags.amenity && diningTypes.has(tags.amenity))                    diningPlaces++;
    else if (tags.amenity === "parking")                                        parkingAreas++;
  }

  const { amenityScore, cotenantScore } = scoreAmenities(transitStops, retailAnchors, diningPlaces, parkingAreas);

  return {
    transitStops, retailAnchors, diningPlaces, parkingAreas,
    amenityScore, cotenantScore,
    osmSource:
      `OpenStreetMap via Overpass API (overpass-api.de). ` +
      `Transit radius: ${TRANSIT_RADIUS}m · Retail radius: ${RETAIL_RADIUS}m · ` +
      `Dining radius: ${DINING_RADIUS}m. Free, no API key required. ` +
      `Data © OpenStreetMap contributors (ODbL).`,
    fetchedAt: new Date().toISOString(),
    status: "live",
  };
}
