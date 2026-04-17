// ── US Census Bureau ACS 5-Year Estimates ────────────────────────────────────
// API key: CENSUS_ACS_API_KEY (set in .env.local)
// Used for: demographics, labor force, income, vehicle availability
// Only available for US locations — returns null for non-US addresses
//
// NOTE: Uses Node.js native https module (not fetch) to avoid Windows SSL
// certificate chain issues with government domains (api.census.gov,
// geocoding.geo.census.gov). Same pattern as tomtom.ts.

import https from "https";
import { HTTP_AGENT } from "./dnsAgent";

const CENSUS_API_KEY = process.env.CENSUS_ACS_API_KEY ?? "";
const ACS_YEAR = "2022"; // ACS 5-Year 2022 (most stable; 2023 released Dec 2024)
const ACS_BASE = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5`;

// ── ACS variable list ─────────────────────────────────────────────────────────
const ACS_VARS = [
  "B01003_001E",  // Total population
  "B11001_001E",  // Total households
  "B25010_001E",  // Avg household size (occupied units)
  "B23025_001E",  // Civilian non-institutional population 16+ (LF denominator)
  "B23025_002E",  // In labor force
  "B23025_005E",  // Unemployed
  "B19001_001E",  // Total HHs (income distribution denominator)
  // Household income brackets $35K and above:
  "B19001_008E",  // $35,000 – $39,999
  "B19001_009E",  // $40,000 – $44,999
  "B19001_010E",  // $45,000 – $49,999
  "B19001_011E",  // $50,000 – $59,999
  "B19001_012E",  // $60,000 – $74,999
  "B19001_013E",  // $75,000 – $99,999
  "B19001_014E",  // $100,000 – $124,999
  "B19001_015E",  // $125,000 – $149,999
  "B19001_016E",  // $150,000 – $199,999
  "B19001_017E",  // $200,000 or more
  "B25003_001E",  // Total occupied housing units
  "B25003_003E",  // Renter occupied
  "B08201_001E",  // Total HHs (vehicle availability denominator)
  "B08201_002E",  // No vehicle available
  "B08201_003E",  // 1 vehicle
  "B08201_004E",  // 2 vehicles
  "B08201_005E",  // 3 vehicles
  "B08201_006E",  // 4+ vehicles
].join(",");

// ── Public types ──────────────────────────────────────────────────────────────
export interface CensusRingData {
  label: string;               // "Census Tract" | "County"
  areaDescription: string;
  population: number;
  households: number;
  avgHouseholdSize: number;
  laborForceParticipation: number;  // %
  unemploymentRate: number;          // %
  hhIncomeOver35kPct: number;        // % of HHs with income ≥ $35K
  renterPct: number;                 // % renter occupied
  totalVehiclesEstimate: number;     // 1×v1 + 2×v2 + 3×v3 + 4×v4+
  vehiclesPerHousehold: number;
  noVehiclePct: number;              // % HHs with no vehicle
  // ICA / industry site-selection benchmarks
  benchmarks: {
    hhSize:      { value: number; target: number; met: boolean; label: string };
    workingPop:  { value: number; target: number; met: boolean; label: string };
    hhIncome35k: { value: number; target: number; met: boolean; label: string };
  };
  source: string;
  fetchedAt: string;
}

export interface CensusData {
  tract:      CensusRingData;
  county:     CensusRingData;
  stateFips:  string;
  countyFips: string;
  tractFips:  string;
  countyName: string;
  status:     "live" | "unavailable";
  fetchedAt:  string;
}

// HTTP_AGENT imported from dnsAgent.ts — uses Google DNS (8.8.8.8) to bypass
// local DNS resolver that blocks api.census.gov on this machine.

// ── Native https fetch helper (avoids Windows SSL issues with gov domains) ────
// Follows up to 5 redirects — census.gov and geo.fcc.gov both redirect.
function censusGet(url: string, redirectsLeft = 5): Promise<any | null> {
  if (redirectsLeft <= 0) {
    console.warn("[Census] Too many redirects →", url.slice(0, 80));
    return Promise.resolve(null);
  }
  const safeUrl = url.replace(/key=[^&]+/, "key=***");

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[Census] Timeout (20s) → ${safeUrl}`);
      resolve(null);
    }, 20_000);

    const req = https.get(url, { agent: HTTP_AGENT, headers: { "User-Agent": "AVW-Site-Intel/1.0" } }, (res) => {
      // Follow redirects (301, 302, 303, 307, 308)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        res.resume(); // drain the response so the socket is freed
        console.log(`[Census] Redirect ${res.statusCode} → ${res.headers.location.slice(0, 80)}`);
        censusGet(res.headers.location, redirectsLeft - 1).then(resolve);
        return;
      }

      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) {
          console.warn(`[Census] HTTP ${res.statusCode} → ${safeUrl}`);
          console.warn(`[Census] Body:`, raw.slice(0, 300));
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          console.warn(`[Census] Non-JSON response → ${safeUrl}`);
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      console.warn(`[Census] Request error → ${safeUrl}:`, err.message);
      resolve(null);
    });

    req.end();
  });
}

// ── FCC Block API: lat/lng → FIPS codes (primary, most reliable) ─────────────
//
// FCC Census Block Conversions API is simpler and more reliable than the Census
// Geocoder on Windows. Returns Census Block FIPS from which we derive state,
// county, and tract codes needed for ACS queries.
//
// Example FIPS "360470023001000":
//   state  = chars 0-1  = "36"
//   county = chars 2-4  = "047"
//   tract  = chars 5-10 = "002300"
//   block  = chars 11-14 = "1000"
async function getGeographyFipsFCC(lat: number, lng: number): Promise<{
  state: string; county: string; tract: string; countyName: string;
} | null> {
  const url =
    `https://geo.fcc.gov/api/census/block/find` +
    `?latitude=${lat}&longitude=${lng}&format=json`;

  const data = await censusGet(url);
  if (!data) {
    console.warn("[Census] FCC Block API returned null");
    return null;
  }

  const blockFips  = data?.Block?.FIPS  as string | undefined;
  const countyFips = data?.County?.FIPS as string | undefined;
  const countyName = data?.County?.name as string | undefined;

  if (!blockFips || blockFips.length < 11) {
    console.warn("[Census] FCC Block API: invalid FIPS", blockFips);
    return null;
  }

  const state  = blockFips.slice(0, 2);
  const county = blockFips.slice(2, 5);
  const tract  = blockFips.slice(5, 11);

  // Sanity check: county from Block FIPS should match County.FIPS
  if (countyFips && !countyFips.endsWith(county)) {
    console.warn("[Census] FCC county FIPS mismatch — using block-derived value");
  }

  console.log(`[Census] FCC FIPS — state:${state} county:${county} tract:${tract} (${countyName ?? "unknown county"})`);
  return { state, county, tract, countyName: countyName ?? "County" };
}

// ── Census Geocoder: lat/lng → FIPS codes (fallback) ─────────────────────────
async function getGeographyFipsCensus(lat: number, lng: number): Promise<{
  state: string; county: string; tract: string; countyName: string;
} | null> {
  const url =
    `https://geocoding.geo.census.gov/geocoder/geographies/coordinates` +
    `?x=${lng}&y=${lat}` +
    `&benchmark=Public_AR_Current&vintage=Current_Vintages&layers=Census%20Tracts&format=json`;

  const data = await censusGet(url);
  if (!data) return null;

  const geo = data?.result?.geographies?.["Census Tracts"]?.[0];
  if (!geo) {
    console.warn("[Census] Census Geocoder returned no tract — likely non-US or no coverage");
    return null;
  }
  return {
    state:      geo.STATE    ?? "",
    county:     geo.COUNTY   ?? "",
    tract:      geo.TRACT    ?? "",
    countyName: geo.BASENAME ?? geo.NAME ?? "County",
  };
}

// ── Combined geocoder: FCC primary, Census fallback ───────────────────────────
async function getGeographyFips(lat: number, lng: number): Promise<{
  state: string; county: string; tract: string; countyName: string;
} | null> {
  // Try FCC first (simpler endpoint, uses Let's Encrypt certs = no Windows SSL issues)
  const fcc = await getGeographyFipsFCC(lat, lng);
  if (fcc) return fcc;

  // Fall back to Census geocoder
  console.warn("[Census] FCC lookup failed — trying Census Geocoder as fallback");
  return getGeographyFipsCensus(lat, lng);
}

// ── Parse raw ACS string array → numeric map ─────────────────────────────────
function parseRow(headers: string[], row: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  headers.forEach((h, i) => {
    const v = parseFloat(row[i]);
    out[h] = isNaN(v) || v < 0 ? 0 : v;
  });
  return out;
}

// ── Derive CensusRingData from raw ACS variables ──────────────────────────────
function computeMetrics(r: Record<string, number>, label: string, areaDesc: string): CensusRingData {
  const population    = r["B01003_001E"] ?? 0;
  const households    = r["B11001_001E"] ?? 0;
  const avgHHSize     = r["B25010_001E"] ?? 0;
  const pop16plus     = r["B23025_001E"] || 1;
  const laborForce    = r["B23025_002E"] ?? 0;
  const unemployed    = r["B23025_005E"] ?? 0;
  const totalHHIncome = r["B19001_001E"] || 1;

  const hhOver35k =
    (r["B19001_008E"] ?? 0) + (r["B19001_009E"] ?? 0) + (r["B19001_010E"] ?? 0) +
    (r["B19001_011E"] ?? 0) + (r["B19001_012E"] ?? 0) + (r["B19001_013E"] ?? 0) +
    (r["B19001_014E"] ?? 0) + (r["B19001_015E"] ?? 0) + (r["B19001_016E"] ?? 0) +
    (r["B19001_017E"] ?? 0);

  const totalOccupied = r["B25003_001E"] || 1;
  const renterOcc     = r["B25003_003E"] ?? 0;
  const totalVehHH    = r["B08201_001E"] || 1;
  const noVeh         = r["B08201_002E"] ?? 0;
  const veh1          = r["B08201_003E"] ?? 0;
  const veh2          = r["B08201_004E"] ?? 0;
  const veh3          = r["B08201_005E"] ?? 0;
  const veh4plus      = r["B08201_006E"] ?? 0;

  const totalVehicles  = veh1 + veh2 * 2 + veh3 * 3 + veh4plus * 4;
  const vehiclesPerHH  = households > 0 ? totalVehicles / households : 0;
  const lfParticipation = (laborForce / pop16plus) * 100;
  const unemployRate    = laborForce > 0 ? (unemployed / laborForce) * 100 : 0;
  const income35kPct    = (hhOver35k / totalHHIncome) * 100;
  const renterPct       = (renterOcc / totalOccupied) * 100;
  const noVehiclePct    = (noVeh / totalVehHH) * 100;

  // ICA / express car wash industry site-selection benchmark targets
  const HH_SIZE_TARGET  = 2.1;
  const WORKING_TARGET  = 55;   // % labor force participation
  const INCOME_TARGET   = 50;   // % HH income ≥ $35K

  return {
    label,
    areaDescription: areaDesc,
    population:      Math.round(population),
    households:      Math.round(households),
    avgHouseholdSize: parseFloat(avgHHSize.toFixed(2)),
    laborForceParticipation: parseFloat(lfParticipation.toFixed(1)),
    unemploymentRate: parseFloat(unemployRate.toFixed(1)),
    hhIncomeOver35kPct: parseFloat(income35kPct.toFixed(1)),
    renterPct:        parseFloat(renterPct.toFixed(1)),
    totalVehiclesEstimate: Math.round(totalVehicles),
    vehiclesPerHousehold:  parseFloat(vehiclesPerHH.toFixed(2)),
    noVehiclePct:     parseFloat(noVehiclePct.toFixed(1)),
    benchmarks: {
      hhSize: {
        value: parseFloat(avgHHSize.toFixed(2)),
        target: HH_SIZE_TARGET,
        met:    avgHHSize >= HH_SIZE_TARGET,
        label:  "Avg Household Size",
      },
      workingPop: {
        value: parseFloat(lfParticipation.toFixed(1)),
        target: WORKING_TARGET,
        met:    lfParticipation >= WORKING_TARGET,
        label:  "Working Population",
      },
      hhIncome35k: {
        value: parseFloat(income35kPct.toFixed(1)),
        target: INCOME_TARGET,
        met:    income35kPct >= INCOME_TARGET,
        label:  "HH Income ≥ $35K",
      },
    },
    source:    `US Census Bureau ACS 5-Year Estimates (${ACS_YEAR})`,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Single ACS API call for a given geography predicate ──────────────────────
async function fetchACS(
  geoParam: string,
  label: string,
  areaDesc: string,
): Promise<CensusRingData | null> {
  const url = `${ACS_BASE}?get=${ACS_VARS}&for=${geoParam}&key=${CENSUS_API_KEY}`;
  const data: string[][] | null = await censusGet(url);

  if (!Array.isArray(data) || data.length < 2) {
    console.warn(`[Census] ACS returned no data for geo: ${geoParam}`);
    return null;
  }
  const headers = data[0];
  const row     = data[1];
  return computeMetrics(parseRow(headers, row), label, areaDesc);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchCensusData(lat: number, lng: number): Promise<CensusData | null> {
  if (!CENSUS_API_KEY) {
    console.warn("[Census] CENSUS_ACS_API_KEY not configured");
    return null;
  }

  const fips = await getGeographyFips(lat, lng);
  if (!fips) {
    console.warn("[Census] Geocoder returned no census geography — likely non-US location");
    return null;
  }

  const { state, county, tract, countyName } = fips;
  console.log(`[Census] FIPS resolved — state:${state} county:${county} tract:${tract} (${countyName})`);

  // Fetch tract and county in parallel
  const [tractData, countyData] = await Promise.all([
    fetchACS(
      `tract:${tract}&in=state:${state}%20county:${county}`,
      "Census Tract",
      `Immediate area — Census Tract ${tract}, ${countyName} County`,
    ),
    fetchACS(
      `county:${county}&in=state:${state}`,
      "County",
      `${countyName} County (broader market area)`,
    ),
  ]);

  if (!tractData && !countyData) {
    console.warn("[Census] Both tract and county ACS fetches failed");
    return null;
  }

  const fallback: CensusRingData = {
    label: "N/A", areaDescription: "Data unavailable",
    population: 0, households: 0, avgHouseholdSize: 0,
    laborForceParticipation: 0, unemploymentRate: 0,
    hhIncomeOver35kPct: 0, renterPct: 0,
    totalVehiclesEstimate: 0, vehiclesPerHousehold: 0, noVehiclePct: 0,
    benchmarks: {
      hhSize:      { value: 0, target: 2.1, met: false, label: "Avg Household Size" },
      workingPop:  { value: 0, target: 55,  met: false, label: "Working Population" },
      hhIncome35k: { value: 0, target: 50,  met: false, label: "HH Income ≥ $35K" },
    },
    source: "Unavailable", fetchedAt: new Date().toISOString(),
  };

  return {
    tract:      tractData  ?? fallback,
    county:     countyData ?? fallback,
    stateFips:  state,
    countyFips: county,
    tractFips:  tract,
    countyName,
    status:    "live",
    fetchedAt: new Date().toISOString(),
  };
}
