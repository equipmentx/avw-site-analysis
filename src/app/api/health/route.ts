import { NextResponse } from "next/server";
import https from "https";

function nativeGet(url: string, timeoutMs = 15_000): Promise<{ status: number; body: string } | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    const req = https.get(url, { headers: { "User-Agent": "AVW-Site-Intel/1.0", "Accept": "application/json" } }, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => { clearTimeout(timer); resolve({ status: res.statusCode ?? 0, body: raw }); });
    });
    req.on("error", () => { clearTimeout(timer); resolve(null); });
    req.end();
  });
}

export async function GET() {
  const results: Record<string, { configured: boolean; reachable?: boolean; error?: string }> = {};

  // ── 1. Google Maps (uses fetch — works fine on Windows) ───────────────────────
  const googleKey = process.env.GOOGLE_MAPS_API_KEY ?? "";
  if (!googleKey) {
    results.google = { configured: false, error: "GOOGLE_MAPS_API_KEY not set" };
  } else {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=London&key=${googleKey}`, { signal: AbortSignal.timeout(10000) });
      const data = await res.json();
      results.google = (data.status === "OK" || data.status === "ZERO_RESULTS")
        ? { configured: true, reachable: true }
        : { configured: true, reachable: false, error: `${data.status}: ${data.error_message ?? ""}` };
    } catch (err: any) {
      results.google = { configured: true, reachable: false, error: err.message };
    }
  }

  // ── 2. TomTom (native https — bypasses undici SSL issues on Windows) ──────────
  const tomtomKey = process.env.TOMTOM_API_KEY ?? "";
  if (!tomtomKey) {
    results.tomtom = { configured: false, error: "TOMTOM_API_KEY not set" };
  } else {
    const res = await nativeGet(
      `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=51.5074,-0.1278&unit=KMPH&key=${tomtomKey}`
    );
    if (!res) {
      results.tomtom = { configured: true, reachable: false, error: "Request timed out (15s)" };
    } else if (res.status >= 400) {
      results.tomtom = { configured: true, reachable: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` };
    } else {
      const data = JSON.parse(res.body);
      results.tomtom = { configured: true, reachable: true, error: `Road class: ${data?.flowSegmentData?.frc ?? "?"} · Speed: ${data?.flowSegmentData?.currentSpeed ?? "?"}km/h` };
    }
  }

  // ── 3. SerpApi (native https — same Windows fix) ──────────────────────────────
  const serpKey = process.env.SERPAPI_KEY ?? "";
  if (!serpKey) {
    results.serpapi = { configured: false, error: "SERPAPI_KEY not set" };
  } else {
    const res = await nativeGet(`https://serpapi.com/account?api_key=${serpKey}`);
    if (!res) {
      results.serpapi = { configured: true, reachable: false, error: "Request timed out (15s)" };
    } else if (res.status >= 400) {
      results.serpapi = { configured: true, reachable: false, error: `HTTP ${res.status}: ${res.body.slice(0, 200)}` };
    } else {
      const data = JSON.parse(res.body);
      results.serpapi = { configured: true, reachable: true, error: `${data.account_email} · ${data.plan_name} · ${data.total_searches_left} searches left` };
    }
  }

  // ── 4. ECB Exchange Rates ─────────────────────────────────────────────────────
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", { signal: AbortSignal.timeout(8000) });
    results.exchangeRates = { configured: true, reachable: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err: any) {
    results.exchangeRates = { configured: true, reachable: false, error: err.message };
  }

  const allOk = Object.values(results).every((r) => r.reachable !== false);
  return NextResponse.json({ status: allOk ? "ok" : "degraded", checks: results });
}
