"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatNumber } from "@/lib/financialModel";
import type { FinancialProjection as FP, CurrencyOption, InvestmentSuggestion } from "@/lib/types";

interface FinancialProjectionProps {
  data: FP;
  currency?: CurrencyOption;
  rate?: number;
  budgetUSD?: number;
  investmentSuggestion?: InvestmentSuggestion;
}

function fmtC(usdValue: number, rate: number, symbol: string): string {
  const val = usdValue * rate;
  if (Math.abs(val) >= 1_000_000_000) return `${symbol}${(val / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(val) >= 1_000_000)     return `${symbol}${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000)         return `${symbol}${(val / 1_000).toFixed(0)}K`;
  return `${symbol}${Math.round(val).toLocaleString()}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-white font-bold mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">
            {typeof p.value === "number" && p.value > 1000
              ? `$${(p.value / 1000).toFixed(0)}K`
              : p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// Real images for each metric card
const METRIC_IMAGES: Record<string, string> = {
  "Total Project Cost":     "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=300&h=120&q=75",
  "Required Down Payment":  "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=300&h=120&q=75",
  "Loan Amount":            "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=300&h=120&q=75",
  "Monthly Debt Service":   "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=300&h=120&q=75",
  "Year 1 Revenue":         "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=300&h=120&q=75",
  "Year 1 EBITDA":          "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?auto=format&fit=crop&w=300&h=120&q=75",
  "Year 5 Revenue":         "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=300&h=120&q=75",
  "Break-even (Monthly)":   "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=300&h=120&q=75",
  "Estimated Payback":      "https://images.unsplash.com/photo-1434626881859-194d67b2b86f?auto=format&fit=crop&w=300&h=120&q=75",
  "5-Year IRR (Est.)":      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=300&h=120&q=75",
};

// Hook: fire once when element enters viewport
function useInView(threshold = 0.2) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// Animated number that counts up once in view
function AnimatedValue({ value, color }: { value: string; color: string }) {
  const { ref, inView } = useInView(0.1);
  const [shown, setShown] = useState("0");

  useEffect(() => {
    if (!inView) return;
    setShown(value);
  }, [inView, value]);

  return (
    <div
      ref={ref}
      className={`text-base font-black transition-all duration-700 ${color} ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
      style={{ transitionDelay: "0.1s" }}
    >
      {shown}
    </div>
  );
}

export default function FinancialProjectionPanel({ data, currency, rate = 1, budgetUSD, investmentSuggestion }: FinancialProjectionProps) {
  const symbol = currency?.symbol ?? "$";
  const {
    projections, assumptions, totalProjectCost, downPayment, loanAmount,
    monthlyDebtService, paybackYears, irr5Year, breakEvenMonthlyRevenue,
    year1Revenue, year1EBITDA, year5Revenue,
  } = data;

  const ebitdaData = projections.map((p) => ({
    year: p.year,
    Revenue: p.revenue,
    EBITDA: p.ebitda,
    "Net Income": p.netIncome,
  }));

  const carData = projections.map((p) => ({
    year: p.year,
    "Cars Washed": p.cars,
  }));

  const keyMetrics = [
    { label: "Total Project Cost",    value: fmtC(totalProjectCost,        rate, symbol), color: "text-blue-400" },
    { label: "Required Down Payment", value: fmtC(downPayment,             rate, symbol), color: "text-purple-400" },
    { label: "Loan Amount",           value: fmtC(loanAmount,              rate, symbol), color: "text-yellow-400" },
    { label: "Monthly Debt Service",  value: fmtC(monthlyDebtService,      rate, symbol), color: "text-orange-400" },
    { label: "Year 1 Revenue",        value: fmtC(year1Revenue,            rate, symbol), color: "text-emerald-400" },
    { label: "Year 1 EBITDA",         value: fmtC(year1EBITDA,             rate, symbol), color: year1EBITDA > 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Year 5 Revenue",        value: fmtC(year5Revenue,            rate, symbol), color: "text-emerald-400" },
    { label: "Break-even (Monthly)",  value: fmtC(breakEvenMonthlyRevenue, rate, symbol), color: "text-yellow-400" },
    { label: "Estimated Payback",     value: `${paybackYears} Years`,                      color: paybackYears <= 5 ? "text-emerald-400" : "text-yellow-400" },
    { label: "5-Year IRR (Est.)",     value: `~${irr5Year}%`,                              color: irr5Year >= 15 ? "text-emerald-400" : "text-yellow-400" },
  ];

  const { ref: chartRef, inView: chartInView } = useInView(0.15);

  return (
    <div className="space-y-8">

      {/* Key Metrics — image cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {keyMetrics.map((m) => (
          <div
            key={m.label}
            className="card-hover bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden group"
          >
            <div className="h-16 overflow-hidden relative">
              <img
                src={METRIC_IMAGES[m.label] ?? METRIC_IMAGES["Year 1 Revenue"]}
                alt={m.label}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
            </div>
            <div className="p-3 text-center">
              <AnimatedValue value={m.value} color={m.color} />
              <div className="text-slate-200 text-xs mt-1 leading-tight">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue & Profitability Chart */}
      <div ref={chartRef} className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-1">
          5-Year Revenue &amp; Profitability Projection
        </h3>
        <p className="text-slate-300 text-xs mb-5">
          Based on {formatNumber(assumptions.dailyTrafficCount)} estimated daily traffic &middot; {(assumptions.captureRate * 100).toFixed(0)}% capture rate
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={ebitdaData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ebitdaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="niGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => fmtC(v, rate, symbol)} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2.5} dot={false} isAnimationActive={chartInView} animationDuration={2000} animationEasing="ease-out" />
            <Area type="monotone" dataKey="EBITDA" stroke="#10b981" fill="url(#ebitdaGrad)" strokeWidth={2.5} dot={false} isAnimationActive={chartInView} animationDuration={2400} animationEasing="ease-out" />
            <Area type="monotone" dataKey="Net Income" stroke="#a855f7" fill="url(#niGrad)" strokeWidth={2.5} dot={false} isAnimationActive={chartInView} animationDuration={2800} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Split — Membership vs Drive-By */}
      {(data.membershipRevenue > 0 || data.driveByRevenue > 0) && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
          <h3 className="text-white font-bold text-base mb-1">Revenue Split — Year 1</h3>
          <p className="text-slate-300 text-xs mb-5">
            Drive-by vs. membership/unlimited · Source: Rinsed Q4 2024 — membership ≈ {data.membershipRevenue > 0 ? Math.round((data.membershipRevenue / (data.year1Revenue || 1)) * 100) : 26}% of total revenue
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {[
              { label: "Drive-By Revenue", value: data.driveByRevenue, color: "#3b82f6", icon: "🚗", pct: data.year1Revenue > 0 ? Math.round((data.driveByRevenue / data.year1Revenue) * 100) : 74 },
              { label: "Membership Revenue", value: data.membershipRevenue, color: "#10b981", icon: "♾️", pct: data.year1Revenue > 0 ? Math.round((data.membershipRevenue / data.year1Revenue) * 100) : 26 },
            ].map(({ label, value, color, icon, pct }) => (
              <div key={label} className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{icon}</span>
                  <span className="text-slate-300 text-sm font-semibold">{label}</span>
                </div>
                <div className="text-white font-black text-2xl mb-1">{fmtC(value, rate, symbol)}</div>
                <div className="h-2 bg-slate-600/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <div className="text-slate-400 text-xs mt-1">{pct}% of Year 1 revenue</div>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-[10px]">Source: Rinsed Q4 2024 Car Wash Industry Benchmarks — membership revenue ~26% of total for express operators.</p>
        </div>
      )}

      {/* Package Tier Breakdown */}
      {data.packageBreakdown && data.packageBreakdown.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
          <h3 className="text-white font-bold text-base mb-1">Wash Package Revenue Breakdown</h3>
          <p className="text-slate-300 text-xs mb-5">
            Drive-by customer distribution across pricing tiers — Sonny's Consulting / Project Prosperitas proforma
          </p>
          <div className="space-y-3">
            {data.packageBreakdown.map((tier, i) => {
              const colors = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b"];
              const color  = colors[i] ?? "#94a3b8";
              return (
                <div key={tier.tier} className="flex items-center gap-4">
                  <div className="w-20 flex-shrink-0">
                    <div className="text-white text-sm font-semibold">{tier.tier}</div>
                    <div className="text-slate-400 text-xs">${tier.priceUSD.toFixed(2)}/wash</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-400 text-xs">{(tier.sharePct * 100).toFixed(0)}% of customers</span>
                      <span className="text-white text-xs font-semibold">{fmtC(tier.annualRevenueUSD, rate, symbol)}/yr</span>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${tier.sharePct * 100}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div className="w-28 text-right flex-shrink-0">
                    <div className="text-slate-300 text-xs">{tier.annualCars.toLocaleString()} cars/yr</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-slate-500 text-[10px] mt-4">Package distribution: Basic 50% · Standard 25% · Premium 15% · Ultimate 10% — Sonny's Consulting proforma (Project Prosperitas).</p>
        </div>
      )}

      {/* Seasonal Revenue Projection */}
      {data.seasonalProjection && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
          <h3 className="text-white font-bold text-base mb-1">Seasonal Revenue Projection — Year 1</h3>
          <p className="text-slate-300 text-xs mb-5">
            ICA 2024 national seasonality: Spring/Summer peak · Winter low · Fall moderate
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: "springSummer" as const, icon: "☀️", label: "Spring / Summer", color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
              { key: "fall"         as const, icon: "🍂", label: "Fall",             color: "#f59e0b", bg: "bg-amber-500/10",   border: "border-amber-500/25" },
              { key: "winter"       as const, icon: "❄️", label: "Winter",           color: "#3b82f6", bg: "bg-blue-500/10",    border: "border-blue-500/25" },
            ].map(({ key, icon, label, color, bg, border }) => {
              const s = data.seasonalProjection[key];
              return (
                <div key={key} className={`rounded-xl border p-4 text-center ${bg} ${border}`}>
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-slate-300 text-xs font-semibold mb-0.5">{label}</div>
                  <div className="text-slate-400 text-[10px] mb-2">{s.months}</div>
                  <div className="text-white font-black text-lg leading-none">{fmtC(s.estimatedRevenueUSD, rate, symbol)}</div>
                  <div className="text-slate-400 text-xs mt-1">{Math.round(s.sharePct * 100)}% of annual revenue</div>
                  <div className="h-1.5 bg-slate-700/40 rounded-full mt-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${s.sharePct * 100}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-slate-500 text-[10px] mt-4">Source: ICA 2024 Industry Report — US national average car wash demand by season. Verify regional variation with a local operator.</p>
        </div>
      )}

      {/* Car Volume Bar Chart */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-1">Annual Car Volume Projection</h3>
        <p className="text-slate-300 text-xs mb-5">Standard washes plus unlimited plan subscribers</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={carData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Cars Washed" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={chartInView} animationDuration={1800} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Model Assumptions */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-4">Model Assumptions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            ["Daily Traffic Estimate",  formatNumber(assumptions.dailyTrafficCount) + " cars/day", "Google Maps review-volume formula"],
            ["Capture Rate",            (assumptions.captureRate * 100).toFixed(0) + "%",           "Express Car Wash Pro Forma — industry benchmark"],
            ["Daily Cars Washed",       formatNumber(assumptions.dailyCarsWashed) + " cars",        "Traffic × capture rate"],
            ["Avg Revenue Per Car",     "$" + assumptions.avgRevenuePerCar.toFixed(2),              "Express Car Wash Pro Forma — weighted pricing tiers"],
            ["Land Cost",               fmtC(assumptions.landCost, rate, symbol),
              assumptions.landCostSource === "attom-sale"     ? "Live ATTOM data — last sale price + 15% appreciation" :
              assumptions.landCostSource === "attom-market"   ? "Live ATTOM data — assessor market value + 10% buffer" :
              assumptions.landCostSource === "attom-assessed" ? "Live ATTOM data — assessed land value + 20% to market" :
              assumptions.landCostSource === "attom-avm"      ? "Live ATTOM AVM estimate × 30% commercial land ratio" :
              "23.9% of total project cost (Pro Forma model ratio)"
            ],
            ["Equipment Cost",          fmtC(assumptions.equipmentCost, rate, symbol),              "32.8% of total project cost (Pro Forma model ratio)"],
            ["Construction Cost",       fmtC(assumptions.constructionCost, rate, symbol),           "29.5% of total project cost (Pro Forma model ratio)"],
            ["Interest Rate",           (assumptions.interestRate * 100).toFixed(0) + "%",          "Pro Forma model — standard SBA commercial lending rate"],
            ["Loan Term",               assumptions.loanTermYears + " years",                       "Pro Forma model — standard commercial term"],
          ].map(([label, value, source]) => (
            <div key={label} className="flex flex-col border-l-2 border-slate-700 pl-3">
              <span className="text-slate-200 text-xs">{label}</span>
              <span className="text-white font-semibold text-sm">{value}</span>
              <span className="text-slate-400 text-[10px] mt-0.5 leading-tight">{source}</span>
            </div>
          ))}
        </div>

        {/* Wage data source — always disclosed */}
        {(() => {
          const isLive = assumptions.wageSource === "ilo-occupation" || assumptions.wageSource === "ilo-all-workers" || assumptions.wageSource === "world-bank-derived";
          const sourceLabel =
            assumptions.wageSource === "ilo-occupation"   ? `ILO ILOSTAT — service workers (${assumptions.wagePeriod})` :
            assumptions.wageSource === "ilo-all-workers"  ? `ILO ILOSTAT — all workers, adj. (${assumptions.wagePeriod})` :
            assumptions.wageSource === "world-bank-derived" ? `World Bank GNI-derived (${assumptions.wagePeriod})` :
            "Pro Forma baseline (2017)";
          return (
        <div className={`mt-4 rounded-xl p-3 border text-xs flex items-start gap-2 ${
          isLive ? "bg-emerald-500/5 border-emerald-500/20" : "bg-yellow-500/5 border-yellow-500/20"
        }`}>
          <span className="text-base flex-shrink-0">{isLive ? "✅" : "⚠️"}</span>
          <div>
            <span className={`font-bold ${isLive ? "text-emerald-300" : "text-yellow-300"}`}>
              Labour Cost Data — {sourceLabel}
            </span>
            <p className="text-slate-200 mt-0.5 leading-relaxed">{assumptions.wageNote}</p>
            <p className="text-slate-200 mt-1">
              Staff: {fmtC(assumptions.staffHourlyUSD, rate, symbol)}/hr &middot;
              Manager: {fmtC(assumptions.managerHourlyUSD, rate, symbol)}/hr
            </p>
          </div>
        </div>
          );
        })()}

        <p className="text-slate-300 text-xs mt-4 leading-relaxed border-t border-slate-700/30 pt-4">
          <span className="text-slate-200 font-semibold">Revenue model:</span> Express Car Wash Pro Forma (August 2017, US baseline $3,663,000).
          Pricing tiers: Bronze $9 &middot; Silver $12 &middot; Gold $18 &middot; Best In Class $23 &middot; Unlimited plans $19.99–$40/mo.
          Costs, depreciation, and financing terms anchored directly to the verified Excel spreadsheet.
          All projections are estimates — verify with a qualified financial advisor before committing capital.
        </p>
      </div>
    </div>
  );
}
