"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MapPin, ArrowLeft, RefreshCw, AlertTriangle,
  TrendingUp, Users, DollarSign, Target, Lightbulb,
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Share2, Download, Navigation, Maximize2, FileText,
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

// ── Loading skeleton ───────────────────────────────────────────────────────────
function LoadingState({ address }: { address: string }) {
  const steps = [
    { icon: "🔍", label: "Locating your address..." },
    { icon: "🚗", label: "Scanning for nearby car washes..." },
    { icon: "⭐", label: "Analyzing competitor reviews..." },
    { icon: "🚦", label: "Measuring traffic signals..." },
    { icon: "💰", label: "Running financial projections..." },
    { icon: "📊", label: "Calculating opportunity score..." },
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
        {/* Spinning logo */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            🔬
          </div>
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
                  : "bg-slate-800/30 border border-slate-700/20 opacity-40"
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
        {message.includes("API key") && (
          <div className="mt-6 bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 text-left">
            <p className="text-slate-200 text-xs font-semibold mb-2">Setup Required:</p>
            <ol className="text-slate-300 text-xs space-y-1 list-decimal list-inside">
              <li>Get a Google Maps API key from Google Cloud Console</li>
              <li>Enable: Maps JS API, Places API, Geocoding API</li>
              <li>Add to .env.local: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and GOOGLE_MAPS_API_KEY</li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  title, subtitle, icon, children, defaultOpen = true,
}: {
  title: string; subtitle?: string; icon: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-slate-800/30 border border-slate-700/30 rounded-3xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-6 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <div className="text-left">
            <div className="text-white font-bold text-base">{title}</div>
            {subtitle && <div className="text-slate-300 text-xs mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}

// ── Inner Page (needs Suspense for useSearchParams) ───────────────────────────
function AnalysisPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const address     = searchParams.get("address")  ?? "";
  const budget      = searchParams.get("budget")   ?? "";
  const currCode    = searchParams.get("currency") ?? localStorage?.getItem("carwash_currency") ?? "USD";
  const radiusMiles = parseFloat(searchParams.get("radius") ?? "5") || 5;
  const configId    = searchParams.get("config") ?? null;

  const [result, setResult]   = useState<SiteAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const hasFetched = useRef(false);

  // Currency + live rates
  const [currency, setCurrency] = useState<CurrencyOption>(
    CURRENCIES.find((c) => c.code === currCode) ?? CURRENCIES[0]
  );
  const [rates, setRates]       = useState<Record<string, number>>({ USD: 1 });
  const [ratesFetchedAt, setRatesFetchedAt] = useState("");
  const [ratesSource, setRatesSource]       = useState("");

  const handleCurrencyChange = (c: CurrencyOption) => {
    setCurrency(c);
    if (typeof localStorage !== "undefined") localStorage.setItem("carwash_currency", c.code);
  };

  // Fetch live rates once on mount
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
      const res = await fetch("/api/analyze", {
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
  if (error) return <ErrorState message={error} onRetry={runAnalysis} />;
  if (!result) return null;

  const { score, competitors, trafficSignals, financialProjection, reviewInsights, recommendations } = result;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  return (
    <main className="min-h-screen hero-bg">
      {/* ── Sticky Header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">New Analysis</span>
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
            <img src="/avw-logo.png" alt="AVW Site Intel" className="h-7 w-auto object-contain flex-shrink-0" />
            <span className="hidden sm:inline font-bold text-white text-sm tracking-tight">AVW Site Intel</span>
            <span className="text-white text-sm font-medium truncate max-w-sm">{result.address}</span>
          </div>

          <div className="flex items-center gap-2">
            {ratesFetchedAt && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live rates</span>
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
              className="p-2 rounded-lg bg-slate-700/40 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Copy link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* ── Selected Format Badge ───────────────────────────────── */}
        {configId && (() => {
          const cfg = getConfig(configId);
          if (!cfg) return null;
          return (
            <div className="flex items-center gap-3 bg-blue-500/8 border border-blue-500/20 rounded-2xl px-5 py-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-sm flex-shrink-0">
                {cfg.category === "tunnel" ? "🏗️" : cfg.category === "inbay" ? "🤖" : cfg.category === "selfserve" ? "🚿" : "⚡"}
              </div>
              <div>
                <div className="text-xs text-blue-400 font-semibold uppercase tracking-widest">
                  Selected Format
                </div>
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

        {/* ── Hero Score Card ─────────────────────────────────────── */}
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-3xl p-8 overflow-hidden relative">
          {/* Background glow */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
            style={{ backgroundColor: score.verdictColor }}
          />

          <div className="relative grid md:grid-cols-[240px_1fr] gap-10 items-start">
            {/* Score ring */}
            <div className="flex justify-center">
              <ScoreRing
                score={score.overall}
                grade={score.grade}
                verdict={score.verdict}
                verdictColor={score.verdictColor}
              />
            </div>

            {/* Summary */}
            <div>
              <div className="text-slate-300 text-sm mb-1">
                Analysis for
              </div>
              <h1 className="text-white font-black text-xl md:text-2xl mb-3 leading-tight">
                {result.address}
              </h1>
              <p className="text-slate-300 text-base leading-relaxed mb-6 max-w-lg">
                {score.explanation}
              </p>

              {/* Highlights & risks */}
              <div className="grid sm:grid-cols-2 gap-4">
                {score.highlights.length > 0 && (
                  <div>
                    <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Highlights
                    </div>
                    <ul className="space-y-1.5">
                      {score.highlights.slice(0, 4).map((h) => (
                        <li key={h} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-emerald-400 mt-0.5 text-xs">✓</span>
                          {h}
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
                          <span className="text-red-400 mt-0.5 text-xs">!</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Analyzed at */}
              <div className="mt-6 text-slate-400 text-xs">
                Analyzed {new Date(result.analyzedAt).toLocaleString()} ·{" "}
                {reviewInsights.totalReviewsAnalyzed} reviews studied ·{" "}
                {competitors.length} competitors found
              </div>
            </div>
          </div>
        </div>

        {/* ── Score Breakdown ─────────────────────────────────────── */}
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

        {/* ── Map ─────────────────────────────────────────────────── */}
        <Section
          title="Location Map"
          subtitle={`${competitors.length} car wash${competitors.length !== 1 ? "es" : ""} within ${result.radiusMiles ?? radiusMiles} mile${(result.radiusMiles ?? radiusMiles) !== 1 ? "s" : ""} · Click pins for details`}
          icon={<MapPin className="w-5 h-5 text-blue-400" />}
        >
          <AnalysisMap
            center={result.coordinates}
            competitors={competitors}
            apiKey={apiKey}
            radiusMiles={result.radiusMiles ?? radiusMiles}
          />
        </Section>

        {/* ── Satellite View ───────────────────────────────────────── */}
        <Section
          title="Satellite Site View"
          subtitle="Overhead imagery — assess lot shape, road access, and anchor tenants"
          icon={<MapPin className="w-5 h-5 text-emerald-400" />}
        >
          <SatelliteView
            coordinates={result.coordinates}
            address={result.address}
            apiKey={apiKey}
          />
        </Section>

        {/* ── Regrid Parcel Data ───────────────────────────────────── */}
        {result.parcel && (
          <Section
            title="Land Parcel Record"
            subtitle="Owner · assessed value · last sale · zoning · lot dimensions — from county assessor via Regrid"
            icon={<FileText className="w-5 h-5 text-emerald-400" />}
          >
            <RegridParcelPanel parcel={result.parcel} />
          </Section>
        )}

        {/* ── Lot Fit Checker ──────────────────────────────────────── */}
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

        {/* ── Traffic Signals ─────────────────────────────────────── */}
        <Section
          title="Traffic & Market Signals"
          subtitle="Commercial density, traffic drivers, and market saturation"
          icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
        >
          <TrafficSignalsPanel signals={trafficSignals} insights={reviewInsights} />
        </Section>

        {/* ── TomTom Road Intelligence ─────────────────────────────── */}
        {result.tomtom && (
          <Section
            title="Road Intelligence"
            subtitle="Live road speed, drive-time trade area & active incidents — powered by TomTom"
            icon={<Navigation className="w-5 h-5 text-purple-400" />}
          >
            <TomTomPanel data={result.tomtom} />
          </Section>
        )}

        {/* ── Radius Traffic Coverage ──────────────────────────────── */}
        <Section
          title="Trade Area Traffic Volume"
          subtitle="Adjust the radius to see how many vehicles pass through your trade area per day"
          icon={<Navigation className="w-5 h-5 text-cyan-400" />}
        >
          <RadiusTrafficPanel coordinates={result.coordinates} />
        </Section>

        {/* ── Competitors ─────────────────────────────────────────── */}
        <Section
          title={`Competitor Analysis (${competitors.length} found)`}
          subtitle={`Every car wash within ${result.radiusMiles ?? radiusMiles} miles — ratings, reviews, and weaknesses`}
          icon={<Users className="w-5 h-5 text-yellow-400" />}
          defaultOpen={competitors.length > 0}
        >
          {competitors.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-white font-bold text-xl mb-2">No Competitors Found!</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                There are no car washes within {result.radiusMiles ?? radiusMiles} mile{(result.radiusMiles ?? radiusMiles) !== 1 ? "s" : ""} of this location. This is an exceptionally strong first-mover opportunity.
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

        {/* ── Review Insights ──────────────────────────────────────── */}
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
                Reviews across all {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} within {result.radiusMiles ?? radiusMiles} miles are fetched live and
                classified by complaint type. Refreshed every time you run a new analysis.
              </p>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <div className="bg-slate-700/40 rounded-xl px-4 py-2 text-center">
                <div className="text-white font-black text-2xl">{reviewInsights.avgCompetitorRating.toFixed(1)}★</div>
                <div className="text-slate-300 text-xs">Avg Competitor Rating</div>
              </div>
              <div className="bg-slate-700/40 rounded-xl px-4 py-2 text-center">
                <div className="text-white font-black text-2xl">{reviewInsights.totalReviewsAnalyzed}</div>
                <div className="text-slate-300 text-xs">Reviews Analyzed</div>
              </div>
              <div className="bg-slate-700/40 rounded-xl px-4 py-2 text-center">
                <div className="text-white font-black text-2xl">{reviewInsights.dominantComplaints.length}</div>
                <div className="text-slate-300 text-xs">Complaint Types</div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {reviewInsights.dominantComplaints.map((complaint) => (
                <div
                  key={complaint.category}
                  className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{complaint.emoji}</span>
                    <div>
                      <div className="text-white font-semibold text-sm">{complaint.category}</div>
                      <div className="text-orange-400 text-xs">{complaint.count} mention{complaint.count !== 1 ? "s" : ""} across reviews</div>
                    </div>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">{complaint.opportunity}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Financial Projection ────────────────────────────────── */}
        {/* ── Investment Suggestion ────────────────────────────────── */}
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

        {/* ── Financial Projection ─────────────────────────────────── */}
        <Section
          title="5-Year Financial Projection"
          subtitle="What your budget can build · what the business will earn · what you take home — all calculated from your inputted price"
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

        {/* ── Recommendations ─────────────────────────────────────── */}
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

        {/* ── AI Final Decision ────────────────────────────────────── */}
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

        {/* ── Data Sources Registry ────────────────────────────────── */}
        {result.dataSources && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔍</span>
              <div>
                <h3 className="text-white font-bold text-sm">Data Sources &amp; Methodology</h3>
                <p className="text-slate-300 text-xs">Every number in this report comes from a disclosed source. Nothing is made up.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Competitor Data",
                  icon: "🏪",
                  value: result.dataSources.competitors,
                  badge: "Live",
                  badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                },
                {
                  label: "Traffic Estimate",
                  icon: "🚗",
                  value: result.dataSources.traffic,
                  badge: "Live formula",
                  badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                },
                {
                  label: "Financial Model",
                  icon: "📊",
                  value: result.dataSources.financialModel,
                  badge: "404 Excel 2017",
                  badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                },
                {
                  label: "Labour / Wage Data",
                  icon: "👷",
                  value: result.dataSources.wageData,
                  badge: result.dataSources.wageData.startsWith("ILO") ? "Live · ILO ILOSTAT" : "Fallback estimate",
                  badgeColor: result.dataSources.wageData.startsWith("ILO")
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                },
                {
                  label: "Investment Cost Range",
                  icon: "💰",
                  value: result.dataSources.investmentRange,
                  badge: "404 model + indices",
                  badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                },
                {
                  label: "Exchange Rates",
                  icon: "💱",
                  value: result.dataSources.exchangeRates,
                  badge: "Live · ECB",
                  badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                },
                {
                  label: "Competitor Volume",
                  icon: "📈",
                  value: result.dataSources.competitorVolume,
                  badge: result.dataSources.competitorVolume.startsWith("Not") ? "Not configured" : "Live · SerpApi",
                  badgeColor: result.dataSources.competitorVolume.startsWith("Not")
                    ? "bg-slate-600/40 text-slate-400 border-slate-600/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                },
                {
                  label: "Road Intelligence",
                  icon: "🛣️",
                  value: result.dataSources.tomtomTraffic,
                  badge: result.dataSources.tomtomTraffic.startsWith("Not") ? "Not configured" : "Live · TomTom",
                  badgeColor: result.dataSources.tomtomTraffic.startsWith("Not")
                    ? "bg-slate-600/40 text-slate-400 border-slate-600/40"
                    : "bg-purple-500/20 text-purple-300 border-purple-500/30",
                },
              ].map((item) => (
                <div key={item.label} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-white text-xs font-semibold">{item.label}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor} flex-shrink-0`}>
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[10px] leading-relaxed">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="text-slate-400 text-[10px] text-center pt-1">
              Analysis run: {new Date(result.analyzedAt).toLocaleString()} ·
              Live data reflects market conditions at time of analysis ·
              All projections are estimates — verify with qualified professionals before committing capital.
            </p>
          </div>
        )}

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-blue-600/20 to-emerald-600/20 border border-blue-500/20 rounded-3xl p-8 text-center">
          <h3 className="text-white font-black text-2xl mb-2">Want to Analyze Another Location?</h3>
          <p className="text-slate-300 mb-6 text-sm">Compare multiple sites to find the absolute best spot for your investment.</p>
          <button
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold px-8 py-3 rounded-xl transition-all flex items-center gap-2 mx-auto"
          >
            <MapPin className="w-4 h-4" />
            Analyze New Location
          </button>
        </div>

        {/* Footer note */}
        <p className="text-slate-400 text-xs text-center pb-4">
          AVW Site Intel · Powered by Google Maps Platform · For informational purposes only.
          Projections are estimates based on industry benchmarks and should be verified by qualified professionals.
        </p>
      </div>
    </main>
  );
}

// ── Default export with Suspense boundary ─────────────────────────────────────
export default function AnalysisPage() {
  return (
    <Suspense fallback={<LoadingState address="Loading..." />}>
      <AnalysisPageInner />
    </Suspense>
  );
}
