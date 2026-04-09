"use client";

import { useEffect, useState } from "react";
import type { SiteAnalysisResult, AiDecision, CurrencyOption } from "@/lib/types";

interface Props {
  result: SiteAnalysisResult;
  budget: number;       // in user's selected currency
  currency: CurrencyOption;
  rate: number;         // how many currency units = 1 USD
}

function fmt(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${Math.round(usd).toLocaleString()}`;
}

const VERDICT_STYLES = {
  "INVEST": {
    bg:     "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text:   "text-emerald-400",
    badge:  "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300",
    icon:   "✅",
    glow:   "#10b981",
  },
  "PROCEED WITH CAUTION": {
    bg:     "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text:   "text-yellow-400",
    badge:  "bg-yellow-500/20 border border-yellow-500/40 text-yellow-300",
    icon:   "⚠️",
    glow:   "#f59e0b",
  },
  "DO NOT INVEST": {
    bg:     "bg-red-500/10",
    border: "border-red-500/30",
    text:   "text-red-400",
    badge:  "bg-red-500/20 border border-red-500/40 text-red-300",
    icon:   "🚫",
    glow:   "#ef4444",
  },
};

function Skeleton() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-3xl p-8 space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-700/60" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 bg-slate-700/60 rounded-lg" />
          <div className="h-4 w-72 bg-slate-700/40 rounded-lg" />
        </div>
      </div>
      <div className="h-4 bg-slate-700/40 rounded-lg w-full" />
      <div className="h-4 bg-slate-700/40 rounded-lg w-4/5" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-32 bg-slate-700/40 rounded-xl" />
        <div className="h-32 bg-slate-700/40 rounded-xl" />
      </div>
      <div className="text-slate-500 text-xs text-center">Analyzing your investment opportunity...</div>
    </div>
  );
}

export default function FinalDecisionPanel({ result, budget, currency, rate }: Props) {
  const [decision, setDecision] = useState<AiDecision | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [showCalc, setShowCalc] = useState(false);

  useEffect(() => {
    // Convert budget to USD (budget is in user's currency; rate = units per USD)
    const exchangeRate = rate || 1;

    fetch("/api/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result, budget, exchangeRate }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setDecision(d);
      })
      .catch((e) => setError(e.message ?? "Analysis unavailable"))
      .finally(() => setLoading(false));
  }, [result, budget, rate]);

  if (loading) return <Skeleton />;

  if (error || !decision) {
    return (
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5 text-center">
        <div className="text-2xl mb-2">📊</div>
        <p className="text-yellow-300/80 text-sm font-semibold">Investment Decision Unavailable</p>
        <p className="text-slate-500 text-xs mt-1">Review the sections above for a complete picture of this location.</p>
      </div>
    );
  }

  const style = VERDICT_STYLES[decision.verdict];

  return (
    <div className={`rounded-3xl border p-8 space-y-6 ${style.bg} ${style.border}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ boxShadow: `0 0 24px ${style.glow}40`, background: `${style.glow}15` }}
        >
          {style.icon}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className={`text-2xl font-black ${style.text}`}>{decision.verdict}</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${decision.budgetFeasible ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
              Budget: {decision.budgetFeasible ? "FEASIBLE" : "INSUFFICIENT"}
            </span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{decision.decisionSummary}</p>
        </div>
      </div>

      {/* ── Budget analysis ─────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 border space-y-4 ${decision.budgetFeasible ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>

        {/* Visual budget comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/40">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Your Budget</div>
            <div className={`text-lg font-black ${decision.budgetFeasible ? "text-emerald-300" : "text-red-300"}`}>
              {fmt(decision.budgetUSD)}
            </div>
            <div className="text-slate-500 text-[10px] mt-0.5">What you have to invest</div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-3 border border-yellow-500/20">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Minimum Viable Investment</div>
            <div className="text-lg font-black text-yellow-300">
              {fmt(decision.minimumRequiredUSD)}
            </div>
            <div className="text-slate-500 text-[10px] mt-0.5">Hard floor to build a viable tunnel</div>
          </div>
        </div>

        {/* Progress bar: budget vs minimum */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>Budget coverage of minimum</span>
            <span className={decision.budgetFeasible ? "text-emerald-400" : "text-red-400"}>
              {Math.round((decision.budgetUSD / decision.minimumRequiredUSD) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${decision.budgetFeasible ? "bg-emerald-400" : "bg-red-400"}`}
              style={{ width: `${Math.min(100, Math.round((decision.budgetUSD / decision.minimumRequiredUSD) * 100))}%` }}
            />
          </div>
          <p className="text-slate-500 text-[10px] mt-1">
            The Minimum Viable Investment is the absolute floor — below this, no car wash can be built to a profitable standard. Your Suggested Investment Range (in the section above) is what a properly-built site actually costs.
          </p>
        </div>

        {/* Full analysis text */}
        <div className="flex items-start gap-2 border-t border-slate-700/30 pt-3">
          <span className="text-lg flex-shrink-0">{decision.budgetFeasible ? "💰" : "❌"}</span>
          <p className={`text-sm leading-relaxed ${decision.budgetFeasible ? "text-emerald-200" : "text-red-200"}`}>
            {decision.budgetAnalysis}
          </p>
        </div>
      </div>

      {/* ── Green / Red flags ──────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Green flags */}
        {decision.greenFlags.length > 0 && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
            <h4 className="text-emerald-400 font-bold text-sm mb-3 flex items-center gap-1.5">
              <span>✅</span> Positive Signals
            </h4>
            <ul className="space-y-2">
              {decision.greenFlags.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">▸</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red flags */}
        {decision.redFlags.length > 0 && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
            <h4 className="text-red-400 font-bold text-sm mb-3 flex items-center gap-1.5">
              <span>🚩</span> Risk Factors
            </h4>
            <ul className="space-y-2">
              {decision.redFlags.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">▸</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Key factors ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4">
        <h4 className="text-white font-bold text-sm mb-3">📊 Key Factors in This Decision</h4>
        <ul className="space-y-1.5">
          {decision.keyFactors.map((f, i) => (
            <li key={i} className="text-slate-300 text-xs flex items-start gap-2">
              <span className={`font-bold flex-shrink-0 ${style.text}`}>{i + 1}.</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* ── How this was calculated (expandable) ───────────────────────────── */}
      <div className="bg-slate-800/30 border border-slate-700/20 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowCalc((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-700/20 transition-colors text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <span>🧮</span> How This Decision Was Calculated
          </span>
          <span className="text-xs">{showCalc ? "▲ Hide" : "▼ Show"}</span>
        </button>
        {showCalc && (
          <div className="px-4 pb-4 border-t border-slate-700/20">
            <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-line mt-3">
              {decision.calculationBreakdown}
            </p>
          </div>
        )}
      </div>

      {/* ── Recommendation ──────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-5 border ${style.bg} ${style.border}`}
           style={{ boxShadow: `inset 0 0 40px ${style.glow}08` }}>
        <h4 className={`font-bold text-sm mb-2 ${style.text}`}>💡 Recommendation</h4>
        <p className="text-white text-sm leading-relaxed">{decision.recommendation}</p>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <p className="text-slate-600 text-xs text-center">
        All projections are estimates based on industry benchmarks and live location data.
        Verify with qualified professionals before making investment decisions.
      </p>
    </div>
  );
}
