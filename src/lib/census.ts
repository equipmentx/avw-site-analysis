// ── US Census ACS 5-Year Estimates via Census Reporter ────────────────────────
// Primary:  https://api.censusreporter.org  (no API key, different CDN)
// Fallback: https://api.census.gov          (direct — may time out locally)
//
// Census Reporter provides the exact same ACS 5-year data but through a
// community-maintained API with no authentication requirement and a CDN that
// is not affected by local DNS/firewall issues that block api.census.gov.
//
// Column ID mapping: Census Reporter uses B01003001, ACS uses B01003_001E.
// computeMetrics() accepts ACS-style keys, so we map on the way in.

import https from "https";
import { HTTP_AGENT } from "./dnsAgent";

// Census Reporter currently serves ACS 2024 5-year (2020-2024), released early 2025.
// This is confirmed via the release.id="acs2024_5yr" field in the API response.
const ACS_YEAR = "2024";

// Census Reporter table IDs (no variable suffix needed — fetch whole table)
const ACS_TABLES = [
  "B01003", // Total population
  "B11001", // Household types
  "B25010", // Avg household size
  "B23025", // Employment status 16+
  "B19001", // HH income brackets
  "B25003", // Tenure (owner vs renter)
  "B08201", // Vehicles available
].join(",");

// ── Public types ──────────────────────────────────────────────────────────────
export interface CensusRingData {
  label: string;
  areaDescription: string;
  population: number;
  households: number;
  avgHouseholdSize: number;
  laborForceParticipation: number;  // %
  unemploymentRate: number;          // %
  hhIncomeOver35kPct: number;        // % of HHs with income ≥ $35K
  renterPct: number;                 // % renter occupied
  totalVehiclesEstimate: number;
  vehiclesPerHousehold: number;
  noVehiclePct: number;              // % HHs with no vehicle
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

// ── Native HTTPS helper ───────────────────────────────────────────────────────
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

    const req = https.get(
      url,
      { agent: HTTP_AGENT, headers: { "User-Agent": "AVW-Site-Intel/1.0", "Accept": "application/json" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer);
          res.resume();
          console.log(`[Census] Redirect ${res.statusCode} → ${res.headers.location.slice(0, 80)}`);
          censusGet(res.headers.location, redirectsLeft - 1).then(resolve);
          return;
        }

        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => {
          clearTimeout(timer);
          if (res.statusCode && res.statusCode >= 400) {
            console.warn(`[Census] HTTP ${res.statusCode} → ${safeUrl}`);
            console.warn(`[Census] Body:`, raw.slice(0, 300));
            resolve(null);
            return;
          }
          try { resolve(JSON.parse(raw)); }
          catch { console.warn(`[Census] Non-JSON → ${safeUrl}`); resolve(null); }
        });
      }
    );

    req.on("error", (err) => {
      clearTimeout(timer);
      console.warn(`[Census] Error → ${safeUrl}:`, err.message);
      resolve(null);
    });

    req.end();
  });
}

// ── FCC Block API: lat/lng → FIPS codes ──────────────────────────────────────
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

  if (countyFips && !countyFips.endsWith(county)) {
    console.warn("[Census] FCC county FIPS mismatch — using block-derived value");
  }

  console.log(`[Census] FCC FIPS — state:${state} county:${county} tract:${tract} (${countyName ?? "unknown county"})`);
  return { state, county, tract, countyName: countyName ?? "County" };
}

// ── Census Geocoder fallback ──────────────────────────────────────────────────
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
    console.warn("[Census] Census Geocoder returned no tract");
    return null;
  }
  return {
    state:      geo.STATE    ?? "",
    county:     geo.COUNTY   ?? "",
    tract:      geo.TRACT    ?? "",
    countyName: geo.BASENAME ?? geo.NAME ?? "County",
  };
}

async function getGeographyFips(lat: number, lng: number): Promise<{
  state: string; county: string; tract: string; countyName: string;
} | null> {
  const fcc = await getGeographyFipsFCC(lat, lng);
  if (fcc) return fcc;

  console.warn("[Census] FCC lookup failed — trying Census Geocoder as fallback");
  return getGeographyFipsCensus(lat, lng);
}

// ── Derive CensusRingData from variable map (ACS-style keys: B01003_001E) ─────
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

  const totalVehicles   = veh1 + veh2 * 2 + veh3 * 3 + veh4plus * 4;
  const vehiclesPerHH   = households > 0 ? totalVehicles / households : 0;
  const lfParticipation = (laborForce / pop16plus) * 100;
  const unemployRate    = laborForce > 0 ? (unemployed / laborForce) * 100 : 0;
  const income35kPct    = (hhOver35k / totalHHIncome) * 100;
  const renterPct       = (renterOcc / totalOccupied) * 100;
  const noVehiclePct    = (noVeh / totalVehHH) * 100;

  const HH_SIZE_TARGET = 2.1;
  const WORKING_TARGET = 55;
  const INCOME_TARGET  = 50;

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
    source:    `US Census Bureau ACS 5-Year Estimates 2024 (2020–2024, via Census Reporter)`,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Census Reporter fetch ─────────────────────────────────────────────────────
// geo_ids:
//   Census tract: "14000US" + 2-digit state + 3-digit county + 6-digit tract
//   County:       "05000US" + 2-digit state + 3-digit county
//
// Column IDs: B01003001 (no underscore, no E suffix)
// We map to ACS-style keys (B01003_001E) for computeMetrics().

async function fetchFromCensusReporter(
  geoId: string,
  label: string,
  areaDesc: string,
): Promise<CensusRingData | null> {
  const url = `https://api.censusreporter.org/1.0/data/show/latest?table_ids=${ACS_TABLES}&geo_ids=${geoId}`;
  console.log(`[Census] Census Reporter → ${geoId}`);

  const data = await censusGet(url);

  if (!data?.data?.[geoId]) {
    console.warn(`[Census] Census Reporter: no data for geo_id ${geoId}`);
    return null;
  }

  const geoData = data.data[geoId] as Record<string, { estimate: Record<string, number> }>;

  // Map B01003001 → B01003_001E
  const r: Record<string, number> = {};
  for (const [, tableData] of Object.entries(geoData)) {
    const estimates = tableData?.estimate ?? {};
    for (const [colId, value] of Object.entries(estimates)) {
      // colId format: B01003001 (table 5 chars + variable 3 digits)
      const acsKey = colId.replace(/^([A-Z]\d{5})(\d{3})$/, "$1_$2E");
      r[acsKey] = typeof value === "number" && value >= 0 ? value : 0;
    }
  }

  console.log(`[Census] Census Reporter OK — population: ${r["B01003_001E"] ?? "?"}`);
  return computeMetrics(r, label, areaDesc);
}

// ── Direct Census ACS fallback (api.census.gov) ───────────────────────────────
// Only used if Census Reporter fails. Requires CENSUS_ACS_API_KEY env var.
const CENSUS_API_KEY = process.env.CENSUS_ACS_API_KEY ?? "";
const ACS_VARS_DIRECT = [
  "B01003_001E","B11001_001E","B25010_001E","B23025_001E","B23025_002E","B23025_005E",
  "B19001_001E","B19001_008E","B19001_009E","B19001_010E","B19001_011E","B19001_012E",
  "B19001_013E","B19001_014E","B19001_015E","B19001_016E","B19001_017E",
  "B25003_001E","B25003_003E","B08201_001E","B08201_002E","B08201_003E",
  "B08201_004E","B08201_005E","B08201_006E",
].join(",");

async function fetchFromCensusGov(
  geoParam: string,
  label: string,
  areaDesc: string,
): Promise<CensusRingData | null> {
  if (!CENSUS_API_KEY) return null;
  const url = `https://api.census.gov/data/2023/acs/acs5?get=${ACS_VARS_DIRECT}&for=${geoParam}&key=${CENSUS_API_KEY}`;
  const data: string[][] | null = await censusGet(url);

  if (!Array.isArray(data) || data.length < 2) {
    console.warn(`[Census] ACS direct returned no data for ${geoParam}`);
    return null;
  }

  const headers = data[0];
  const row     = data[1];
  const r: Record<string, number> = {};
  headers.forEach((h, i) => {
    const v = parseFloat(row[i]);
    r[h] = isNaN(v) || v < 0 ? 0 : v;
  });

  return computeMetrics(r, label, areaDesc);
}

// ── Fetch one geography: Census Reporter first, direct ACS fallback ───────────
async function fetchACS(opts: {
  reporterGeoId: string;
  directGeoParam: string;
  label: string;
  areaDesc: string;
}): Promise<CensusRingData | null> {
  const reporter = await fetchFromCensusReporter(opts.reporterGeoId, opts.label, opts.areaDesc);
  if (reporter) return reporter;

  console.warn(`[Census] Census Reporter failed for ${opts.reporterGeoId} — trying direct ACS`);
  return fetchFromCensusGov(opts.directGeoParam, opts.label, opts.areaDesc);
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function fetchCensusData(lat: number, lng: number): Promise<CensusData | null> {
  const fips = await getGeographyFips(lat, lng);
  if (!fips) {
    console.warn("[Census] Geocoder returned no census geography — likely non-US location");
    return null;
  }

  const { state, county, tract, countyName } = fips;
  console.log(`[Census] FIPS resolved — state:${state} county:${county} tract:${tract} (${countyName})`);

  // Census Reporter geo IDs
  const tractGeoId  = `14000US${state}${county}${tract}`;
  const countyGeoId = `05000US${state}${county}`;

  // Direct ACS fallback geo params
  const tractGeoParam  = `tract:${tract}&in=state:${state}%20county:${county}`;
  const countyGeoParam = `county:${county}&in=state:${state}`;

  const [tractData, countyData] = await Promise.all([
    fetchACS({
      reporterGeoId:  tractGeoId,
      directGeoParam: tractGeoParam,
      label:          "Census Tract",
      areaDesc:       `Immediate area — Census Tract ${tract}, ${countyName} County`,
    }),
    fetchACS({
      reporterGeoId:  countyGeoId,
      directGeoParam: countyGeoParam,
      label:          "County",
      areaDesc:       `${countyName} County (broader market area)`,
    }),
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
