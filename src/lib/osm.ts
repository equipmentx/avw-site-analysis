/**
 * OpenStreetMap Overpass API — Building Footprint
 *
 * Fetches the building footprint polygon for the structure nearest to the
 * given coordinates. Used to compute on-site building square footage.
 *
 * Free, no API key required.
 * Endpoint: https://overpass-api.de/api/interpreter
 *
 * Query strategy:
 *   1. Search for any "building" tagged way within 100 m of the coordinates
 *   2. Return the first way (closest matches tend to be first)
 *   3. Compute polygon area via Shoelace formula
 *   4. Convert from m² to sq ft
 *
 * Area accuracy: flat-earth approximation, good to < 1% for parcels < 10 acres.
 */

import https from "https";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const TIMEOUT_MS   = 15_000;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OSMBuilding {
  /** Polygon of building outline as lat/lng pairs */
  polygon:       Array<{ lat: number; lng: number }>;
  /** Footprint area in square feet (Shoelace, WGS-84) */
  footprintSqFt: number | null;
  /** Footprint area in square metres */
  footprintSqM:  number | null;
  /** OSM way ID (for reference / deep-link) */
  osmWayId:      number | null;
  /** Building type tag (e.g. "commercial", "retail", "yes") */
  buildingType:  string | null;
  status:        "live" | "unavailable";
  source:        string;
  fetchedAt:     string;
}

// ── Shoelace formula — polygon area in m² ─────────────────────────────────────
// Uses the spherical excess approximation suitable for small parcels.
// Input: array of {lat, lng} in decimal degrees.
// Returns area in square metres.
function shoelaceAreaM2(ring: Array<{ lat: number; lng: number }>): number {
  const n = ring.length;
  if (n < 3) return 0;

  // Convert to approximate Cartesian (metres) relative to centroid
  const latMid = ring.reduce((s, p) => s + p.lat, 0) / n;
  const DEG_TO_M_LAT = 111_320;                                      // 1° lat ≈ 111 320 m
  const DEG_TO_M_LNG = 111_320 * Math.cos((latMid * Math.PI) / 180); // shrinks near poles

  let area = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].lng * DEG_TO_M_LNG;
    const yi = ring[i].lat * DEG_TO_M_LAT;
    const xj = ring[j].lng * DEG_TO_M_LNG;
    const yj = ring[j].lat * DEG_TO_M_LAT;
    area += (xj + xi) * (yj - yi);
  }
  return Math.abs(area) / 2;
}

// ── HTTP helper (native https — avoids Windows SSL fetch issues) ───────────────
function overpassPost(body: string): Promise<any | null> {
  return new Promise((resolve) => {
    const urlObj  = new URL(OVERPASS_URL);
    const payload = Buffer.from(body, "utf-8");
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname,
      method:   "POST",
      headers: {
        "Content-Type":   "application/x-www-form-urlencoded",
        "Content-Length": payload.length,
        "User-Agent":     "AVW-Site-Intel/1.0",
        "Accept":         "application/json",
      },
    };

    const timer = setTimeout(() => {
      console.warn("[AVW] Overpass timeout");
      resolve(null);
    }, TIMEOUT_MS);

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) {
          console.warn(`[AVW] Overpass HTTP ${res.statusCode}:`, raw.slice(0, 200));
          resolve(null);
          return;
        }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      console.warn("[AVW] Overpass error:", err.message);
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function fetchOSMBuilding(
  lat: number,
  lng: number,
): Promise<OSMBuilding> {
  const unavailable = (reason: string): OSMBuilding => ({
    polygon: [], footprintSqFt: null, footprintSqM: null,
    osmWayId: null, buildingType: null,
    status: "unavailable",
    source: reason,
    fetchedAt: new Date().toISOString(),
  });

  // Overpass QL — find buildings within 100 m, return nodes too (for geometry)
  // Timeout is set low (8s) inside the query to avoid holding connections
  const query = `
[out:json][timeout:8];
(
  way["building"](around:100,${lat},${lng});
);
out body;
>;
out skel qt;
`.trim();

  const body = `data=${encodeURIComponent(query)}`;
  const json = await overpassPost(body);

  if (!json) return unavailable("OpenStreetMap Overpass request failed or timed out.");

  const elements: any[] = json?.elements ?? [];
  if (!elements.length) return unavailable("No building footprint found within 100 m of this location in OpenStreetMap.");

  // Build a node id → {lat, lng} lookup
  const nodes: Record<number, { lat: number; lng: number }> = {};
  for (const el of elements) {
    if (el.type === "node" && typeof el.lat === "number") {
      nodes[el.id] = { lat: el.lat, lng: el.lon };
    }
  }

  // Find the first way element that has nodes
  const way = elements.find((el) => el.type === "way" && Array.isArray(el.nodes) && el.nodes.length > 2);
  if (!way) return unavailable("Overpass returned elements but no usable building way polygon.");

  // Resolve node refs → polygon
  const polygon: Array<{ lat: number; lng: number }> = [];
  for (const nodeId of way.nodes as number[]) {
    const n = nodes[nodeId];
    if (n) polygon.push(n);
  }

  if (polygon.length < 3) return unavailable("Building polygon has fewer than 3 nodes — geometry unusable.");

  // Area via Shoelace
  const areaM2   = shoelaceAreaM2(polygon);
  const areaSqFt = areaM2 > 0 ? Math.round(areaM2 * 10.7639) : null; // 1 m² = 10.7639 ft²

  const buildingType: string | null = way.tags?.building ?? null;
  const osmWayId: number            = way.id;

  console.log(`[AVW] OSM building found — way ${osmWayId}, ${polygon.length} nodes, ~${areaSqFt?.toLocaleString() ?? "?"} sq ft`);

  return {
    polygon,
    footprintSqFt: areaSqFt,
    footprintSqM:  areaM2 > 0 ? Math.round(areaM2) : null,
    osmWayId,
    buildingType,
    status:    "live",
    source:    `OpenStreetMap via Overpass API (overpass-api.de). Building way ${osmWayId}. ` +
               `Footprint polygon from OSM contributor data — accuracy reflects OSM survey quality. ` +
               `Area computed via Shoelace formula. Free, no API key required.`,
    fetchedAt: new Date().toISOString(),
  };
}
