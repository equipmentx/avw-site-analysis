import { NextRequest, NextResponse } from "next/server";
import { getCountry } from "@/lib/countryData";
import { CAR_WASH_CONFIGS } from "@/lib/carwashConfigs";
import type { CarWashConfig } from "@/lib/carwashConfigs";
import type { SiteAnalysisResult, AiDecision } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// US baseline hourly rates from Express Car Wash Pro Forma model (used to assess wage impact)
const US_BASELINE_STAFF_HOURLY   = 16;
const US_BASELINE_MANAGER_HOURLY = 30;

// ── Rule-based decision engine (works without any AI API key) ─────────────────
function rulesDecision(
  result: SiteAnalysisResult,
  budgetUSD: number,
  exchangeRate: number,
  config?: CarWashConfig
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

  // ── Config-aware budget floor ──────────────────────────────────────────────
  // If the user selected a specific car wash format, use that format's investment
  // range (scaled by the country multiplier) as the primary budget benchmark.
  // Fall back to the generic country minimum if no config is selected.
  const configMinUSD = config
    ? config.investmentRangeUSD.min * country.multiplier
    : null;
  const configMaxUSD = config
    ? config.investmentRangeUSD.max * country.multiplier
    : null;
  const effectiveMinRequired = configMinUSD ?? minRequired;

  // ── Budget feasibility ──────────────────────────────────────────────────────
  // budget=0 means "no budget entered" — evaluate on location score only
  const noBudget       = budgetUSD === 0;
  const budgetGap      = effectiveMinRequired - budgetUSD;
  const budgetRatio    = noBudget ? 1.0 : budgetUSD / effectiveMinRequired;
  const budgetFeasible = noBudget || budgetRatio >= 1.0;
  const budgetMarginal = !noBudget && budgetRatio >= 0.6 && budgetRatio < 1.0;

  // ── Wage impact analysis (ILO vs Excel baseline) ────────────────────────────
  const staffHourly   = assumptions.staffHourlyUSD   ?? US_BASELINE_STAFF_HOURLY;
  const managerHourly = assumptions.managerHourlyUSD ?? US_BASELINE_MANAGER_HOURLY;
  const wageSource    = assumptions.wageSource ?? "excel-baseline";
  const wagePeriod    = assumptions.wagePeriod ?? "estimate";
  const staffDelta    = staffHourly - US_BASELINE_STAFF_HOURLY;   // positive = more expensive
  const staffDeltaPct = (staffDelta / US_BASELINE_STAFF_HOURLY) * 100;

  // ── ATTOM parcel intelligence ──────────────────────────────────────────────
  const parcel          = result.parcel;
  const parcelLive      = parcel?.status === "live";
  const lotSqFt         = parcel?.lotSqFt ?? null;
  const lotAcres        = parcel?.lotAcres ?? null;
  const widthFt         = parcel?.dimensions?.widthFt ?? null;
  const depthFt         = parcel?.dimensions?.depthFt ?? null;
  const parcelZoning    = parcel?.zoning ?? null;
  const parcelLandUse   = parcel?.landUse ?? null;
  const parcelLastSale  = parcel?.lastSalePrice ?? null;
  const parcelLandVal   = parcel?.assessedLandUSD ?? null;
  const parcelOwner     = parcel?.owner ?? null;
  const parcelLastDate  = parcel?.lastSaleDate ?? null;

  // Tommy Express tunnel minimum: 30,625 sqft (245×125 ft)
  const EXPRESS_MIN_SQFT = 30_625;
  const INBAY_MIN_SQFT   =  4_800;
  const SELFSERVE_MIN_SQFT = 7_000;

  // ── Investment suggestion ───────────────────────────────────────────────────
  // Guard: if the analyze route didn't produce an investment suggestion (shouldn't
  // happen, but provides a safe fallback so rulesDecision never throws on undefined)
  const inv = result.investmentSuggestion ?? {
    minEstimateUSD: 0, maxEstimateUSD: 0, cityTier: "Unknown", countryCode: result.countryCode,
    countryName: country.name, dataTimestamp: new Date().toISOString(), sourceNote: "Unavailable",
    rationale: "", marketContext: "",
    breakdown: { land: { min: 0, max: 0 }, construction: { min: 0, max: 0 }, equipment: { min: 0, max: 0 }, fees: { min: 0, max: 0 } },
  };

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
  const configLabel = config ? `a ${config.name}` : "a car wash";
  const configFloorNote = config
    ? `(${config.name} investment range: ${fmtUSD(config.investmentRangeUSD.min)}–${fmtUSD(config.investmentRangeUSD.max)} US baseline, scaled to ${country.name} at ${(country.multiplier * 100).toFixed(0)}%)`
    : `(based on the Express Car Wash Pro Forma model scaled to ${country.name} at ${(country.multiplier * 100).toFixed(0)}% of the US benchmark)`;

  let budgetAnalysis: string;
  if (noBudget) {
    budgetAnalysis =
      `No investment budget was provided — this decision is evaluated on location fundamentals only. ` +
      `The typical investment required for ${configLabel} in ${country.name} is ${fmtUSD(effectiveMinRequired)} ${configFloorNote}. ` +
      (config && configMaxUSD ? `Full build-out range: ${fmtUSD(configMaxUSD)}. ` : "") +
      `To get a personalised budget feasibility assessment, enter your available investment on the home page.`;
  } else if (budgetFeasible) {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is SUFFICIENT for ${configLabel} in ${country.name}. ` +
      `Minimum viable investment is ${fmtUSD(effectiveMinRequired)} ${configFloorNote}. ` +
      `Your budget covers ${(budgetRatio * 100).toFixed(0)}% of the minimum threshold.` +
      (config && configMaxUSD ? ` The full build-out range for this format runs to ${fmtUSD(configMaxUSD)}.` : "");
  } else if (budgetMarginal) {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is MARGINAL for ${configLabel} in ${country.name}. ` +
      `Minimum viable investment is ${fmtUSD(effectiveMinRequired)} ${configFloorNote} — you are ${fmtUSD(budgetGap)} short (${(budgetRatio * 100).toFixed(0)}% funded). ` +
      (config
        ? `Consider raising additional equity or revising to a smaller format than the ${config.shortName}.`
        : `At this level you may be limited to a self-serve or in-bay automatic format rather than a full express tunnel. ` +
          `Consider raising additional equity or revising to a smaller format.`);
  } else {
    budgetAnalysis =
      `Budget of ${fmtUSD(budgetUSD)} is INSUFFICIENT for ${configLabel} in ${country.name}. ` +
      `The minimum viable investment is ${fmtUSD(effectiveMinRequired)} ${configFloorNote}, meaning you are ${fmtUSD(budgetGap)} short (${(budgetRatio * 100).toFixed(0)}% funded). ` +
      (config
        ? `The ${config.shortName} requires: equipment alone ~${fmtUSD(config.investmentRangeUSD.min * 0.35)}, construction ~${fmtUSD(config.investmentRangeUSD.min * 0.30)}, land ~${fmtUSD(config.investmentRangeUSD.min * 0.24)}. `
        : `A US-standard express tunnel requires: equipment alone ~$1.2M, construction ~$1.08M, land ~$875K. `) +
      `Even in lower-cost markets like ${country.name}, core equipment and installation represent the largest fixed cost. ` +
      `At your current budget level, this format cannot be built. ` +
      `To proceed: either increase your investment to at least ${fmtUSD(effectiveMinRequired)}, or explore a smaller format at lower entry cost.`;
  }

  // ── Green flags ─────────────────────────────────────────────────────────────
  const greenFlags: string[] = [];
  if (trafficSignals.estimatedDailyTraffic >= 8_000) greenFlags.push(`High daily vehicle count: ${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day passing this location (source: TomTom Traffic Flow API — BPR/HCM methodology)`);
  if (score.components.competition >= 60)            greenFlags.push(`Weak competition nearby (score ${score.components.competition}/100) — low market saturation`);
  if (score.components.opportunity >= 65)            greenFlags.push(`Strong opportunity gap: competitors have notable service weaknesses`);
  if (fp.year1EBITDA > 0)                            greenFlags.push(`Positive Year 1 EBITDA: ${fmtUSD(fp.year1EBITDA)} — model uses ${ ["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `live wage data (${wagePeriod})` : "Pro Forma baseline wages"} for ${country.name}`);
  if (fp.paybackYears <= 5)                          greenFlags.push(`Estimated payback of ${fp.paybackYears} years is within the 4–7 year industry benchmark`);
  if (reviewInsights.premiumOpportunity)             greenFlags.push("Low competitor quality signals room to charge premium pricing");
  if (trafficSignals.nearbyGasStations >= 3)         greenFlags.push(`${trafficSignals.nearbyGasStations} gas stations nearby — strong arterial road traffic indicator (source: Google Places API)`);
  if (budgetFeasible)                                greenFlags.push(`Budget fully funded at ${(budgetRatio * 100).toFixed(0)}% of minimum threshold`);

  // Wage green flag — lower local wages improve profitability vs US baseline
  if (staffDeltaPct < -20) {
    greenFlags.push(
      `Local wages are ${Math.abs(staffDeltaPct).toFixed(0)}% below the US model baseline ` +
      `(staff: $${staffHourly.toFixed(2)}/hr vs $${US_BASELINE_STAFF_HOURLY}/hr US baseline) — ` +
      `improves EBITDA vs a US operation. Source: ${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `${wageSource === "world-bank-derived" ? "World Bank" : "ILO ILOSTAT"} ${wagePeriod}` : "Pro Forma baseline"}.`
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
  if (!noBudget && !budgetFeasible)                  redFlags.push(`Budget ${fmtUSD(budgetUSD)} is below minimum viable ${fmtUSD(minRequired)} — gap of ${fmtUSD(budgetGap)}`);
  if (fp.year1EBITDA <= 0)                           redFlags.push(`Year 1 EBITDA is negative (${fmtUSD(fp.year1EBITDA)}) — location may not generate enough revenue at current traffic levels`);
  if (score.components.traffic < 40)                 redFlags.push(`Low traffic score (${score.components.traffic}/100) — not enough daily cars passing the site`);
  if (score.components.competition >= 75)            redFlags.push(`High competition score (${score.components.competition}/100) — strong established players nearby`);
  if (fp.paybackYears > 8)                           redFlags.push(`Long payback period of ${fp.paybackYears} years exceeds the 7-year industry benchmark`);
  if (trafficSignals.estimatedDailyTraffic < 3_000)  redFlags.push(`Very low estimated traffic (${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day) — capture rate will be insufficient`);
  if (competitors.length >= 5)                       redFlags.push(`${competitors.length} car washes detected within ${result.radiusMiles} miles — market may be over-served`);
  if (fp.irr5Year < 10)                              redFlags.push(`5-year IRR of ~${fp.irr5Year}% is below typical 15% investment hurdle rate`);

  // Wage red flag — higher local wages compress margins vs US baseline
  if (staffDeltaPct > 15) {
    redFlags.push(
      `Local wages are ${staffDeltaPct.toFixed(0)}% above the US model baseline ` +
      `(staff: $${staffHourly.toFixed(2)}/hr vs $${US_BASELINE_STAFF_HOURLY}/hr) — ` +
      `labour costs compress EBITDA vs standard projections. ` +
      `Source: ${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `${wageSource === "world-bank-derived" ? "World Bank" : "ILO ILOSTAT"} ${wagePeriod}` : "Pro Forma baseline"}.`
    );
  }

  // Wage source disclosure
  if (wageSource === "excel-baseline" || wageSource === "unavailable") {
    redFlags.push(
      `Labour cost data unavailable from live sources (ILO ILOSTAT and World Bank both returned no data for ${country.name}). ` +
      `Pro Forma 2017 US baseline rates used. Verify local wage rates with an HR consultant before committing.`
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

  // ATTOM parcel green flags
  if (parcelLive && lotSqFt !== null && lotSqFt >= EXPRESS_MIN_SQFT) {
    greenFlags.push(
      `Parcel is ${lotSqFt.toLocaleString()} sqft (${lotAcres?.toFixed(2) ?? "?"} acres) — ` +
      `large enough for a 130ft Express Tunnel layout (min 30,625 sqft). Source: ATTOM county assessor records.`
    );
  }
  if (parcelLive && parcelZoning && /commercial|retail|C[0-9]|B[0-9]|GC|HC|SC/i.test(parcelZoning)) {
    greenFlags.push(
      `Zoning: ${parcelZoning}${parcel?.zoningDescription ? ` (${parcel.zoningDescription})` : ""} — ` +
      `commercial zoning supports car wash use without special variance. Source: ATTOM county assessor.`
    );
  }
  if (parcelLive && parcelLastSale !== null) {
    greenFlags.push(
      `Last recorded land sale: ${fmtUSD(parcelLastSale)}${parcelLastDate ? ` (${parcelLastDate})` : ""} — ` +
      `provides a negotiation anchor for site acquisition. Source: ATTOM county assessor records.`
    );
  }

  // ATTOM parcel red flags
  if (parcelLive && lotSqFt !== null && lotSqFt < INBAY_MIN_SQFT) {
    redFlags.push(
      `Parcel is only ${lotSqFt.toLocaleString()} sqft — too small even for an in-bay automatic ` +
      `(min 4,800 sqft). This lot cannot support a car wash of any format. Source: ATTOM.`
    );
  } else if (parcelLive && lotSqFt !== null && lotSqFt < EXPRESS_MIN_SQFT && lotSqFt >= SELFSERVE_MIN_SQFT) {
    redFlags.push(
      `Parcel is ${lotSqFt.toLocaleString()} sqft — insufficient for an Express Tunnel (need 30,625 sqft). ` +
      `Limited to self-serve or in-bay format. Source: ATTOM.`
    );
  }
  if (parcelLive && parcelZoning && /residential|R[0-9]|industrial|I[0-9]/i.test(parcelZoning) && !/commercial|C[0-9]/i.test(parcelZoning)) {
    redFlags.push(
      `Zoning: ${parcelZoning} — non-commercial zoning may require a conditional use permit or variance for a car wash. Source: ATTOM.`
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

  // ── Config-specific lot fit check ───────────────────────────────────────────
  if (config && parcelLive && lotSqFt !== null) {
    if (lotSqFt >= config.minLotSqFt) {
      greenFlags.push(
        `Lot is ${lotSqFt.toLocaleString()} sqft — fits the ${config.name} layout requirement of ${config.minLotSqFt.toLocaleString()} sqft minimum. Source: ATTOM.`
      );
    } else {
      redFlags.push(
        `Lot is only ${lotSqFt.toLocaleString()} sqft — the ${config.name} needs at least ${config.minLotSqFt.toLocaleString()} sqft (${config.minLotWidthFt}ft wide × ${config.minLotDepthFt}ft deep). This format does not fit this parcel. Source: ATTOM.`
      );
    }
  }

  // Config throughput vs traffic — does this format make sense for this traffic level?
  if (config) {
    const dailyCars = fp.assumptions.dailyCarsWashed;
    const peakHourCapacity = config.carsPerHour.max;
    if (dailyCars > 0 && peakHourCapacity > 0) {
      const hoursToServe = dailyCars / peakHourCapacity;
      if (hoursToServe > 8) {
        greenFlags.push(
          `Traffic demand (${dailyCars} cars/day projected) would require ${hoursToServe.toFixed(1)} hours at ${peakHourCapacity} cars/hr — ` +
          `the ${config.shortName} may be undersized for this location. Consider a higher-throughput format.`
        );
      } else if (hoursToServe < 2) {
        redFlags.push(
          `Projected demand (${dailyCars} cars/day) only utilises the ${config.shortName} for ${hoursToServe.toFixed(1)} hours at peak — ` +
          `this format may be oversized for this traffic level, inflating capex unnecessarily.`
        );
      } else {
        greenFlags.push(
          `The ${config.shortName} (${config.carsPerHour.min}–${config.carsPerHour.max} cars/hr) suits the projected demand of ${dailyCars} cars/day.`
        );
      }
    }
  }

  // ── Key factors ─────────────────────────────────────────────────────────────
  const keyFactors: string[] = [
    config
      ? `Selected format: ${config.name} (${config.categoryLabel}) — ${config.carsPerHour.min}–${config.carsPerHour.max} cars/hr · ${config.staffRequired.min}–${config.staffRequired.max} staff · ${config.membershipFriendly ? "membership-ready" : "no membership model"}`
      : `No format selected — generic analysis`,
    config
      ? `Format investment range: ${fmtUSD(config.investmentRangeUSD.min)}–${fmtUSD(config.investmentRangeUSD.max)} US baseline → ${fmtUSD(effectiveMinRequired)}–${fmtUSD(configMaxUSD ?? effectiveMinRequired)} in ${country.name}`
      : `Country minimum viable investment: ${fmtUSD(minRequired)}`,
    `Overall location score: ${score.overall}/100 (${score.grade} — ${score.verdict})`,
    `Traffic score: ${score.components.traffic}/100 | Competition: ${score.components.competition}/100 | Opportunity: ${score.components.opportunity}/100`,
    `Year 1 revenue: ${fmtUSD(fp.year1Revenue)} | EBITDA: ${fmtUSD(fp.year1EBITDA)} | Payback: ${fp.paybackYears} yrs | IRR: ~${fp.irr5Year}%`,
    `Year 5 revenue: ${fmtUSD(fp.year5Revenue)}`,
    `Competitors within ${result.radiusMiles} miles: ${competitors.length} | Market saturation: ${reviewInsights.marketSaturationLevel}`,
    `Daily vehicle count: ${trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day passing site (TomTom Traffic Flow API — BPR/HCM)`,
    `Country cost index: ${country.name} at ${(country.multiplier * 100).toFixed(0)}% of US benchmark`,
    `Labour rates (${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `${wageSource === "world-bank-derived" ? "World Bank" : "ILO ILOSTAT"} ${wagePeriod}` : "Pro Forma 2017 baseline"}): staff $${staffHourly.toFixed(2)}/hr · manager $${managerHourly.toFixed(2)}/hr`,
    competitorsWithVolume.length > 0
      ? `Competitor volume data (SerpApi): ${competitorsWithVolume.length}/${competitors.length} competitors have Popular Times data · avg ~${avgCompetitorVolume6mo?.toLocaleString() ?? "N/A"} cars/6 months`
      : `Competitor volume: no SerpApi data available (SERPAPI_KEY not configured or data unavailable)`,
    flowStatus === "live"
      ? `Road intelligence (TomTom): ${roadLabel ?? "Unknown"} (${roadClass ?? "?"}) · traffic ${congestion ?? "unknown"} · incident risk ${incidentRisk ?? "unknown"} · ${closures} closure(s)`
      : `Road intelligence: TomTom data unavailable (API key not configured)`,
    parcelLive
      ? `Parcel (ATTOM): ${lotSqFt?.toLocaleString() ?? "?"} sqft · ${widthFt ? `${widthFt}ft wide × ${depthFt}ft deep` : "dimensions unavailable"} · zoning: ${parcelZoning ?? "unknown"} · owner: ${parcelOwner ?? "unknown"}`
      : `Parcel data: not available (US-only; ATTOM_API_KEY not configured or location outside coverage)`,
    parcelLive && (parcelLastSale || parcelLandVal)
      ? `Land value (ATTOM): last sale ${parcelLastSale ? fmtUSD(parcelLastSale) : "n/a"}${parcelLastDate ? ` on ${parcelLastDate}` : ""} · assessed land ${parcelLandVal ? fmtUSD(parcelLandVal) : "n/a"}`
      : parcelLive
      ? `Land value (ATTOM): connected — assessor financial fields (sale price, assessed value) not returned by this county's record; investment range uses pro-forma estimate`
      : `Land value: ATTOM not available (US-only; check ATTOM_API_KEY or location outside coverage)`,
    `Suggested investment range (BLS CPI-adjusted): ${fmtUSD(inv.minEstimateUSD)}–${fmtUSD(inv.maxEstimateUSD)} · land ${fmtUSD(inv.breakdown.land.min)}–${fmtUSD(inv.breakdown.land.max)} · construction ${fmtUSD(inv.breakdown.construction.min)}–${fmtUSD(inv.breakdown.construction.max)} · equipment ${fmtUSD(inv.breakdown.equipment.min)}–${fmtUSD(inv.breakdown.equipment.max)} [${inv.sourceNote}]`,
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
    `\n\nFINANCIAL MODEL (Express Car Wash Pro Forma model, August 2017): ` +
    `Capture rate ${(fp.assumptions.captureRate * 100).toFixed(1)}% × ${trafficSignals.estimatedDailyTraffic.toLocaleString()} daily vehicles × $${fp.assumptions.avgRevenuePerCar.toFixed(2)} avg revenue/car. ` +
    `Labour costs: ${["ilo-occupation","ilo-all-workers","world-bank-derived"].includes(wageSource) ? `live ${wageSource === "world-bank-derived" ? "World Bank" : "ILO"} data (${wagePeriod}): staff $${staffHourly.toFixed(2)}/hr` : `Pro Forma baseline: staff $${staffHourly.toFixed(2)}/hr`}. ` +
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
    (parcelLive
      ? `\n\nPARCEL DATA (ATTOM county assessor — live): ` +
        `Lot: ${lotSqFt?.toLocaleString() ?? "?"} sqft (${lotAcres?.toFixed(2) ?? "?"} acres) · ` +
        `Dimensions: ${widthFt ? `${widthFt}ft wide × ${depthFt}ft deep` : "unavailable"} · ` +
        `Zoning: ${parcelZoning ?? "unknown"}${parcel?.zoningDescription ? ` (${parcel.zoningDescription})` : ""} · ` +
        `Land use: ${parcelLandUse ?? "unknown"} · ` +
        `Owner: ${parcelOwner ?? "unknown"} · ` +
        (parcelLastSale ? `Last sale: ${fmtUSD(parcelLastSale)}${parcelLastDate ? ` (${parcelLastDate})` : ""} · ` : "") +
        (parcelLandVal ? `Assessed land: ${fmtUSD(parcelLandVal)} · ` : "") +
        `Express tunnel feasibility: ${lotSqFt !== null ? (lotSqFt >= EXPRESS_MIN_SQFT ? "FITS" : lotSqFt >= SELFSERVE_MIN_SQFT ? "TOO SMALL for Express — self-serve/in-bay only" : "TOO SMALL for any car wash format") : "unknown"}. `
      : `\n\nPARCEL DATA: Not available (US-only via ATTOM, or ATTOM_API_KEY not configured). `) +
    `\n\nINVESTMENT RANGE (BLS CPI-adjusted, ${inv.dataTimestamp}): ` +
    `${fmtUSD(inv.minEstimateUSD)}–${fmtUSD(inv.maxEstimateUSD)} total. ` +
    `Breakdown — Land: ${fmtUSD(inv.breakdown.land.min)}–${fmtUSD(inv.breakdown.land.max)} · ` +
    `Construction: ${fmtUSD(inv.breakdown.construction.min)}–${fmtUSD(inv.breakdown.construction.max)} · ` +
    `Equipment: ${fmtUSD(inv.breakdown.equipment.min)}–${fmtUSD(inv.breakdown.equipment.max)} · ` +
    `Fees: ${fmtUSD(inv.breakdown.fees.min)}–${fmtUSD(inv.breakdown.fees.max)}. ` +
    `Source: ${inv.sourceNote}. ` +
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
      `Proceed with site acquisition and detailed engineering feasibility study` +
      (config ? ` for a ${config.name}` : "") + `. ` +
      `Differentiate on ${topComplaint.toLowerCase()} — the primary gap in this market. ` +
      (config?.membershipFriendly
        ? `Launch with an unlimited membership plan from day one to maximise recurring revenue.`
        : `Focus on per-wash throughput and premium service differentiation.`);
  } else if (verdict === "PROCEED WITH CAUTION") {
    recommendation = budgetMarginal
      ? `Explore raising additional equity or securing financing to close the ${fmtUSD(budgetGap)} gap` +
        (config ? ` needed for the ${config.shortName}` : "") + `. ` +
        `Alternatively, evaluate a smaller format (e.g. in-bay automatic at ~${fmtUSD(effectiveMinRequired * 0.45)}) as a lower-risk entry point.`
      : `Commission a professional traffic study and competitor analysis before committing. ` +
        `Negotiate site control (option agreement) while conducting due diligence. ` +
        `Consider a phased opening to validate demand before committing to` +
        (config ? ` the full ${config.shortName} build.` : ` the full build.`);
  } else {
    recommendation = budgetFeasible
      ? `This location's traffic and market fundamentals do not support the investment at this time. ` +
        `Evaluate alternative sites with higher commercial density or weaker competition. ` +
        `Re-run the analysis with a different address.`
      : `Increase your investment budget to at least ${fmtUSD(effectiveMinRequired)} before proceeding` +
        (config ? ` with the ${config.shortName}` : "") + `. ` +
        `At ${fmtUSD(budgetUSD)}, the facility cannot be built to a standard that generates positive returns. ` +
        `Explore SBA 504 loans (10% down), equipment financing, or equity partnerships to bridge the gap.`;
  }

  // ── Decision summary ────────────────────────────────────────────────────────
  const decisionSummary =
    `This ${result.address} analysis scores ${score.overall}/100 with a ${score.verdict} verdict` +
    (config ? ` for a ${config.name}` : "") + `. ` +
    (noBudget
      ? `No investment budget was entered — evaluated on location fundamentals only. Typical investment: ${fmtUSD(effectiveMinRequired)} in ${country.name}.`
      : budgetFeasible
      ? `Your budget of ${fmtUSD(budgetUSD)} covers the minimum ${fmtUSD(effectiveMinRequired)} required${config ? ` for this format` : ""} in ${country.name}.`
      : `However, your budget of ${fmtUSD(budgetUSD)} falls ${fmtUSD(budgetGap)} short of the ${fmtUSD(effectiveMinRequired)} minimum${config ? ` for the ${config.shortName}` : ""} in ${country.name}.`) +
    ` ${verdict === "INVEST" ? "The location fundamentals support moving forward." : verdict === "PROCEED WITH CAUTION" ? "Proceed carefully with additional due diligence." : "This investment is not recommended at this time."}`;

  return {
    verdict,
    budgetFeasible,
    budgetUSD,
    minimumRequiredUSD: effectiveMinRequired,
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
    const { result, budget, exchangeRate = 1, configId } = body as {
      result: SiteAnalysisResult;
      budget: number;
      exchangeRate?: number;
      configId?: string;
    };

    if (!result || budget == null) {
      return NextResponse.json({ error: "result and budget are required" }, { status: 400 });
    }

    // Resolve the selected car wash config if provided
    const config = configId
      ? CAR_WASH_CONFIGS.find((c) => c.id === configId)
      : undefined;

    // Convert budget to USD using provided exchange rate
    const budgetUSD = budget / (exchangeRate || 1);

    // Validate required fields before entering the rules engine
    if (!result.score || !result.financialProjection || !result.trafficSignals || !result.reviewInsights) {
      console.error("[AVW/decision] Missing required result fields:", {
        hasScore: !!result.score,
        hasFinancial: !!result.financialProjection,
        hasTraffic: !!result.trafficSignals,
        hasReviewInsights: !!result.reviewInsights,
        hasInvestmentSuggestion: !!result.investmentSuggestion,
      });
      return NextResponse.json({ error: "Analysis result is missing required fields — re-run the analysis." }, { status: 422 });
    }

    // Rules-based engine always runs first
    let decision: AiDecision;
    try {
      decision = rulesDecision(result, budgetUSD, exchangeRate, config);
    } catch (rulesErr: any) {
      console.error("[AVW/decision] rulesDecision threw:", rulesErr?.message ?? String(rulesErr));
      console.error("[AVW/decision] result.investmentSuggestion defined:", !!result.investmentSuggestion);
      console.error("[AVW/decision] result.score.overall:", result.score?.overall);
      console.error("[AVW/decision] result.financialProjection.year1EBITDA:", result.financialProjection?.year1EBITDA);
      throw rulesErr;
    }

    // Extract TomTom variables for use in AI prompts below
    const _tomtom      = result.tomtom;
    const flowStatus   = _tomtom?.trafficFlow.status ?? "unavailable";
    const roadClass    = _tomtom?.trafficFlow.roadClass ?? null;
    const roadLabel    = _tomtom?.trafficFlow.roadClassLabel ?? null;
    const congestion   = _tomtom?.trafficFlow.congestionLevel ?? null;
    const incidentRisk = _tomtom?.incidents.accessRiskLevel ?? null;
    const closures     = _tomtom?.incidents.closureCount ?? 0;

    // Extract ATTOM parcel variables for use in AI prompts below
    const parcel         = result.parcel;
    const parcelLive     = parcel?.status === "live";
    const lotSqFt        = parcel?.lotSqFt ?? null;
    const lotAcres       = parcel?.lotAcres ?? null;
    const widthFt        = parcel?.dimensions?.widthFt ?? null;
    const depthFt        = parcel?.dimensions?.depthFt ?? null;
    const parcelZoning   = parcel?.zoning ?? null;
    const parcelLandUse  = parcel?.landUse ?? null;
    const parcelLastSale = parcel?.lastSalePrice ?? null;
    const parcelLandVal  = parcel?.assessedLandUSD ?? null;
    const parcelOwner    = parcel?.owner ?? null;
    const parcelLastDate = parcel?.lastSaleDate ?? null;
    const EXPRESS_MIN_SQFT   = 30_625;
    const SELFSERVE_MIN_SQFT =  7_000;

    // Extract investment suggestion for AI prompts
    const inv = result.investmentSuggestion;

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
Selected format: ${config ? `${config.name} (${config.categoryLabel}) — ${config.carsPerHour.min}–${config.carsPerHour.max} cars/hr, ${config.staffRequired.min}–${config.staffRequired.max} staff, lot min ${config.minLotSqFt.toLocaleString()} sqft, US investment range ${fmtUSD(config.investmentRangeUSD.min)}–${fmtUSD(config.investmentRangeUSD.max)}, ${config.membershipFriendly ? "membership-ready" : "no membership model"}, avg ticket $${config.avgTicketUSD}` : "None selected — generic analysis"}
Score: ${result.score.overall}/100 (${result.score.verdict})
Estimated daily traffic: ${result.trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day [source: Google Maps review-volume formula]
Nearby grocery stores: ${result.trafficSignals.nearbyGroceryStores} [source: Google Places API]
Nearby shopping centers: ${result.trafficSignals.nearbyShopping} [source: Google Places API]
Nearby gas stations: ${result.trafficSignals.nearbyGasStations} [source: Google Places API]
Competitors within ${result.radiusMiles} miles: ${result.competitors.length} | Avg rating: ${result.reviewInsights.avgCompetitorRating.toFixed(1)} [source: Google Places API]
Market saturation: ${result.reviewInsights.marketSaturationLevel}
Year 1 Revenue: ${fmtUSD(result.financialProjection.year1Revenue)} | EBITDA: ${fmtUSD(result.financialProjection.year1EBITDA)} [source: Express Car Wash Investment Pro Forma]
Payback: ${result.financialProjection.paybackYears} years | IRR: ~${result.financialProjection.irr5Year}%
LABOUR RATES [source: ${result.financialProjection.assumptions.wageSource !== "excel-baseline" && result.financialProjection.assumptions.wageSource !== "unavailable" ? `Live — ${result.financialProjection.assumptions.wagePeriod}` : "Pro Forma baseline (2017) — live data unavailable"}]: Staff $${result.financialProjection.assumptions.staffHourlyUSD?.toFixed(2)}/hr | Manager $${result.financialProjection.assumptions.managerHourlyUSD?.toFixed(2)}/hr | US baseline: $${US_BASELINE_STAFF_HOURLY}/hr staff
COMPETITOR VOLUME [source: Google Maps Popular Times via SerpApi]: ${
  decision.keyFactors.find(f => f.includes("Competitor volume")) ?? "No volume data available"
}
ROAD INTELLIGENCE [source: TomTom APIs — live data]: ${
  flowStatus === "live"
    ? `Road class: ${roadLabel} (${roadClass}) | Traffic: ${congestion} | Incident risk: ${incidentRisk} | Active closures: ${closures} | 5-min drive-time isochrone: ${result.tomtom?.isochrones.fiveMin.status === "live" ? result.tomtom.isochrones.fiveMin.boundaryPoints + " boundary points" : "unavailable"} | 10-min isochrone: ${result.tomtom?.isochrones.tenMin.status === "live" ? result.tomtom.isochrones.tenMin.boundaryPoints + " boundary points" : "unavailable"}`
    : "TomTom data unavailable"
}
PARCEL DATA [source: ATTOM county assessor — live]: ${
  parcelLive
    ? `Lot: ${lotSqFt?.toLocaleString() ?? "?"} sqft (${lotAcres?.toFixed(2) ?? "?"} acres) | Dimensions: ${widthFt ? `${widthFt}ft × ${depthFt}ft` : "unavailable"} | Zoning: ${parcelZoning ?? "unknown"}${parcel?.zoningDescription ? ` (${parcel.zoningDescription})` : ""} | Land use: ${parcelLandUse ?? "unknown"} | Owner: ${parcelOwner ?? "unknown"} | Last sale: ${parcelLastSale ? fmtUSD(parcelLastSale) : "unknown"}${parcelLastDate ? ` (${parcelLastDate})` : ""} | Assessed land: ${parcelLandVal ? fmtUSD(parcelLandVal) : "unknown"} | Express tunnel fits: ${lotSqFt !== null ? (lotSqFt >= EXPRESS_MIN_SQFT ? "YES" : "NO — too small") : "unknown"}`
    : "Not available (US-only, or ATTOM_API_KEY not configured)"
}
INVESTMENT RANGE [source: ${inv.sourceNote}]: Total ${fmtUSD(inv.minEstimateUSD)}–${fmtUSD(inv.maxEstimateUSD)} | Land ${fmtUSD(inv.breakdown.land.min)}–${fmtUSD(inv.breakdown.land.max)} | Construction ${fmtUSD(inv.breakdown.construction.min)}–${fmtUSD(inv.breakdown.construction.max)} | Equipment ${fmtUSD(inv.breakdown.equipment.min)}–${fmtUSD(inv.breakdown.equipment.max)} | Fees ${fmtUSD(inv.breakdown.fees.min)}–${fmtUSD(inv.breakdown.fees.max)}
Existing red flags: ${decision.redFlags.join("; ")}
Existing green flags: ${decision.greenFlags.join("; ")}`;

        const aiRes = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
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
                `- Competitors within ${result.radiusMiles} miles: ${result.competitors.length}\n` +
                `- Average competitor rating: ${result.reviewInsights.avgCompetitorRating}/5.0\n` +
                `- Market saturation: ${result.reviewInsights.marketSaturationLevel}\n` +
                `- Estimated daily traffic: ${result.trafficSignals.estimatedDailyTraffic.toLocaleString()} vehicles/day [Google Maps review-volume formula]\n\n` +
                `SITE SURROUNDINGS [source: Google Places API]:\n` +
                `- Nearby grocery stores: ${result.trafficSignals.nearbyGroceryStores} (ideal: ≥2)\n` +
                `- Nearby shopping centers/big-box: ${result.trafficSignals.nearbyShopping} (ideal: ≥1)\n` +
                `- Nearby gas stations: ${result.trafficSignals.nearbyGasStations} (arterial road indicator)\n` +
                `- Nearby fast food / restaurants: ${result.trafficSignals.nearbyFastFood}\n\n` +
                `FINANCIAL PROJECTIONS [source: Express Car Wash Investment Pro Forma, August 2017]:\n` +
                `- Year 1 Revenue: ${fmtUSD(result.financialProjection.year1Revenue)}\n` +
                `- Year 1 EBITDA: ${fmtUSD(result.financialProjection.year1EBITDA)}\n` +
                `- Year 5 Revenue: ${fmtUSD(result.financialProjection.year5Revenue)}\n` +
                `- Payback period: ${result.financialProjection.paybackYears} years\n` +
                `- 5-Year IRR: ~${result.financialProjection.irr5Year}%\n\n` +
                `LABOUR COSTS [source: ${result.financialProjection.assumptions.wageSource !== "excel-baseline" && result.financialProjection.assumptions.wageSource !== "unavailable" ? `Live — ${result.financialProjection.assumptions.wagePeriod}` : "Pro Forma baseline 2017 — live data unavailable"}]:\n` +
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
                (parcelLive
                  ? `PARCEL DATA [source: ATTOM county assessor — live]:\n` +
                    `- Lot size: ${lotSqFt?.toLocaleString() ?? "?"} sqft (${lotAcres?.toFixed(2) ?? "?"} acres)\n` +
                    `- Dimensions: ${widthFt ? `${widthFt}ft wide × ${depthFt}ft deep` : "unavailable"}\n` +
                    `- Zoning: ${parcelZoning ?? "unknown"}${parcel?.zoningDescription ? ` (${parcel.zoningDescription})` : ""}\n` +
                    `- Land use: ${parcelLandUse ?? "unknown"}\n` +
                    `- Owner: ${parcelOwner ?? "unknown"}\n` +
                    (parcelLastSale ? `- Last sale: ${fmtUSD(parcelLastSale)}${parcelLastDate ? ` on ${parcelLastDate}` : ""}\n` : "") +
                    (parcelLandVal ? `- Assessed land value: ${fmtUSD(parcelLandVal)}\n` : "") +
                    `- Express tunnel fit (needs 30,625 sqft min): ${lotSqFt !== null ? (lotSqFt >= EXPRESS_MIN_SQFT ? "YES — fits" : "NO — too small") : "unknown"}\n\n`
                  : `PARCEL DATA: Not available (US-only via ATTOM API, or ATTOM_API_KEY not configured).\n\n`) +
                `INVESTMENT RANGE [source: ${inv.sourceNote}]:\n` +
                `- Total: ${fmtUSD(inv.minEstimateUSD)}–${fmtUSD(inv.maxEstimateUSD)}\n` +
                `- Land: ${fmtUSD(inv.breakdown.land.min)}–${fmtUSD(inv.breakdown.land.max)}\n` +
                `- Construction: ${fmtUSD(inv.breakdown.construction.min)}–${fmtUSD(inv.breakdown.construction.max)}\n` +
                `- Equipment: ${fmtUSD(inv.breakdown.equipment.min)}–${fmtUSD(inv.breakdown.equipment.max)}\n` +
                `- Permits & fees: ${fmtUSD(inv.breakdown.fees.min)}–${fmtUSD(inv.breakdown.fees.max)}\n\n` +
                `INITIAL VERDICT: ${decision.verdict}\n\n` +
                `Evaluate the site against all 5 criteria and include relevant criteria findings in your redFlags and greenFlags. Include road intelligence in Criterion 4 (VISIBILITY & ACCESS) and parcel data in Criterion 3 (PHYSICAL FIT). Return this exact JSON structure:\n` +
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
