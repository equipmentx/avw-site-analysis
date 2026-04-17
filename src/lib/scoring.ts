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
} from "./types";

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
  estimatedVolume: import("./types").EstimatedVolume
): CompetitorAnalysis {
  const reviews    = place.reviews ?? [];
  const sentiment  = analyzeReviews(reviews);
  const rating     = place.rating ?? 0;
  const reviewCount = place.user_ratings_total ?? 0;
  const ratingScore = (rating / 5) * 60;
  const volumeScore = Math.min(reviewCount / 500, 1) * 40;
  const strengthScore = Math.round(ratingScore + volumeScore);
  let threatLevel: "LOW" | "MEDIUM" | "HIGH";
  if (distanceMiles < 0.5 && strengthScore > 70)       threatLevel = "HIGH";
  else if (distanceMiles < 1.5 && strengthScore > 50)  threatLevel = "MEDIUM";
  else                                                  threatLevel = "LOW";
  return { place, distanceMiles, sentiment, strengthScore, threatLevel, estimatedVolume };
}

// ─── Traffic signal scoring ───────────────────────────────────────────────────
// This is used for the sub-component display only.
// The main scoring uses AADT directly.
export function scoreTrafficSignals(signals: TrafficSignals): number {
  const weights = { gasStations: 0.20, grocery: 0.20, fastFood: 0.15, shopping: 0.20, schools: 0.10, trafficDensity: 0.15 };
  const normalize = (val: number, max: number) => Math.min(val / max, 1);
  const score =
    normalize(signals.nearbyGasStations,   8)  * weights.gasStations   * 100 +
    normalize(signals.nearbyGroceryStores,  6)  * weights.grocery       * 100 +
    normalize(signals.nearbyFastFood,       10) * weights.fastFood      * 100 +
    normalize(signals.nearbyShopping,        8) * weights.shopping      * 100 +
    normalize(signals.nearbySchools,         5) * weights.schools       * 100 +
    normalize(signals.estimatedDailyTraffic, 25000) * weights.trafficDensity * 100;
  return Math.min(Math.round(score), 100);
}

// ─── AADT-based traffic score — aligned with ICA 25,000 AADT benchmark ──────
// ICA / industry methodology: target is 25,000 bi-directional AADT.
// Below 5,000 = destination location (viable only with aggressive marketing).
// Below 2,000 = very marginal for any car wash format.
function aadtToTrafficScore(aadt: number): number {
  if (aadt >= 25_000) return 100;
  if (aadt >= 18_000) return Math.round(80 + ((aadt - 18_000) / 7_000) * 20);  // 80-100
  if (aadt >= 10_000) return Math.round(60 + ((aadt - 10_000) / 8_000) * 20);  // 60-80
  if (aadt >= 5_000)  return Math.round(40 + ((aadt - 5_000)  / 5_000) * 20);  // 40-60
  if (aadt >= 2_000)  return Math.round(20 + ((aadt - 2_000)  / 3_000) * 20);  // 20-40
  return Math.max(5, Math.round((aadt / 2_000) * 20));                          // 0-20
}

// ─── Commercial density — proxy for impulse-buy environment ──────────────────
// ICA site selection looks at area profile (shopping, business, residential, industrial).
// We approximate this with Google Places commercial anchor counts.
function commercialDensityScore(signals: TrafficSignals): number {
  const total = signals.nearbyGasStations + signals.nearbyGroceryStores +
                signals.nearbyFastFood + signals.nearbyShopping;
  if (total === 0) return 0;        // wilderness / off-grid
  if (total <= 2)  return 20;       // very sparse
  if (total <= 5)  return 40;
  if (total <= 10) return 60;
  if (total <= 20) return 80;
  return 100;
}

// ─── Main location scoring ────────────────────────────────────────────────────
export function calculateLocationScore(
  competitors: CompetitorAnalysis[],
  trafficSignals: TrafficSignals,
  financialViable: boolean
): LocationScore {
  const nearbyCount = competitors.length;
  const avgRating   = nearbyCount > 0
    ? competitors.reduce((s, c) => s + (c.place.rating ?? 0), 0) / nearbyCount
    : 0;

  const aadt = trafficSignals.estimatedDailyTraffic;

  // ── Traffic Score (AADT-based, ICA benchmark) ────────────────────────────
  const trafficScore = aadtToTrafficScore(aadt);

  // ── Commercial Density Score ──────────────────────────────────────────────
  const densityScore = commercialDensityScore(trafficSignals);

  // ── Market Viability Index ────────────────────────────────────────────────
  // Key fix: prevents "middle of nowhere with no competitors" from scoring well.
  // Low traffic + low density = the absence of competition means absence of market.
  //
  // Key insight: "first-mover advantage" only applies when there IS a market
  // (vehicles in the trade area + commercial activity). When both are near-zero,
  // the site is simply not viable regardless of competition.
  const marketViabilityIndex = Math.min(
    (trafficScore / 100) * 0.55 + (densityScore / 100) * 0.45,
    1.0
  );

  // ── Competition Score ─────────────────────────────────────────────────────
  // Base competition score from proximity.
  // Key fix: competition value is discounted in no-market areas.
  // "No competition near a lake" != "first-mover advantage in a viable market."
  const within1Mile  = competitors.filter((c) => c.distanceMiles <= 1).length;
  const within3Miles = competitors.filter((c) => c.distanceMiles <= 3).length;

  let rawCompetitionScore: number;
  if (within1Mile === 0 && within3Miles === 0)      rawCompetitionScore = 95;
  else if (within1Mile === 0 && within3Miles <= 1)  rawCompetitionScore = 85;
  else if (within1Mile === 0 && within3Miles <= 3)  rawCompetitionScore = 72;
  else if (within1Mile === 1 && within3Miles <= 4)  rawCompetitionScore = 58;
  else if (within1Mile <= 2 && within3Miles <= 6)   rawCompetitionScore = 45;
  else if (within1Mile <= 3)                        rawCompetitionScore = 30;
  else                                              rawCompetitionScore = 18;

  // Discount competition score by market viability.
  // A first-mover advantage in a viable market (high market viability) = full credit.
  // First-mover in a no-traffic / no-density area = significantly discounted.
  // Formula: blend raw score with market-viability-adjusted floor.
  const marketViabilityDiscount = 0.35 + (marketViabilityIndex * 0.65);
  const competitionScore = Math.round(rawCompetitionScore * marketViabilityDiscount);

  // ── Opportunity Score ─────────────────────────────────────────────────────
  // Key fix: remove the free 50-point base.
  // Opportunity requires actual market evidence — complaints, low ratings, gaps.
  // A rural area with zero competitors has ZERO complaint data = low opportunity score.
  const totalComplaints = competitors.reduce((sum, c) => sum + c.sentiment.topComplaints.length, 0);
  const lowRatedCount   = competitors.filter((c) => (c.place.rating ?? 5) < 3.5).length;

  // Base starts at 25 only if there is evidence of an underserved market
  const hasMarketEvidence = nearbyCount > 0 || aadt > 5_000;
  let opportunityScore = hasMarketEvidence ? 30 : 15;
  opportunityScore += Math.min(totalComplaints * 5, 25);
  opportunityScore += lowRatedCount * 8;
  if (avgRating > 0 && avgRating < 3.8) opportunityScore += 12;
  // Market size bonus: more vehicles = more opportunity
  if (aadt > 15_000) opportunityScore += 10;
  if (aadt > 25_000) opportunityScore += 8;
  opportunityScore = Math.min(opportunityScore, 100);

  // ── Market Score (commercial density for impulse-buy environment) ─────────
  const marketScore = densityScore;

  // ── Financial Score ───────────────────────────────────────────────────────
  const financialScore = financialViable ? 72 : 35;

  // ── Weighted Overall ──────────────────────────────────────────────────────
  // Weights aligned with ICA emphasis: traffic is the primary variable,
  // competition structure is secondary.
  const components = {
    traffic:     trafficScore,
    competition: competitionScore,
    opportunity: opportunityScore,
    market:      marketScore,
    financial:   financialScore,
  };

  let overall = Math.round(
    components.traffic     * 0.30 +   // ICA: traffic count is the #1 factor
    components.competition * 0.25 +
    components.opportunity * 0.20 +
    components.market      * 0.15 +
    components.financial   * 0.10
  );

  // ── Hard floor: very low AADT cannot be saved by other factors ────────────
  // Industry standard: sites below 5,000 AADT are "destination locations" requiring
  // aggressive marketing — not viable as pure impulse-buy sites.
  // Below 2,000 AADT: marginal viability regardless of other factors.
  if (aadt < 2_000)  overall = Math.min(overall, 42);
  else if (aadt < 5_000)  overall = Math.min(overall, 62);
  else if (aadt < 8_000)  overall = Math.min(overall, 74);

  // ── Grade & Verdict ───────────────────────────────────────────────────────
  let grade: "A" | "B" | "C" | "D" | "F";
  let verdict: "GO" | "CAUTION" | "NO-GO";
  let verdictColor: string;

  if (overall >= 78)      { grade = "A"; verdict = "GO";      verdictColor = "#10b981"; }
  else if (overall >= 63) { grade = "B"; verdict = "GO";      verdictColor = "#10b981"; }
  else if (overall >= 48) { grade = "C"; verdict = "CAUTION"; verdictColor = "#f59e0b"; }
  else if (overall >= 33) { grade = "D"; verdict = "CAUTION"; verdictColor = "#f97316"; }
  else                    { grade = "F"; verdict = "NO-GO";   verdictColor = "#ef4444"; }

  // ── Build explanation ─────────────────────────────────────────────────────
  const highlights: string[] = [];
  const risks: string[] = [];

  if (aadt >= 25_000)          highlights.push(`Strong corridor traffic — ${aadt.toLocaleString()} vehicles/day meets the 25,000 AADT industry benchmark`);
  else if (aadt >= 10_000)     highlights.push(`Moderate corridor traffic of ${aadt.toLocaleString()} vehicles/day — below 25,000 AADT target but operational`);
  if (rawCompetitionScore >= 85 && marketViabilityIndex > 0.4)
                               highlights.push("No conveyorized competition in the immediate area — potential first-mover advantage");
  if (totalComplaints > 0)     highlights.push(`${totalComplaints} complaint categories detected across ${nearbyCount} competitor(s) — potential service gaps to study`);
  if (lowRatedCount > 0)       highlights.push(`${lowRatedCount} competitor(s) rated below 3.5 ★ — service quality appears to be an issue in this market`);
  if (densityScore >= 60)      highlights.push("Commercial anchors nearby suggest impulse-purchase traffic patterns");

  if (aadt < 5_000)            risks.push(`Corridor AADT of ~${aadt.toLocaleString()} is well below the 25,000 industry benchmark — this site would function as a destination location, requiring sustained marketing investment`);
  else if (aadt < 10_000)      risks.push(`AADT of ~${aadt.toLocaleString()} is below target — below-benchmark traffic requires membership-driven revenue strategy`);
  if (within1Mile >= 2)        risks.push(`${within1Mile} car washes within 1 mile — meaningful differentiation will be required`);
  if (avgRating > 4.3 && nearbyCount > 2) risks.push("Existing competitors are well-rated — new entrant must match or exceed quality to capture share");
  if (!financialViable)        risks.push("Projected traffic may yield thin operating margins under current assumptions — verify with detailed pro forma");
  if (densityScore < 20 && aadt < 8_000) risks.push("Low commercial density and below-benchmark traffic suggest limited impulse-buy potential");
  if (aadt < 2_000)            risks.push("Very low corridor traffic — a car wash at this location would likely function primarily as a destination business serving a small captive area");

  let explanation = "";
  if (verdict === "GO")
    explanation = `This location scores ${overall}/100 — data signals indicate reasonable site potential. ${highlights[0] ?? "Review the full breakdown below."}`;
  else if (verdict === "CAUTION")
    explanation = `This location scores ${overall}/100 — mixed signals require careful evaluation before committing capital. ${risks[0] ?? "Review the risk factors below."}`;
  else
    explanation = `This location scores ${overall}/100 — current data signals present significant challenges for a car wash operation. ${risks[0] ?? "Consider alternative locations with higher corridor traffic."}`;

  return { overall, grade, verdict, verdictColor, components, explanation, highlights, risks };
}

// ─── Review insights aggregation ─────────────────────────────────────────────
export function buildReviewInsights(competitors: CompetitorAnalysis[]): ReviewInsights {
  const totalReviews          = competitors.reduce((s, c) => s + (c.place.user_ratings_total ?? 0), 0);
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
  const unlimitedPlanDemand = totalReviews > 200 || dominantComplaints.some((c) => c.category === "Overpriced");

  return {
    totalReviewsAnalyzed,
    avgCompetitorRating: parseFloat(avgRating.toFixed(1)),
    marketSaturationLevel,
    dominantComplaints,
    missingServices,
    premiumOpportunity,
    unlimitedPlanDemand,
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
      description:
        "With corridor traffic below the 25,000 AADT target, this location would need to draw customers from a wider trade area. Budget for sustained digital marketing, local partnerships, and community outreach. Consider consulting with a car wash operator experienced in destination-model sites.",
      icon: "📢",
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
