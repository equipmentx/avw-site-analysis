/**
 * Industry Benchmarks — Single source of truth for all car wash site-selection thresholds.
 *
 * Sources:
 *   ICA   — International Carwash Association 2024 Industry Report + Q4 2025 Pulse Report
 *   SC    — Sonny's Consulting Site Selection Methodology
 *   BC    — Buxton Company Location Intelligence Framework
 *   RI    — Rinsed Q4 2024 + Q1 2025 Car Wash Industry Reports
 *   MMCG  — MMCG Invest 2025 U.S. Car Wash & Auto Detailing Industry Overview
 *   MMCG2 — MMCG Invest 2024 Demand Analysis in Feasibility Studies (institutional underwriting)
 *   PP    — Project Prosperitas Site Analysis Toolkit (Feasibility studies, Woodland WA & Landover MD)
 *   BL    — BrightLocal Consumer Survey 2024
 *
 * IMPORTANT: No threshold values should be hardcoded anywhere else in the codebase.
 * Always import from this file so thresholds stay consistent and auditable.
 *
 * Last updated: May 2025 with MMCG 2025 + Rinsed Q1 2025 data.
 */

// ── Traffic ───────────────────────────────────────────────────────────────────
export const TRAFFIC_BENCHMARKS = {
  /** ICA/SC: Express tunnel target — 25,000 bi-directional AADT */
  expressTargetAADT: 25_000,
  /** MMCG2: Minimum fronting-street AADT for a viable express tunnel (institutional underwriting floor) */
  minimumFrontingAADT: 22_000,
  /** ICA: Minimum for viable express operation without heavy destination marketing */
  viableMinAADT: 10_000,
  /** ICA: Below this = very marginal; only destination model survives */
  marginalAADT: 5_000,
  /** ICA: Absolute floor — below 2,000 AADT a car wash cannot survive on pass-by traffic alone */
  absoluteFloorAADT: 2_000,
  /**
   * MMCG2 2024: Tiered capture rates (% of bi-directional AADT that stops).
   * Express car washes show an inverse relationship — higher AADT = lower capture
   * due to circulation and stacking constraints.
   * Source: MMCG Invest Demand Analysis in Feasibility Studies (2024).
   */
  captureRatesByAADT: [
    { maxAADT:  15_000, minPct: 1.2, maxPct: 1.7, midPct: 1.4, label: "Low-traffic market (<15k AADT)" },
    { maxAADT:  25_000, minPct: 0.85, maxPct: 1.2, midPct: 1.0, label: "Suburban arterial (15–25k AADT)" },
    { maxAADT:  60_000, minPct: 0.65, maxPct: 0.85, midPct: 0.75, label: "Urban corridor (25–60k AADT)" },
    { maxAADT: Infinity, minPct: 0.4, maxPct: 0.65, midPct: 0.55, label: "High-AADT (>60k — circulation-limited)" },
  ] as const,
  /**
   * MMCG2 2024: Site-characteristic capture rate adjustment multipliers.
   * Applied on top of the AADT-tier base rate.
   */
  captureAdjustments: {
    populationOver35kIn3Mi:    +0.20,  // +20% if 3-mi population > 35,000 households
    noCompetingTunnelInArea:   +0.25,  // +25% if no competing tunnel in trade area
    saturationOver3Per50k:     -0.30,  // -30% if >3 tunnels per 50,000 residents
    goingHomeSide:             +0.10,  // +10% if site is on the commuter going-home side
  },
  /** MMCG2: Conservative institutional pro forma range for a ground-up express tunnel */
  conservativeProFormaRange: { min: 0.005, max: 0.007 },
  /**
   * ICA/SC: Optimal road speed for impulse-buy entry.
   * Too fast (>45 MPH) = drivers can't react in time to turn in.
   * Too slow (<25 MPH) = heavy congestion = poor stacking / ingress.
   */
  optimalSpeedMph: { min: 25, max: 45 },
  optimalSpeedKmh: { min: 40, max: 72 },
};

// ── Demographics ──────────────────────────────────────────────────────────────
export const DEMOGRAPHICS_BENCHMARKS = {
  /** SC/PP: Average household size ≥ 2.3 persons (more people = more vehicles = more demand) */
  hhSizeTarget: 2.3,
  /** ICA: Working population (labor force participation) ≥ 55% — commuters drive past car washes */
  workingPopTargetPct: 55,
  /** ICA Express: ≥ 50% of households with income ≥ $35K — minimum discretionary spend threshold */
  hhIncome35kExpressThresholdPct: 50,
  /** ICA Flex/Full-Service: ≥ 50% of households with income ≥ $50K */
  hhIncome50kFlexThresholdPct: 50,
  /** BC/SC: Average vehicles per household ≥ 2.3 */
  vehiclesPerHHTarget: 2.3,
  /** ICA: No-vehicle households should be < 10% of total households */
  noVehicleMaxPct: 10,
  /** ICA: Unemployment rate below this indicates healthy consumer spending */
  unemploymentMaxPct: 6,
  /**
   * MMCG2 2024: Minimum trade area population for a viable express tunnel.
   * Source: MMCG Invest Demand Analysis in Feasibility Studies.
   */
  minimumHouseholds3MiRadius: { floor: 25_000, recommended: 35_000 },
};

// ── Competition ───────────────────────────────────────────────────────────────
export const COMPETITION_BENCHMARKS = {
  /** ICA/PP: Same-format competitor within 0.5 mi = HIGH threat requiring strong differentiation */
  highThreatRadiusMiles: 0.5,
  /** ICA: Competitor within 1.5 mi = MODERATE threat */
  moderateThreatRadiusMiles: 1.5,
  /** SC: 4+ competitors within 3 miles = saturated market */
  saturatedCountWithin3Miles: 4,
  /** PP: Competitive analysis standard zone = 3-mile radius from site */
  primaryAnalysisRadiusMiles: 3,
  /** Keywords in competitor reviews/names indicating they have a membership program */
  membershipKeywords: [
    "unlimited", "monthly", "membership", "subscribe", "subscription",
    "plan", "pass", "club", "member", "recurring",
  ],
  /** Keywords for wash type classification */
  washTypeKeywords: {
    express:     ["express", "tunnel", "conveyor", "automatic", "drive-thru"],
    fullService: ["full service", "full-service", "detail", "interior"],
    iba:         ["in-bay", "rollover", "touchless", "soft touch", "laser"],
    selfServe:   ["self serve", "self-serve", "self-service", "coin", "wand"],
  },
};

// ── Financial ─────────────────────────────────────────────────────────────────
export const FINANCIAL_BENCHMARKS = {
  /**
   * RI Q4 2024 + MMCG 2025: Membership revenue = 35% of total for express operators.
   * (Was 26% in 2022 benchmarks — membership growth +13.2% YoY per Rinsed Q4 2024.)
   * Leading platforms converting 35% of visitors to members; industry median ~35%.
   * Drive-by = 65% of total.
   */
  membershipRevSharePct: 35,
  driveByRevSharePct: 65,

  /**
   * RI Q4 2024 + MMCG2 2024: Membership unit economics.
   * Average ARPU: $30/month (confirmed: Rinsed tracks avg $30 across thousands of sites).
   * Member wash frequency: 2.4 washes/month.
   * Member lifetime value (36 months): $440 vs retail $106 (315% higher).
   */
  membershipARPUMonthly: 30,
  memberWashFrequencyPerMonth: 2.4,
  memberLifetimeValue36Mo: 440,
  retailRepeatLifetimeValue: 106,

  /**
   * MMCG2 2024: Membership ramp targets.
   * Day-300 target: 1,000 active members.
   * Stabilized (mature site): ~3,000 members.
   * Year-1 ramp: 50–65% of stabilized (use 55% midpoint for pro forma).
   * Year-2 ramp: 75–85% of stabilized (use 80% midpoint).
   * Source: MMCG Invest Demand Analysis in Feasibility Studies + institutional benchmarks.
   */
  stabilizedMemberCount: 3_000,
  year1RampFactor: 0.55,
  year2RampFactor: 0.80,
  year3RampFactor: 0.95,

  /**
   * MMCG2 2024: Churn rates at mature sites.
   * Monthly churn: 7–8% (use 7.5% base; 12% stress test).
   */
  memberMonthlyChurnPct: { base: 7.5, stress: 12 },

  /**
   * Retail-to-member conversion rates (MMCG2 2024).
   * Immature site: ~3% conversion. Mature site: 13–14% conversion.
   */
  retailToMemberConversionPct: { immature: 3, mature: 13.5 },

  /**
   * ICA 2024: Standard unlimited membership ~$39.99/month.
   * PP Proforma (Woodland WA): $39.99/month standard.
   */
  membershipStandardPriceUSD: 39.99,
  membershipPremiumPriceUSD: 49.99,

  /**
   * MMCG 2025 + ICA 2024: Revenue per car (drive-by, no membership).
   * Average ticket: $12.50 (WifiTalents 2025 / IBISWorld).
   * With upsells: $14–$20. Average cost per wash: $2.10 (chemicals + labor).
   */
  avgTicketPriceUSD: 12.50,
  avgCostPerWashUSD: 2.10,
  grossMarginPerWash: 10.40,

  /**
   * MMCG 2025: EBITDA margins for express tunnels.
   * Well-operated express: EBITDA margins above 30%; optimized sites: 40–50%+.
   */
  ebitdaMarginExpress: { typical: 0.30, optimized: 0.45 },

  /**
   * PP Proforma (Sonny's Consulting): wash package customer distribution.
   * Updated: Basic share reduced, Standard/Premium/Ultimate slightly increased.
   * Reflects 2024-2025 market trend toward higher-tier packages.
   */
  packageDistribution: [
    { tier: "Basic",    sharePct: 0.40 },
    { tier: "Standard", sharePct: 0.28 },
    { tier: "Premium",  sharePct: 0.20 },
    { tier: "Ultimate", sharePct: 0.12 },
  ],

  /**
   * ICA 2024 Industry Report: Car wash demand by season (US national average).
   * Winter (Dec–Feb): 28% of annual volume (revised down from 32% per MMCG 2025).
   * Spring/Summer (Mar–Aug): 52% of annual volume.
   * Fall (Sep–Nov): 20% of annual volume.
   */
  seasonality: {
    winter:       { months: "Dec–Feb", sharePct: 0.28 },
    springSummer: { months: "Mar–Aug", sharePct: 0.52 },
    fall:         { months: "Sep–Nov", sharePct: 0.20 },
  },

  /**
   * SC/PP: Labor structure (manager, assistant manager, attendants).
   * Burden rate = 20% (FICA taxes + basic benefits) per Sonny's Consulting.
   */
  laborStructure: {
    manager:      { hoursPerWeek: 49, weeksPerYear: 49 },
    assistantMgr: { hoursPerWeek: 42, weeksPerYear: 52 },
    attendants:   { totalHoursPerWeek: 160, weeksPerYear: 52 },
    burdenRatePct: 20,
  },

  /** ICA/PP: Typical break-even window for an express car wash */
  typicalBreakEvenMonths: { min: 18, max: 24 },

  /**
   * MMCG2 2024: Debt service coverage ratio (DSCR) benchmarks for lender stress tests.
   * Base case: DSCR ≥ 1.25×. Downside (−25% capture, −10% ticket): DSCR ≥ 1.10×.
   */
  dscrBaseCase: 1.25,
  dscrDownside:  1.10,

  /**
   * MMCG 2025: Year-1 and Year-2 ramp to stabilization (% of stabilized revenue).
   * Gas stations: 70–80% Year 1. Car washes ramp slower: 50–65% Year 1.
   */
  revenueRampToStabilization: { year1: 0.55, year2: 0.80, year3: 0.95 },
};

// ── Trade Area ────────────────────────────────────────────────────────────────
export const TRADE_AREA = {
  /** ICA/BC: Primary trade area — the 3-mile radius captures the majority of express wash customers */
  primaryRadiusMiles: 3,
  /** ICA/BC: Secondary trade area — 5-mile radius */
  secondaryRadiusMiles: 5,
  /** ICA/BC: Drive-time zone — 10-minute drive time (TomTom isochrone) */
  driveTimeMinutes: 10,
};

// ── Site Selection Ratings ────────────────────────────────────────────────────
/**
 * SC/PP: Site Fundamentals rating bands.
 * Used for the 7-dimension scoring dashboard.
 * Matches Sonny's Consulting visual rating scale.
 */
export const SITE_RATINGS = [
  { label: "Excellent", minScore: 85, color: "#10b981", bg: "bg-emerald-500/15",  border: "border-emerald-500/40",  text: "text-emerald-400"  },
  { label: "Great",     minScore: 70, color: "#3b82f6", bg: "bg-blue-500/15",     border: "border-blue-500/40",     text: "text-blue-400"     },
  { label: "Good",      minScore: 55, color: "#eab308", bg: "bg-yellow-500/15",   border: "border-yellow-500/40",   text: "text-yellow-400"   },
  { label: "Borderline",minScore: 40, color: "#f97316", bg: "bg-orange-500/15",   border: "border-orange-500/40",   text: "text-orange-400"   },
  { label: "Poor",      minScore: 0,  color: "#ef4444", bg: "bg-red-500/15",      border: "border-red-500/40",      text: "text-red-400"      },
] as const;

export type SiteRating = typeof SITE_RATINGS[number]["label"];

/** Returns the rating band for a given 0-100 score */
export function getSiteRating(score: number): typeof SITE_RATINGS[number] {
  return (
    SITE_RATINGS.find((r) => score >= r.minScore) ??
    SITE_RATINGS[SITE_RATINGS.length - 1]
  );
}

// ── Scoring Weights ───────────────────────────────────────────────────────────
/**
 * Weights for the 7-dimension Site Fundamentals score.
 * ICA emphasises traffic and demographics most heavily.
 */
export const FUNDAMENTALS_WEIGHTS = {
  traffic:       0.28,  // ICA #1 factor
  demographics:  0.22,  // ICA #2 factor
  competition:   0.18,  // ICA #3 factor
  accessibility: 0.12,  // SC/PP: road speed, ingress/egress
  retailDraw:    0.10,  // BC: cotenant / commercial anchor score
  visibility:    0.10,  // SC: sightline and road class
};
