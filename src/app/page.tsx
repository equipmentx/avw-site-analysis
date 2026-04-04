"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  MapPin, TrendingUp, Star, DollarSign, BarChart2,
  CheckCircle, ChevronRight, Zap, Shield,
} from "lucide-react";

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
    desc: "Deep dive into every car wash near your site — ratings, reviews, weaknesses, and service gaps you can exploit.",
  },
  {
    icon: <BarChart2 className="w-6 h-6 text-emerald-400" />,
    title: "5-Year Financial Model",
    desc: "Projects revenue, EBITDA, and payback period based on real industry benchmarks and your investment budget.",
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-purple-400" />,
    title: "Opportunity Scoring",
    desc: "Scores your location 0 to 100 and issues a clear GO, CAUTION, or NO-GO verdict with plain-English reasoning.",
  },
  {
    icon: <DollarSign className="w-6 h-6 text-green-400" />,
    title: "Investment Sizing",
    desc: "Enter your budget and receive a custom capital stack, loan structure, and return on investment estimate.",
  },
  {
    icon: <Zap className="w-6 h-6 text-orange-400" />,
    title: "Instant Results",
    desc: "Full site analysis delivered in under 30 seconds. No spreadsheets, no consultants, no guesswork required.",
  },
];

const STATS = [
  { label: "Locations Analyzed",   value: 12400, suffix: "+" },
  { label: "Average Analysis Time", value: 30,    suffix: "s" },
  { label: "Data Points Checked",   value: 200,   suffix: "+" },
  { label: "Investor Accuracy",     value: 94,    suffix: "%" },
];

const SCORE_BARS = [
  { label: "Traffic Score",     val: 88, color: "#3b82f6" },
  { label: "Competition",       val: 75, color: "#a855f7" },
  { label: "Opportunity",       val: 90, color: "#10b981" },
  { label: "Market Activity",   val: 72, color: "#eab308" },
  { label: "Financial Viability", val: 80, color: "#ec4899" },
];

// ── Stats count-up (fires on page load) ───────────────────────────────────────
function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const steps = 60;
    const duration = 2000;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCount(Math.min(Math.round((target / steps) * step), target));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

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
  const [address, setAddress] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [error, setError] = useState("");
  const [bgIndex, setBgIndex] = useState(0);
  const [bgFading, setBgFading] = useState(false);

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

  // Load Google Maps
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") return;
    if (window.google?.maps) { setMapsReady(true); return; }
    window.initGoogleMaps = () => setMapsReady(true);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  // Wire autocomplete
  useEffect(() => {
    if (!mapsReady || !inputRef.current || autocompleteRef.current) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      inputRef.current, { types: ["geocode", "establishment"] }
    );
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (place.formatted_address) setAddress(place.formatted_address);
      else if (place.name) setAddress(place.name);
    });
  }, [mapsReady]);

  const handleAnalyze = () => {
    const val = inputRef.current?.value || address;
    if (!val.trim()) { setError("Please enter an address or location."); return; }
    setError("");
    setLoading(true);
    const params = new URLSearchParams({ address: val });
    if (budget) params.set("budget", budget);
    router.push(`/analysis?${params.toString()}`);
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
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">CarWash Intel</span>
        </button>

        <div className="hidden md:flex items-center gap-6 text-sm text-slate-200">
          <a href="#features"    className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#overview"    className="hover:text-white transition-colors">What You Get</a>
        </div>

        <div className="flex items-center gap-2 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full px-3 py-1.5">
          <Shield className="w-3 h-3" />
          <span>Trusted by Investors Nationwide</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-28 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 text-sm text-blue-300 mb-8">
            <Shield className="w-4 h-4" />
            <span>Professional site analysis for car wash investors and developers</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6 tracking-tight">
            Know If Your Location{" "}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Will Win
            </span>{" "}
            Before You Build
          </h1>

          <p className="text-xl text-white/90 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
            Enter any address in the world. CarWash Intel analyzes traffic, competitors,
            customer complaints, and financial potential, delivering a crystal clear
            GO or NO-GO verdict in under 30 seconds.
          </p>

          {/* Search box */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-800/85 backdrop-blur-xl border border-slate-600/60 rounded-2xl p-2 shadow-2xl shadow-black/60">
              <div className="flex items-center gap-3 px-4 py-3">
                <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter address, city, or location..."
                  className="flex-1 bg-transparent text-white placeholder-slate-400 text-base outline-none"
                  defaultValue={address}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-700/40">
                <span className="text-slate-200 text-sm font-bold flex-shrink-0">$</span>
                <input
                  type="text"
                  placeholder="Investment budget (optional) — e.g., 3,500,000"
                  className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 text-sm outline-none"
                  value={budget ? parseInt(budget).toLocaleString() : ""}
                  onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
                />
                {budget && (
                  <span className="text-xs text-emerald-400 font-semibold whitespace-nowrap">
                    USD
                  </span>
                )}
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
                    <Zap className="w-4 h-4" />
                    Analyze This Location
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            {error && <p className="mt-3 text-red-400 text-sm text-center">{error}</p>}
            <p className="mt-4 text-xs text-slate-300 text-center">
              Powered by Google Maps Platform · Analysis covers a 5-mile radius
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 border-y border-slate-700/50 bg-slate-900/60 backdrop-blur-sm py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-white mb-1">
                <CountUp target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs text-slate-300 uppercase tracking-widest">{s.label}</div>
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
            <TypewriterHeading text="Three Steps to Clarity" />
            <p className="text-slate-200 text-lg">
              No spreadsheets. No consultants. No guesswork.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Enter Your Location",
                desc: "Type any address in the world. Our autocomplete knows every street, city, and landmark on the planet.",
                color: "blue",
              },
              {
                step: "02",
                title: "We Analyze Everything",
                desc: "We scan nearby car washes, pull 200 data points, analyze competitor reviews, and model your financials all in seconds.",
                color: "purple",
              },
              {
                step: "03",
                title: "Get Your Verdict",
                desc: "Receive a clear GO, CAUTION, or NO-GO score with specific recommendations tailored to your exact site.",
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
              Built for the Investor Who Has{" "}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                the Capital, Not the Background
              </span>
            </h2>
            {/* Pure white as requested */}
            <p className="text-white text-lg max-w-2xl mx-auto font-medium leading-relaxed">
              Whether you are a nurse, a contractor, or a first-time investor, CarWash Intel
              speaks plain English and tells you exactly what to do next.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-600/40 rounded-3xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-10">
              {/* Checklist */}
              <div>
                <h3 className="text-white font-bold text-xl mb-6">Your Report Includes:</h3>
                <div className="space-y-3.5">
                  {[
                    "Overall site score (0 to 100) with plain-English explanation",
                    "Interactive map of all car washes within 5 miles",
                    "Competitor strengths, weaknesses, and full review breakdown",
                    "What customers are complaining about and how to capitalize on it",
                    "5-year revenue and profit projections",
                    "Exact capital requirements and loan structure",
                    "Personalized strategic recommendations for your site",
                    "Estimated daily car volume and capture rate analysis",
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
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-md flex items-center justify-center group-hover:scale-105 transition-transform">
              <MapPin className="w-3 h-3 text-white" />
            </div>
            <span className="text-slate-200 text-sm font-semibold">CarWash Intel</span>
          </button>

          <p className="text-slate-200 text-xs text-center font-medium">
            &copy; 2026 CarWash Intel. Professional site analysis for car wash investors.
          </p>

          <p className="text-slate-200 text-xs font-medium">
            Powered by Google Maps Platform
          </p>
        </div>
      </footer>

    </main>
  );
}
