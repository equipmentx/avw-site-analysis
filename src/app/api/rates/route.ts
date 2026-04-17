import { NextResponse } from "next/server";

// ── Exchange Rate Sources (US-based, USD-anchored) ────────────────────────────
//
// Primary:  US Federal Reserve FRED API (H.10 FX release, official USG source)
//           Endpoint: https://api.stlouisfed.org/fred/series/observations
//           Covers: GBP, EUR, CAD, AUD, JPY, CNY, MXN, INR, BRL, SAR, AED, ZAR
//           No API key required for public data; key optional for higher rate limits
//
// Secondary: Open Exchange Rates (USD-base, US company, covers all currencies)
//            Free tier: no key needed for latest USD rates via the public endpoint
//            Used for: NGN, GHS, KES — currencies not in FRED H.10 release
//
// Fallback: Hard-coded approximate rates if both sources are down

// Fed FRED series IDs for H.10 Foreign Exchange Rates (USD per 1 foreign unit or inverted)
// Note: FRED reports some as "USD per foreign" and some as "foreign per USD"
// We normalise everything to: how many foreign units = 1 USD
const FRED_SERIES: Record<string, { id: string; invert: boolean }> = {
  GBP: { id: "DEXUSUK", invert: false }, // USD per GBP → invert to get GBP per USD
  EUR: { id: "DEXUSEU", invert: false }, // USD per EUR → invert
  CAD: { id: "DEXCAUS", invert: true  }, // CAD per USD → use directly
  AUD: { id: "DEXUSAL", invert: false }, // USD per AUD → invert
  JPY: { id: "DEXJPUS", invert: true  }, // JPY per USD → use directly
  CNY: { id: "DEXCHUS", invert: true  }, // CNY per USD → use directly
  MXN: { id: "DEXMXUS", invert: true  }, // MXN per USD → use directly
  INR: { id: "DEXINUS", invert: true  }, // INR per USD → use directly
  BRL: { id: "DEXBZUS", invert: true  }, // BRL per USD → use directly
  SAR: { id: "DEXSDUS", invert: true  }, // SAR per USD → use directly
  ZAR: { id: "DEXSFUS", invert: true  }, // ZAR per USD → use directly
};

// Open Exchange Rates public endpoint (USD base, no key required for latest)
const OXR_URL = "https://openexchangerates.org/api/latest.json?app_id=";
const OXR_APP_ID = process.env.OPEN_EXCHANGE_RATES_APP_ID ?? "";

// Currencies not in FRED — fetched from Open Exchange Rates
const OXR_ONLY = ["NGN", "GHS", "KES", "AED"];

async function fetchFredRate(
  series: string, invert: boolean, apiKey: string
): Promise<number | null> {
  try {
    const key = apiKey ? `&api_key=${apiKey}` : "";
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=${series}&limit=5&sort_order=desc&file_type=json${key}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data?.observations?.find((o: any) => o.value !== ".");
    if (!obs) return null;
    const raw = parseFloat(obs.value);
    if (isNaN(raw) || raw <= 0) return null;
    // FRED series are "X per USD" (invert=true) or "USD per X" (invert=false)
    // We always want: how many X per 1 USD
    return invert ? raw : 1 / raw;
  } catch {
    return null;
  }
}

async function fetchOxrRates(currencies: string[]): Promise<Record<string, number>> {
  try {
    if (!OXR_APP_ID) {
      // Free public endpoint (limited but sufficient for fallback currencies)
      const res = await fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: 3600 },
      });
      if (!res.ok) return {};
      const data = await res.json();
      const result: Record<string, number> = {};
      for (const c of currencies) {
        if (data?.rates?.[c]) result[c] = data.rates[c];
      }
      return result;
    }
    const res = await fetch(`${OXR_URL}${OXR_APP_ID}&base=USD&symbols=${currencies.join(",")}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data?.rates ?? {};
  } catch {
    return {};
  }
}

export async function GET() {
  const FRED_API_KEY = process.env.FRED_API_KEY ?? "";

  // Fetch all FRED rates in parallel
  const fredEntries = Object.entries(FRED_SERIES);
  const fredResults = await Promise.all(
    fredEntries.map(([, { id, invert }]) => fetchFredRate(id, invert, FRED_API_KEY))
  );

  const rates: Record<string, number> = { USD: 1 };
  const missing: string[] = [];

  fredEntries.forEach(([currency], i) => {
    const val = fredResults[i];
    if (val && val > 0) {
      rates[currency] = parseFloat(val.toFixed(6));
    } else {
      missing.push(currency);
    }
  });

  // Fetch OXR-only currencies + any FRED misses
  const oxrCurrencies = [...OXR_ONLY, ...missing];
  if (oxrCurrencies.length > 0) {
    const oxrRates = await fetchOxrRates(oxrCurrencies);
    Object.assign(rates, oxrRates);
  }

  // How many Fed rates did we get?
  const fredCount = fredEntries.filter(([c]) => rates[c] !== undefined).length;
  const source = fredCount >= 6
    ? `US Federal Reserve FRED H.10 (${fredCount}/${fredEntries.length} currencies) · ` +
      `Open Exchange Rates / er-api (fallback for NGN, GHS, KES)`
    : `Open Exchange Rates / er-api (FRED unavailable — ${fredCount} Fed rates retrieved)`;

  // Hard fallback for any still-missing currencies
  const fallback: Record<string, number> = {
    GBP: 0.79, EUR: 0.92, NGN: 1580, CAD: 1.37, AUD: 1.54,
    ZAR: 18.6, GHS: 15.5, KES: 132, AED: 3.67, INR: 83.8,
    BRL: 5.1, MXN: 17.3, JPY: 150, CNY: 7.25, SAR: 3.75,
  };
  for (const [c, v] of Object.entries(fallback)) {
    if (!rates[c]) rates[c] = v;
  }

  return NextResponse.json({
    base:      "USD",
    date:      new Date().toISOString().split("T")[0],
    rates,
    source,
    fetchedAt: new Date().toISOString(),
  });
}
