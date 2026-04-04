"use client";

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/financialModel";
import type { FinancialProjection as FP } from "@/lib/types";

interface FinancialProjectionProps {
  data: FP;
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
              ? formatCurrency(p.value)
              : p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function FinancialProjectionPanel({ data }: FinancialProjectionProps) {
  const { projections, assumptions, totalProjectCost, downPayment, loanAmount, monthlyDebtService, paybackYears, irr5Year, breakEvenMonthlyRevenue, year1Revenue, year1EBITDA, year1NetIncome, year5Revenue } = data;

  const ebitdaMargins = projections.map((p) => ({
    year: p.year,
    Revenue: p.revenue,
    EBITDA: p.ebitda,
    "Net Income": p.netIncome,
  }));

  const carVolumes = projections.map((p) => ({
    year: p.year,
    "Cars Washed": p.cars,
  }));

  const keyMetrics = [
    { label: "Total Project Cost",    value: formatCurrency(totalProjectCost),     color: "text-blue-400",    icon: "🏗️" },
    { label: "Required Down Payment", value: formatCurrency(downPayment),           color: "text-purple-400",  icon: "💳" },
    { label: "Loan Amount",           value: formatCurrency(loanAmount),            color: "text-yellow-400",  icon: "🏦" },
    { label: "Monthly Debt Service",  value: formatCurrency(monthlyDebtService),    color: "text-orange-400",  icon: "📅" },
    { label: "Year 1 Revenue",        value: formatCurrency(year1Revenue),          color: "text-emerald-400", icon: "💵" },
    { label: "Year 1 EBITDA",         value: formatCurrency(year1EBITDA),           color: year1EBITDA > 0 ? "text-emerald-400" : "text-red-400", icon: "📊" },
    { label: "Year 5 Revenue",        value: formatCurrency(year5Revenue),          color: "text-emerald-400", icon: "🚀" },
    { label: "Break-even (Monthly)",  value: formatCurrency(breakEvenMonthlyRevenue), color: "text-yellow-400", icon: "⚖️" },
    { label: "Estimated Payback",     value: `${paybackYears} Years`,              color: paybackYears <= 5 ? "text-emerald-400" : "text-yellow-400", icon: "⏳" },
    { label: "5-Year IRR (Est.)",     value: `~${irr5Year}%`,                      color: irr5Year >= 15 ? "text-emerald-400" : "text-yellow-400", icon: "📈" },
  ];

  return (
    <div className="space-y-8">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {keyMetrics.map((m) => (
          <div key={m.label} className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{m.icon}</div>
            <div className={`text-lg font-black ${m.color}`}>{m.value}</div>
            <div className="text-slate-500 text-xs mt-1 leading-tight">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue & EBITDA Chart */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-1">5-Year Revenue & Profitability Projection</h3>
        <p className="text-slate-500 text-xs mb-5">Based on {formatNumber(assumptions.dailyTrafficCount)} est. daily traffic · {(assumptions.captureRate * 100).toFixed(0)}% capture rate</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={ebitdaMargins} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ebitdaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="niGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
            <Area type="monotone" dataKey="Revenue"    stroke="#3b82f6" fill="url(#revGrad)"    strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="EBITDA"     stroke="#10b981" fill="url(#ebitdaGrad)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Net Income" stroke="#a855f7" fill="url(#niGrad)"     strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cars Washed Chart */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-1">Annual Car Volume Projection</h3>
        <p className="text-slate-500 text-xs mb-5">Standard washes + unlimited plan subscribers</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={carVolumes} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Cars Washed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Assumptions Table */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
        <h3 className="text-white font-bold text-base mb-4">Model Assumptions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            ["Daily Traffic Estimate",  formatNumber(assumptions.dailyTrafficCount) + " cars/day"],
            ["Capture Rate",            (assumptions.captureRate * 100).toFixed(0) + "%"],
            ["Daily Cars Washed",       formatNumber(assumptions.dailyCarsWashed) + " cars"],
            ["Avg Revenue / Car",       "$" + assumptions.avgRevenuePerCar.toFixed(2)],
            ["Land Cost",               formatCurrency(assumptions.landCost)],
            ["Equipment Cost",          formatCurrency(assumptions.equipmentCost)],
            ["Construction Cost",       formatCurrency(assumptions.constructionCost)],
            ["Interest Rate",           (assumptions.interestRate * 100).toFixed(0) + "%"],
            ["Loan Term",               assumptions.loanTermYears + " years"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col">
              <span className="text-slate-500 text-xs">{label}</span>
              <span className="text-white font-medium text-sm">{value}</span>
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-xs mt-4 leading-relaxed">
          * Financial model based on industry benchmarks from professional car wash development analysis.
          Pricing tiers: Bronze $9 · Silver $12 · Gold $18 · Best In Class $23 · Unlimited plans $19.99–$40/mo.
          All projections are estimates and should be verified with a qualified financial advisor.
        </p>
      </div>
    </div>
  );
}
