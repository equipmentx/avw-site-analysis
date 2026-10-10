# CarWash Intel — Site Analysis Platform

> **Read this first, every session.** This file is the source of truth for what the project is, how it works, and where we left off. Update it before ending any working session.

## What this is

A browser-based site analysis tool for car wash investors. Enter any address → get a **GO / CAUTION / NO-GO** verdict (0–100 score) backed by:

- Live competitor scan (every car wash within ~5 miles, ratings, review mining)
- Traffic signals (TomTom AADT + proximity to weekly-needs retail)
- Parcel + zoning data (ATTOM, Regrid, OpenStreetMap)
- Trade-area demographics (US Census ACS)
- 5-year financial projection (revenue, EBITDA, payback) anchored to a real pro-forma
- AI-written decision summary (Claude or GPT) scored against the "5 Secrets to a Stellar Car Wash Site" framework

## Why it exists

AVW builds and sells car wash equipment. Prospective buyers / investors ask "is my location any good?" This gives them a defensible, data-driven answer before they commit capital — and gives AVW a lead-qualification funnel.

## Architecture (one-liner)

```
Browser  →  Next.js App Router routes  →  Google Maps / TomTom / ATTOM / Regrid / Census / BLS / FRED / OXR / OpenAI / Anthropic
```

- **No database.** The app is stateless — every analysis is a fresh fan-out of external API calls.
- **Server-side keys** (`GOOGLE_MAPS_API_KEY`, `TOMTOM_API_KEY`, `ATTOM_API_KEY`, etc.) live in Vercel env; the client only sees `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- **AI enrichment is optional** — if neither Anthropic nor OpenAI keys are set, the decision panel still works from rules alone.
- **Server-side 24-h cache** for BLS CPI (reduces to ~1 req/day across all analyses).

## Stack

- **Next.js 14.2.5** (App Router, pinned) — this is NOT Next 16; don't apply the "This is NOT the Next.js you know" shim from other repos.
- **React 18.3**, TypeScript 5.5, Tailwind CSS 3.4
- **`@vis.gl/react-google-maps`** for the map, Google Places JS for address autocomplete
- **`@react-three/fiber` + `drei` + `postprocessing`** for the `SitePreview3D` component (`.glb` models in `public/models/`)
- **Recharts** for financial charts, **Framer Motion** for landing-page motion
- **`@anthropic-ai/sdk`** for AI decision enrichment (OpenAI SDK via dynamic import as fallback)
- **`xlsx`** — reads `Express Car Wash Investment Pro Forma.xlsx` for financial-model constants
- Dev: `cross-env NODE_OPTIONS=--dns-result-order=ipv4first next dev` (works around a Windows DNS quirk)

## Where things live

### App shell
- `src/app/layout.tsx` — root layout; globally loads the Google Maps JS SDK once
- `src/app/page.tsx` — landing / address entry with rotating hero backgrounds
- `src/app/analysis/page.tsx` — results screen, orchestrates every panel
- `src/app/globals.css` — Tailwind base

### API routes (`src/app/api/*`)
- `analyze/route.ts` — **the big one.** Does the full fan-out: Google Places competitor scan, TomTom AADT, ATTOM parcel, Census ACS, OSM building footprint, proximity, BLS CPI inflation adjust, scoring, financial model. Prints startup diagnostics for every key.
- `decision/route.ts` — turns the raw analysis into a GO/CAUTION/NO-GO verdict + AI-written summary (Claude preferred; falls back to OpenAI; falls back to rules).
- `health/route.ts` — pings Google / TomTom / SerpAPI / FRED / ATTOM / BLS in parallel; useful to check key status.
- `proximity/route.ts` — Overpass/OSM proximity queries (grocers, big-box, etc.).
- `rates/route.ts` — FX rates (FRED for majors, Open Exchange Rates for everything else).
- `satellite/route.ts` — Google Static Maps proxy.
- `traffic-radius/route.ts` — TomTom flow-segment queries in a radius.

### Components (`src/components/*`)
~20 panels composed on `/analysis`:
- Map/visual: `AnalysisMap`, `SatelliteView`, `SitePreview3D/`
- Scoring: `ScoreRing`, `ScoreBreakdown`, `FinalDecision`, `RecommendationCard`
- Competition: `CompetitorCard`, `CompetitorIntelligencePanel`
- Site: `SiteFundamentalsPanel`, `LotFitChecker`, `ParcelDataPanel`, `RegridParcelPanel`
- Traffic: `RadiusTrafficPanel`, `TomTomPanel`, `TrafficSignals`
- Demographics: `DemographicsPanel`, `TradeAreaDemographicsPanel`, `PsychographicPanel`
- Financial: `InvestmentSuggestion`, `FinancialProjection`, `WashVolumeEstimate`
- Misc: `CurrencySelector`

### Libraries (`src/lib/*`)
- `scoring.ts` — the location-score math (0–100)
- `financialModel.ts` — 5-year projection, reads the Excel pro forma
- `types.ts` — all shared TypeScript types + the `CURRENCIES` list
- `tomtom.ts`, `attom.ts`, `regrid.ts`, `census.ts`, `censusByZone.ts`, `osm.ts`, `proximity.ts`, `iloWages.ts`, `industryBenchmarks.ts`, `carwashConfigs.ts`, `countryData.ts`
- `dnsAgent.ts` — Windows-specific DNS workaround (IPv4-first for native `https`)
- `printReport.ts` — PDF/print report builder

### Public assets
- `public/avw-logo.png`
- `public/images/bg1.jpg … bg6.jpg` — landing-page hero rotator
- `public/images/configs/` — car-wash layout renders (generated by scripts)
- `public/models/inbay.glb`, `selfserve.glb`, `tunnel.glb` — 3D wash-type previews

### Scripts (`scripts/*`)
- `generate-config-images.mjs` / `generate-config-images-native.mjs` — OpenAI image gen for wash-config renders. Takes `QUALITY`, `SIZE`, `ONLY`, `SKIP`, `VIEW` env flags.

### Not source
- `Express Car Wash Investment Pro Forma.xlsx` — the real pro-forma the financial model is anchored to. Lives at repo root. Keep in sync with `src/lib/financialModel.ts`.

## Required / optional environment variables

Copy `.env.example` to `.env.local` and fill in. All `?` entries are **optional** (feature degrades but app still runs).

### Required
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — client-side Maps JS + Places autocomplete
- `GOOGLE_MAPS_API_KEY` — server-side Geocoding, Places details, Street View, Static Maps

### Strongly recommended
- `TOMTOM_API_KEY` — AADT / traffic flow (without it, AADT is 0 and traffic score degrades)
- `ATTOM_API_KEY` — parcel assessor records (lot size, AVM, zoning, last sale, owner)
- `CENSUS_ACS_API_KEY` — demographics (works without a key, but rate-limited)
- `BLS_API_KEY` — CPI inflation adjust (25 req/day without, 500/day with — free registration)

### Optional
- `REGRID_API_KEY` — alt parcel source (US only)
- `SERPAPI_KEY` — competitor web-search enrichment
- `OPENAI_API_KEY` — AI decision summary (fallback if Anthropic missing)
- `ANTHROPIC_API_KEY` — AI decision summary (preferred; model = Claude)
- `FRED_API_KEY` — US Fed FX rates (works without key, lower rate limit)
- `OPEN_EXCHANGE_RATES_APP_ID` — FX rates for non-FRED currencies (NGN, GHS, KES, AED)
- `NEXT_PUBLIC_SITE_URL` — OG metadata base URL (default: `https://avw-site-analysis.vercel.app`)

> **Never paste a live key into chat.** `.env.local` is git-ignored. Rotate immediately if one leaks.

## Setup (first-time, from a fresh clone)

1. **Install deps** — `npm install`
2. **Get a Google Maps key** — console.cloud.google.com → enable Maps JavaScript API, Places API, Geocoding API, Street View Static API, Maps Static API. Create a browser key (for `NEXT_PUBLIC_*`) with HTTP-referrer restrictions, and a server key (for `GOOGLE_MAPS_API_KEY`) with IP restrictions once deployed.
3. **Grab the recommended data keys** — TomTom (developer.tomtom.com), ATTOM (attomdata.com), Census (api.census.gov/data/key_signup.html), BLS (data.bls.gov/registrationEngine).
4. **Fill `.env.local`** with everything above.
5. **Run** — `npm run dev` → open `http://localhost:3000` → type an address → watch the server log for the `[AVW] API keys loaded:` block to confirm what's configured.
6. **Health-check** — hit `http://localhost:3000/api/health` to see which upstream APIs are actually reachable.

## Rules for working in this repo

- **This is Next 14, not Next 16.** No App Router experimental APIs from Next 15/16, no Cache Components, no Turbopack-only config. Verify against installed `node_modules/next/dist/docs/` if unsure.
- **Never commit secrets.** `.env*` (except `.env.example`) is git-ignored. If you spot a key in a commit, flag it immediately and rotate.
- **Server-only keys never cross to the client.** Only vars prefixed `NEXT_PUBLIC_` are safe for `src/components/*` or `"use client"` files. `GOOGLE_MAPS_API_KEY` (no prefix) is server-only.
- **External-API failures must degrade, not crash.** The analyze route already catches per-source failures and marks them unavailable — keep it that way. One upstream outage must not break the whole analysis.
- **Ask before touching `financialModel.ts` or the Excel pro-forma.** They're a contract — the Excel is the source of truth, the TS mirrors it.
- **Windows DNS quirk is real.** Keep `cross-env NODE_OPTIONS=--dns-result-order=ipv4first` on `npm run dev`. Native `https.get` calls use `rejectUnauthorized: false` on purpose (local Windows cert chain) — don't "fix" that without replacing it with a working alternative.
- **Verify locally before production.** Default dev is `localhost:3000`; promote to Vercel only after `/api/health` is green.
- **Update this file at the end of every session** with what changed and what's pending.

## Current state (2026-10-09 — initial Claude bootstrap)

### What's done

- Repo lives at **github.com/equipmentx/avw-site-analysis** (public), last upstream commit `55084b8` ("final") on **2026-05-16**. Local clone at `C:\Users\ashe\projects\avw-site-analysis`.
- Full landing (`/`) → analysis (`/analysis`) flow is implemented.
- Analyze pipeline (`/api/analyze`) wires: Google Places competitor scan, TomTom AADT, ATTOM parcel, Census ACS trade-area demographics, OSM building footprint, Overpass proximity, BLS CPI inflation adjust, scoring, financial model.
- Decision pipeline (`/api/decision`) has rules-based verdict + Claude/OpenAI enrichment against the "5 Secrets" framework.
- 20+ UI panels composed on `/analysis`.
- 3D car-wash previews (inbay / selfserve / tunnel `.glb`).
- Health endpoint (`/api/health`) that pings every upstream in parallel.
- Multi-currency support via FRED + Open Exchange Rates (`/api/rates`).

### Known gotchas / open items

- **No `.env.example`** committed in the repo yet — bootstrapping one in this session.
- **No automated tests.** Zero test files; no Vitest/Jest config.
- **No `vercel.json`** — deployment config is implicit. If per-route timeouts / cron / regions are needed, add it.
- **Commit history is terse** ("final", "done", "OMO"). Treat 2026-05-16's "final" as a snapshot, not a release tag.
- **Dev-only Windows SSL bypass** (`rejectUnauthorized: false`) is in multiple `https.get` calls — fine for local dev, acceptable risk for public APIs, but worth re-visiting if any auth-bearing endpoint is added.
- **Startup console log** in `src/app/api/analyze/route.ts` prints the first 8 chars of each key. Harmless on Vercel logs since you own the project, but keep an eye on it if logs ever get shared.
- **`SatelliteView` + Street View etc.** all use the server `GOOGLE_MAPS_API_KEY`. If that key is loose on restrictions, it's exposed via proxied URLs.

### Decisions made (2026-10-09)

- **Coverage target: all of USA + Canada.** Today the data layer is effectively US-only.
- **Accuracy target: 95% average across metrics**, with any metric below that shown with an honest confidence badge. Placer.ai / StreetLight are deferred until we've proven the non-paid-visits stack can't get there.
- **Drop ATTOM.** Regrid becomes the single parcel source for US + CA. (If AVM is needed later, evaluate Rentcast.)
- **Buy DataForSEO** — replaces SerpAPI; pulls *all* Google reviews (Places API only returns 5).
- **Buy Regrid** — start pay-as-you-go, move to a plan if volume > ~200 analyses/mo.
- **No AVW customer volume data available** → bootstrap the accuracy benchmark from public sources (Mister Car Wash / Driven / ZIPS 10-Ks, FDDs, ICA benchmarks, press releases).
- **No budget ceiling**, but spend must be justified by measured accuracy lift.

### Approved work plan (in order)

1. Vitest + ground-truth benchmark harness (`scripts/benchmarks/` JSON, bootstrap from public data)
2. Drop ATTOM → Regrid primary (US + CA)
3. StatCan WDS (CA demographics + CPI)
4. Real AADT: FHWA HPMS (US) + MTO / MTQ / MOTI / Alberta (CA); TomTom kept for live flow only
5. DataForSEO (full reviews + web search)
6. Yelp Fusion (second competitor source, cross-validation)
7. Mapbox (satellite fallback, isochrone cross-check)
8. Bank of Canada Valet (CAD rates)
9. Microsoft Building Footprints (replace OSM footprint)
10. Multi-source ensemble layer
11. Calibration regression against the benchmark
12. Google Places → Places API (New)
13. Lock-in tests for scoring + financial model
14. Per-field confidence badges in UI
15. Remove prod `rejectUnauthorized: false` + rate limiting on `/api/analyze`
16. Hourly `/api/health` alert cron (Resend)

### Where to pick up next session

1. Ashe: create DataForSEO + Regrid accounts, drop keys into `.env.local` (never in chat).
2. Continue the approved work plan above from wherever the last session stopped.
3. Add a `vercel.json` with longer `maxDuration` for `/api/analyze` (fans out to ~8+ upstreams).

## Roadmap

- **Lead capture.** Right now anyone can analyze any address anonymously. Add an email gate for the full report / PDF export.
- **PDF/print report.** `src/lib/printReport.ts` exists — wire a "Download PDF" button on `/analysis`.
- **Saved analyses.** Need a DB (Neon?) to let a logged-in user come back to a past address.
- **Compare mode.** Side-by-side scoring of 2–3 candidate sites.
- **Non-US coverage.** ATTOM and Regrid are US-only; parcel panel degrades for international. Decide if we commit to a non-US parcel source or just document the limitation.
- **AVW equipment nudge.** When the verdict is GO, suggest an AVW wash config (tunnel vs in-bay vs self-serve) with pricing.
