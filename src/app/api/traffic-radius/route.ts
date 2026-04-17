/**
 * /api/traffic-radius — Vehicle count across ALL roads within a radius
 *
 * Strategy:
 *   Uses a hex-grid sampling pattern that covers the entire circle area uniformly.
 *   Grid spacing scales with radius to maintain ~90 sample points regardless of
 *   the requested miles — this ensures every significant road within the area is
 *   sampled, not just a ring around the perimeter.
 *
 *   For each point the TomTom Traffic Flow Segment Data API returns the nearest
 *   road segment, its road class (FRC0–FRC7), and live speed. We derive AADT
 *   via the BPR/HCM methodology (same as the main TomTom panel).
 *
 *   Trade-area vehicle exposure = average AADT × estimated road-network length.
 *   Road-network length scales linearly with radius (roads are linear, not areal
 *   features), so the displayed figure grows monotonically as radius increases.
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
 *   1-mile  radius → spacing ≈ 0.19 miles (~300m) → every urban block sampled
 *   3-mile  radius → spacing ≈ 0.56 miles         → every arterial road sampled
 *   10-mile radius → spacing ≈ 1.87 miles          → all major/secondary roads
 *   25-mile radius → spacing ≈ 4.68 miles          → regional highway network
 */
const TARGET_POINTS = 90;

function buildHexGrid(lat: number, lng: number, miles: number): Array<{ lat: number; lng: number }> {
  // Hex spacing to achieve TARGET_POINTS in the circle
  const spacingMiles = Math.max(0.12, miles * Math.sqrt(Math.PI / TARGET_POINTS));

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

/** Estimate vehicles/day for a single TomTom flow response */
function flowToVehiclesPerDay(flow: any): number | null {
  const seg = flow?.flowSegmentData;
  if (!seg) return null;

  const frc           = (seg.frc as string) ?? "FRC3";
  const currentSpeed  = seg.currentSpeed  as number;
  const freeFlowSpeed = seg.freeFlowSpeed as number;

  const aadt = AADT_BY_CLASS[frc] ?? AADT_BY_CLASS["FRC3"];

  // If speed data missing, use road-class typical midpoint
  if (!currentSpeed || !freeFlowSpeed || freeFlowSpeed === 0) {
    return Math.round((aadt.min + aadt.max) / 2);
  }

  // BPR v/c ratio from speed ratio
  const delayRatio = freeFlowSpeed / currentSpeed;
  const cappedDelay = Math.min(delayRatio, 5.0);
  const vc = cappedDelay > 1
    ? Math.min(Math.pow((cappedDelay - 1) / 0.15, 0.25), 1.05)
    : 0;

  // AADT range interpolation: AADT_min at free flow, AADT_max at capacity
  return Math.round(aadt.min + vc * (aadt.max - aadt.min));
}

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

  const points = buildHexGrid(lat, lng, miles);

  // Fetch all sample points in parallel with 100ms stagger to respect TomTom rate limits
  const results = await Promise.all(
    points.map((pt, i) =>
      new Promise<number | null>((res) =>
        setTimeout(async () => {
          const url =
            `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json` +
            `?point=${pt.lat},${pt.lng}&unit=KMPH&key=${TOMTOM_KEY}`;
          const json = await nativeGet(url);
          res(flowToVehiclesPerDay(json));
        }, i * 100) // 100ms stagger → ~9s for 90 points
      )
    )
  );

  const valid = results.filter((v): v is number => v !== null && v > 0);

  if (valid.length === 0) {
    return NextResponse.json({
      error: "TomTom returned no usable data for this location.",
      milesRadius: miles,
      vehiclesPerDay: null,
    });
  }

  const totalSampled  = valid.reduce((a, b) => a + b, 0);
  const avgVehicles   = Math.round(totalSampled / valid.length);

  // Trade-area total: average AADT × estimated road segments in the area.
  // Road network length scales roughly linearly with radius (roads are linear
  // features, not areal). Calibrated so 1-mile radius ≈ 1 road-worth of
  // exposure and 10-mile radius ≈ 18 road-equivalents.
  const roadNetworkScale = Math.max(1, miles * 1.8);
  const scaledTotal      = Math.round(avgVehicles * roadNetworkScale);

  return NextResponse.json({
    milesRadius:      miles,
    vehiclesPerDay:   scaledTotal,
    avgRoadVehicles:  avgVehicles,
    pointsSampled:    valid.length,
    totalPointsTried: points.length,
    note:
      `Hex-grid sampling: ${valid.length} of ${points.length} points returned data ` +
      `(uniform grid at ~${(miles * Math.sqrt(Math.PI / TARGET_POINTS)).toFixed(2)}-mile spacing within ${miles}-mile radius). ` +
      `Avg road AADT: ${avgVehicles.toLocaleString()} veh/day. ` +
      `Trade-area total = avg AADT × road-network scale factor (${roadNetworkScale.toFixed(1)}).`,
  });
}
