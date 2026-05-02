/**
 * Census demographics aggregated by TomTom drive-time isochrone zones.
 *
 * Method:
 *   1. Sample N points inside each isochrone polygon (ray-casting point-in-polygon).
 *   2. Call Census Reporter /geo/contains for each sample point to get tract geo_ids.
 *   3. De-duplicate unique tract geo_ids across all sample points.
 *   4. Fetch ACS 5-year data for each unique tract via Census Reporter.
 *   5. Aggregate: sum populations/households; weighted-average the rate metrics.
 *
 * This gives realistic "who lives within X minutes of this site" demographics
 * based on actual drive-time polygons rather than radius circles.
 *
 * Sources: US Census Bureau ACS 5-Year Estimates 2024 via api.censusreporter.org.
 */

import https from "https";
import { HTTP_AGENT } from "./dnsAgent";
import { computeMetrics, fetchFromCensusReporter } from "./census";
import type { TradeAreaDemographics, TradeAreaZoneData } from "./types";

type Point = { lat: number; lng: number };

// ── Geometry helpers ──────────────────────────────────────────────────────────

function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    if (((yi > pt.lat) !== (yj > pt.lat)) &&
        (pt.lng < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonCentroid(poly: Point[]): Point {
  return {
    lat: poly.reduce((s, p) => s + p.lat, 0) / poly.length,
    lng: poly.reduce((s, p) => s + p.lng, 0) / poly.length,
  };
}

function boundingBox(poly: Point[]) {
  return {
    minLat: Math.min(...poly.map(p => p.lat)),
    maxLat: Math.max(...poly.map(p => p.lat)),
    minLng: Math.min(...poly.map(p => p.lng)),
    maxLng: Math.max(...poly.map(p => p.lng)),
  };
}

// Returns up to `n` sample points that lie inside the polygon.
// Uses a grid over the bounding box, always includes the centroid.
function samplePoints(poly: Point[], n = 6): Point[] {
  if (poly.length === 0) return [];
  const centroid = polygonCentroid(poly);
  const pts: Point[] = [centroid];
  const bbox = boundingBox(poly);
  const steps = Math.ceil(Math.sqrt(n * 3));
  for (let i = 0; i < steps && pts.length < n; i++) {
    for (let j = 0; j < steps && pts.length < n; j++) {
      const lat = bbox.minLat + (bbox.maxLat - bbox.minLat) * (i + 0.5) / steps;
      const lng = bbox.minLng + (bbox.maxLng - bbox.minLng) * (j + 0.5) / steps;
      const pt = { lat, lng };
      if (pointInPolygon(pt, poly)) pts.push(pt);
    }
  }
  return pts.slice(0, n);
}

// ── Census Reporter geo/contains ──────────────────────────────────────────────

function crGet(url: string, timeoutMs = 12_000): Promise<any | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const req = https.get(url, { agent: HTTP_AGENT, headers: { "User-Agent": "AVW-Site-Intel/1.0", "Accept": "application/json" } }, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        clearTimeout(timer);
        if ((res.statusCode ?? 0) >= 400) { resolve(null); return; }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", () => { clearTimeout(timer); resolve(null); });
    req.end();
  });
}

async function getTractGeoId(lat: number, lng: number): Promise<string | null> {
  // Primary: Census Reporter geo/contains
  const url = `https://api.censusreporter.org/1.0/geo/contains?lat=${lat}&lon=${lng}&sumlevs=140`;
  const data = await crGet(url);
  const results: Array<{ geoid?: string }> = data?.results ?? [];
  const tract = results.find(r => r.geoid?.startsWith("14000US"));
  if (tract?.geoid) return tract.geoid;

  // Fallback: FCC Block API → reconstruct geo_id
  const fcc = await crGet(`https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&format=json`, 12_000);
  const blockFips = fcc?.Block?.FIPS as string | undefined;
  if (blockFips && blockFips.length >= 11) {
    return `14000US${blockFips.slice(0, 11)}`;
  }

  // Fallback: Census Geocoder
  const cgUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Vintages&layers=Census%20Tracts&format=json`;
  const cg = await crGet(cgUrl, 12_000);
  const geo = cg?.result?.geographies?.["Census Tracts"]?.[0];
  if (geo?.STATE && geo?.COUNTY && geo?.TRACT) {
    return `14000US${geo.STATE}${geo.COUNTY}${geo.TRACT}`;
  }

  return null;
}

// ── Aggregate CensusRingData from multiple fetched datasets ──────────────────

function aggregateTracts(
  datasets: Array<Record<string, number>>,
  driveTimeMinutes: number,
): TradeAreaZoneData {
  if (!datasets.length) {
    return {
      driveTimeMinutes,
      label: `${driveTimeMinutes}-Min Drive Zone`,
      population: 0, households: 0, avgHouseholdSize: 0,
      laborForceParticipationPct: 0, unemploymentRatePct: 0,
      hhIncomeOver35kPct: 0, vehiclesPerHousehold: 0, noVehiclePct: 0,
      renterPct: 0, totalVehiclesEstimate: 0,
      tractsAnalyzed: 0, benchmarksMet: 0, benchmarksTotal: 3,
      source: "No Census data found for this zone.",
    };
  }

  // Sum raw variables across all tracts
  const totals: Record<string, number> = {};
  const keys = Array.from(new Set(datasets.flatMap(d => Object.keys(d))));
  for (const k of keys) {
    totals[k] = datasets.reduce((s, d) => s + (d[k] ?? 0), 0);
  }

  // Compute derived metrics from summed raw variables
  const ring = computeMetrics(totals, `${driveTimeMinutes}-Min Drive Zone`, `${driveTimeMinutes}-minute drive-time trade area`);

  const benchmarksMet = [ring.benchmarks.hhSize.met, ring.benchmarks.workingPop.met, ring.benchmarks.hhIncome35k.met].filter(Boolean).length;

  return {
    driveTimeMinutes,
    label: `${driveTimeMinutes}-Min Drive Zone`,
    population:                  ring.population,
    households:                  ring.households,
    avgHouseholdSize:            ring.avgHouseholdSize,
    laborForceParticipationPct:  ring.laborForceParticipation,
    unemploymentRatePct:         ring.unemploymentRate,
    hhIncomeOver35kPct:          ring.hhIncomeOver35kPct,
    vehiclesPerHousehold:        ring.vehiclesPerHousehold,
    noVehiclePct:                ring.noVehiclePct,
    renterPct:                   ring.renterPct,
    totalVehiclesEstimate:       ring.totalVehiclesEstimate,
    tractsAnalyzed:              datasets.length,
    benchmarksMet,
    benchmarksTotal: 3,
    source: `US Census ACS 5-Year 2024 — ${datasets.length} census tract(s) within ${driveTimeMinutes}-min drive-time isochrone (TomTom). Via api.censusreporter.org`,
  };
}

// ── Fetch ACS raw variables for a tract geo_id ────────────────────────────────

const ACS_TABLES = "B01003,B11001,B25010,B23025,B19001,B25003,B08201";

const ACS_VARS_DIRECT = [
  "B01003_001E","B11001_001E","B25010_001E","B23025_001E","B23025_002E","B23025_005E",
  "B19001_001E","B19001_008E","B19001_009E","B19001_010E","B19001_011E","B19001_012E",
  "B19001_013E","B19001_014E","B19001_015E","B19001_016E","B19001_017E",
  "B25003_001E","B25003_003E","B08201_001E","B08201_002E","B08201_003E",
  "B08201_004E","B08201_005E","B08201_006E",
].join(",");

async function fetchRawVarsViaCensusGov(geoId: string): Promise<Record<string, number> | null> {
  // geoId format: "14000US" + 2(state) + 3(county) + 6(tract)
  const fips = geoId.replace("14000US", "");
  if (fips.length < 11) return null;
  const state  = fips.slice(0, 2);
  const county = fips.slice(2, 5);
  const tract  = fips.slice(5, 11);
  const censusKey = process.env.CENSUS_ACS_API_KEY ?? "";
  const keyParam  = censusKey ? `&key=${censusKey}` : "";
  const geoParam  = `tract:${tract}&in=state:${state}%20county:${county}`;
  const url = `https://api.census.gov/data/2024/acs/acs5?get=${ACS_VARS_DIRECT}&for=${geoParam}${keyParam}`;
  const data: string[][] | null = await crGet(url, 20_000);
  if (!Array.isArray(data) || data.length < 2) return null;
  const headers = data[0];
  const row     = data[1];
  const r: Record<string, number> = {};
  headers.forEach((h: string, i: number) => {
    const v = parseFloat(row[i]);
    r[h] = isNaN(v) || v < 0 ? 0 : v;
  });
  return r;
}

async function fetchRawVarsForGeoId(geoId: string): Promise<Record<string, number> | null> {
  // Primary: Census Reporter (no key, CDN-backed)
  const url = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=${ACS_TABLES}&geo_ids=${geoId}`;
  const data = await crGet(url, 20_000);
  if (data?.data?.[geoId]) {
    const geoData = data.data[geoId] as Record<string, { estimate: Record<string, number> }>;
    const r: Record<string, number> = {};
    for (const tableData of Object.values(geoData)) {
      for (const [colId, value] of Object.entries(tableData?.estimate ?? {})) {
        const acsKey = colId.replace(/^([A-Z]\d{5})(\d{3})$/, "$1_$2E");
        r[acsKey] = typeof value === "number" && value >= 0 ? value : 0;
      }
    }
    return r;
  }

  // Fallback: direct api.census.gov (free, no key required)
  return fetchRawVarsViaCensusGov(geoId);
}

// ── Process one isochrone zone ────────────────────────────────────────────────

async function processZone(
  polygon: Point[],
  driveTimeMinutes: number,
): Promise<TradeAreaZoneData | null> {
  if (!polygon.length) return null;

  const samples = samplePoints(polygon, 6);
  if (!samples.length) return null;

  // Get tract geo_ids for all sample points in parallel
  const geoIds = await Promise.all(samples.map(p => getTractGeoId(p.lat, p.lng)));
  const uniqueGeoIds = Array.from(new Set(geoIds.filter((g): g is string => !!g)));

  if (!uniqueGeoIds.length) return null;

  // Fetch ACS data for each unique tract in parallel
  const rawVarSets = await Promise.all(uniqueGeoIds.map(id => fetchRawVarsForGeoId(id)));
  const validSets  = rawVarSets.filter((s): s is Record<string, number> => !!s);

  if (!validSets.length) return null;

  return aggregateTracts(validSets, driveTimeMinutes);
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchTradeAreaDemographics(
  fiveMinPolygon:    Point[],
  tenMinPolygon:     Point[],
  fifteenMinPolygon: Point[],
): Promise<TradeAreaDemographics | null> {
  // Only run for US sites — Census Reporter covers US only
  const hasPolygons = fiveMinPolygon.length > 0 || tenMinPolygon.length > 0 || fifteenMinPolygon.length > 0;
  if (!hasPolygons) return null;

  const [fiveMin, tenMin, fifteenMin] = await Promise.all([
    fiveMinPolygon.length    > 0 ? processZone(fiveMinPolygon,    5)  : Promise.resolve(null),
    tenMinPolygon.length     > 0 ? processZone(tenMinPolygon,     10) : Promise.resolve(null),
    fifteenMinPolygon.length > 0 ? processZone(fifteenMinPolygon, 15) : Promise.resolve(null),
  ]);

  const anyLive = fiveMin || tenMin || fifteenMin;
  if (!anyLive) return null;

  const liveCount = [fiveMin, tenMin, fifteenMin].filter(Boolean).length;

  return {
    fiveMin,
    tenMin,
    fifteenMin,
    status: liveCount === 3 ? "live" : liveCount > 0 ? "partial" : "unavailable",
    fetchedAt: new Date().toISOString(),
    note:
      "Demographics aggregated from US Census ACS 5-Year 2024 for each TomTom drive-time isochrone. " +
      "Method: sample points within each polygon → unique census tracts → aggregate ACS variables. " +
      "Zones are cumulative (15-min zone includes all areas within 15 minutes). " +
      "Source: api.censusreporter.org · US Census Bureau ACS 2020–2024.",
  };
}
