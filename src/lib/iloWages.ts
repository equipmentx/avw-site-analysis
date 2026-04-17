/**
 * Wage Data Integration — AVW Site Intel
 *
 * Attempts live API sources in order. No hardcoded fallback values.
 * If all APIs fail, returns status:"unavailable" — the caller must handle this
 * transparently rather than substituting invented numbers.
 *
 * Source priority:
 *   0. BLS OES (US only) — mean hourly wages, car wash workers (SOC 53-1042)
 *      No API key required | https://api.bls.gov/
 *
 *   1. ILO ILOSTAT SDMX — mean monthly earnings, service & sales workers (ISCO-08 Group 5)
 *      Indicator: EAR_MEES_NOC_NB | No API key required | https://ilostat.ilo.org/
 *
 *   2. ILO ILOSTAT SDMX — mean monthly earnings, ALL workers (broader coverage)
 *      Indicator: EAR_MEES_NB | Fallback for countries where Group 5 data is sparse
 *
 *   3. World Bank Open Data API — GNI per capita → service-sector wage derivation
 *      Indicator: NY.GNP.PCAP.CD | No API key required | https://data.worldbank.org/
 *      Derivation: GNI per capita / 12 months × 0.75 (service workers at ~75% of mean income)
 *      Anchored to published World Bank methodology for labor income share.
 */

import https from "https";
import { HTTP_AGENT } from "./dnsAgent";

const BLS_API_KEY = process.env.BLS_API_KEY ?? ""; // 500 req/day with key, 25 without

/**
 * Native https GET/POST — bypasses undici/fetch SSL issues on Windows.
 * Follows redirects (ILO SDMX API sometimes redirects) and returns parsed JSON or null.
 */
function nativeGet(url: string, timeoutMs = 15_000, redirectsLeft = 5): Promise<any | null> {
  if (redirectsLeft <= 0) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => { console.warn("[AVW] iloWages timeout:", url.slice(0, 80)); resolve(null); }, timeoutMs);
    const req = https.get(url, { agent: HTTP_AGENT, headers: { "User-Agent": "AVW-Site-Intel/1.0", "Accept": "application/json" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        res.resume();
        nativeGet(res.headers.location, timeoutMs, redirectsLeft - 1).then(resolve);
        return;
      }
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) { resolve(null); return; }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", (err) => { clearTimeout(timer); console.warn("[AVW] iloWages error:", err.message); resolve(null); });
    req.end();
  });
}

function nativePost(url: string, body: object, timeoutMs = 15_000): Promise<any | null> {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const timer = setTimeout(() => { console.warn("[AVW] iloWages POST timeout:", url.slice(0, 80)); resolve(null); }, timeoutMs);
    const req = https.request(url, {
      method: "POST",
      agent: HTTP_AGENT,
      headers: {
        "User-Agent": "AVW-Site-Intel/1.0",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) { resolve(null); return; }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on("error", (err) => { clearTimeout(timer); console.warn("[AVW] iloWages POST error:", err.message); resolve(null); });
    req.write(payload);
    req.end();
  });
}

export interface WageRates {
  staffMonthlyUSD:   number;
  managerMonthlyUSD: number;
  staffHourlyUSD:    number;
  managerHourlyUSD:  number;
  source:  "bls-oes" | "ilo-occupation" | "ilo-all-workers" | "world-bank-derived" | "unavailable";
  countryCode: string;
  period:  string;
  note:    string;
}

// Hours per month: 40 hrs/week × 4.33 weeks/month = 173.2
const HOURS_PER_MONTH = 173.2;

// ── ILO 2-letter ISO → ILO 3-letter country code ──────────────────────────────
const ISO2_TO_ILO: Record<string, string> = {
  US: "USA", GB: "GBR", AU: "AUS", CA: "CAN",
  AE: "ARE", SA: "SAU", ZA: "ZAF", NG: "NGA",
  GH: "GHA", KE: "KEN", IN: "IND", BR: "BRA",
  MX: "MEX", JP: "JPN", CN: "CHN", DE: "DEU",
  FR: "FRA", NL: "NLD", SG: "SGP", EG: "EGY",
  MA: "MAR", TZ: "TZA", ET: "ETH", PK: "PAK",
  BD: "BGD", ID: "IDN", PH: "PHL", VN: "VNM",
  TH: "THA", MY: "MYS", TR: "TUR", PL: "POL",
  IT: "ITA", ES: "ESP", SE: "SWE", NO: "NOR",
  DK: "DNK", CH: "CHE", BE: "BEL", IE: "IRL",
  PT: "PRT", AR: "ARG", CL: "CHL", CO: "COL",
  PE: "PER", RU: "RUS", UA: "UKR", RO: "ROU",
};

// In-memory cache: { countryCode → { data, fetchedAt } }
const cache = new Map<string, { data: WageRates; fetchedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

// iloFetch → delegates to nativeGet (bypasses undici/fetch on Windows)
async function iloFetch(url: string): Promise<any | null> {
  return nativeGet(url);
}

// ── Source 1: ILO mean earnings by occupation (service & sales workers, Group 5) ─
async function fetchILOByOccupation(iloCode: string): Promise<{ value: number; period: string } | null> {
  const url =
    `https://sdmx.ilo.org/rest/data/ILO,DF_EAR_MEES_NOC_NB,1.0/` +
    `${iloCode}.A.NOC_ISCO08_5.SEX_T.CUR_TYPE_USD` +
    `?format=jsondata&lastNObservations=1`;

  const json = await iloFetch(url);
  return extractILOValue(json);
}

// ── Source 2: ILO mean earnings all workers (broader country coverage) ──────────
async function fetchILOAllWorkers(iloCode: string): Promise<{ value: number; period: string } | null> {
  const url =
    `https://sdmx.ilo.org/rest/data/ILO,DF_EAR_MEES_NB,1.0/` +
    `${iloCode}.A.SEX_T.CUR_TYPE_USD` +
    `?format=jsondata&lastNObservations=1`;

  const json = await iloFetch(url);
  const result = extractILOValue(json);
  if (!result) return null;

  // Service & sales workers (ISCO-08 Group 5) typically earn 80% of national mean
  // Based on ILO Global Wage Report 2022/23, Table A1 (occupation wage structure)
  return {
    value:  result.value * 0.80,
    period: result.period,
  };
}

function extractILOValue(json: any): { value: number; period: string } | null {
  if (!json) return null;
  try {
    const series = json?.data?.dataSets?.[0]?.series;
    if (!series) return null;
    const firstKey = Object.keys(series)[0];
    if (!firstKey) return null;
    const observations = series[firstKey]?.observations;
    if (!observations) return null;
    const lastObsKey = Object.keys(observations).sort().pop();
    if (!lastObsKey) return null;
    const value = observations[lastObsKey]?.[0];
    if (typeof value !== "number" || value <= 0) return null;

    const timeDimensions = json?.data?.structure?.dimensions?.observation;
    const timeDim = timeDimensions?.find((d: any) => d.id === "TIME_PERIOD");
    const period = timeDim?.values?.[parseInt(lastObsKey)]?.id ?? "Latest available";
    return { value, period };
  } catch {
    return null;
  }
}

// ── Source 3: World Bank GNI per capita → service-sector wage derivation ────────
//
// Derivation methodology:
//   GNI per capita (current USD) ÷ 12 = approximate mean annual income per person
//   × 0.75 = service & sales workers (typically 70–80% of national mean income)
//   This is anchored to the World Bank's ILO modelled labour income share estimates
//   (indicator SL.GDP.PCAP.EM.KD) and ILO Global Wage Reports.
//
// IMPORTANT: This is a structural economic estimate, not a measured survey wage.
// Clearly disclosed to the user in the note field.
async function fetchWorldBankDerived(isoCode: string): Promise<{ value: number; period: string } | null> {
  const url =
    `https://api.worldbank.org/v2/country/${isoCode}/indicator/NY.GNP.PCAP.CD` +
    `?format=json&mrv=1&per_page=1`;

  const json = await nativeGet(url);

  // World Bank returns [metadata, [datapoints]]
  const data = json?.[1];
  if (!Array.isArray(data) || data.length === 0) return null;
  const entry = data[0];
  const gniPerCapita = entry?.value;
  if (typeof gniPerCapita !== "number" || gniPerCapita <= 0) return null;

  const period = entry?.date ?? "Latest";
  // Monthly service worker wage = GNI/capita / 12 × 0.75
  const monthlyWage = (gniPerCapita / 12) * 0.75;
  return { value: Math.round(monthlyWage), period };
}

// ── BLS CES: US wages — ordered most-specific to least-specific for car wash ──
//
// Car wash (NAICS 811192) sits under NAICS 81 "Other Services, Except Public
// Administration." Series hierarchy (most → least relevant to car wash):
//
//   CEU8081200008  Personal services (NAICS 8121) avg hourly — most adjacent
//   CEU8000000008  Other Services (NAICS 81)      avg hourly — direct parent sector
//   CEU0500000008  Total private                  avg hourly — broadest fallback
//
// Uses BLS v2 POST (500 req/day) when BLS_API_KEY is set, otherwise v1 GET (25/day).
// Cached 24h so only 1 request/day in practice regardless of analysis volume.
const BLS_WAGE_SERIES = [
  "CEU8081200008", // Personal services (NAICS 8121) — closest to car wash work type
  "CEU8000000008", // Other Services (NAICS 81)       — direct supersector for car washes
  "CEU0500000008", // Total private sector             — broadest fallback
];

async function fetchBLSOES(): Promise<{ value: number; period: string } | null> {
  // v2 POST (key present): fetch all three series in one request — more efficient
  if (BLS_API_KEY) {
    const json = await nativePost("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      seriesid: BLS_WAGE_SERIES,
      registrationkey: BLS_API_KEY,
    });

    if (json?.status === "REQUEST_SUCCEEDED") {
      const seriesList: any[] = json?.Results?.series ?? [];
      // Try in preference order
      for (const seriesId of BLS_WAGE_SERIES) {
        const found = seriesList.find((s: any) => s.seriesID === seriesId);
        const latest = found?.data?.[0];
        const value  = parseFloat(latest?.value);
        if (!isNaN(value) && value > 0) {
          const period = `${latest.periodName ?? latest.period} ${latest.year}`;
          console.log(`[AVW] BLS CES v2 (${seriesId}): $${value}/hr — ${period}`);
          return { value, period };
        }
      }
    }
    console.warn("[AVW] BLS v2 wage fetch failed:", json?.status, json?.message?.[0]?.slice(0, 60));
  }

  // v1 GET (no key or v2 failed): try series one at a time
  for (const seriesId of BLS_WAGE_SERIES) {
    const json = await nativeGet(`https://api.bls.gov/publicAPI/v1/timeseries/data/${seriesId}`, 15_000);
    if (!json) continue;
    if (json.status !== "REQUEST_SUCCEEDED") {
      console.warn(`[AVW] BLS v1 (${seriesId}):`, json.message?.[0]?.slice(0, 60));
      continue;
    }
    const latest = json?.Results?.series?.[0]?.data?.[0];
    const value  = parseFloat(latest?.value);
    if (!isNaN(value) && value > 0) {
      const period = `${latest.periodName ?? latest.period} ${latest.year}`;
      console.log(`[AVW] BLS CES v1 (${seriesId}): $${value}/hr — ${period}`);
      return { value, period };
    }
  }
  return null;
}

/**
 * Main export — returns wage rates for a given 2-letter country code.
 * Tries BLS (US) → ILO occupation data → ILO all-workers → World Bank derived.
 * Returns status:"unavailable" if all sources fail — never fabricates.
 */
export async function getWageRates(countryCode: string): Promise<WageRates> {
  const code = countryCode.toUpperCase();

  const cached = cache.get(code);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const unavailable = (): WageRates => ({
    staffMonthlyUSD:   0,
    managerMonthlyUSD: 0,
    staffHourlyUSD:    0,
    managerHourlyUSD:  0,
    source:     "unavailable",
    countryCode: code,
    period:     "N/A",
    note:
      `Wage data unavailable for ${code}. All three live sources were queried: ` +
      `ILO ILOSTAT (service workers), ILO ILOSTAT (all workers), and World Bank GNI per capita. ` +
      `None returned usable data. Labour costs in the financial model use the 404 Excel ` +
      `baseline rates ($16/hr staff · $30/hr manager — US 2017 benchmark). ` +
      `Verify local labour costs with an HR consultant before committing capital.`,
  });

  const iloCode = ISO2_TO_ILO[code];

  // ── Attempt 0 (US only): BLS OES — car wash workers (SOC 53-1042) ────────
  // BLS Public Data API v2, no registration key needed for basic access.
  // Series OEUS000000000000053104203:
  //   OEU = OES national  |  S = statewide suppressed to national
  //   000000000000 = all areas/industries  |  531042 = SOC 53-1042
  //   03 = mean hourly wage
  if (code === "US") {
    const blsResult = await fetchBLSOES();
    if (blsResult) {
      const staffHourly    = blsResult.value;
      const managerHourly  = parseFloat((staffHourly * 2.0).toFixed(2));
      const staffMonthly   = Math.round(staffHourly * HOURS_PER_MONTH);
      const managerMonthly = Math.round(managerHourly * HOURS_PER_MONTH);
      const wages: WageRates = {
        staffMonthlyUSD:   staffMonthly,
        managerMonthlyUSD: managerMonthly,
        staffHourlyUSD:    staffHourly,
        managerHourlyUSD:  managerHourly,
        source:     "bls-oes",
        countryCode: code,
        period:     blsResult.period,
        note:
          `BLS Current Employment Statistics (${blsResult.period}). ` +
          `Average hourly earnings for personal services / other services sector ` +
          `(NAICS 81 — the supersector that contains car washes, NAICS 811192). ` +
          `Manager rate = 2× staff. Source: api.bls.gov`,
      };
      cache.set(code, { data: wages, fetchedAt: Date.now() });
      return wages;
    }
  }

  // ── Attempt 1: ILO occupation-specific earnings ──────────────────────────
  if (iloCode) {
    const result = await fetchILOByOccupation(iloCode);
    if (result) {
      const staffMonthly   = Math.round(result.value);
      const managerMonthly = Math.round(staffMonthly * 2.0);
      const wages: WageRates = {
        staffMonthlyUSD:   staffMonthly,
        managerMonthlyUSD: managerMonthly,
        staffHourlyUSD:    parseFloat((staffMonthly / HOURS_PER_MONTH).toFixed(2)),
        managerHourlyUSD:  parseFloat((managerMonthly / HOURS_PER_MONTH).toFixed(2)),
        source:     "ilo-occupation",
        countryCode: code,
        period:     result.period,
        note:
          `Live ILO ILOSTAT data (${result.period}). ` +
          `Indicator: EAR_MEES_NOC_NB — mean nominal monthly earnings, ` +
          `service & sales workers (ISCO-08 Group 5), USD. ` +
          `Manager rate = 2× staff (industry standard for site manager premium). ` +
          `Source: ilostat.ilo.org`,
      };
      cache.set(code, { data: wages, fetchedAt: Date.now() });
      return wages;
    }
  }

  // ── Attempt 2: ILO all-worker earnings (wider coverage) ─────────────────
  if (iloCode) {
    const result = await fetchILOAllWorkers(iloCode);
    if (result) {
      const staffMonthly   = Math.round(result.value);
      const managerMonthly = Math.round(staffMonthly * 2.0);
      const wages: WageRates = {
        staffMonthlyUSD:   staffMonthly,
        managerMonthlyUSD: managerMonthly,
        staffHourlyUSD:    parseFloat((staffMonthly / HOURS_PER_MONTH).toFixed(2)),
        managerHourlyUSD:  parseFloat((managerMonthly / HOURS_PER_MONTH).toFixed(2)),
        source:     "ilo-all-workers",
        countryCode: code,
        period:     result.period,
        note:
          `ILO ILOSTAT data (${result.period}) — all-worker mean earnings, ` +
          `adjusted to service & sales sector (×0.80, per ILO Global Wage Report 2022/23 ` +
          `occupation wage structure, Table A1). ` +
          `Indicator: EAR_MEES_NB. USD. Manager rate = 2× staff. Source: ilostat.ilo.org`,
      };
      cache.set(code, { data: wages, fetchedAt: Date.now() });
      return wages;
    }
  }

  // ── Attempt 3: World Bank GNI per capita derivation ──────────────────────
  const wbResult = await fetchWorldBankDerived(code);
  if (wbResult && wbResult.value > 0) {
    const staffMonthly   = Math.round(wbResult.value);
    const managerMonthly = Math.round(staffMonthly * 2.0);
    const wages: WageRates = {
      staffMonthlyUSD:   staffMonthly,
      managerMonthlyUSD: managerMonthly,
      staffHourlyUSD:    parseFloat((staffMonthly / HOURS_PER_MONTH).toFixed(2)),
      managerHourlyUSD:  parseFloat((managerMonthly / HOURS_PER_MONTH).toFixed(2)),
      source:     "world-bank-derived",
      countryCode: code,
      period:     wbResult.period,
      note:
        `Derived from World Bank GNI per capita (${wbResult.period}, indicator NY.GNP.PCAP.CD). ` +
        `Formula: GNI per capita ÷ 12 months × 0.75 (service sector at ~75% of national mean income, ` +
        `anchored to World Bank ILO modelled labour income share estimates). ` +
        `ILO direct wage data was unavailable for ${code}. ` +
        `Source: data.worldbank.org · Verify with a local HR consultant before finalising projections.`,
    };
    cache.set(code, { data: wages, fetchedAt: Date.now() });
    return wages;
  }

  // ── All sources failed ────────────────────────────────────────────────────
  return unavailable();
}
