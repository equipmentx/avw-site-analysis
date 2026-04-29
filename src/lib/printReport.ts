import type { SiteAnalysisResult, CurrencyOption } from "@/lib/types";

function fmtUSD(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000)     return `$${(usd / 1_000).toFixed(0)}K`;
  return `$${Math.round(usd).toLocaleString()}`;
}

function fmtCurr(usd: number, rate: number, symbol: string): string {
  const v = usd * rate;
  if (v >= 1_000_000) return `${symbol}${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${symbol}${(v / 1_000).toFixed(0)}K`;
  return `${symbol}${Math.round(v).toLocaleString()}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function bar(score: number, color: string): string {
  return `<div style="background:#1e293b;border-radius:4px;height:8px;overflow:hidden;">
    <div style="width:${score}%;height:100%;background:${color};border-radius:4px;"></div>
  </div>`;
}

export function generatePrintReport(
  result: SiteAnalysisResult,
  currency: CurrencyOption,
  rate: number,
  configId: string | null,
): string {
  const { score, competitors, trafficSignals, financialProjection: fp, reviewInsights, investmentSuggestion: inv } = result;
  const sym = currency.symbol;
  const verdictColor = score.verdictColor;

  // Score component rows
  const compRows = Object.entries(score.components)
    .map(([key, val]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const color = scoreColor(val);
      return `<tr>
        <td style="padding:6px 12px;color:#94a3b8;font-size:13px;">${label}</td>
        <td style="padding:6px 12px;width:200px;">${bar(val, color)}</td>
        <td style="padding:6px 12px;color:${color};font-weight:700;font-size:13px;">${val}/100</td>
      </tr>`;
    }).join("");

  // Competitor rows
  const compTableRows = competitors.map((c) => {
    const tl = c.threatLevel;
    const tlColor = tl === "HIGH" ? "#ef4444" : tl === "MEDIUM" ? "#f59e0b" : "#10b981";
    return `<tr style="border-bottom:1px solid #1e293b;">
      <td style="padding:6px 12px;color:#e2e8f0;font-size:12px;">${c.place.name}</td>
      <td style="padding:6px 12px;color:#94a3b8;font-size:12px;">${c.distanceMiles.toFixed(1)} mi</td>
      <td style="padding:6px 12px;color:#fbbf24;font-size:12px;">${(c.place.rating ?? 0).toFixed(1)}★</td>
      <td style="padding:6px 12px;font-size:12px;color:${tlColor};font-weight:600;">${tl}</td>
      <td style="padding:6px 12px;color:#94a3b8;font-size:12px;">${c.washType ?? "unknown"}</td>
    </tr>`;
  }).join("");

  // Financial projection rows
  const projRows = (fp.projections ?? []).map((row, i) => {
    const pos = row.netIncome >= 0;
    return `<tr style="${i % 2 === 0 ? "" : "background:#0f172a20;"}">
      <td style="padding:6px 12px;color:#e2e8f0;font-size:12px;font-weight:600;">Year ${row.year}</td>
      <td style="padding:6px 12px;color:#94a3b8;font-size:12px;">${fmtCurr(row.revenue, rate, sym)}</td>
      <td style="padding:6px 12px;color:#94a3b8;font-size:12px;">${fmtCurr(row.ebitda, rate, sym)}</td>
      <td style="padding:6px 12px;font-size:12px;font-weight:600;color:${pos ? "#10b981" : "#ef4444"};">${fmtCurr(row.netIncome, rate, sym)}</td>
    </tr>`;
  }).join("");

  // Complaints
  const complaintList = reviewInsights.dominantComplaints
    .map((c) => `<li style="margin-bottom:4px;color:#94a3b8;font-size:12px;">${c.emoji} <strong style="color:#e2e8f0;">${c.category}</strong> — ${c.count} mention(s). ${c.opportunity}</li>`)
    .join("");

  // Traffic signals
  const trafficRows = [
    ["Est. Daily Traffic (AADT)", `${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day`],
    ["Nearby Gas Stations",       trafficSignals.nearbyGasStations.toString()],
    ["Nearby Grocery Stores",     trafficSignals.nearbyGroceryStores.toString()],
    ["Nearby Fast Food",          trafficSignals.nearbyFastFood.toString()],
    ["Nearby Shopping",          trafficSignals.nearbyShopping.toString()],
  ].map(([label, val]) => `<tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">${label}</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;font-weight:600;">${val}</td></tr>`).join("");

  // TomTom summary
  const tomtomSection = result.tomtom ? `
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Road Class</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${result.tomtom.trafficFlow.roadClassLabel ?? "N/A"} (${result.tomtom.trafficFlow.roadClass ?? "?"})</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Congestion</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${result.tomtom.trafficFlow.congestionLevel ?? "N/A"}</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Incident Risk</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${result.tomtom.incidents.accessRiskLevel ?? "N/A"}</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Active Closures</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${result.tomtom.incidents.closureCount}</td></tr>
  ` : `<tr><td colspan="2" style="padding:5px 12px;color:#64748b;font-size:12px;">TomTom road intelligence data not available</td></tr>`;

  // Parcel summary
  const parcelSection = result.parcel?.status === "live" ? `
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Lot Size</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${result.parcel.lotSqFt?.toLocaleString() ?? "?"} sqft (${result.parcel.lotAcres?.toFixed(2) ?? "?"} acres)</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Zoning</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${result.parcel.zoning ?? "Unknown"}</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Owner</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${result.parcel.owner ?? "Unknown"}</td></tr>
    ${result.parcel.lastSalePrice ? `<tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Last Sale</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${fmtUSD(result.parcel.lastSalePrice)}${result.parcel.lastSaleDate ? ` (${result.parcel.lastSaleDate})` : ""}</td></tr>` : ""}
  ` : `<tr><td colspan="2" style="padding:5px 12px;color:#64748b;font-size:12px;">ATTOM parcel data not available (US only, or not configured)</td></tr>`;

  // Investment suggestion breakdown
  const invBreakdown = inv ? `
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Land</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${fmtCurr(inv.breakdown.land.min, rate, sym)} – ${fmtCurr(inv.breakdown.land.max, rate, sym)}</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Construction</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${fmtCurr(inv.breakdown.construction.min, rate, sym)} – ${fmtCurr(inv.breakdown.construction.max, rate, sym)}</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Equipment</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${fmtCurr(inv.breakdown.equipment.min, rate, sym)} – ${fmtCurr(inv.breakdown.equipment.max, rate, sym)}</td></tr>
    <tr><td style="padding:5px 12px;color:#94a3b8;font-size:12px;">Fees & Permits</td><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;">${fmtCurr(inv.breakdown.fees.min, rate, sym)} – ${fmtCurr(inv.breakdown.fees.max, rate, sym)}</td></tr>
    <tr style="border-top:1px solid #334155;"><td style="padding:5px 12px;color:#e2e8f0;font-size:12px;font-weight:700;">Total Range</td><td style="padding:5px 12px;color:#60a5fa;font-size:13px;font-weight:800;">${fmtCurr(inv.minEstimateUSD, rate, sym)} – ${fmtCurr(inv.maxEstimateUSD, rate, sym)}</td></tr>
  ` : `<tr><td colspan="2" style="padding:5px 12px;color:#64748b;font-size:12px;">Investment suggestion data unavailable</td></tr>`;

  const now = new Date(result.analyzedAt).toLocaleString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CarWash Intel — Site Analysis Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; }
    .page { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
    h1 { font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 12px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    .verdict-badge { display: inline-block; padding: 4px 14px; border-radius: 999px; font-weight: 800; font-size: 15px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    .print-btn { background: #3b82f6; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 16px; }
    @media print {
      body { background: #fff !important; color: #0f172a !important; }
      .card { background: #f8fafc !important; border-color: #cbd5e1 !important; }
      .print-btn { display: none !important; }
      h2 { color: #0f172a !important; border-color: #cbd5e1 !important; }
      h1 { color: #0f172a !important; }
      td { color: #334155 !important; }
    }
  </style>
</head>
<body>
<div class="page">
  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>

  <h1>CarWash Intel — Site Analysis Report</h1>
  <p class="meta">
    ${result.address}<br/>
    Analyzed: ${now} &nbsp;·&nbsp;
    Verdict: <strong style="color:${verdictColor};">${score.verdict}</strong> &nbsp;·&nbsp;
    Overall Score: <strong>${score.overall}/100</strong>
    ${configId ? ` &nbsp;·&nbsp; Format: ${configId}` : ""}
  </p>

  <!-- SCORE OVERVIEW -->
  <div class="card">
    <h2>Location Score</h2>
    <p style="color:#94a3b8;font-size:13px;margin-bottom:16px;">${score.explanation}</p>
    <table>
      ${compRows}
    </table>
  </div>

  <!-- TRAFFIC SIGNALS -->
  <div class="card">
    <h2>Traffic &amp; Market Signals</h2>
    <table>${trafficRows}${tomtomSection}</table>
    <p style="color:#64748b;font-size:11px;margin-top:10px;">
      Traffic: TomTom Traffic Flow API (BPR/HCM) · Surroundings: Google Places API · Road Intelligence: TomTom APIs
    </p>
  </div>

  <!-- COMPETITORS -->
  <div class="card">
    <h2>Competitor Analysis (${competitors.length} found within ${result.radiusMiles} mi)</h2>
    ${competitors.length === 0 ? '<p style="color:#64748b;font-size:13px;">No competitors found within the search radius.</p>' : `
    <table>
      <thead>
        <tr style="border-bottom:1px solid #334155;">
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Name</th>
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Distance</th>
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Rating</th>
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Threat</th>
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Type</th>
        </tr>
      </thead>
      <tbody>${compTableRows}</tbody>
    </table>
    <p style="color:#64748b;font-size:11px;margin-top:10px;">Source: Google Places API — live data at time of analysis.</p>
    `}
  </div>

  <!-- COMPLAINT ANALYSIS -->
  ${reviewInsights.dominantComplaints.length > 0 ? `
  <div class="card">
    <h2>Market Complaint Analysis</h2>
    <div style="margin-bottom:12px;display:flex;gap:16px;flex-wrap:wrap;">
      <div><span style="color:#64748b;font-size:11px;">Avg Rating</span><div style="font-size:18px;font-weight:800;color:#fbbf24;">${reviewInsights.avgCompetitorRating.toFixed(1)}★</div></div>
      <div><span style="color:#64748b;font-size:11px;">Reviews Analyzed</span><div style="font-size:18px;font-weight:800;">${reviewInsights.totalReviewsAnalyzed}</div></div>
      <div><span style="color:#64748b;font-size:11px;">Market Saturation</span><div style="font-size:18px;font-weight:800;">${reviewInsights.marketSaturationLevel}</div></div>
      <div><span style="color:#64748b;font-size:11px;">Market Gap Score</span><div style="font-size:18px;font-weight:800;color:#60a5fa;">${reviewInsights.marketGapScore}/100</div></div>
    </div>
    <ul style="padding-left:16px;">${complaintList}</ul>
  </div>
  ` : ""}

  <!-- PARCEL DATA -->
  <div class="card">
    <h2>Land Parcel Data</h2>
    <table>${parcelSection}</table>
    <p style="color:#64748b;font-size:11px;margin-top:10px;">Source: ATTOM Data (county assessor records) — US only.</p>
  </div>

  <!-- INVESTMENT SUGGESTION -->
  <div class="card">
    <h2>Suggested Investment Range</h2>
    <table>${invBreakdown}</table>
    ${inv ? `<p style="color:#64748b;font-size:11px;margin-top:10px;">${inv.sourceNote}</p>` : ""}
  </div>

  <!-- 5-YEAR FINANCIALS -->
  <div class="card">
    <h2>5-Year Financial Projection</h2>
    <div style="margin-bottom:12px;display:flex;gap:24px;flex-wrap:wrap;">
      <div><span style="color:#64748b;font-size:11px;">Year 1 Revenue</span><div style="font-size:16px;font-weight:800;color:#10b981;">${fmtCurr(fp.year1Revenue, rate, sym)}</div></div>
      <div><span style="color:#64748b;font-size:11px;">Year 1 EBITDA</span><div style="font-size:16px;font-weight:800;color:${fp.year1EBITDA >= 0 ? "#10b981" : "#ef4444"};">${fmtCurr(fp.year1EBITDA, rate, sym)}</div></div>
      <div><span style="color:#64748b;font-size:11px;">Payback Period</span><div style="font-size:16px;font-weight:800;">${fp.paybackYears} years</div></div>
      <div><span style="color:#64748b;font-size:11px;">5-Year IRR</span><div style="font-size:16px;font-weight:800;">~${fp.irr5Year}%</div></div>
      <div><span style="color:#64748b;font-size:11px;">Capture Rate</span><div style="font-size:16px;font-weight:800;">${(fp.assumptions.captureRate * 100).toFixed(1)}%</div></div>
    </div>
    ${(fp.projections ?? []).length > 0 ? `
    <table>
      <thead>
        <tr style="border-bottom:1px solid #334155;">
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;">Year</th>
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;">Revenue</th>
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;">EBITDA</th>
          <th style="padding:6px 12px;text-align:left;color:#64748b;font-size:11px;">Net Income</th>
        </tr>
      </thead>
      <tbody>${projRows}</tbody>
    </table>` : ""}
    <p style="color:#64748b;font-size:11px;margin-top:10px;">
      Source: Express Car Wash Investment Pro Forma model (2024-2025 benchmarks).
      Labour rates: ${fp.assumptions.wageSource !== "excel-baseline" ? `live ILO/World Bank data (${fp.assumptions.wagePeriod})` : "Pro Forma 2017 baseline"}.
      Staff $${fp.assumptions.staffHourlyUSD?.toFixed(2)}/hr · Manager $${fp.assumptions.managerHourlyUSD?.toFixed(2)}/hr.
    </p>
  </div>

  <!-- HIGHLIGHTS & RISKS -->
  <div class="card">
    <h2>Highlights &amp; Risk Factors</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <div style="color:#10b981;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">✓ Highlights</div>
        <ul style="padding-left:16px;">
          ${score.highlights.map((h) => `<li style="color:#94a3b8;font-size:12px;margin-bottom:4px;">${h}</li>`).join("")}
        </ul>
      </div>
      <div>
        <div style="color:#ef4444;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">⚠ Risk Factors</div>
        <ul style="padding-left:16px;">
          ${score.risks.map((r) => `<li style="color:#94a3b8;font-size:12px;margin-bottom:4px;">${r}</li>`).join("")}
        </ul>
      </div>
    </div>
  </div>

  <!-- DATA SOURCES -->
  <div class="card">
    <h2>Data Sources &amp; Methodology</h2>
    ${Object.entries(result.dataSources).map(([key, val]) => val ? `
      <div style="margin-bottom:8px;">
        <div style="color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;">${key.replace(/([A-Z])/g, " $1")}</div>
        <div style="color:#64748b;font-size:11px;line-height:1.5;">${val}</div>
      </div>` : "").join("")}
  </div>

  <p style="color:#475569;font-size:11px;text-align:center;margin-top:24px;">
    All projections are estimates based on industry benchmarks and live location data.
    Verify with qualified professionals before making investment decisions. ·
    Generated by CarWash Intel · ${now}
  </p>
</div>
</body>
</html>`;
}
