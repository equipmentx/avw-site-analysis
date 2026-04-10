import { NextResponse } from "next/server";
import https from "https";

function nativeGet(url: string, timeoutMs = 15_000): Promise<{ status: number; body: string } | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const req = https.get(
      url,
      { headers: { "User-Agent": "AVW-Site-Intel/1.0", "Accept": "application/json" } },
      (res) => {
        let raw = "";
        res.on("data", (c) => { raw += c; });
        res.on("end", () => { clearTimeout(timer); resolve({ status: res.statusCode ?? 0, body: raw }); });
      }
    );
    req.on("error", () => { clearTimeout(timer); resolve(null); });
    req.end();
  });
}

// ── Individual check helpers ──────────────────────────────────────────────────

async function checkGoogle(key: string) {
  if (!key) return { configured: false, error: "GOOGLE_MAPS_API_KEY not set" };
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=London&key=${key}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    const data = await res.json();
    return (data.status === "OK" || data.status === "ZERO_RESULTS")
      ? { configured: true, reachable: true }
      : { configured: true, reachable: false, error: `${data.status}: ${data.error_message ?? ""}` };
  } catch (err: any) {
    return { configured: true, reachable: false, error: err.message };
  }
}

async function checkTomTom(key: string) {
  if (!key) return { configured: false, error: "TOMTOM_API_KEY not set" };
  const res = await nativeGet(
    `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=51.5074,-0.1278&unit=KMPH&key=${key}`
  );
  if (!res) return { configured: true, reachable: false, error: "Timed out (12s) — may be rate-limited on free plan" };
  if (res.status >= 400) return { configured: true, reachable: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` };
  try {
    const data = JSON.parse(res.body);
    return { configured: true, reachable: true, error: `FRC: ${data?.flowSegmentData?.frc ?? "?"} · ${data?.flowSegmentData?.currentSpeed ?? "?"}km/h` };
  } catch { return { configured: true, reachable: false, error: "Non-JSON response" }; }
}

async function checkSerpApi(key: string) {
  if (!key) return { configured: false, error: "SERPAPI_KEY not set" };
  const res = await nativeGet(`https://serpapi.com/account?api_key=${key}`);
  if (!res) return { configured: true, reachable: false, error: "Timed out (12s)" };
  if (res.status >= 400) return { configured: true, reachable: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` };
  try {
    const data = JSON.parse(res.body);
    return { configured: true, reachable: true, error: `${data.account_email} · ${data.plan_name} · ${data.total_searches_left} searches left` };
  } catch { return { configured: true, reachable: false, error: "Non-JSON response" }; }
}

async function checkECB() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", { signal: AbortSignal.timeout(8_000) });
    return { configured: true, reachable: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err: any) {
    return { configured: true, reachable: false, error: err.message };
  }
}

async function checkRegrid(key: string) {
  if (!key) return { configured: false, error: "REGRID_API_KEY not set" };
  // Probe: Times Square, NYC — a dense US parcel area
  const res = await nativeGet(
    `https://app.regrid.com/api/v2/parcels/point?lat=40.7580&lon=-73.9855&token=${key}&return_custom=false`
  );
  if (!res) return { configured: true, reachable: false, error: "Timed out (12s)" };
  if (res.status >= 400) return { configured: true, reachable: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` };
  try {
    const data = JSON.parse(res.body);
    const count = data?.parcels?.features?.length ?? 0;
    return { configured: true, reachable: true, error: `${count} parcel(s) returned for probe · regrid.com` };
  } catch { return { configured: true, reachable: false, error: "Non-JSON response" }; }
}

async function checkBLSPPI() {
  // BLS CPI-U All Items (CUUR0000SA0).
  // No key → v1 API, 25 req/day. With BLS_API_KEY → v2 API, 500 req/day.
  // Free key: https://data.bls.gov/registrationEngine/ (instant, just name + email)
  // The analyze route caches the result 24h, so health checks shouldn't burn quota.
  const blsKey = process.env.BLS_API_KEY ?? "";
  const tier   = blsKey ? "v2 (500 req/day)" : "v1 (25 req/day — set BLS_API_KEY for 500/day)";

  let json: any = null;

  if (blsKey) {
    // v2 POST with registration key
    json = await new Promise((resolve) => {
      const body = JSON.stringify({
        seriesid:        ["CUUR0000SA0"],
        startyear:       "2024",
        endyear:         new Date().getFullYear().toString(),
        registrationkey: blsKey,
      });
      const timer = setTimeout(() => resolve(null), 20_000);
      const req = https.request(
        {
          hostname: "api.bls.gov", path: "/publicAPI/v2/timeseries/data/", method: "POST",
          headers: { "User-Agent": "AVW-Site-Intel/1.0", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        },
        (r) => {
          let raw = ""; r.on("data", (c) => { raw += c; });
          r.on("end", () => { clearTimeout(timer); try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
        }
      );
      req.on("error", () => { clearTimeout(timer); resolve(null); });
      req.write(body); req.end();
    });
  } else {
    // v1 GET — no key needed
    const res = await nativeGet("https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0", 20_000);
    if (res) { try { json = JSON.parse(res.body); } catch { json = null; } }
  }

  if (!json) return { configured: !!blsKey, reachable: false, error: `BLS timed out (20s) · ${tier}` };
  if (json?.status !== "REQUEST_SUCCEEDED") {
    return { configured: !!blsKey, reachable: false, error: `BLS: ${json?.status} — ${JSON.stringify(json?.message ?? "").slice(0, 80)} · ${tier}` };
  }
  const latest = json?.Results?.series?.[0]?.data?.[0];
  return {
    configured: true, reachable: true,
    error: `CPI-U ${latest?.year}/${latest?.period} = ${latest?.value} · ${tier}`,
  };
}

// ── Main handler — ALL checks run in parallel ─────────────────────────────────
export async function GET() {
  const [google, tomtom, serpapi, exchangeRates, regrid, blsPPI] = await Promise.all([
    checkGoogle(process.env.GOOGLE_MAPS_API_KEY ?? ""),
    checkTomTom(process.env.TOMTOM_API_KEY ?? ""),
    checkSerpApi(process.env.SERPAPI_KEY ?? ""),
    checkECB(),
    checkRegrid(process.env.REGRID_API_KEY ?? ""),
    checkBLSPPI(),
  ]);

  const results = { google, tomtom, serpapi, exchangeRates, regrid, blsPPI };
  const allOk = Object.values(results).every((r) => r.reachable !== false);

  return NextResponse.json({ status: allOk ? "ok" : "degraded", checks: results });
}
