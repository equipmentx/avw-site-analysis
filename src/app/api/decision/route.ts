import { NextRequest, NextResponse } from "next/server";
import { getCountry } from "@/lib/countryData";
import type { SiteAnalysisResult, AiDecision } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// US baseline hourly rates from 404 Excel model (used to assess wage impact)
const US_BASELINE_STAFF_HOURLY   = 16;
const US_BASELINE_MANAGER_HOURLY = 30;

// ── Rule-based decision engine (works without any AI API key) ─────────────────
function rulesDecision(
  result: SiteAnalysisResult,
  budgetUSD: number,
  exchangeRate: number
): AiDecision {
  const country     = getCountry(result.countryCode);
  const minRequired = country.minViableUSD;
  const { score, financialProjection: fp, trafficSignals, competitors, reviewInsights } = result;
  const assumptions = fp.assumptions;

  // ── TomTom road intelligence ───────────────────────────────────────────────
  const tomtom         = result.tomtom;
  const roadClass      = tomtom?.trafficFlow.roadClass ?? null;
  const roadLabel      = tomtom?.trafficFlow.roadClassLabel ?? null;
  const congestion     = tomtom?.trafficFlow.congestionLevel ?? null;
  const incidentRisk   = tomtom?.incidents.accessRiskLevel ?? null;
  const closures       = tomtom?.incidents.closureCount ?? 0;
  const flowStatus     = tomtom?.trafficFlow.status ?? "unavailable";

  // ── Budget feasibility ──────────────────────────────────────────────────────
  const budgetGap      = minRequired - budgetUSD;
  const budgetRatio    = budgetUSD / minRequired;
  const budgetFeasible = budgetRatio >= 1.0;
  const budgetMarginal = budgetRatio >= 0.6 && budgetRatio < 1.0;

  // ── Wage impact analysis (ILO vs Excel baseline) ────────────────────────────
  const staffHourly   = assumptions.staffHourlyUSD   ?? US_BASELINE_STAFF_HOURLY;
  const managerHourly = assumptions.managerHourlyUSD ?? US_BASELINE_MANAGER_HOURLY;
  const wageSource    = assumptions.wageSource ?? "excel-baseline";
  const wagePeriod    = assumptions.wagePeriod ?? "estimate";
  const staffDelta    = staffHourly - US_BASELINE_STAFF_HOURLY;   // positive = more expensive
  const staffDeltaPct = (staffDelta / US_BASELINE_STAFF_HOURLY) * 100;

  // ── Competitor volume analysis (SerpApi Popular Times) ─────────────────────
  const competitorsWithVolume = competitors.filter(
    (c) => c.estimatedVolume?.sixMonthEstimate !== null && c.estimatedVolume?.sixMonthEstimate !== undefined
  );
  const totalCompetitorVolume6mo = competitorsWithVolume.reduce(
    (sum, c) => sum + (c.estimatedVolume.sixMonthEstimate ?? 0), 0
  );
  const avgCompetitorVolume6mo = competitorsWithVolume.length > 0
    ? Math.round(totalCompetitorVolume6mo / competitorsWithVolume.length)
    : null;
  const topVolumeCompetitor = competitorsWithVolume.length > 0
    ? competitorsWithVolume.sort((a, b) =>
        (b.estimatedVolume.sixMonthEstimate ?? 0) - (a.estimatedVolume.sixMonthEstimate ?? 0)
      )[0]
    : null;

  // ── Verdict logic ───────────────────────────────────────────────────────────
  let verdict: AiDecision["verdict"];
  if (!budgetFeasible && !budgetMarginal) {
    verdict = "DO NOT INVEST";
  } else if (!budgetFeasible && budgetMarginal) {
    verdict = "PROCEED WITH CAUTION";
  } else if (score.overall >= 68) {
    verdict = "INVEST";
  } else if (score.overall >= 45) {
    verdict = "PROCEED WITH CAUTION";
  } else {
    verdict = "DO NOT INVEST";
  }

  // ── Budget analysis message ─────────────────────────────────────────────────
  let budgetAnalysis: string;
  if (budgetFeasible) {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is SUFFICIENT for a car wash in ${country.name}. ` +
      `Minimum viable investment is ${fmtUSD(minRequired)} (based on the 404 Excel model scaled to ${country.name} ` +
      `at ${(country.multiplier * 100).toFixed(0)}% of the US benchmark). ` +
      `Your budget covers ${(budgetRatio * 100).toFixed(0)}% of the minimum threshold.`;
  } else if (budgetMarginal) {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is MARGINAL for a car wash in ${country.name}. ` +
      `Minimum viable investment is ${fmtUSD(minRequired)} — you are ${fmtUSD(budgetGap)} short (${(budgetRatio * 100).toFixed(0)}% funded). ` +
      `At this level you may be limited to a self-serve or in-bay automatic format rather than a full express tunnel. ` +
      `Consider raising additional equity or revising to a smaller format.`;
  } else {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is INSUFFICIENT for a car wash in ${country.name}. ` +
      `The minimum viable investment is ${fmtUSD(minRequired)}, meaning you are ${fmtUSD(budgetGap)} short (${(budgetRatio * 100).toFixed(0)}% funded). ` +
      `A US-standard express tunnel requires: equipment alone ~$1.2M, construction ~$1.08M, land ~$875K. ` +
      `Even in lower-cost markets like ${country.name}, core equipment and installation represent the largest fixed cost. ` +
      `At your current budget level, a full car wash facility cannot be built. ` +
      `To proceed: either increase your investment to at least ${fmtUSD(minRequired)}, or explore a manual/hand-wash format at significantly lower entry cost.`;
  }

  // ── Green flags ─────────────────────────────────────────────────────────────
  const greenFlags: string[] = [];
  if (trafficSignals.estimatedDailyTraffic >= 8_000) greenFlags.push(`High daily vehicle count: ${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day passing this location (source: TomTom Traffic Flow API — BPR/HCM methodology)`);
  if (score.components.competition >= 60)            greenFlags.push(`Weak competition nearby (score ${score.components.competition}/100) — low market saturation`);
  if (score.components.opportunity >= 65)            greenFlags.push(`Strong opportunity gap: competitors have notable service weaknesses`);
  if (fp.year1EBITDA > 0)                            greenFlags.push(`Positive Year 1 EBITDA: ${fmtUSD(fp.year1EBITDA)} — model uses ${ ["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `live wage data (${wagePeriod})` : "404 Excel baseline wages"} for ${country.name}`);
  if (fp.paybackYears <= 5)                          greenFlags.push(`Estimated payback of ${fp.paybackYears} years is within the 4–7 year industry benchmark`);
  if (reviewInsights.premiumOpportunity)             greenFlags.push("Low competitor quality signals room to charge premium pricing");
  if (trafficSignals.nearbyGasStations >= 3)         greenFlags.push(`${trafficSignals.nearbyGasStations} gas stations nearby — strong arterial road traffic indicator (source: Google Places API)`);
  if (budgetFeasible)                                greenFlags.push(`Budget fully funded at ${(budgetRatio * 100).toFixed(0)}% of minimum threshold`);

  // Wage green flag — lower local wages improve profitability vs US baseline
  if (staffDeltaPct < -20) {
    greenFlags.push(
      `Local wages are ${Math.abs(staffDeltaPct).toFixed(0)}% below the US model baseline ` +
      `(staff: $${staffHourly.toFixed(2)}/hr vs $${US_BASELINE_STAFF_HOURLY}/hr US baseline) — ` +
      `improves EBITDA vs a US operation. Source: ${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `${wageSource === "world-bank-derived" ? "World Bank" : "ILO ILOSTAT"} ${wagePeriod}` : "404 Excel baseline"}.`
    );
  }

  // TomTom road intelligence green flags
  if (flowStatus === "live" && roadClass && ["FRC1", "FRC2", "FRC3"].includes(roadClass)) {
    greenFlags.push(
      `Road classification: ${roadLabel} (${roadClass}) — a major/secondary arterial is ideal for a car wash ` +
      `(high passing traffic, manageable speeds). Source: TomTom Traffic Flow API.`
    );
  }
  if (flowStatus === "live" && congestion === "FREE_FLOW") {
    greenFlags.push(
      `Traffic flowing freely at time of analysis — no congestion-related access barriers. ` +
      `Source: TomTom Traffic Flow API.`
    );
  }

  // Competitor volume green flags — market proven active
  if (topVolumeCompetitor && (topVolumeCompetitor.estimatedVolume.sixMonthEstimate ?? 0) >= 15_000) {
    greenFlags.push(
      `Market proven active: top competitor "${topVolumeCompetitor.place.name}" estimated ` +
      `~${topVolumeCompetitor.estimatedVolume.sixMonthEstimate!.toLocaleString()} cars in last 6 months ` +
      `(source: Google Maps Popular Times via SerpApi, ${topVolumeCompetitor.estimatedVolume.confidence} confidence).`
    );
  }
  if (avgCompetitorVolume6mo !== null && avgCompetitorVolume6mo >= 8_000) {
    greenFlags.push(
      `Competitors averaging ~${avgCompetitorVolume6mo.toLocaleString()} cars/6 months — ` +
      `confirms active car wash demand in this trade area.`
    );
  }

  // ── Red flags ───────────────────────────────────────────────────────────────
  const redFlags: string[] = [];
  if (!budgetFeasible)                               redFlags.push(`Budget ${fmtUSD(budgetUSD)} is below minimum viable ${fmtUSD(minRequired)} — gap of ${fmtUSD(budgetGap)}`);
  if (fp.year1EBITDA <= 0)                           redFlags.push(`Year 1 EBITDA is negative (${fmtUSD(fp.year1EBITDA)}) — location may not generate enough revenue at current traffic levels`);
  if (score.components.traffic < 40)                 redFlags.push(`Low traffic score (${score.components.traffic}/100) — not enough daily cars passing the site`);
  if (score.components.competition >= 75)            redFlags.push(`High competition score (${score.components.competition}/100) — strong established players nearby`);
  if (fp.paybackYears > 8)                           redFlags.push(`Long payback period of ${fp.paybackYears} years exceeds the 7-year industry benchmark`);
  if (trafficSignals.estimatedDailyTraffic < 3_000)  redFlags.push(`Very low estimated traffic (${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day) — capture rate will be insufficient`);
  if (competitors.length >= 5)                       redFlags.push(`${competitors.length} car washes detected within 5 miles — market may be over-served`);
  if (fp.irr5Year < 10)                              redFlags.push(`5-year IRR of ~${fp.irr5Year}% is below typical 15% investment hurdle rate`);

  // Wage red flag — higher local wages compress margins vs US baseline
  if (staffDeltaPct > 15) {
    redFlags.push(
      `Local wages are ${staffDeltaPct.toFixed(0)}% above the US model baseline ` +
      `(staff: $${staffHourly.toFixed(2)}/hr vs $${US_BASELINE_STAFF_HOURLY}/hr) — ` +
      `labour costs compress EBITDA vs standard projections. ` +
      `Source: ${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `${wageSource === "world-bank-derived" ? "World Bank" : "ILO ILOSTAT"} ${wagePeriod}` : "404 Excel baseline"}.`
    );
  }

  // Wage source disclosure
  if (wageSource === "excel-baseline" || wageSource === "unavailable") {
    redFlags.push(
      `Labour cost data unavailable from live sources (ILO ILOSTAT and World Bank both returned no data for ${country.name}). ` +
      `404 Excel 2017 US baseline rates used. Verify local wage rates with an HR consultant before committing.`
    );
  } else if (wageSource === "world-bank-derived") {
    redFlags.push(
      `Labour costs derived from World Bank GNI per capita (ILO direct data unavailable for ${country.name}). ` +
      `This is a structural estimate — verify actual service-sector wages locally.`
    );
  }

  // TomTom red flags
  if (closures >= 1) {
    redFlags.push(
      `${closures} road closure(s) active within 2km of site — direct access may be blocked at time of analysis. ` +
      `Source: TomTom Traffic Incidents API.`
    );
  }
  if (flowStatus === "live" && roadClass && ["FRC0"].includes(roadClass)) {
    redFlags.push(
      `Site is on a motorway/highway (${roadClass}) — too fast for impulse car wash stops. ` +
      `Customers typically cannot slow down and turn in safely. Source: TomTom Traffic Flow API.`
    );
  }
  if (flowStatus === "live" && roadClass && ["FRC5", "FRC6", "FRC7"].includes(roadClass)) {
    redFlags.push(
      `Site is on a minor local road (${roadLabel}) — insufficient passing traffic volume for a ` +
      `viable car wash operation. Source: TomTom Traffic Flow API.`
    );
  }
  if (flowStatus === "live" && congestion === "HEAVY") {
    redFlags.push(
      `Heavy traffic congestion detected near site — ingress/egress may be difficult, reducing ` +
      `impulse-stop likelihood. Source: TomTom Traffic Flow API.`
    );
  }

  // Competitor volume red flags
  if (competitorsWithVolume.length > 0 && avgCompetitorVolume6mo !== null && avgCompetitorVolume6mo < 3_000) {
    redFlags.push(
      `Competitors averaging only ~${avgCompetitorVolume6mo.toLocaleString()} cars/6 months — ` +
      `low volumes may indicate weak car wash demand in this area. ` +
      `(source: Google Maps Popular Times via SerpApi)`
    );
  }
  if (totalCompetitorVolume6mo > 60_000 && competitors.length >= 4) {
    redFlags.push(
      `Combined competitor volume of ~${totalCompetitorVolume6mo.toLocaleString()} cars/6 months across ${competitorsWithVolume.length} competitors — ` +
      `market may be near saturation capacity at current traffic levels.`
    );
  }

  // ── Key factors ─────────────────────────────────────────────────────────────
  const keyFactors: string[] = [
    `Overall location score: ${score.overall}/100 (${score.grade} — ${score.verdict})`,
    `Traffic score: ${score.components.traffic}/100 | Competition: ${score.components.competition}/100 | Opportunity: ${score.components.opportunity}/100`,
    `Year 1 revenue: ${fmtUSD(fp.year1Revenue)} | EBITDA: ${fmtUSD(fp.year1EBITDA)} | Payback: ${fp.paybackYears} yrs | IRR: ~${fp.irr5Year}%`,
    `Year 5 revenue: ${fmtUSD(fp.year5Revenue)}`,
    `Competitors within 5 miles: ${competitors.length} | Market saturation: ${reviewInsights.marketSaturationLevel}`,
    `Daily vehicle count: ${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day passing site (TomTom Traffic Flow API — BPR/HCM)`,
    `Country cost index: ${country.name} at ${(country.multiplier * 100).toFixed(0)}% of US benchmark`,
    `Labour rates (${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `${wageSource === "world-bank-derived" ? "World Bank" : "ILO ILOSTAT"} ${wagePeriod}` : "404 Excel 2017 baseline"}): staff $${staffHourly.toFixed(2)}/hr · manager $${managerHourly.toFixed(2)}/hr`,
    competitorsWithVolume.length > 0
      ? `Competitor volume data (SerpApi): ${competitorsWithVolume.length}/${competitors.length} competitors have Popular Times data · avg ~${avgCompetitorVolume6mo?.toLocaleString() ?? "N/A"} cars/6 months`
      : `Competitor volume: no SerpApi data available (SERPAPI_KEY not configured or data unavailable)`,
    flowStatus === "live"
      ? `Road intelligence (TomTom): ${roadLabel ?? "Unknown"} (${roadClass ?? "?"}) · traffic ${congestion ?? "unknown"} · incident risk ${incidentRisk ?? "unknown"} · ${closures} closure(s)`
      : `Road intelligence: TomTom data unavailable (API key not configured)`,
  ];

  // ── Calculation breakdown ───────────────────────────────────────────────────
  const calculationBreakdown =
    `BUDGET CHECK: Input budget ${fmtUSD(budgetUSD)} ÷ Country minimum ${fmtUSD(minRequired)} = ${(budgetRatio * 100).toFixed(1)}% funded. ` +
    `Country minimum = US Excel baseline $3,663,000 × ${country.name} multiplier ${(country.multiplier * 100).toFixed(0)}% × 0.41 viability factor. ` +
    `\n\nSCORE BREAKDOWN: Overall ${score.overall}/100 = ` +
    `Traffic (${score.components.traffic}/100 × 25%) + Competition (${score.components.competition}/100 × 25%) + ` +
    `Opportunity (${score.components.opportunity}/100 × 20%) + Market (${score.components.market}/100 × 15%) + ` +
    `Financial (${score.components.financial}/100 × 15%). All inputs from Google Places API live data. ` +
    `\n\nVEHICLE COUNT (TomTom Traffic Flow API — BPR/HCM methodology): ` +
    `${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day passing this location. ` +
    `Nearby surroundings: ${trafficSignals.nearbyGasStations} gas stations + ${trafficSignals.nearbyGroceryStores} grocers + ` +
    `${trafficSignals.nearbyFastFood} restaurants + ${trafficSignals.nearbyShopping} shopping centres (Google Places API). ` +
    `\n\nFINANCIAL MODEL (404 Excel model, August 2017): ` +
    `Capture rate ${(fp.assumptions.captureRate * 100).toFixed(1)}% × ${trafficSignals.estimatedDailyTraffic.toLocaleString()} daily vehicles × $${fp.assumptions.avgRevenuePerCar.toFixed(2)} avg revenue/car. ` +
    `Labour costs: ${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `live ${wageSource === "world-bank-derived" ? "World Bank" : "ILO"} data (${wagePeriod}): staff $${staffHourly.toFixed(2)}/hr` : `404 Excel baseline: staff $${staffHourly.toFixed(2)}/hr`}. ` +
    `Year 1 revenue ${fmtUSD(fp.year1Revenue)}, EBITDA ${fmtUSD(fp.year1EBITDA)}, payback ${fp.paybackYears} yrs. ` +
    (competitorsWithVolume.length > 0
      ? `\n\nCOMPETITOR VOLUME (Google Maps Popular Times via SerpApi): ` +
        `${competitorsWithVolume.length} of ${competitors.length} competitors have volume data. ` +
        `Average 6-month volume: ~${avgCompetitorVolume6mo?.toLocaleString() ?? "N/A"} cars. ` +
        (topVolumeCompetitor ? `Busiest competitor: "${topVolumeCompetitor.place.name}" at ~${topVolumeCompetitor.estimatedVolume.sixMonthEstimate?.toLocaleString()} cars/6 months. ` : "")
      : `\n\nCOMPETITOR VOLUME: Not available — SERPAPI_KEY not configured. `) +
    (flowStatus === "live"
      ? `\n\nROAD INTELLIGENCE (TomTom APIs — live): ` +
        `Road class ${roadLabel} (${roadClass}) · Traffic ${congestion} · ` +
        `Incident risk ${incidentRisk} · ${closures} active closure(s) within 2km. `
      : `\n\nROAD INTELLIGENCE: TomTom data unavailable. `) +
    `\n\nVERDICT: ${verdict} — ` +
    (verdict === "INVEST"
      ? `Budget sufficient, location fundamentals strong, financials viable.`
      : verdict === "PROCEED WITH CAUTION"
      ? `Budget marginal or location score below ideal. Commission a detailed feasibility study.`
      : `Budget insufficient or location fundamentals too weak for a viable investment.`);

  // ── Recommendation ──────────────────────────────────────────────────────────
  let recommendation: string;
  if (verdict === "INVEST") {
    const topComplaint = reviewInsights.dominantComplaints[0]?.category ?? "service quality";
    recommendation =
      `Proceed with site acquisition and detailed engineering feasibility study. ` +
      `Differentiate on ${topComplaint.toLowerCase()} — the primary gap in this market. ` +
      `Launch with an express tunnel + unlimited membership plan to maximize revenue per car.`;
  } else if (verdict === "PROCEED WITH CAUTION") {
    recommendation = budgetMarginal
      ? `Explore raising additional equity or securing SBA/commercial financing to close the ${fmtUSD(budgetGap)} budget gap before committing. ` +
        `Alternatively, evaluate a smaller in-bay automatic format (~${fmtUSD(minRequired * 0.45)}) as a lower-risk entry point.`
      : `Commission a professional traffic study and competitor analysis before committing. ` +
        `Negotiate site control (option agreement) while conducting due diligence. ` +
        `Consider a phased opening starting with self-serve bays to validate demand.`;
  } else {
    recommendation = budgetFeasible
      ? `This location's traffic and market fundamentals do not support the investment at this time. ` +
        `Evaluate alternative sites with higher commercial density or weaker competition. ` +
        `Re-run the analysis with a different address.`
      : `Increase your investment budget to at least ${fmtUSD(minRequired)} before proceeding. ` +
        `At ${fmtUSD(budgetUSD)}, the car wash cannot be built to a standard that generates positive returns. ` +
        `Explore SBA 504 loans (10% down), equipment financing, or equity partnerships to bridge the gap.`;
  }

  // ── Decision summary ────────────────────────────────────────────────────────
  const decisionSummary =
    `This ${result.address} analysis scores ${score.overall}/100 with a ${score.verdict} verdict. ` +
    (budgetFeasible
      ? `Your budget of ${fmtUSD(budgetUSD)} is sufficient for ${country.name}.`
      : `However, your budget of ${fmtUSD(budgetUSD)} falls short of the ${fmtUSD(minRequired)} minimum required for ${country.name}.`) +
    ` ${verdict === "INVEST" ? "The location fundamentals support moving forward." : verdict === "PROCEED WITH CAUTION" ? "Proceed carefully with additional due diligence." : "This investment is not recommended at this time."}`;

  return {
    verdict,
    budgetFeasible,
    budgetUSD,
    minimumRequiredUSD: minRequired,
    budgetAnalysis,
    decisionSummary,
    keyFactors,
    redFlags,
    greenFlags,
    calculationBreakdown,
    recommendation,
    poweredBy: "rules",
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { result, budget, exchangeRate = 1 } = body as {
      result: SiteAnalysisResult;
      budget: number;
      exchangeRate?: number;
    };

    if (!result || !budget) {
      return NextResponse.json({ error: "result and budget are required" }, { status: 400 });
    }

    // Convert budget to USD using provided exchange rate
    const budgetUSD = budget / (exchangeRate || 1);

    // Rules-based engine always runs first
    const decision = rulesDecision(result, budgetUSD, exchangeRate);

    // Extract TomTom variables for use in AI prompts below
    const _tomtom      = result.tomtom;
    const flowStatus   = _tomtom?.trafficFlow.status ?? "unavailable";
    const roadClass    = _tomtom?.trafficFlow.roadClass ?? null;
    const roadLabel    = _tomtom?.trafficFlow.roadClassLabel ?? null;
    const congestion   = _tomtom?.trafficFlow.congestionLevel ?? null;
    const incidentRisk = _tomtom?.incidents.accessRiskLevel ?? null;
    const closures     = _tomtom?.incidents.closureCount ?? 0;

    // ── AI enhancement (Claude or OpenAI) ──────────────────────────────────
    // When ANTHROPIC_API_KEY or OPENAI_API_KEY is set, Claude/GPT enriches
    // the decision with real-world market insight on top of the rules output.

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey    = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: anthropicKey });

        const aiPrompt = `You are a professional car wash investment analyst. Review this rule-based analysis and enrich it with real-world market insight.

You must evaluate this site against the industry-standard "5 Secrets to a Stellar Car Wash Site" framework:
1. MARKET SIZE — Does the trade area have 25,000–30,000+ people? Are there enough potential customers?
2. SITE SURROUNDINGS — Are weekly-needs businesses present (grocery stores, big-box retailers like Target/Walmart/HEB)? Is estimated daily traffic ≥20,000 vehicles/day?
3. PHYSICAL FIT — Does the lot likely support a car wash layout (shape, size, setbacks, grade)?
4. VISIBILITY & ACCESS — Is the location on a commercial corridor with good sightlines, reasonable speed limits (≤45 mph), and dual-direction access?
5. ZONING VIABILITY — Is the area a commercial retail zone (not industrial or residential)? Commercial retail = highest foot traffic, strongest repeat customer base.

Use the data below to score each of the 5 criteria as PASS, CAUTION, or FAIL and incorporate your findings into the JSON output.

Return ONLY valid JSON with exactly these fields (no markdown fences):
{
  "decisionSummary": "string (2-3 sentences, specific to this location and referencing the 5-criteria assessment)",
  "recommendation": "string (concrete actionable next step)",
  "redFlags": ["string", ...],
  "greenFlags": ["string", ...]
}

ANALYSIS DATA:
Address: ${result.address}
Country: ${result.countryCode}
Verdict: ${decision.verdict}
Budget: ${fmtUSD(budgetUSD)} USD | Minimum required: ${fmtUSD(decision.minimumRequiredUSD)}
Score: ${result.score.overall}/100 (${result.score.verdict})
Estimated daily traffic: ${result.trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day [source: Google Maps review-volume formula]
Nearby grocery stores: ${result.trafficSignals.nearbyGroceryStores} [source: Google Places API]
Nearby shopping centers: ${result.trafficSignals.nearbyShopping} [source: Google Places API]
Nearby gas stations: ${result.trafficSignals.nearbyGasStations} [source: Google Places API]
Competitors within 5 miles: ${result.competitors.length} | Avg rating: ${result.reviewInsights.avgCompetitorRating.toFixed(1)} [source: Google Places API]
Market saturation: ${result.reviewInsights.marketSaturationLevel}
Year 1 Revenue: ${fmtUSD(result.financialProjection.year1Revenue)} | EBITDA: ${fmtUSD(result.financialProjection.year1EBITDA)} [source: 404 Financial Model]
Payback: ${result.financialProjection.paybackYears} years | IRR: ~${result.financialProjection.irr5Year}%
LABOUR RATES [source: ${result.financialProjection.assumptions.wageSource !== "excel-baseline" && result.financialProjection.assumptions.wageSource !== "unavailable" ? `Live — ${result.financialProjection.assumptions.wagePeriod}` : "404 Excel baseline (2017) — live data unavailable"}]: Staff $${result.financialProjection.assumptions.staffHourlyUSD?.toFixed(2)}/hr | Manager $${result.financialProjection.assumptions.managerHourlyUSD?.toFixed(2)}/hr | US baseline: $${US_BASELINE_STAFF_HOURLY}/hr staff
COMPETITOR VOLUME [source: Google Maps Popular Times via SerpApi]: ${
  decision.keyFactors.find(f => f.includes("Competitor volume")) ?? "No volume data available"
}
ROAD INTELLIGENCE [source: TomTom APIs — live data]: ${
  flowStatus === "live"
    ? `Road class: ${roadLabel} (${roadClass}) | Traffic: ${congestion} | Incident risk: ${incidentRisk} | Active closures: ${closures} | 5-min drive-time isochrone: ${result.tomtom?.isochrones.fiveMin.status === "live" ? result.tomtom.isochrones.fiveMin.boundaryPoints + " boundary points" : "unavailable"} | 10-min isochrone: ${result.tomtom?.isochrones.tenMin.status === "live" ? result.tomtom.isochrones.tenMin.boundaryPoints + " boundary points" : "unavailable"}`
    : "TomTom data unavailable"
}
Existing red flags: ${decision.redFlags.join("; ")}
Existing green flags: ${decision.greenFlags.join("; ")}`;

        const aiRes = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{ role: "user", content: aiPrompt }],
        });

        const raw = (aiRes.content[0] as { text: string }).text.trim()
          .replace(/^```json\s*/i, "").replace(/\s*```$/, "");
        const aiJson = JSON.parse(raw);

        if (aiJson.decisionSummary) decision.decisionSummary = aiJson.decisionSummary;
        if (aiJson.recommendation)  decision.recommendation  = aiJson.recommendation;
        if (Array.isArray(aiJson.redFlags) && aiJson.redFlags.length)   decision.redFlags   = aiJson.redFlags;
        if (Array.isArray(aiJson.greenFlags) && aiJson.greenFlags.length) decision.greenFlags = aiJson.greenFlags;
        decision.poweredBy = "claude";
      } catch {
        // Claude failed — rules output is already in decision, continue
      }
    } else if (openaiKey) {
      try {
        const oaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 1200,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content:
                "You are a professional car wash investment analyst with 20 years of experience in real estate and retail business development. " +
                "You evaluate sites using the industry-standard '5 Secrets to a Stellar Car Wash Site' framework:\n" +
                "1. MARKET SIZE — Trade area needs 25,000–30,000+ people to support a car wash.\n" +
                "2. SITE SURROUNDINGS — Weekly-needs businesses (grocery, big-box) must be present; daily traffic ≥20,000 vehicles.\n" +
                "3. PHYSICAL FIT — Lot must support car wash layout: square/rectangle shape, sufficient acreage, manageable setbacks.\n" +
                "4. VISIBILITY & ACCESS — 500ft clear sightlines both directions, speed limit ≤45mph, dual-direction road access, no blocking median.\n" +
                "5. ZONING VIABILITY — Commercial retail zone preferred over industrial or residential; may need conditional use permit.\n\n" +
                "You will be given data about a car wash investment opportunity. Evaluate it against these 5 criteria and return your expert assessment. " +
                "Be specific, realistic, and reference the actual location and numbers provided. " +
                "Return ONLY a valid JSON object — no markdown, no code fences, no extra text.",
            }, {
              role: "user",
              content:
                `Analyze this car wash investment opportunity using the 5-Criteria framework and return your expert assessment as JSON.\n\n` +
                `LOCATION: ${result.address}\n` +
                `COUNTRY: ${result.countryCode}\n` +
                `INVESTMENT BUDGET: ${fmtUSD(budgetUSD)} USD\n` +
                `MINIMUM REQUIRED: ${fmtUSD(decision.minimumRequiredUSD)} USD\n` +
                `BUDGET STATUS: ${decision.budgetFeasible ? "SUFFICIENT" : "INSUFFICIENT"}\n\n` +
                `LOCATION SCORE: ${result.score.overall}/100 (${result.score.verdict})\n` +
                `- Traffic: ${result.score.components.traffic}/100\n` +
                `- Competition: ${result.score.components.competition}/100\n` +
                `- Opportunity: ${result.score.components.opportunity}/100\n` +
                `- Market Activity: ${result.score.components.market}/100\n` +
                `- Financial Viability: ${result.score.components.financial}/100\n\n` +
                `MARKET DATA [source: Google Places API — live data]:\n` +
                `- Competitors within 5 miles: ${result.competitors.length}\n` +
                `- Average competitor rating: ${result.reviewInsights.avgCompetitorRating}/5.0\n` +
                `- Market saturation: ${result.reviewInsights.marketSaturationLevel}\n` +
                `- Estimated daily traffic: ${result.trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day [Google Maps review-volume formula]\n\n` +
                `SITE SURROUNDINGS [source: Google Places API]:\n` +
                `- Nearby grocery stores: ${result.trafficSignals.nearbyGroceryStores} (ideal: ≥2)\n` +
                `- Nearby shopping centers/big-box: ${result.trafficSignals.nearbyShopping} (ideal: ≥1)\n` +
                `- Nearby gas stations: ${result.trafficSignals.nearbyGasStations} (arterial road indicator)\n` +
                `- Nearby fast food / restaurants: ${result.trafficSignals.nearbyFastFood}\n\n` +
                `FINANCIAL PROJECTIONS [source: 404 Financial Model, August 2017]:\n` +
                `- Year 1 Revenue: ${fmtUSD(result.financialProjection.year1Revenue)}\n` +
                `- Year 1 EBITDA: ${fmtUSD(result.financialProjection.year1EBITDA)}\n` +
                `- Year 5 Revenue: ${fmtUSD(result.financialProjection.year5Revenue)}\n` +
                `- Payback period: ${result.financialProjection.paybackYears} years\n` +
                `- 5-Year IRR: ~${result.financialProjection.irr5Year}%\n\n` +
                `LABOUR COSTS [source: ${result.financialProjection.assumptions.wageSource !== "excel-baseline" && result.financialProjection.assumptions.wageSource !== "unavailable" ? `Live — ${result.financialProjection.assumptions.wagePeriod}` : "404 Excel baseline 2017 — live data unavailable"}]:\n` +
                `- Staff hourly: $${result.financialProjection.assumptions.staffHourlyUSD?.toFixed(2)} USD (US baseline: $${US_BASELINE_STAFF_HOURLY})\n` +
                `- Manager hourly: $${result.financialProjection.assumptions.managerHourlyUSD?.toFixed(2)} USD (US baseline: $${US_BASELINE_MANAGER_HOURLY})\n` +
                `- Note: labour costs are ALREADY factored into the EBITDA above\n\n` +
                `COMPETITOR VOLUME [source: Google Maps Popular Times via SerpApi]:\n` +
                `${decision.keyFactors.find(f => f.includes("Competitor volume")) ?? "- No competitor volume data available"}\n\n` +
                `ROAD INTELLIGENCE [source: TomTom APIs — live data]:\n` +
                (flowStatus === "live"
                  ? `- Road class: ${roadLabel} (${roadClass})\n` +
                    `- Traffic congestion: ${congestion}\n` +
                    `- Incident access risk: ${incidentRisk}\n` +
                    `- Active road closures within 2km: ${closures}\n` +
                    `- 5-min drive-time isochrone: ${result.tomtom?.isochrones.fiveMin.status === "live" ? "computed (" + result.tomtom.isochrones.fiveMin.boundaryPoints + " boundary points)" : "unavailable"}\n` +
                    `- 10-min drive-time isochrone: ${result.tomtom?.isochrones.tenMin.status === "live" ? "computed (" + result.tomtom.isochrones.tenMin.boundaryPoints + " boundary points)" : "unavailable"}\n` +
                    `- 15-min drive-time isochrone: ${result.tomtom?.isochrones.fifteenMin.status === "live" ? "computed (" + result.tomtom.isochrones.fifteenMin.boundaryPoints + " boundary points)" : "unavailable"}\n\n`
                  : "- TomTom data unavailable\n\n") +
                `INITIAL VERDICT: ${decision.verdict}\n\n` +
                `Evaluate the site against all 5 criteria and include relevant criteria findings in your redFlags and greenFlags. Include road intelligence in Criterion 4 (VISIBILITY & ACCESS). Return this exact JSON structure:\n` +
                `{\n` +
                `  "decisionSummary": "2-3 sentences specific to this location, budget, and 5-criteria assessment",\n` +
                `  "recommendation": "One concrete actionable next step for the investor",\n` +
                `  "redFlags": ["specific risk referencing criteria or data", ...],\n` +
                `  "greenFlags": ["specific positive referencing criteria or data", ...]\n` +
                `}`,
            }],
          }),
        });

        if (!oaiRes.ok) {
          const errBody = await oaiRes.text();
          console.error("OpenAI API error:", oaiRes.status, errBody);
        } else {
          const oaiJson = await oaiRes.json();
          const content = oaiJson.choices?.[0]?.message?.content;
          if (content) {
            // content is already a JSON string when response_format = json_object
            const aiJson = typeof content === "string" ? JSON.parse(content) : content;
            if (typeof aiJson.decisionSummary === "string" && aiJson.decisionSummary)
              decision.decisionSummary = aiJson.decisionSummary;
            if (typeof aiJson.recommendation === "string" && aiJson.recommendation)
              decision.recommendation = aiJson.recommendation;
            if (Array.isArray(aiJson.redFlags) && aiJson.redFlags.length)
              decision.redFlags = aiJson.redFlags;
            if (Array.isArray(aiJson.greenFlags) && aiJson.greenFlags.length)
              decision.greenFlags = aiJson.greenFlags;
            decision.poweredBy = "openai";
          }
        }
      } catch (oaiErr) {
        console.error("OpenAI call failed:", oaiErr);
        // Rules output stays — analysis is still complete
      }
    }

    return NextResponse.json(decision);
  } catch (err) {
    console.error("Decision error:", err);
    return NextResponse.json({ error: "Decision engine failed" }, { status: 500 });
  }
}
