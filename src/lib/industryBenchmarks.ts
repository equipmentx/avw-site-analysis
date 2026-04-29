/**
 * Industry Benchmarks — Single source of truth for all car wash site-selection thresholds.
 *
 * Sources:
 *   ICA  — International Carwash Association 2024 Industry Report
 *   SC   — Sonny's Consulting Site Selection Methodology
 *   BC   — Buxton Company Location Intelligence Framework
 *   RI   — Rinsed Q4 2024 Car Wash Industry Benchmarks
 *   PP   — Project Prosperitas Site Analysis Toolkit (Feasibility studies, Woodland WA & Landover MD)
 *
 * IMPORTANT: No threshold values should be hardcoded anywhere else in the codebase.
 * Always import from this file so thresholds stay consistent and auditable.
 */

// ── Traffic ───────────────────────────────────────────────────────────────────
export const TRAFFIC_BENCHMARKS = {
  /** ICA/SC: Express tunnel target — 25,000 bi-directional AADT */
  expressTargetAADT: 25_000,
  /** ICA: Minimum for viable express operation without heavy destination marketing */
  viableMinAADT: 10_000,
  /** ICA: Below this = very marginal; only destination model survives */
  marginalAADT: 5_000,
  /** ICA: Absolute floor — below 2,000 AADT a car wash cannot survive on pass-by traffic alone */
  absoluteFloorAADT: 2_000,
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
   * RI 2024: Membership revenue = ~26% of total car wash revenue for express operators.
   * SC/PP Proforma: Drive-by = 74%.
   */
  membershipRevSharePct: 26,
  driveByRevSharePct: 74,

  /**
   * ICA 2024: Standard unlimited membership ~$39.99/month.
   * PP Proforma (Woodland WA): $39.99/month standard.
   */
  membershipStandardPriceUSD: 39.99,
  membershipPremiumPriceUSD: 49.99,

  /**
   * PP Proforma (Sonny's Consulting): wash package customer distribution.
   * Basic = 50%, Menu#1 = 15%, Menu#2 = 15%, Menu#3 = 10%, Menu#4 = 10%.
   * Mapped to our 4-tier model: Basic/Standard/Premium/Ultimate.
   */
  packageDistribution: [
    { tier: "Basic",    sharePct: 0.50 },
    { tier: "Standard", sharePct: 0.25 },
    { tier: "Premium",  sharePct: 0.15 },
    { tier: "Ultimate", sharePct: 0.10 },
  ],

  /**
   * ICA 2024 Industry Report: Car wash demand by season (US national average).
   * Winter (Dec–Feb): 32% of annual volume.
   * Spring/Summer (Mar–Aug): 50% of annual volume.
   * Fall (Sep–Nov): 18% of annual volume.
   */
  seasonality: {
    winter:       { months: "Dec–Feb", sharePct: 0.32 },
    springSummer: { months: "Mar–Aug", sharePct: 0.50 },
    fall:         { months: "Sep–Nov", sharePct: 0.18 },
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
