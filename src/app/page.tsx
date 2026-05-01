"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MapPin, TrendingUp, Star, DollarSign, BarChart2,
  CheckCircle, ChevronRight, Zap, Shield, Building2,
} from "lucide-react";
import CurrencySelector from "@/components/CurrencySelector";
import { CURRENCIES, type CurrencyOption } from "@/lib/types";

declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

const BG_IMAGES = [
  "/images/bg1.jpg",
  "/images/bg2.jpg",
  "/images/bg3.jpg",
  "/images/bg4.jpg",
  "/images/bg5.jpg",
  "/images/bg6.jpg",
];

const FEATURES = [
  {
    icon: <MapPin className="w-6 h-6 text-blue-400" />,
    title: "Location Intelligence",
    desc: "Analyzes traffic patterns, road access, and commercial density within a 5-mile radius of your target site.",
  },
  {
    icon: <Star className="w-6 h-6 text-yellow-400" />,
    title: "Competitor Analysis",
    desc: "Maps every car wash near your site — ratings, review counts, and service gaps identified from live customer feedback.",
  },
  {
    icon: <BarChart2 className="w-6 h-6 text-emerald-400" />,
    title: "5-Year Financial Model",
    desc: "Projects estimated revenue, EBITDA, and payback period based on industry benchmarks anchored to a verified US development model.",
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-purple-400" />,
    title: "Opportunity Scoring",
    desc: "Produces a comparative score (0–100) based on AADT traffic data, competition density, and market viability — with a plain-English breakdown. Directional guidance only; not a guarantee of outcome.",
  },
  {
    icon: <DollarSign className="w-6 h-6 text-green-400" />,
    title: "Investment Range",
    desc: "Estimates a cost range per car wash format — land, construction, equipment, and fees — based on live parcel data and published industry benchmarks. Verify with local contractors before committing capital.",
  },
  {
    icon: <Zap className="w-6 h-6 text-orange-400" />,
    title: "Parcel & Zoning Data",
    desc: "Pulls the actual county assessor record — lot size, AVM estimate, assessed value, last sale price, zoning code, and ownership — from ATTOM Data. Building footprint from OpenStreetMap.",
  },
];

const DATA_POINTS = [
  { label: "Traffic Data Source",   text: "TomTom AADT" },
  { label: "Property Records",      text: "ATTOM · Assessor" },
  { label: "Competitor Data",       text: "Google Places" },
  { label: "Cost Benchmarks",       text: "Car Wash Pro Forma" },
];

const SCORE_BARS = [
  { label: "Traffic Score",     val: 88, color: "#3b82f6" },
  { label: "Competition",       val: 75, color: "#a855f7" },
  { label: "Opportunity",       val: 90, color: "#10b981" },
  { label: "Market Activity",   val: 72, color: "#eab308" },
  { label: "Financial Viability", val: 80, color: "#ec4899" },
];

// ── Typewriter heading (fires when scrolled into view) ────────────────────────
function TypewriterHeading({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let i = 0;
    setDisplayed("");
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 55);
    return () => clearInterval(timer);
  }, [started, text]);

  return (
    <h2 ref={ref} className="text-4xl font-black text-white mb-4 min-h-[2.5rem]">
      {displayed}
      {started && displayed.length < text.length && (
        <span className="inline-block w-0.5 h-8 bg-blue-400 ml-0.5 animate-pulse align-middle" />
      )}
    </h2>
  );
}

// ── Animated sample score card (bars + number rise when scrolled into view) ───
function AnimatedScoreCard() {
  const [triggered, setTriggered] = useState(false);
  const [score, setScore] = useState(0);
  const [barWidths, setBarWidths] = useState(SCORE_BARS.map(() => 0));
  const [barVals, setBarVals] = useState(SCORE_BARS.map(() => 0));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !triggered) setTriggered(true); },
      { threshold: 0.35 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [triggered]);

  useEffect(() => {
    if (!triggered) return;

    // Animate the big score number 0 → 82
    let s = 0;
    const scoreTimer = setInterval(() => {
      s = Math.min(s + 2, 82);
      setScore(s);
      if (s >= 82) clearInterval(scoreTimer);
    }, 25);

    // Animate each bar and its label number
    const steps = 60;
    const duration = 1400;
    let step = 0;
    const barTimer = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      // Ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      setBarWidths(SCORE_BARS.map((b) => b.val * eased));
      setBarVals(SCORE_BARS.map((b) => Math.round(b.val * eased)));
      if (step >= steps) clearInterval(barTimer);
    }, duration / steps);

    return () => { clearInterval(scoreTimer); clearInterval(barTimer); };
  }, [triggered]);

  return (
    <div ref={ref} className="bg-slate-900/70 rounded-2xl p-6 border border-slate-700/40">
      <div className="text-center mb-6">
        <div
          className="text-7xl font-black text-emerald-400 mb-1 tabular-nums"
          style={{ textShadow: "0 0 40px rgba(16,185,129,0.5)" }}
        >
          {score}
        </div>
        <div className="text-white font-bold text-xl tracking-wide">Strong GO</div>
        <div className="text-slate-400 text-xs mt-1">
          Sample score — 1420 N Harbor Blvd, Fullerton CA
        </div>
      </div>

      <div className="space-y-3.5">
        {SCORE_BARS.map((item, i) => (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">{item.label}</span>
              <span className="text-white font-bold tabular-nums">{barVals[i]}/100</span>
            </div>
            <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${barWidths[i]}%`,
                  backgroundColor: item.color,
                  boxShadow: `0 0 8px ${item.color}70`,
                  transition: "width 0.05s linear",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const investmentInputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [placeSelected, setPlaceSelected] = useState(false);
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [investment, setInvestment] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [loading, setLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [error, setError] = useState("");
  const [bgIndex, setBgIndex] = useState(0);
  const [bgFading, setBgFading] = useState(false);
  const [currency, setCurrency] = useState<CurrencyOption>(CURRENCIES[0]);

  // Persist currency in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("carwash_currency");
    if (saved) {
      const found = CURRENCIES.find((c) => c.code === saved);
      if (found) setCurrency(found);
    }
  }, []);

  const handleCurrencyChange = (c: CurrencyOption) => {
    setCurrency(c);
    localStorage.setItem("carwash_currency", c.code);
  };

  // Background rotation — 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBgFading(true);
      setTimeout(() => {
        setBgIndex((i) => (i + 1) % BG_IMAGES.length);
        setBgFading(false);
      }, 600);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Wire up Google Maps readiness — layout already loads the script globally.
  // We just need to register our callback and check if it's already loaded.
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") return;
    // Already loaded (e.g. returning from analysis page in same session)
    if (window.google?.maps) { setMapsReady(true); return; }
    // Register callback — layout's global script will call this when Maps loads
    window.initGoogleMaps = () => setMapsReady(true);
    // Guard: if no layout script present (dev/local without layout), load ourselves
    if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
      script.async = true;
      document.head.appendChild(script);
      return () => { try { document.head.removeChild(script); } catch {} };
    }
  }, []);

  // Wire autocomplete
  useEffect(() => {
    if (!mapsReady || !inputRef.current || autocompleteRef.current) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current,
      { types: ["address", "establishment"] }
    );
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      const lat = place.geometry?.location?.lat() ?? null;
      const lng = place.geometry?.location?.lng() ?? null;
      const pid = place.place_id ?? null;
      setSelectedLat(lat);
      setSelectedLng(lng);
      setSelectedPlaceId(pid);
      if (place.formatted_address) {
        setAddress(place.formatted_address);
        setPlaceSelected(true);
      } else if (place.name) {
        setAddress(place.name);
        setPlaceSelected(true);
      }
    });
  }, [mapsReady]);

  const handleAnalyze = () => {
    const val = inputRef.current?.value || address;
    if (!val.trim()) {
      setError("Please enter a specific address — street number, city, and state.");
      return;
    }
    if (!placeSelected) {
      setError("Please select a specific address from the dropdown. A city name alone is not precise enough.");
      return;
    }
    if (!investment.trim() || isNaN(Number(investment.replace(/[,$]/g, ""))) || Number(investment.replace(/[,$]/g, "")) <= 0) {
      setError("Please enter your investment amount before continuing.");
      return;
    }
    setError("");
    setLoading(true);
    const cleanInvestment = investment.replace(/[,$]/g, "");
    const params = new URLSearchParams({ address: val, currency: currency.code, radius: radiusMiles.toString(), budget: cleanInvestment });
    if (selectedLat !== null) params.set("lat", selectedLat.toString());
    if (selectedLng !== null) params.set("lng", selectedLng.toString());
    if (selectedPlaceId)      params.set("placeId", selectedPlaceId);
    router.push(`/configure?${params.toString()}`);
  };

  const handleLogoClick = () => window.location.reload();

  return (
    <main className="min-h-screen bg-[#0f172a]">

      {/* Background slideshow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{ backgroundImage: `url('${BG_IMAGES[bgIndex]}')`, opacity: bgFading ? 0 : 1 }}
        />
        <div className="absolute inset-0 bg-[#0f172a]/55" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0f172a] to-transparent" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-black/25 border-b border-white/5">
        <button onClick={handleLogoClick} className="flex items-center gap-2 group" title="Refresh">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <MapPin className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-white font-bold text-sm hidden sm:inline">Site Intelligence</span>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-6 text-sm text-slate-200">
          <a href="#features"    className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#overview"    className="hover:text-white transition-colors">What You Get</a>
        </div>

        <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full px-3 py-1.5">
          <Shield className="w-3 h-3" />
          <span>Data-Driven Site Analysis</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-28 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 text-sm text-blue-300 mb-8">
            <Shield className="w-4 h-4" />
            <span>Data-driven site analysis for car wash investors and developers</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 tracking-tight">
            Know What the Data Says{" "}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Before You Build
            </span>
          </h1>

          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
            Enter any US address. We pull live traffic counts, parcel records, competitor data,
            and construction cost benchmarks — and present what the data shows about your site.
            You make the decision.
          </p>

          {/* Search box */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-800/85 backdrop-blur-xl border border-slate-600/60 rounded-2xl p-2 shadow-2xl shadow-black/60">
              <div className="flex items-center gap-3 px-4 py-3">
                <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter a specific street address (e.g. 1420 N Harbor Blvd, Fullerton, CA)"
                  className="flex-1 bg-transparent text-white placeholder-slate-400 text-base outline-none"
                  defaultValue={address}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  onChange={(e) => { setAddress(e.target.value); setPlaceSelected(false); setSelectedLat(null); setSelectedLng(null); setSelectedPlaceId(null); }}
                />
              </div>
              {/* Investment amount — required */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-t border-slate-700/40 cursor-text"
                onClick={() => investmentInputRef.current?.focus()}
              >
                <Building2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-slate-400 text-sm whitespace-nowrap">Investment amount</span>
                  <input
                    ref={investmentInputRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 3,500,000"
                    value={investment}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, "");
                      setInvestment(raw ? Number(raw).toLocaleString() : "");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm outline-none text-right"
                  />
                  <span className="text-slate-500 text-xs">{currency.symbol}</span>
                </div>
                <span className="text-red-400 text-xs font-semibold">Required</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-700/40">
                <CurrencySelector selected={currency} onChange={handleCurrencyChange} compact />
                <span className="text-slate-500 text-xs">Investment ranges shown per format on the next step</span>
              </div>

              {/* Radius selector — slider 5→31 mi (Google Places API hard limit) */}
              <div className="flex flex-col gap-1.5 px-3 py-2.5 border-t border-slate-700/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-400 text-xs">Search radius</span>
                  </div>
                  <span className="text-blue-300 font-bold text-sm tabular-nums">{radiusMiles} mi</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={31}
                  step={1}
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-blue-500 cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 ${((radiusMiles - 5) / 26) * 100}%, #1e293b ${((radiusMiles - 5) / 26) * 100}%)`,
                  }}
                />
                <div className="flex justify-between text-[9px] text-slate-600 font-medium">
                  <span>5 mi</span>
                  <span>18 mi</span>
                  <span>31 mi</span>
                </div>
                <p className="text-slate-500 text-[9px]">Competitor search capped at 31 miles — Google Places API limit</p>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing location...
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    Continue — Choose Format
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            {error && <p className="mt-3 text-red-400 text-sm text-center">{error}</p>}
            <p className="mt-4 text-xs text-slate-300 text-center">
              Powered by Google Maps · TomTom · ILO · World Bank · Analysis covers a {radiusMiles}-mile radius
            </p>
          </div>
        </div>
      </section>

      {/* Data sources bar */}
      <section className="relative z-10 border-y border-slate-700/50 bg-slate-900/60 backdrop-blur-sm py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {DATA_POINTS.map((d) => (
            <div key={d.label} className="text-center">
              <div className="text-base font-bold text-white mb-0.5">{d.text}</div>
              <div className="text-xs text-slate-400 uppercase tracking-widest">{d.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Make the Right Call
              </span>
            </h2>
            <p className="text-slate-200 text-lg max-w-xl mx-auto">
              Built on the same analysis framework used by professional car wash developers,
              now available to every investor at any level.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-hover bg-slate-800/60 border border-slate-600/50 rounded-2xl p-6 group">
                <div className="w-12 h-12 bg-slate-700/60 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-700 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-200 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 py-24 px-4 bg-slate-900/55">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <TypewriterHeading text="Three Steps to Your Site Report" />
            <p className="text-slate-200 text-lg">
              Live data. Disclosed sources. You decide.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Enter a Specific Address",
                desc: "Enter a full street address and your investment amount. We require a precise location — not just a city — to pull accurate parcel records, traffic data, and competitor listings.",
                color: "blue",
              },
              {
                step: "02",
                title: "We Pull the Data",
                desc: "TomTom AADT, Google Places competitors, ATTOM parcel record, ILO wage data, and a verified cost model — all fetched live.",
                color: "purple",
              },
              {
                step: "03",
                title: "Review the Report",
                desc: "You get a scored site report with every data source disclosed. The scoring reflects traffic, competition, and market density — nothing fabricated.",
                color: "emerald",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center text-2xl font-black
                  ${item.color === "blue"   ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                    item.color === "purple" ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                                              "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"}`}>
                  {item.step}
                </div>
                <h3 className="text-white font-bold text-xl mb-3">{item.title}</h3>
                <p className="text-slate-200 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section id="overview" className="relative z-10 py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-white mb-4">
              Built for Investors Who Want{" "}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Real Data, Not Gut Feeling
              </span>
            </h2>
            <p className="text-white text-lg max-w-2xl mx-auto font-medium leading-relaxed">
              Whether you are a first-time investor or an experienced developer,
              every number in the report comes from a disclosed source — and the final call is always yours.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-600/40 rounded-3xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-10">
              {/* Checklist */}
              <div>
                <h3 className="text-white font-bold text-xl mb-6">Your Report Includes:</h3>
                <div className="space-y-3.5">
                  {[
                    "Site score (0–100) based on AADT traffic, competition density, and market viability",
                    "Interactive map of all car washes within your chosen radius",
                    "Competitor ratings, review count, and customer complaint breakdown",
                    "County parcel record — owner, lot size, assessed value, zoning, last sale",
                    "Investment cost range based on car wash format and regional cost data",
                    "5-year financial projection anchored to a verified industry model",
                    "Lot fit check — which formats physically fit on the parcel",
                    "Strategic observations — what the data suggests, not guarantees",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-100 text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Animated score card */}
              <AnimatedScoreCard />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-4">
            Ready to Find Your{" "}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Perfect Site?
            </span>
          </h2>
          <p className="text-slate-200 text-lg mb-10">
            Enter your location above and receive your full analysis in seconds.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold px-10 py-4 rounded-2xl text-lg transition-all duration-200 flex items-center gap-2 mx-auto"
          >
            <Zap className="w-5 h-5" />
            Analyze My Location
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-700/50 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <button onClick={handleLogoClick} className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
              <MapPin className="w-3 h-3 text-blue-400" />
            </div>
            <span className="text-slate-400 text-xs font-medium group-hover:text-white transition-colors">Site Intelligence Tool</span>
          </button>

          <p className="text-slate-200 text-xs text-center font-medium">
            For informational purposes only — verify all data with qualified professionals before committing capital.
          </p>

          <p className="text-slate-200 text-xs font-medium">
            Powered by Google Maps Platform
          </p>
        </div>
      </footer>

    </main>
  );
}
