/**
 * /api/traffic-radius — Vehicle count across ALL roads within a radius
 *
 * Strategy:
 *   Uses a hex-grid sampling pattern that covers the entire circle area uniformly.
 *   Sample count scales with trade area: ~20 pts/mile of radius, capped at 250.
 *   This means 1-mile → ~40 pts, 3-mile → ~60 pts, 10-mile → ~200 pts, etc.,
 *   so "road points sampled" visibly grows as the user widens the radius.
 *
 *   For each point the TomTom Traffic Flow Segment Data API returns the nearest
 *   road segment, its road class (FRC0–FRC7), and live speed. We derive AADT
 *   via the BPR/HCM methodology (same as the main TomTom panel).
 *
 *   Unique road count is estimated from the FRC-class distribution of valid samples:
 *   each sample is assumed to represent the nearest distinct road corridor.
 *   Trade-area exposure = sum of (unique_roads[FRC] × avg_AADT[FRC]) across classes.
 *
 * Query params:
 *   lat, lng  — center coordinates (required)
 *   miles     — radius in miles, 1–25 (default 3)
 */

import { NextRequest, NextResponse } from "next/server";
import https from "https";
import { HTTP_AGENT } from "@/lib/dnsAgent";

const TOMTOM_KEY  = process.env.TOMTOM_API_KEY ?? "";
const TIMEOUT_MS  = 12_000;

// FHWA typical daily traffic by road class (vehicles/day, mid-range)
const AADT_BY_CLASS: Record<string, { min: number; typical: number; max: number }> = {
  FRC0: { min: 50_000,  typical: 80_000,  max: 150_000 },
  FRC1: { min: 20_000,  typical: 40_000,  max: 80_000  },
  FRC2: { min: 10_000,  typical: 22_000,  max: 45_000  },
  FRC3: { min: 5_000,   typical: 12_000,  max: 25_000  },
  FRC4: { min: 2_000,   typical: 6_000,   max: 12_000  },
  FRC5: { min: 500,     typical: 2_500,   max: 6_000   },
  FRC6: { min: 100,     typical: 800,     max: 2_500   },
};

function nativeGet(url: string): Promise<any | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), TIMEOUT_MS);
    const req = https.get(
      url,
      { agent: HTTP_AGENT, headers: { "User-Agent": "AVW-Site-Intel/1.0", "Accept": "application/json" } },
      (res) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer);
          res.resume();
          nativeGet(res.headers.location).then(resolve);
          return;
        }
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => {
          clearTimeout(timer);
          if (res.statusCode && res.statusCode >= 400) { resolve(null); return; }
          try { resolve(JSON.parse(raw)); } catch { resolve(null); }
        });
      }
    );
    req.on("error", () => { clearTimeout(timer); resolve(null); });
    req.end();
  });
}

/** 1 mile ≈ 0.014483° latitude anywhere on Earth */
const MILES_TO_DEG_LAT = 0.014483;

function milesToDegLat(miles: number) { return miles * MILES_TO_DEG_LAT; }
function milesToDegLng(miles: number, lat: number) {
  return miles * MILES_TO_DEG_LAT / Math.cos((lat * Math.PI) / 180);
}

/**
 * Build a hex grid that covers the ENTIRE circle area.
 *
 * A hex grid gives the best area coverage with minimum redundancy — each cell
 * covers a roughly equal portion of the total area. Alternate rows are offset
 * by half a cell width (standard hex-grid tessellation).
 *
 * Grid spacing is chosen so the circle contains approximately TARGET_POINTS
 * sample points, ensuring every significant road within the radius is sampled:
 *   N ≈ π × (R/d)²  →  d ≈ R × √(π / N)
 *
 * With TARGET_POINTS = 90, spacing = radius × 0.187
 *   1-mile  radius →  40 pts → spacing ≈ 0.28 miles → every major block sampled
 *   3-mile  radius →  60 pts → spacing ≈ 0.69 miles → every arterial sampled
 *   5-mile  radius → 100 pts → spacing ≈ 0.89 miles → all significant roads
 *   10-mile radius → 200 pts → spacing ≈ 1.25 miles → major + secondary network
 *   25-mile radius → 250 pts → spacing ≈ 2.81 miles → regional highway network
 */

// Sample count scales with trade area: 20 pts per mile, capped at 250
// Gives visible growth across the radius slider: 40→60→100→200→250
function targetPointsForRadius(miles: number): number {
  return Math.min(250, Math.max(40, Math.round(miles * 20)));
}

function buildHexGrid(lat: number, lng: number, miles: number): Array<{ lat: number; lng: number }> {
  const targetPoints = targetPointsForRadius(miles);
  const spacingMiles = Math.max(0.12, miles * Math.sqrt(Math.PI / targetPoints));

  const dLatPerCell = milesToDegLat(spacingMiles);
  const dLngPerCell = milesToDegLng(spacingMiles, lat);

  const points: Array<{ lat: number; lng: number }> = [{ lat, lng }]; // center always included

  // Row range covers the full diameter
  const rowCount = Math.ceil(miles / spacingMiles) + 1;

  for (let row = -rowCount; row <= rowCount; row++) {
    const dLat = row * dLatPerCell;
    // Hex offset: odd rows are shifted right by half a cell
    const colOffset = (Math.abs(row) % 2 === 1) ? 0.5 : 0;
    const colCount  = Math.ceil(miles / spacingMiles) + 1;

    for (let col = -colCount; col <= colCount; col++) {
      const dLng = (col + colOffset) * dLngPerCell;

      // Skip center (already added) and any point outside the circle
      if (dLat === 0 && dLng === 0) continue;

      const distMiles = Math.sqrt(
        Math.pow(dLat / MILES_TO_DEG_LAT, 2) +
        Math.pow(dLng * Math.cos((lat * Math.PI) / 180) / MILES_TO_DEG_LAT, 2)
      );

      if (distMiles <= miles) {
        points.push({ lat: lat + dLat, lng: lng + dLng });
      }
    }
  }

  return points;
}

interface SampleResult {
  aadt:  number;
  frc:   string;
}

/** Estimate vehicles/day + road class for a single TomTom flow response */
function flowToSample(flow: any): SampleResult | null {
  const seg = flow?.flowSegmentData;
  if (!seg) return null;

  const frc           = (seg.frc as string) ?? "FRC3";
  const currentSpeed  = seg.currentSpeed  as number;
  const freeFlowSpeed = seg.freeFlowSpeed as number;

  const aadt = AADT_BY_CLASS[frc] ?? AADT_BY_CLASS["FRC3"];

  let vehiclesPerDay: number;
  if (!currentSpeed || !freeFlowSpeed || freeFlowSpeed === 0) {
    vehiclesPerDay = Math.round((aadt.min + aadt.max) / 2);
  } else {
    const delayRatio  = freeFlowSpeed / currentSpeed;
    const cappedDelay = Math.min(delayRatio, 5.0);
    const vc = cappedDelay > 1
      ? Math.min(Math.pow((cappedDelay - 1) / 0.15, 0.25), 1.05)
      : 0;
    vehiclesPerDay = Math.round(aadt.min + vc * (aadt.max - aadt.min));
  }

  return { aadt: vehiclesPerDay, frc };
}

// Expected grid points per unique road corridor by road class.
// Higher FRC = smaller road = more roads per sq mile = fewer grid cells per road.
// Calibrated for typical US suburban road spacing.
const GRID_CELLS_PER_ROAD: Record<string, number> = {
  FRC0: 18, // highways appear in maybe 1-2 cells out of 90 per mile
  FRC1: 10,
  FRC2:  6,
  FRC3:  4,
  FRC4:  3,
  FRC5:  2,
  FRC6:  1,
};

export async function GET(req: NextRequest) {
  if (!TOMTOM_KEY) {
    return NextResponse.json({ error: "TomTom API key not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const lat   = parseFloat(searchParams.get("lat")   ?? "");
  const lng   = parseFloat(searchParams.get("lng")   ?? "");
  const miles = Math.min(25, Math.max(1, parseFloat(searchParams.get("miles") ?? "3")));

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const targetPts = targetPointsForRadius(miles);
  const points    = buildHexGrid(lat, lng, miles);
  const spacingMiles = (miles * Math.sqrt(Math.PI / targetPts)).toFixed(2);

  // Fetch all sample points in parallel with 25ms stagger
  // 250 pts × 25ms = ~6s max — well within TomTom rate limits
  const results = await Promise.all(
    points.map((pt, i) =>
      new Promise<SampleResult | null>((res) =>
        setTimeout(async () => {
          const url =
            `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json` +
            `?point=${pt.lat},${pt.lng}&unit=KMPH&key=${TOMTOM_KEY}`;
          const json = await nativeGet(url);
          res(flowToSample(json));
        }, i * 25)
      )
    )
  );

  const valid = results.filter((v): v is SampleResult => v !== null && v.aadt > 0);

  if (valid.length === 0) {
    return NextResponse.json({
      error: "TomTom returned no usable data for this location.",
      milesRadius: miles,
      vehiclesPerDay: null,
    });
  }

  // Group samples by FRC class
  const frcGroups: Record<string, number[]> = {};
  for (const s of valid) {
    if (!frcGroups[s.frc]) frcGroups[s.frc] = [];
    frcGroups[s.frc].push(s.aadt);
  }

  // Estimate unique road corridors per FRC class.
  // Each unique road is expected to be hit by GRID_CELLS_PER_ROAD[frc] sample points
  // (calibrated to US suburban road spacing). More sample points = more distinct roads found.
  let totalVehiclesPerDay = 0;
  let totalUniqueRoads    = 0;
  const frcBreakdown: string[] = [];

  for (const [frc, aadts] of Object.entries(frcGroups)) {
    const cellsPerRoad   = GRID_CELLS_PER_ROAD[frc] ?? 3;
    const uniqueRoads    = Math.max(1, Math.round(aadts.length / cellsPerRoad));
    const avgAadt        = Math.round(aadts.reduce((a, b) => a + b, 0) / aadts.length);
    totalVehiclesPerDay += uniqueRoads * avgAadt;
    totalUniqueRoads    += uniqueRoads;
    frcBreakdown.push(`${frc}: ${uniqueRoads} road(s) @ ${avgAadt.toLocaleString()} avg`);
  }

  const avgVehicles = Math.round(
    valid.reduce((a, b) => a + b.aadt, 0) / valid.length
  );

  return NextResponse.json({
    milesRadius:      miles,
    vehiclesPerDay:   totalVehiclesPerDay,
    avgRoadVehicles:  avgVehicles,
    pointsSampled:    valid.length,
    totalPointsTried: points.length,
    uniqueRoadsEst:   totalUniqueRoads,
    note:
      `Hex-grid: ${valid.length}/${points.length} pts returned data ` +
      `(~${spacingMiles}-mile grid spacing, ${miles}-mile radius). ` +
      `${totalUniqueRoads} unique road corridors estimated from FRC-class distribution. ` +
      `Road breakdown: ${frcBreakdown.join(" · ")}. ` +
      `Total daily exposure = Σ(unique roads × avg AADT per class). ` +
      `Source: TomTom Traffic Flow API v4 + BPR/HCM methodology.`,
  });
}
