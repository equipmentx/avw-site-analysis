"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MapPin, ArrowLeft, RefreshCw, AlertTriangle,
  TrendingUp, Users, DollarSign, Target, Lightbulb,
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Share2, Navigation, Maximize2, FileText, BarChart2,
  Building2, Map, Activity,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { SiteAnalysisResult, CurrencyOption } from "@/lib/types";
import { CURRENCIES } from "@/lib/types";
import { getConfig } from "@/lib/carwashConfigs";
import ScoreRing from "@/components/ScoreRing";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import CompetitorCard from "@/components/CompetitorCard";
import RecommendationCard from "@/components/RecommendationCard";
import TrafficSignalsPanel from "@/components/TrafficSignals";
import CurrencySelector from "@/components/CurrencySelector";

const FinancialProjectionPanel = dynamic(
  () => import("@/components/FinancialProjection"),
  { ssr: false, loading: () => <div className="shimmer h-64 rounded-2xl" /> }
);
const AnalysisMap = dynamic(
  () => import("@/components/AnalysisMap"),
  { ssr: false, loading: () => <div className="shimmer h-[480px] rounded-2xl" /> }
);
const InvestmentSuggestionPanel = dynamic(
  () => import("@/components/InvestmentSuggestion"),
  { ssr: false, loading: () => <div className="shimmer h-40 rounded-2xl" /> }
);
const FinalDecisionPanel = dynamic(
  () => import("@/components/FinalDecision"),
  { ssr: false, loading: () => <div className="shimmer h-80 rounded-3xl" /> }
);
const SatelliteView = dynamic(
  () => import("@/components/SatelliteView"),
  { ssr: false, loading: () => <div className="shimmer h-[380px] rounded-2xl" /> }
);
const TomTomPanel = dynamic(
  () => import("@/components/TomTomPanel"),
  { ssr: false, loading: () => <div className="shimmer h-64 rounded-2xl" /> }
);
const RadiusTrafficPanel = dynamic(
  () => import("@/components/RadiusTrafficPanel"),
  { ssr: false, loading: () => <div className="shimmer h-64 rounded-2xl" /> }
);
const LotFitChecker = dynamic(
  () => import("@/components/LotFitChecker"),
  { ssr: false, loading: () => <div className="shimmer h-96 rounded-2xl" /> }
);
const RegridParcelPanel = dynamic(
  () => import("@/components/RegridParcelPanel"),
  { ssr: false, loading: () => <div className="shimmer h-64 rounded-2xl" /> }
);
const SitePreview3D = dynamic(
  () => import("@/components/SitePreview3D"),
  { ssr: false, loading: () => <div className="shimmer h-[460px] rounded-2xl" /> }
);
const DemographicsPanel = dynamic(
  () => import("@/components/DemographicsPanel"),
  { ssr: false, loading: () => <div className="shimmer h-64 rounded-2xl" /> }
);
const WashVolumeEstimate = dynamic(
  () => import("@/components/WashVolumeEstimate"),
  { ssr: false, loading: () => <div className="shimmer h-64 rounded-2xl" /> }
);

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",     label: "Overview",        icon: Target },
  { id: "demographics", label: "Demographics",    icon: Users },
  { id: "traffic",      label: "Traffic & Access",icon: Activity },
  { id: "competitive",  label: "Competition",     icon: BarChart2 },
  { id: "site",         label: "Site & Parcel",   icon: Map },
  { id: "financials",   label: "Financials",      icon: DollarSign },
  { id: "decision",     label: "Decision",        icon: TrendingUp },
] as const;
type TabId = typeof TABS[number]["id"];

// ── Loading skeleton ───────────────────────────────────────────────────────────
function LoadingState({ address }: { address: string }) {
  const steps = [
    { icon: "🔍", label: "Locating your address..." },
    { icon: "🚗", label: "Scanning for nearby car washes..." },
    { icon: "⭐", label: "Analyzing competitor reviews..." },
    { icon: "🚦", label: "Measuring traffic signals..." },
    { icon: "🏛️", label: "Fetching demographic data..." },
    { icon: "💰", label: "Running financial projections..." },
  ];
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen hero-bg flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-600" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-4xl">🔬</div>
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Analyzing Your Location</h2>
        <p className="text-slate-400 text-sm mb-8 line-clamp-2">{address}</p>
        <div className="space-y-3 text-left">
          {steps.map((step, i) => (
            <div
              key={step.label}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                i < activeStep
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : i === activeStep
                  ? "bg-blue-500/10 border border-blue-500/20"
                  : "bg-slate-700/30 border border-slate-600/20 opacity-40"
              }`}
            >
              <span className="text-lg">{step.icon}</span>
              <span className={`text-sm font-medium ${
                i < activeStep ? "text-emerald-400" :
                i === activeStep ? "text-blue-400" : "text-slate-500"
              }`}>
                {step.label}
              </span>
              {i < activeStep && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}
              {i === activeStep && (
                <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin ml-auto" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Error state ────────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen hero-bg flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-2xl font-black text-white mb-3">Analysis Failed</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">{message}</p>
        <button
          onClick={onRetry}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2 mx-auto transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}

// ── Collapsible section wrapper ────────────────────────────────────────────────
function Section({
  title, subtitle, icon, children, defaultOpen = true,
}: {
  title: string; subtitle?: string; icon: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-slate-700/20 border border-slate-600/25 rounded-3xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-600/15 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-600/40 rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <div className="text-left">
            <div className="text-white font-bold text-base">{title}</div>
            {subtitle && <div className="text-slate-400 text-xs mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}

// ── Inner Page ─────────────────────────────────────────────────────────────────
function AnalysisPageInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const address      = searchParams.get("address")  ?? "";
  const budget       = searchParams.get("budget")   ?? "";
  const currCode     = searchParams.get("currency") ?? localStorage?.getItem("carwash_currency") ?? "USD";
  const radiusMiles  = parseFloat(searchParams.get("radius") ?? "5") || 5;
  const configId     = searchParams.get("config") ?? null;

  const [result,  setResult]  = useState<SiteAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const hasFetched = useRef(false);

  const [currency, setCurrency] = useState<CurrencyOption>(
    CURRENCIES.find((c) => c.code === currCode) ?? CURRENCIES[0]
  );
  const [rates,         setRates]         = useState<Record<string, number>>({ USD: 1 });
  const [ratesFetchedAt,setRatesFetchedAt] = useState("");
  const [ratesSource,   setRatesSource]   = useState("");

  const handleCurrencyChange = (c: CurrencyOption) => {
    setCurrency(c);
    if (typeof localStorage !== "undefined") localStorage.setItem("carwash_currency", c.code);
  };

  useEffect(() => {
    fetch("/api/rates")
      .then((r) => r.json())
      .then((d) => {
        setRates(d.rates ?? { USD: 1 });
        setRatesFetchedAt(d.fetchedAt ?? "");
        setRatesSource(d.source ?? "");
      })
      .catch(() => {});
  }, []);

  const rate = rates[currency.code] ?? 1;

  const runAnalysis = async () => {
    if (!address) { setError("No address provided."); setLoading(false); return; }
    setLoading(true);
    setError("");
    hasFetched.current = true;
    try {
      const res  = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, budget, radiusMiles, configId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasFetched.current) runAnalysis();
  }, []);

  if (loading) return <LoadingState address={address} />;
  if (error)   return <ErrorState message={error} onRetry={runAnalysis} />;
  if (!result) return null;

  const { score, competitors, trafficSignals, financialProjection, reviewInsights, recommendations } = result;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <main className="min-h-screen hero-bg">
      {/* ── Sticky Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-800/75 border-b border-slate-600/30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">New Analysis</span>
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
            <img src="/avw-logo.png" alt="Car Wash Site Analysis" className="h-7 w-auto object-contain flex-shrink-0" />
            <span className="text-white text-sm font-medium truncate max-w-sm hidden md:block">{result.address}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {ratesFetchedAt && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live</span>
              </div>
            )}
            <CurrencySelector selected={currency} onChange={handleCurrencyChange} compact />
            <div
              className="px-3 py-1.5 rounded-full text-xs font-black"
              style={{ backgroundColor: `${score.verdictColor}20`, color: score.verdictColor, border: `1px solid ${score.verdictColor}40` }}
            >
              {score.verdict}
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="p-2 rounded-lg bg-slate-600/40 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
              title="Copy link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tab navigation ─────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 border-t border-slate-600/20">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${
                  activeTab === id
                    ? "border-blue-400 text-white bg-blue-500/8"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-600/15"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* ════════════════════════════════════════════════════════════
            TAB 1 — OVERVIEW
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <>
            {/* Selected format badge */}
            {configId && (() => {
              const cfg = getConfig(configId);
              if (!cfg) return null;
              return (
                <div className="flex items-center gap-3 bg-blue-500/8 border border-blue-500/20 rounded-2xl px-5 py-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-sm flex-shrink-0">
                    {cfg.category === "tunnel" ? "🏗️" : cfg.category === "inbay" ? "🤖" : cfg.category === "selfserve" ? "🚿" : "⚡"}
                  </div>
                  <div>
                    <div className="text-xs text-blue-400 font-semibold uppercase tracking-widest">Selected Format</div>
                    <div className="text-white font-bold text-sm">{cfg.name}</div>
                  </div>
                  <div className="ml-auto hidden sm:flex items-center gap-4 text-xs text-slate-400">
                    <span>{cfg.carsPerHour.min}–{cfg.carsPerHour.max} cars/hr</span>
                    <span>Min {cfg.minLotSqFt.toLocaleString()} sqft</span>
                    <span className={cfg.membershipFriendly ? "text-emerald-400" : "text-slate-500"}>
                      {cfg.membershipFriendly ? "✓ Membership ready" : "No membership model"}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Hero Score Card */}
            <div className="bg-slate-700/25 border border-slate-600/25 rounded-3xl p-8 overflow-hidden relative">
              <div
                className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-8 pointer-events-none"
                style={{ backgroundColor: score.verdictColor }}
              />
              <div className="relative grid md:grid-cols-[240px_1fr] gap-10 items-start">
                <div className="flex justify-center">
                  <ScoreRing
                    score={score.overall}
                    grade={score.grade}
                    verdict={score.verdict}
                    verdictColor={score.verdictColor}
                  />
                </div>
                <div>
                  <div className="text-slate-400 text-sm mb-1">Analysis for</div>
                  <h1 className="text-white font-black text-xl md:text-2xl mb-3 leading-tight">{result.address}</h1>
                  <p className="text-slate-300 text-base leading-relaxed mb-6 max-w-lg">{score.explanation}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {score.highlights.length > 0 && (
                      <div>
                        <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Highlights
                        </div>
                        <ul className="space-y-1.5">
                          {score.highlights.slice(0, 4).map((h) => (
                            <li key={h} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="text-emerald-400 mt-0.5 text-xs">✓</span>{h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {score.risks.length > 0 && (
                      <div>
                        <div className="text-red-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Risk Factors
                        </div>
                        <ul className="space-y-1.5">
                          {score.risks.slice(0, 4).map((r) => (
                            <li key={r} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="text-red-400 mt-0.5 text-xs">!</span>{r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 text-slate-500 text-xs">
                    Analyzed {new Date(result.analyzedAt).toLocaleString()} ·{" "}
                    {reviewInsights.totalReviewsAnalyzed} reviews studied ·{" "}
                    {competitors.length} competitors found
                  </div>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <Section
              title="Score Breakdown"
              subtitle="How each factor contributes to the overall rating"
              icon={<Target className="w-5 h-5 text-blue-400" />}
            >
              <ScoreBreakdown
                components={score.components}
                coordinates={result.coordinates}
                apiKey={apiKey}
              />
            </Section>

            {/* Quick nav cards to other tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { tab: "demographics" as TabId, label: "Market Demographics", icon: "🏛️",
                  value: result.census ? `${Object.values(result.census.county.benchmarks).filter(b => b.met).length}/3 benchmarks met` : "No US Census data" },
                { tab: "traffic" as TabId,      label: "Daily Traffic (AADT)", icon: "🚗",
                  value: trafficSignals.estimatedDailyTraffic.toLocaleString() },
                { tab: "competitive" as TabId,  label: "Competitors Found",    icon: "🏪",
                  value: `${competitors.length} within ${result.radiusMiles} mi` },
                { tab: "site" as TabId,         label: "Parcel Data",          icon: "📍",
                  value: result.parcel?.status === "live" ? result.parcel.address : "Parcel data unavailable" },
                { tab: "financials" as TabId,   label: "Year 1 Revenue",       icon: "📈",
                  value: `$${(financialProjection.year1Revenue / 1000).toFixed(0)}K projected` },
                { tab: "decision" as TabId,     label: "Verdict",              icon: "⚖️",
                  value: score.verdict },
              ].map(({ tab, label, icon, value }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="bg-slate-700/20 hover:bg-slate-600/25 border border-slate-600/25 rounded-2xl p-4 text-left transition-all group"
                >
                  <div className="text-xl mb-2">{icon}</div>
                  <div className="text-slate-400 text-xs font-medium mb-1">{label}</div>
                  <div className="text-white text-sm font-bold">{value}</div>
                  <div className="text-blue-400 text-[10px] mt-2 group-hover:underline">View details →</div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 2 — DEMOGRAPHICS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "demographics" && (
          <>
            {result.census ? (
              <Section
                title="Market Demographics"
                subtitle={`Census data for ${result.census.countyName} County — benchmarked against ICA site-selection criteria`}
                icon={<Users className="w-5 h-5 text-blue-400" />}
              >
                <DemographicsPanel census={result.census} />
              </Section>
            ) : (
              <div className="bg-slate-700/20 border border-slate-600/25 rounded-3xl p-8 text-center">
                <div className="text-5xl mb-4">🏛️</div>
                <h3 className="text-white font-bold text-lg mb-2">Demographics Data Unavailable</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                  {result.countryCode === "US"
                    ? "Census ACS data fetch failed. Ensure CENSUS_ACS_API_KEY is set in .env.local and the location is within the US."
                    : `US Census Bureau ACS is only available for US locations. This site is in ${result.countryCode}.`}
                </p>
              </div>
            )}

            {/* Wash Volume Estimate — always show */}
            <Section
              title="Wash Volume Estimate"
              subtitle="ICA capture rate model — projected annual wash volume from market vehicle fleet"
              icon={<BarChart2 className="w-5 h-5 text-violet-400" />}
            >
              <WashVolumeEstimate
                census={result.census}
                tomtom={result.tomtom}
                aadt={trafficSignals.estimatedDailyTraffic}
              />
            </Section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 3 — TRAFFIC & ACCESS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "traffic" && (
          <>
            {result.tomtom && (
              <Section
                title="Road Intelligence"
                subtitle="Live road speed, drive-time trade area & active incidents — powered by TomTom"
                icon={<Navigation className="w-5 h-5 text-purple-400" />}
              >
                <TomTomPanel data={result.tomtom} />
              </Section>
            )}

            <Section
              title="Trade Area Traffic Volume"
              subtitle="Adjust the radius to see how many vehicles pass through your trade area per day"
              icon={<Navigation className="w-5 h-5 text-cyan-400" />}
            >
              <RadiusTrafficPanel coordinates={result.coordinates} />
            </Section>

            <Section
              title="Traffic & Market Signals"
              subtitle="Commercial density, traffic drivers, and market saturation"
              icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
            >
              <TrafficSignalsPanel signals={trafficSignals} insights={reviewInsights} />
            </Section>

            {/* AADT benchmark callout */}
            <div className="bg-slate-700/20 border border-slate-600/25 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🎯</div>
                <div>
                  <div className="text-white font-bold text-sm mb-1">ICA AADT Benchmark</div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Express car wash site-selection criteria targets{" "}
                    <span className="text-white font-semibold">25,000 bi-directional vehicles per day (AADT)</span>{" "}
                    as the ideal traffic threshold for a high-volume express tunnel.
                    This site has an estimated{" "}
                    <span className={`font-semibold ${
                      trafficSignals.estimatedDailyTraffic >= 25000 ? "text-emerald-300" :
                      trafficSignals.estimatedDailyTraffic >= 15000 ? "text-amber-300" : "text-red-300"
                    }`}>
                      {trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day
                    </span>
                    {" "}— {trafficSignals.estimatedDailyTraffic >= 25000
                      ? "meets or exceeds target."
                      : trafficSignals.estimatedDailyTraffic >= 15000
                      ? "below target but viable for smaller format."
                      : "below the minimum recommended threshold."
                    }
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 4 — COMPETITIVE LANDSCAPE
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "competitive" && (
          <>
            <Section
              title={`Competitor Analysis (${competitors.length} found)`}
              subtitle={`Every car wash within ${result.radiusMiles ?? radiusMiles} miles — ratings, reviews, and weaknesses`}
              icon={<Users className="w-5 h-5 text-yellow-400" />}
            >
              {competitors.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-white font-bold text-xl mb-2">No Competitors Found</h3>
                  <p className="text-slate-400 text-sm max-w-sm mx-auto">
                    No car washes found within {result.radiusMiles ?? radiusMiles} miles.
                    This may indicate low market density — review traffic and parcel data carefully before drawing conclusions.
                  </p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {competitors.map((comp, i) => (
                    <CompetitorCard key={comp.place.place_id} competitor={comp} index={i} />
                  ))}
                </div>
              )}
            </Section>

            {reviewInsights.dominantComplaints.length > 0 && (
              <Section
                title="Market-Wide Complaint Analysis"
                subtitle="What customers across all competitors are saying — your strategic playbook"
                icon={<Lightbulb className="w-5 h-5 text-orange-400" />}
              >
                <div className="mb-3 flex items-start gap-2 bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-2">
                  <span className="text-blue-400 text-xs mt-0.5">📡</span>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    <span className="text-blue-300 font-semibold">Live data</span> — pulled from Google Places reviews at time of analysis.
                    {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} within {result.radiusMiles ?? radiusMiles} miles.
                  </p>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {[
                    { label: "Avg Competitor Rating", value: `${reviewInsights.avgCompetitorRating.toFixed(1)}★` },
                    { label: "Reviews Analyzed",      value: reviewInsights.totalReviewsAnalyzed.toString() },
                    { label: "Complaint Types",       value: reviewInsights.dominantComplaints.length.toString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-700/40 rounded-xl px-4 py-2 text-center">
                      <div className="text-white font-black text-2xl">{value}</div>
                      <div className="text-slate-300 text-xs">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {reviewInsights.dominantComplaints.map((complaint) => (
                    <div key={complaint.category} className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{complaint.emoji}</span>
                        <div>
                          <div className="text-white font-semibold text-sm">{complaint.category}</div>
                          <div className="text-orange-400 text-xs">{complaint.count} mention{complaint.count !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      <p className="text-slate-200 text-xs leading-relaxed">{complaint.opportunity}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 5 — SITE & PARCEL
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "site" && (
          <>
            <Section
              title="Location Map"
              subtitle={`${competitors.length} car wash${competitors.length !== 1 ? "es" : ""} within ${result.radiusMiles ?? radiusMiles} miles · Click pins for details`}
              icon={<MapPin className="w-5 h-5 text-blue-400" />}
            >
              <AnalysisMap
                center={result.coordinates}
                competitors={competitors}
                apiKey={apiKey}
                radiusMiles={result.radiusMiles ?? radiusMiles}
              />
            </Section>

            <Section
              title="Satellite Site View"
              subtitle="Overhead imagery — assess lot shape, road access, and anchor tenants"
              icon={<Map className="w-5 h-5 text-emerald-400" />}
            >
              <SatelliteView
                coordinates={result.coordinates}
                address={result.address}
                apiKey={apiKey}
              />
            </Section>

            {configId && result.coordinates && (
              <Section
                title="3D Site Preview"
                subtitle="See how your selected car wash format sits on this lot"
                icon={<span className="text-lg">🏗️</span>}
              >
                <SitePreview3D
                  configId={configId}
                  lat={result.coordinates.lat}
                  lng={result.coordinates.lng}
                  address={result.address}
                />
              </Section>
            )}

            {(result.parcel || result.countryCode === "US") && result.parcel && (
              <Section
                title="Land Parcel Record"
                subtitle="Owner · AVM · assessed value · last sale · zoning · lot dimensions — from ATTOM Data (county assessor) + OpenStreetMap"
                icon={<FileText className="w-5 h-5 text-emerald-400" />}
              >
                <RegridParcelPanel parcel={result.parcel} osmBuilding={result.osmBuilding} />
              </Section>
            )}

            <Section
              title="Lot Fit Checker"
              subtitle="Enter your lot dimensions — see which car wash configurations fit"
              icon={<Maximize2 className="w-5 h-5 text-cyan-400" />}
            >
              <LotFitChecker
                prefilledWidthFt={result.parcel?.dimensions?.widthFt}
                prefilledDepthFt={result.parcel?.dimensions?.depthFt}
              />
            </Section>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 6 — FINANCIALS
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "financials" && (
          <>
            <Section
              title="Suggested Investment Range"
              subtitle={`Live market estimate for ${result.countryCode} · ${currency.code} · rates updated hourly`}
              icon={<DollarSign className="w-5 h-5 text-blue-400" />}
            >
              <InvestmentSuggestionPanel
                data={result.investmentSuggestion}
                currency={currency}
                rate={rate}
                fetchedAt={ratesFetchedAt || result.analyzedAt}
              />
            </Section>

            <Section
              title="5-Year Financial Projection"
              subtitle="Revenue, EBITDA, and payback — anchored to the Express Car Wash Pro Forma model and live traffic data"
              icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
            >
              <FinancialProjectionPanel
                data={financialProjection}
                currency={currency}
                rate={rate}
                budgetUSD={result.budgetUSD ?? 0}
                investmentSuggestion={result.investmentSuggestion}
              />
            </Section>

            {/* Cash-on-Cash Return table */}
            <Section
              title="Cash-on-Cash Return"
              subtitle="Annual return on equity investment (20% down payment) — Years 1 through 5"
              icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
            >
              {(() => {
                const equity = financialProjection.downPayment || financialProjection.totalProjectCost * 0.20;
                const rows   = financialProjection.projections ?? [];
                return (
                  <div className="space-y-4">
                    <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
                      <span className="text-amber-400 text-sm mt-0.5">💡</span>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        Cash-on-Cash = Net Income ÷ Equity Investment (20% down payment of total project cost).
                        Initial equity: <span className="text-white font-semibold">${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>.
                        This is the annual cash return on your out-of-pocket investment — a key metric used by professional car wash investors and operators.
                      </p>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-600/30">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-700/40 border-b border-slate-600/30">
                            <th className="py-2.5 px-4 text-left text-slate-400 text-xs font-semibold">Year</th>
                            <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">Revenue</th>
                            <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">EBITDA</th>
                            <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">Net Income</th>
                            <th className="py-2.5 px-4 text-right text-slate-400 text-xs font-semibold">Cash-on-Cash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => {
                            const coc = equity > 0 ? (row.netIncome / equity) * 100 : 0;
                            const fmt$ = (v: number) =>
                              `${currency.symbol}${(v * rate / 1000).toFixed(0)}K`;
                            return (
                              <tr key={row.year} className={`border-b border-slate-700/20 ${i % 2 === 0 ? "" : "bg-slate-700/10"}`}>
                                <td className="py-3 px-4 text-white font-semibold text-sm">{row.year}</td>
                                <td className="py-3 px-4 text-right text-slate-300 text-sm">{fmt$(row.revenue)}</td>
                                <td className="py-3 px-4 text-right text-slate-300 text-sm">{fmt$(row.ebitda)}</td>
                                <td className={`py-3 px-4 text-right text-sm font-semibold ${row.netIncome >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                                  {fmt$(row.netIncome)}
                                </td>
                                <td className={`py-3 px-4 text-right text-sm font-bold ${
                                  coc >= 15 ? "text-emerald-300" : coc >= 8 ? "text-amber-300" : "text-red-300"
                                }`}>
                                  {coc >= 0 ? `${coc.toFixed(1)}%` : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-slate-500 text-[10px]">
                      Net income after debt service. Equity = {currency.symbol}{(equity * rate / 1000).toFixed(0)}K (20% down payment).
                      Projections are estimates based on the Express Car Wash Pro Forma financial model — verify with a financial advisor.
                    </p>
                  </div>
                );
              })()}
            </Section>

            {/* Data Sources */}
            {result.dataSources && (
              <div className="bg-slate-700/20 border border-slate-600/25 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔍</span>
                  <div>
                    <h3 className="text-white font-bold text-sm">Data Sources &amp; Methodology</h3>
                    <p className="text-slate-400 text-xs">Every number in this report comes from a disclosed source.</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { label: "Competitor Data",    icon: "🏪", value: result.dataSources.competitors,  badge: "Live", bc: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
                    { label: "Traffic",            icon: "🚗", value: result.dataSources.traffic,       badge: "Live", bc: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                    { label: "Financial Model",    icon: "📊", value: result.dataSources.financialModel,badge: "2024-2025 Benchmarks", bc: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
                    { label: "Wage Data",          icon: "👷", value: result.dataSources.wageData,      badge: result.dataSources.wageData.startsWith("ILO") ? "ILO" : "Estimate", bc: result.dataSources.wageData.startsWith("ILO") ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
                    { label: "Investment Range",   icon: "💰", value: result.dataSources.investmentRange, badge: "BLS CPI Adjusted", bc: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                    { label: "Exchange Rates",     icon: "💱", value: result.dataSources.exchangeRates,  badge: "Live · US Fed FRED", bc: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
                    { label: "Demographics",       icon: "🏛️", value: result.dataSources.demographics,  badge: result.dataSources.demographics?.includes("Census Bureau") ? "Live · ACS" : "Unavailable", bc: result.dataSources.demographics?.includes("Census Bureau") ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-slate-600/40 text-slate-400 border-slate-600/40" },
                    { label: "Road Intelligence",  icon: "🛣️", value: result.dataSources.tomtomTraffic,  badge: result.dataSources.tomtomTraffic?.startsWith("Not") ? "Not configured" : "Live · TomTom", bc: result.dataSources.tomtomTraffic?.startsWith("Not") ? "bg-slate-600/40 text-slate-400 border-slate-600/40" : "bg-purple-500/20 text-purple-300 border-purple-500/30" },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{item.icon}</span>
                          <span className="text-white text-xs font-semibold">{item.label}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.bc} flex-shrink-0`}>{item.badge}</span>
                      </div>
                      <p className="text-slate-400 text-[10px] leading-relaxed">{item.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-slate-500 text-[10px] text-center pt-1">
                  Analysis run: {new Date(result.analyzedAt).toLocaleString()} ·
                  All projections are estimates — verify with qualified professionals before committing capital.
                </p>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            TAB 7 — INVESTMENT DECISION
        ═══════════════════════════════════════════════════════════════ */}
        {activeTab === "decision" && (
          <>
            {/* Recommendations */}
            <Section
              title="Strategic Recommendations"
              subtitle="Actionable steps to maximize your investment at this location"
              icon={<CheckCircle className="w-5 h-5 text-blue-400" />}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                {recommendations.map((rec, i) => (
                  <RecommendationCard key={rec.title} rec={rec} index={i} />
                ))}
              </div>
            </Section>

            {/* Final Decision */}
            <Section
              title="Investment Decision"
              subtitle="Feasibility verdict based on your budget, location score, and financial projections"
              icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
            >
              <FinalDecisionPanel
                result={result}
                budget={budget ? parseFloat(budget) : 0}
                currency={currency}
                rate={rate}
                configId={configId ?? undefined}
              />
            </Section>

            {/* CTA */}
            <div className="bg-gradient-to-r from-blue-600/20 to-emerald-600/20 border border-blue-500/20 rounded-3xl p-8 text-center">
              <h3 className="text-white font-black text-2xl mb-2">Compare Another Location</h3>
              <p className="text-slate-300 mb-6 text-sm">Run a new analysis to find the best site for your investment.</p>
              <button
                onClick={() => router.push("/")}
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-8 py-3 rounded-xl transition-all flex items-center gap-2 mx-auto"
              >
                <MapPin className="w-4 h-4" />
                Analyze New Location
              </button>
            </div>
          </>
        )}

        {/* Footer */}
        <p className="text-slate-500 text-xs text-center pb-4">
          Car Wash Site Intelligence · Powered by Google Maps Platform, TomTom, ATTOM Data, OpenStreetMap &amp; US Census Bureau ·
          For informational purposes only. Verify all projections with qualified professionals before committing capital.
        </p>
      </div>
    </main>
  );
}

// ── Default export with Suspense ──────────────────────────────────────────────
export default function AnalysisPage() {
  return (
    <Suspense fallback={<LoadingState address="Loading..." />}>
      <AnalysisPageInner />
    </Suspense>
  );
}
