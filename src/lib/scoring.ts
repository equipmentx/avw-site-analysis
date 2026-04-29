import type {
  PlaceResult,
  PlaceReview,
  ReviewSentiment,
  ComplaintCategory,
  CompetitorAnalysis,
  TrafficSignals,
  LocationScore,
  ReviewInsights,
  Recommendation,
  SiteFundamentalsScore,
  SiteFundamentalsDimension,
  TomTomTrafficFlow,
  CensusData,
} from "./types";
import {
  TRAFFIC_BENCHMARKS,
  DEMOGRAPHICS_BENCHMARKS,
  COMPETITION_BENCHMARKS,
  FUNDAMENTALS_WEIGHTS,
  getSiteRating,
} from "./industryBenchmarks";

// ─── Complaint keyword groups ─────────────────────────────────────────────────
const COMPLAINT_GROUPS: Array<{
  category: string;
  keywords: string[];
  emoji: string;
  opportunity: string;
}> = [
  {
    category: "Long Wait Times",
    keywords: ["wait", "long line", "queue", "slow", "took forever", "hour wait", "45 minutes", "backed up"],
    emoji: "⏱️",
    opportunity: "Express tunnel technology with 45-second wash cycles and pre-sale kiosks can reduce or eliminate queues.",
  },
  {
    category: "Poor Cleaning Quality",
    keywords: ["dirty", "still dirty", "not clean", "missed spots", "didn't clean", "bug", "dirt left", "streaks"],
    emoji: "🚗",
    opportunity: "Multi-stage foam application and triple-rinse systems are worth evaluating as potential differentiators.",
  },
  {
    category: "Vehicle Damage",
    keywords: ["scratch", "damage", "dent", "broken", "mirror", "antenna", "chipped", "scraped"],
    emoji: "🛠️",
    opportunity: "Soft-touch brushless equipment with a documented damage policy is worth researching for this market.",
  },
  {
    category: "Poor Customer Service",
    keywords: ["rude", "unprofessional", "staff", "service", "attitude", "helpful", "ignored", "unhelpful"],
    emoji: "👥",
    opportunity: "Trained service staff and a clear customer satisfaction policy may address a known gap in this market.",
  },
  {
    category: "Overpriced",
    keywords: ["expensive", "overpriced", "too much", "not worth", "cheap", "price", "cost", "value"],
    emoji: "💰",
    opportunity: "Tiered pricing or a membership plan may be worth evaluating relative to the local price sensitivity.",
  },
  {
    category: "Outdated Equipment",
    keywords: ["broken", "machine", "equipment", "out of service", "old", "outdated", "doesn't work"],
    emoji: "⚙️",
    opportunity: "Market-wide equipment complaints may indicate an opportunity for a modern facility in this area.",
  },
  {
    category: "Vacuums & Amenities",
    keywords: ["vacuum", "vending", "no vacuum", "free vacuum", "interiors", "inside", "mat"],
    emoji: "✨",
    opportunity: "Free vacuums and amenity stations are commonly cited as differentiators by new market entrants.",
  },
  {
    category: "Limited Hours",
    keywords: ["closed", "hours", "early", "late", "open", "Sunday", "holiday", "weekend"],
    emoji: "🕐",
    opportunity: "Extended or 7-day operating hours may address a service gap competitors have in this market.",
  },
];

const POSITIVE_KEYWORDS = [
  "great", "excellent", "amazing", "clean", "fast", "quick", "love", "best",
  "friendly", "recommend", "perfect", "wonderful", "fantastic", "outstanding",
  "professional", "thorough", "spotless", "efficient", "convenient",
];

// ─── Distance helpers ─────────────────────────────────────────────────────────
export function calcDistanceMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ─── Review sentiment analysis ────────────────────────────────────────────────
export function analyzeReviews(reviews: PlaceReview[]): ReviewSentiment {
  if (!reviews || reviews.length === 0) {
    return { positives: [], negatives: [], topComplaints: [], opportunities: [] };
  }

  const allText = reviews.map((r) => r.text?.toLowerCase() ?? "").join(" ");
  const positives: string[] = [];
  const negatives: string[] = [];

  POSITIVE_KEYWORDS.forEach((kw) => {
    if (allText.includes(kw)) positives.push(kw);
  });

  const topComplaints: ComplaintCategory[] = [];

  COMPLAINT_GROUPS.forEach((group) => {
    const matchedKeywords: string[] = [];
    let count = 0;
    reviews.forEach((review) => {
      const text = review.text?.toLowerCase() ?? "";
      const matches = group.keywords.filter((kw) => text.includes(kw));
      if (matches.length > 0 && review.rating <= 3) {
        count++;
        matches.forEach((m) => { if (!matchedKeywords.includes(m)) matchedKeywords.push(m); });
        if (!negatives.includes(group.category)) negatives.push(group.category);
      }
    });
    if (count > 0) {
      topComplaints.push({
        category: group.category, count, keywords: matchedKeywords.slice(0, 3),
        emoji: group.emoji, opportunity: group.opportunity,
      });
    }
  });

  topComplaints.sort((a, b) => b.count - a.count);
  return { positives, negatives, topComplaints, opportunities: topComplaints.map((c) => c.opportunity) };
}

// ─── Competitor threat analysis ───────────────────────────────────────────────
export function analyzeCompetitor(
  place: PlaceResult,
  distanceMiles: number,
  estimatedVolume: import("./types").EstimatedVolume,
  hasMembership: boolean | null,
  washType: CompetitorAnalysis["washType"],
): CompetitorAnalysis {
  const reviews     = place.reviews ?? [];
  const sentiment   = analyzeReviews(reviews);
  const rating      = place.rating ?? 0;
  const reviewCount = place.user_ratings_total ?? 0;
  const ratingScore = (rating / 5) * 60;
  const volumeScore = Math.min(reviewCount / 500, 1) * 40;
  const strengthScore = Math.round(ratingScore + volumeScore);

  let threatLevel: "LOW" | "MEDIUM" | "HIGH";
  if (distanceMiles < COMPETITION_BENCHMARKS.highThreatRadiusMiles && strengthScore > 70)
    threatLevel = "HIGH";
  else if (distanceMiles < COMPETITION_BENCHMARKS.moderateThreatRadiusMiles && strengthScore > 50)
    threatLevel = "MEDIUM";
  else
    threatLevel = "LOW";

  return { place, distanceMiles, sentiment, strengthScore, threatLevel, estimatedVolume, hasMembership, washType };
}

// ─── Traffic signal scoring ───────────────────────────────────────────────────
export function scoreTrafficSignals(signals: TrafficSignals): number {
  const weights = { gasStations: 0.20, grocery: 0.20, fastFood: 0.15, shopping: 0.20, schools: 0.10, trafficDensity: 0.15 };
  const normalize = (val: number, max: number) => Math.min(val / max, 1);
  const score =
    normalize(signals.nearbyGasStations,   8)  * weights.gasStations   * 100 +
    normalize(signals.nearbyGroceryStores,  6)  * weights.grocery       * 100 +
    normalize(signals.nearbyFastFood,       10) * weights.fastFood      * 100 +
    normalize(signals.nearbyShopping,        8) * weights.shopping      * 100 +
    normalize(signals.nearbySchools,         5) * weights.schools       * 100 +
    normalize(signals.estimatedDailyTraffic, TRAFFIC_BENCHMARKS.expressTargetAADT) * weights.trafficDensity * 100;
  return Math.min(Math.round(score), 100);
}

// ─── AADT-based traffic score — aligned with ICA benchmark ───────────────────
function aadtToTrafficScore(aadt: number): number {
  const { expressTargetAADT, viableMinAADT, marginalAADT, absoluteFloorAADT } = TRAFFIC_BENCHMARKS;
  if (aadt >= expressTargetAADT) return 100;
  if (aadt >= 18_000)            return Math.round(80 + ((aadt - 18_000) / (expressTargetAADT - 18_000)) * 20);
  if (aadt >= viableMinAADT)     return Math.round(60 + ((aadt - viableMinAADT) / 8_000) * 20);
  if (aadt >= marginalAADT)      return Math.round(40 + ((aadt - marginalAADT) / 5_000) * 20);
  if (aadt >= absoluteFloorAADT) return Math.round(20 + ((aadt - absoluteFloorAADT) / 3_000) * 20);
  return Math.max(5, Math.round((aadt / absoluteFloorAADT) * 20));
}

// ─── Commercial density — proxy for impulse-buy environment ──────────────────
function commercialDensityScore(signals: TrafficSignals): number {
  const total = signals.nearbyGasStations + signals.nearbyGroceryStores +
                signals.nearbyFastFood + signals.nearbyShopping;
  if (total === 0) return 0;
  if (total <= 2)  return 20;
  if (total <= 5)  return 40;
  if (total <= 10) return 60;
  if (total <= 20) return 80;
  return 100;
}

// ─── Accessibility score — road speed sweet spot + congestion ─────────────────
function buildAccessibilityScore(trafficFlow?: TomTomTrafficFlow | null): number {
  if (!trafficFlow || trafficFlow.status !== "live") return 50; // neutral if no data

  const speedKmh = trafficFlow.currentSpeedKmh;
  const { optimalSpeedKmh } = TRAFFIC_BENCHMARKS;

  // Speed sweet spot score (ICA/SC: 25-45 MPH = 40-72 km/h is optimal for impulse entry)
  let speedScore: number;
  if (speedKmh >= optimalSpeedKmh.min && speedKmh <= optimalSpeedKmh.max) {
    speedScore = 100; // perfect — vehicles can notice and turn in
  } else if (speedKmh < optimalSpeedKmh.min) {
    // Too slow: heavy congestion — stacking and entry issues
    speedScore = Math.max(20, Math.round((speedKmh / optimalSpeedKmh.min) * 80));
  } else {
    // Too fast: drivers can't react in time
    const excess = speedKmh - optimalSpeedKmh.max;
    speedScore = Math.max(20, Math.round(100 - excess * 1.5));
  }

  // Congestion penalty: heavy congestion hurts accessibility
  const congestionPenalty = trafficFlow.congestionLevel === "HEAVY" ? 25
    : trafficFlow.congestionLevel === "MODERATE" ? 10
    : 0;

  // Road class bonus: arterial roads (FRC2-3) are ideal for car washes
  const frcNum = parseInt(trafficFlow.roadClass?.replace("FRC", "") ?? "4");
  const roadClassBonus = frcNum <= 2 ? 10 : frcNum <= 3 ? 5 : 0;

  return Math.min(100, Math.max(0, speedScore - congestionPenalty + roadClassBonus));
}

// ─── Visibility score — road class + AADT ────────────────────────────────────
function buildVisibilityScore(trafficFlow?: TomTomTrafficFlow | null, aadt?: number): number {
  if (!trafficFlow || trafficFlow.status !== "live") {
    return aadt ? aadtToTrafficScore(aadt) * 0.8 : 40;
  }
  const frcNum = parseInt(trafficFlow.roadClass?.replace("FRC", "") ?? "5");
  // FRC0-1 = motorway/freeway (very fast, bad for car wash entry)
  // FRC2-3 = major arterial/primary road (ideal — high volume, manageable speed)
  // FRC4-5 = secondary/local (lower visibility)
  // FRC6-7 = service/access road (minimal traffic)
  let classScore: number;
  if (frcNum === 0)       classScore = 30; // freeway — hard to access
  else if (frcNum === 1)  classScore = 55;
  else if (frcNum === 2)  classScore = 90; // major arterial = ideal
  else if (frcNum === 3)  classScore = 80;
  else if (frcNum === 4)  classScore = 60;
  else if (frcNum === 5)  classScore = 40;
  else                    classScore = 20;

  // Blend with AADT score
  const aadtScore = aadt ? aadtToTrafficScore(aadt) : 50;
  return Math.round(classScore * 0.6 + aadtScore * 0.4);
}

// ─── Demographics score — from Census benchmarks ─────────────────────────────
function buildDemographicsScore(census?: CensusData | null): number {
  if (!census || census.status !== "live") return 50; // neutral if no data

  const county = census.county;
  let score = 0;

  // HH size (ICA target: ≥ 2.3) — 25 pts
  if (county.avgHouseholdSize >= DEMOGRAPHICS_BENCHMARKS.hhSizeTarget) score += 25;
  else score += Math.round((county.avgHouseholdSize / DEMOGRAPHICS_BENCHMARKS.hhSizeTarget) * 25);

  // Working population (ICA target: ≥ 55%) — 25 pts
  if (county.laborForceParticipation >= DEMOGRAPHICS_BENCHMARKS.workingPopTargetPct) score += 25;
  else score += Math.round((county.laborForceParticipation / DEMOGRAPHICS_BENCHMARKS.workingPopTargetPct) * 25);

  // HH income ≥ $35K — 50%+ of households (ICA express target) — 25 pts
  if (county.hhIncomeOver35kPct >= DEMOGRAPHICS_BENCHMARKS.hhIncome35kExpressThresholdPct) score += 25;
  else score += Math.round((county.hhIncomeOver35kPct / DEMOGRAPHICS_BENCHMARKS.hhIncome35kExpressThresholdPct) * 25);

  // Vehicles per household (BC target: ≥ 2.3) — 25 pts
  if (county.vehiclesPerHousehold >= DEMOGRAPHICS_BENCHMARKS.vehiclesPerHHTarget) score += 25;
  else score += Math.round((county.vehiclesPerHousehold / DEMOGRAPHICS_BENCHMARKS.vehiclesPerHHTarget) * 25);

  return Math.min(100, score);
}

// ─── Build Site Fundamentals 7-dimension dashboard ───────────────────────────
function buildDimension(score: number, detail: string): SiteFundamentalsDimension {
  const rating = getSiteRating(score);
  return {
    score,
    rating: rating.label,
    color: rating.color,
    bg: rating.bg,
    border: rating.border,
    text: rating.text,
    detail,
  };
}

export function buildSiteFundamentals(
  aadt: number,
  competitors: CompetitorAnalysis[],
  trafficSignals: TrafficSignals,
  trafficFlow?: TomTomTrafficFlow | null,
  census?: CensusData | null,
): SiteFundamentalsScore {
  const trafficScore       = aadtToTrafficScore(aadt);
  const demographicsScore  = buildDemographicsScore(census);
  const competitionScore   = buildRawCompetitionScore(competitors);
  const accessibilityScore = buildAccessibilityScore(trafficFlow);
  const retailDrawScore    = commercialDensityScore(trafficSignals);
  const visibilityScore    = buildVisibilityScore(trafficFlow, aadt);

  const overallScore = Math.round(
    trafficScore       * FUNDAMENTALS_WEIGHTS.traffic +
    demographicsScore  * FUNDAMENTALS_WEIGHTS.demographics +
    competitionScore   * FUNDAMENTALS_WEIGHTS.competition +
    accessibilityScore * FUNDAMENTALS_WEIGHTS.accessibility +
    retailDrawScore    * FUNDAMENTALS_WEIGHTS.retailDraw +
    visibilityScore    * FUNDAMENTALS_WEIGHTS.visibility
  );

  const speedMph = trafficFlow ? Math.round(trafficFlow.currentSpeedKmh * 0.621) : null;
  const frc = trafficFlow?.roadClassLabel ?? "unknown";

  return {
    traffic:       buildDimension(trafficScore,       `${aadt.toLocaleString()} vehicles/day · ICA target: ${TRAFFIC_BENCHMARKS.expressTargetAADT.toLocaleString()}`),
    demographics:  buildDimension(demographicsScore,  census ? `${Object.values(census.county.benchmarks).filter(b => b.met).length}/3 ICA benchmarks met · ${census.countyName} County` : "US Census data unavailable"),
    competition:   buildDimension(competitionScore,   `${competitors.length} car wash${competitors.length !== 1 ? "es" : ""} within search radius · ${competitors.filter(c => c.distanceMiles <= 1).length} within 1 mile`),
    accessibility: buildDimension(accessibilityScore, speedMph ? `Road speed ${speedMph} MPH · ICA optimal: ${TRAFFIC_BENCHMARKS.optimalSpeedMph.min}–${TRAFFIC_BENCHMARKS.optimalSpeedMph.max} MPH` : "TomTom speed data unavailable"),
    retailDraw:    buildDimension(retailDrawScore,     `${trafficSignals.nearbyGasStations + trafficSignals.nearbyGroceryStores + trafficSignals.nearbyShopping} commercial anchors nearby`),
    visibility:    buildDimension(visibilityScore,     `Road class: ${frc}${speedMph ? ` · ${speedMph} MPH` : ""}`),
    overall:       buildDimension(overallScore,        "Weighted composite of all 6 dimensions — ICA site-selection methodology"),
  };
}

function buildRawCompetitionScore(competitors: CompetitorAnalysis[]): number {
  const within1Mile  = competitors.filter((c) => c.distanceMiles <= 1).length;
  const within3Miles = competitors.filter((c) => c.distanceMiles <= COMPETITION_BENCHMARKS.primaryAnalysisRadiusMiles).length;
  if (within1Mile === 0 && within3Miles === 0)      return 95;
  if (within1Mile === 0 && within3Miles <= 1)       return 85;
  if (within1Mile === 0 && within3Miles <= 3)       return 72;
  if (within1Mile === 1 && within3Miles <= 4)       return 58;
  if (within1Mile <= 2 && within3Miles <= 6)        return 45;
  if (within1Mile <= 3)                             return 30;
  return 18;
}

// ─── Main location scoring ────────────────────────────────────────────────────
// Weights, formula, and thresholds are deliberately kept close to the original
// baseline so scores remain comparable. The Site Fundamentals dashboard uses
// the separate AADT-based scoring — it does NOT feed into the overall score.
export function calculateLocationScore(
  competitors: CompetitorAnalysis[],
  trafficSignals: TrafficSignals,
  financialViable: boolean,
  trafficFlow?: TomTomTrafficFlow | null,
  census?: CensusData | null,
): LocationScore {
  const nearbyCount = competitors.length;
  const avgRating   = nearbyCount > 0
    ? competitors.reduce((s, c) => s + (c.place.rating ?? 0), 0) / nearbyCount
    : 0;

  const aadt = trafficSignals.estimatedDailyTraffic;
  const { expressTargetAADT, viableMinAADT, marginalAADT, absoluteFloorAADT } = TRAFFIC_BENCHMARKS;

  // Traffic: original density+AADT blend (same as before the rewrite)
  const trafficScore = scoreTrafficSignals(trafficSignals);

  const within1Mile  = competitors.filter((c) => c.distanceMiles <= 1).length;
  const within3Miles = competitors.filter((c) => c.distanceMiles <= COMPETITION_BENCHMARKS.primaryAnalysisRadiusMiles).length;

  // Competition: original lookup table (no market-viability discount)
  let competitionScore: number;
  if      (within1Mile === 0 && within3Miles <= 1)  competitionScore = 95;
  else if (within1Mile === 0 && within3Miles <= 3)  competitionScore = 80;
  else if (within1Mile === 1 && within3Miles <= 4)  competitionScore = 65;
  else if (within1Mile <= 2  && within3Miles <= 6)  competitionScore = 50;
  else if (within1Mile <= 3)                        competitionScore = 35;
  else                                              competitionScore = 20;

  const totalComplaints = competitors.reduce((sum, c) => sum + c.sentiment.topComplaints.length, 0);
  const lowRatedCount   = competitors.filter((c) => (c.place.rating ?? 5) < 3.5).length;

  // Opportunity: original formula (baseline 50, not 30)
  let opportunityScore = 50;
  opportunityScore += Math.min(totalComplaints * 5, 30);
  opportunityScore += lowRatedCount * 10;
  if (avgRating > 0 && avgRating < 3.8) opportunityScore += 15;
  opportunityScore = Math.min(opportunityScore, 100);

  // Market: original raw-sum formula
  const marketScore = Math.min(
    trafficSignals.nearbyGasStations   * 8  +
    trafficSignals.nearbyGroceryStores * 10 +
    trafficSignals.nearbyFastFood      * 5  +
    trafficSignals.nearbyShopping      * 8,
    100
  );

  // Financial: original values
  const financialScore = financialViable ? 75 : 40;

  // Accessibility: new dimension, small weight absorbed proportionally from others
  const accessScore = buildAccessibilityScore(trafficFlow);

  const components = {
    traffic:       trafficScore,
    competition:   competitionScore,
    opportunity:   opportunityScore,
    market:        marketScore,
    financial:     financialScore,
    accessibility: accessScore,
  };

  // Weights: original proportions (traffic 0.25, competition 0.25, …) trimmed
  // slightly to make room for accessibility at 0.08 — net change ≤ 3 points.
  const overall = Math.round(
    components.traffic       * 0.25 +
    components.competition   * 0.23 +
    components.opportunity   * 0.18 +
    components.market        * 0.14 +
    components.financial     * 0.12 +
    components.accessibility * 0.08
  );

  // Grade/verdict thresholds: restored to original values
  let grade: "A" | "B" | "C" | "D" | "F";
  let verdict: "GO" | "CAUTION" | "NO-GO";
  let verdictColor: string;

  if (overall >= 80)      { grade = "A"; verdict = "GO";      verdictColor = "#10b981"; }
  else if (overall >= 65) { grade = "B"; verdict = "GO";      verdictColor = "#10b981"; }
  else if (overall >= 50) { grade = "C"; verdict = "CAUTION"; verdictColor = "#f59e0b"; }
  else if (overall >= 35) { grade = "D"; verdict = "CAUTION"; verdictColor = "#f97316"; }
  else                    { grade = "F"; verdict = "NO-GO";   verdictColor = "#ef4444"; }

  const highlights: string[] = [];
  const risks: string[] = [];

  if (trafficScore >= 70)
    highlights.push(`Strong traffic corridor — ${aadt.toLocaleString()} vehicles/day with high commercial density`);
  else if (aadt >= viableMinAADT)
    highlights.push(`Moderate corridor traffic of ${aadt.toLocaleString()} vehicles/day — below ${expressTargetAADT.toLocaleString()} AADT target but operational`);
  if (competitionScore >= 80)
    highlights.push("No conveyorized competition in the immediate area — potential first-mover advantage");
  if (totalComplaints > 0)
    highlights.push(`${totalComplaints} complaint categories detected across ${nearbyCount} competitor(s) — potential service gaps to study`);
  if (lowRatedCount > 0)
    highlights.push(`${lowRatedCount} competitor(s) rated below 3.5 ★ — service quality appears to be an issue in this market`);
  if (marketScore >= 60)
    highlights.push("Dense commercial activity signals strong impulse-purchase traffic patterns");
  if (accessScore >= 70 && trafficFlow?.currentSpeedKmh) {
    const mph = Math.round(trafficFlow.currentSpeedKmh * 0.621);
    highlights.push(`Road speed ${mph} MPH is within the ${TRAFFIC_BENCHMARKS.optimalSpeedMph.min}–${TRAFFIC_BENCHMARKS.optimalSpeedMph.max} MPH optimal entry window`);
  }

  if (trafficScore < 40)
    risks.push(`Lower traffic area — ${aadt.toLocaleString()} vehicles/day is well below the ${expressTargetAADT.toLocaleString()} ICA benchmark. Aggressive marketing will be essential`);
  else if (aadt < viableMinAADT)
    risks.push(`AADT of ~${aadt.toLocaleString()} is below the ${viableMinAADT.toLocaleString()} viable minimum — membership-driven revenue strategy required`);
  if (within1Mile >= 2)
    risks.push(`${within1Mile} car washes within 1 mile — meaningful differentiation will be required`);
  if (avgRating > 4.3 && nearbyCount > 2)
    risks.push("Existing competitors are well-rated — new entrant must match or exceed quality to capture share");
  if (!financialViable)
    risks.push("Projected traffic may yield thin operating margins under current assumptions — verify with detailed pro forma");
  if (trafficSignals.nearbyGasStations < 2)
    risks.push("Limited gas station proximity — consider prominent signage and digital presence to drive awareness");
  if (aadt < absoluteFloorAADT)
    risks.push("Very low corridor traffic — a car wash at this location would function primarily as a destination business");
  if (trafficFlow && trafficFlow.currentSpeedKmh > TRAFFIC_BENCHMARKS.optimalSpeedKmh.max) {
    const mph = Math.round(trafficFlow.currentSpeedKmh * 0.621);
    risks.push(`Road speed ${mph} MPH exceeds the ${TRAFFIC_BENCHMARKS.optimalSpeedMph.max} MPH optimal threshold — drivers may not react in time to turn in`);
  }

  let explanation = "";
  if (verdict === "GO")
    explanation = `This location scores ${overall}/100 — data signals indicate reasonable site potential. ${highlights[0] ?? "Review the full breakdown below."}`;
  else if (verdict === "CAUTION")
    explanation = `This location scores ${overall}/100 — mixed signals require careful evaluation before committing capital. ${risks[0] ?? "Review the risk factors below."}`;
  else
    explanation = `This location scores ${overall}/100 — current data signals present significant challenges for a car wash operation. ${risks[0] ?? "Consider alternative locations with higher corridor traffic."}`;

  const siteFundamentals = buildSiteFundamentals(aadt, competitors, trafficSignals, trafficFlow, census);

  return { overall, grade, verdict, verdictColor, components, siteFundamentals, explanation, highlights, risks };
}

// ─── Review insights aggregation ─────────────────────────────────────────────
export function buildReviewInsights(competitors: CompetitorAnalysis[]): ReviewInsights {
  const totalReviewsAnalyzed  = competitors.reduce((s, c) => s + (c.place.reviews?.length ?? 0), 0);
  const avgRating             = competitors.length > 0
    ? competitors.reduce((s, c) => s + (c.place.rating ?? 0), 0) / competitors.length
    : 0;

  const complaintMap = new Map<string, ComplaintCategory>();
  competitors.forEach((c) => {
    c.sentiment.topComplaints.forEach((complaint) => {
      const existing = complaintMap.get(complaint.category);
      if (existing) existing.count += complaint.count;
      else complaintMap.set(complaint.category, { ...complaint });
    });
  });

  const dominantComplaints = Array.from(complaintMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const missingServices: string[] = [];
  if (!competitors.some((c) => (c.place.types ?? []).includes("car_detailing")))
    missingServices.push("Professional Interior Detailing");
  if (dominantComplaints.some((c) => c.category === "Vacuums & Amenities"))
    missingServices.push("Free Self-Service Vacuums");
  if (dominantComplaints.some((c) => c.category === "Limited Hours"))
    missingServices.push("Extended Operating Hours");
  if (dominantComplaints.some((c) => c.category === "Overpriced"))
    missingServices.push("Competitive Membership Pricing");
  if (dominantComplaints.some((c) => c.category === "Vehicle Damage"))
    missingServices.push("Touchless / Soft-Brush Option");

  const weightedSaturation = competitors.reduce((total, c) => {
    const d = c.distanceMiles;
    const proximityWeight = d < 0.5 ? 3.0 : d < 1.0 ? 2.0 : d < 2.0 ? 1.2 : d < 3.5 ? 0.7 : 0.3;
    const ratingStrength  = (c.place.rating ?? 3.0) / 5.0;
    const reviewAuthority = Math.min((c.place.user_ratings_total ?? 0) / 500, 1.0);
    const strengthNorm    = c.strengthScore / 100;
    return total + proximityWeight * (ratingStrength * 0.5 + reviewAuthority * 0.25 + strengthNorm * 0.25);
  }, 0);

  const marketSaturationLevel: "LOW" | "MEDIUM" | "HIGH" =
    weightedSaturation < 2.5 ? "LOW" : weightedSaturation < 5.5 ? "MEDIUM" : "HIGH";

  const premiumOpportunity  = avgRating < 3.8 || dominantComplaints.length >= 3;
  const unlimitedPlanDemand = competitors.some(c => (c.place.user_ratings_total ?? 0) > 200)
    || dominantComplaints.some((c) => c.category === "Overpriced");

  // Market gap score: how underserved is this market?
  // High score = strong gap = opportunity. Low score = already well-served.
  const competitorsWithMembership = competitors.filter((c) => c.hasMembership === true).length;
  const totalCompetitors = competitors.length;

  let marketGapScore = 50; // neutral baseline
  if (totalCompetitors === 0) marketGapScore = 90;           // no competition = large gap
  else if (marketSaturationLevel === "LOW") marketGapScore = 75;
  else if (marketSaturationLevel === "MEDIUM") marketGapScore = 50;
  else marketGapScore = 25;

  if (dominantComplaints.length >= 3) marketGapScore += 15;  // lots of complaints = gap
  if (avgRating < 3.8 && totalCompetitors > 0) marketGapScore += 10; // poor quality = gap
  if (competitorsWithMembership === 0 && totalCompetitors > 0) marketGapScore += 10; // no membership = gap
  marketGapScore = Math.min(100, marketGapScore);

  return {
    totalReviewsAnalyzed,
    avgCompetitorRating: parseFloat(avgRating.toFixed(1)),
    marketSaturationLevel,
    dominantComplaints,
    missingServices,
    premiumOpportunity,
    unlimitedPlanDemand,
    marketGapScore,
    competitorsWithMembership,
  };
}

// ─── Recommendations builder ──────────────────────────────────────────────────
export function buildRecommendations(
  score: LocationScore,
  insights: ReviewInsights
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (score.verdict === "GO" || score.verdict === "CAUTION") {
    recs.push({
      priority: "CRITICAL",
      category: "Business Model",
      title: "Evaluate Express Tunnel with Monthly Membership Structure",
      description:
        "Industry data suggests express tunnels with monthly unlimited plans tend to produce more stable revenue than pay-per-wash models. A membership program starting around $19–$39/month is commonly used by operators to build recurring revenue. This is worth modeling in your pro forma.",
      icon: "🔑",
    });
  }

  if (insights.dominantComplaints.length > 0) {
    const topComplaint = insights.dominantComplaints[0];
    recs.push({
      priority: "HIGH",
      category: "Market Positioning",
      title: `Competitor Weakness to Investigate: ${topComplaint.category}`,
      description: topComplaint.opportunity,
      icon: topComplaint.emoji,
    });
  }

  if (score.components.traffic < 50) {
    recs.push({
      priority: "HIGH",
      category: "Marketing",
      title: "Below-Benchmark Traffic Requires a Destination Marketing Strategy",
      description: `With corridor traffic below the ${TRAFFIC_BENCHMARKS.expressTargetAADT.toLocaleString()} AADT target, this location would need to draw customers from a wider trade area. Budget for sustained digital marketing, local partnerships, and community outreach.`,
      icon: "📢",
    });
  }

  if (insights.marketGapScore >= 70) {
    recs.push({
      priority: "HIGH",
      category: "Market Opportunity",
      title: "Market Gap Detected — High Opportunity Score",
      description: `Market gap score is ${insights.marketGapScore}/100 — competitors show quality gaps, low service levels, or no membership programs. This is a meaningful opportunity signal worth investigating on-site.`,
      icon: "🎯",
    });
  }

  if (insights.competitorsWithMembership === 0 && insights.totalReviewsAnalyzed > 0) {
    recs.push({
      priority: "MEDIUM",
      category: "Competitive Advantage",
      title: "No Competitors Detected With a Membership Program",
      description: "None of the nearby car washes appear to offer a monthly unlimited membership plan. Launching with a membership-first model could immediately differentiate your site and build recurring revenue from day one.",
      icon: "🏆",
    });
  }

  if (insights.premiumOpportunity) {
    recs.push({
      priority: "MEDIUM",
      category: "Positioning",
      title: "Competitors Show Quality Gaps Worth Studying",
      description:
        "Review data indicates existing operators have service quality issues. Whether positioning as a premium alternative is viable depends on your cost structure and local price sensitivity — this warrants further research.",
      icon: "💎",
    });
  }

  recs.push({
    priority: "MEDIUM",
    category: "Operations",
    title: "Research License Plate Recognition Technology",
    description:
      "Many operators report that LPR-based membership systems reduce lane time and improve customer experience. The technology has become more accessible — evaluate whether it fits your operational model.",
    icon: "📷",
  });

  if (score.components.competition >= 60 && score.components.traffic >= 40) {
    recs.push({
      priority: "LOW",
      category: "Long-Term Strategy",
      title: "Low Competition in a Viable Market May Support Multi-Site Planning",
      description:
        "Sites with limited competition and adequate traffic can be attractive to multi-unit operators. If this site performs, establishing a second location before competition enters the trade area is worth discussing with a financial advisor.",
      icon: "🏗️",
    });
  }

  recs.push({
    priority: "LOW",
    category: "Due Diligence",
    title: "Engage a Car Wash Consultant Before Committing Capital",
    description:
      "This tool provides data-driven signals to inform your research — it does not replace a site visit, a qualified consultant, legal review, or a full pro forma. Consider engaging a licensed car wash industry consultant and a commercial real estate attorney before finalizing a decision.",
    icon: "📋",
  });

  return recs;
}
