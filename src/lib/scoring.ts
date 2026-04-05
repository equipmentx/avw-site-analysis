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
    opportunity: "Install express tunnel technology with 45-second wash cycles and pre-sale kiosks to eliminate queues.",
  },
  {
    category: "Poor Cleaning Quality",
    keywords: ["dirty", "still dirty", "not clean", "missed spots", "didn't clean", "bug", "dirt left", "streaks"],
    emoji: "🚗",
    opportunity: "Invest in multi-stage foam application and triple-rinse technology to guarantee spotless results.",
  },
  {
    category: "Vehicle Damage",
    keywords: ["scratch", "damage", "dent", "broken", "mirror", "antenna", "chipped", "scraped"],
    emoji: "🛠️",
    opportunity: "Use soft-touch brushless equipment with damage guarantee — market this prominently.",
  },
  {
    category: "Poor Customer Service",
    keywords: ["rude", "unprofessional", "staff", "service", "attitude", "helpful", "ignored", "unhelpful"],
    emoji: "👥",
    opportunity: "Hire trained service attendants and implement a customer satisfaction guarantee with refund policy.",
  },
  {
    category: "Overpriced",
    keywords: ["expensive", "overpriced", "too much", "not worth", "cheap", "price", "cost", "value"],
    emoji: "💰",
    opportunity: "Launch a tiered membership plan starting at $9.99/month — market as best value in the area.",
  },
  {
    category: "Outdated Equipment",
    keywords: ["broken", "machine", "equipment", "out of service", "old", "outdated", "doesn't work"],
    emoji: "⚙️",
    opportunity: "Brand new state-of-the-art tunnel system with 99%+ uptime guarantee and real-time monitoring.",
  },
  {
    category: "Vacuums & Amenities",
    keywords: ["vacuum", "vending", "no vacuum", "free vacuum", "interiors", "inside", "mat"],
    emoji: "✨",
    opportunity: "Offer complimentary high-powered vacuums, fragrance stations, and detailing bays as differentiators.",
  },
  {
    category: "Limited Hours",
    keywords: ["closed", "hours", "early", "late", "open", "Sunday", "holiday", "weekend"],
    emoji: "🕐",
    opportunity: "Operate 7 days/week with extended 6am–9pm hours and holiday availability.",
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
  const R = 3958.8; // Earth radius in miles
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
        matches.forEach((m) => {
          if (!matchedKeywords.includes(m)) matchedKeywords.push(m);
        });
        if (!negatives.includes(group.category)) negatives.push(group.category);
      }
    });

    if (count > 0) {
      topComplaints.push({
        category: group.category,
        count,
        keywords: matchedKeywords.slice(0, 3),
        emoji: group.emoji,
        opportunity: group.opportunity,
      });
    }
  });

  topComplaints.sort((a, b) => b.count - a.count);

  const opportunities = topComplaints.map((c) => c.opportunity);

  return { positives, negatives, topComplaints, opportunities };
}

// ─── Competitor threat analysis ───────────────────────────────────────────────
export function analyzeCompetitor(
  place: PlaceResult,
  distanceMiles: number
): CompetitorAnalysis {
  const reviews = place.reviews ?? [];
  const sentiment = analyzeReviews(reviews);
  const rating = place.rating ?? 0;
  const reviewCount = place.user_ratings_total ?? 0;

  // Strength score: higher rating + more reviews = stronger competitor
  const ratingScore  = (rating / 5) * 60;
  const volumeScore  = Math.min(reviewCount / 500, 1) * 40;
  const strengthScore = Math.round(ratingScore + volumeScore);

  // Threat: based on proximity + strength
  let threatLevel: "LOW" | "MEDIUM" | "HIGH";
  if (distanceMiles < 0.5 && strengthScore > 70) threatLevel = "HIGH";
  else if (distanceMiles < 1.5 && strengthScore > 50) threatLevel = "MEDIUM";
  else threatLevel = "LOW";

  return { place, distanceMiles, sentiment, strengthScore, threatLevel };
}

// ─── Traffic signal scoring ───────────────────────────────────────────────────
export function scoreTrafficSignals(signals: TrafficSignals): number {
  const weights = {
    gasStations:   0.20,
    grocery:       0.20,
    fastFood:      0.15,
    shopping:      0.20,
    schools:       0.10,
    trafficDensity: 0.15,
  };

  const normalize = (val: number, max: number) => Math.min(val / max, 1);

  const score =
    normalize(signals.nearbyGasStations,   8) * weights.gasStations   * 100 +
    normalize(signals.nearbyGroceryStores,  6) * weights.grocery       * 100 +
    normalize(signals.nearbyFastFood,       10) * weights.fastFood      * 100 +
    normalize(signals.nearbyShopping,        8) * weights.shopping      * 100 +
    normalize(signals.nearbySchools,         5) * weights.schools       * 100 +
    normalize(signals.estimatedDailyTraffic, 20000) * weights.trafficDensity * 100;

  return Math.min(Math.round(score), 100);
}

// ─── Main location scoring ────────────────────────────────────────────────────
export function calculateLocationScore(
  competitors: CompetitorAnalysis[],
  trafficSignals: TrafficSignals,
  financialViable: boolean
): LocationScore {
  const nearbyCount = competitors.length;
  const avgRating =
    nearbyCount > 0
      ? competitors.reduce((s, c) => s + (c.place.rating ?? 0), 0) / nearbyCount
      : 0;

  // ── Traffic Score ──────────────────────────────────────────────────────────
  const trafficScore = scoreTrafficSignals(trafficSignals);

  // ── Competition Score (higher = less competition = better for new entrant) ─
  let competitionScore: number;
  const within1Mile = competitors.filter((c) => c.distanceMiles <= 1).length;
  const within3Miles = competitors.filter((c) => c.distanceMiles <= 3).length;

  if (within1Mile === 0 && within3Miles <= 1)       competitionScore = 95;
  else if (within1Mile === 0 && within3Miles <= 3)  competitionScore = 80;
  else if (within1Mile === 1 && within3Miles <= 4)  competitionScore = 65;
  else if (within1Mile <= 2 && within3Miles <= 6)   competitionScore = 50;
  else if (within1Mile <= 3)                         competitionScore = 35;
  else                                               competitionScore = 20;

  // ── Opportunity Score (complaints = opportunity) ──────────────────────────
  const totalComplaints = competitors.reduce(
    (sum, c) => sum + c.sentiment.topComplaints.length, 0
  );
  const lowRatedCount = competitors.filter(
    (c) => (c.place.rating ?? 5) < 3.5
  ).length;

  let opportunityScore = 50;
  opportunityScore += Math.min(totalComplaints * 5, 30);
  opportunityScore += lowRatedCount * 10;
  if (avgRating > 0 && avgRating < 3.8) opportunityScore += 15;
  opportunityScore = Math.min(opportunityScore, 100);

  // ── Market Score ──────────────────────────────────────────────────────────
  const marketScore = Math.min(
    trafficSignals.nearbyGasStations * 8 +
    trafficSignals.nearbyGroceryStores * 10 +
    trafficSignals.nearbyFastFood * 5 +
    trafficSignals.nearbyShopping * 8,
    100
  );

  // ── Financial Score ────────────────────────────────────────────────────────
  const financialScore = financialViable ? 75 : 40;

  // ── Weighted Overall ──────────────────────────────────────────────────────
  const components = {
    traffic:     trafficScore,
    competition: competitionScore,
    opportunity: opportunityScore,
    market:      marketScore,
    financial:   financialScore,
  };

  const overall = Math.round(
    components.traffic     * 0.25 +
    components.competition * 0.25 +
    components.opportunity * 0.20 +
    components.market      * 0.15 +
    components.financial   * 0.15
  );

  // ── Grade & Verdict ───────────────────────────────────────────────────────
  let grade: "A" | "B" | "C" | "D" | "F";
  let verdict: "GO" | "CAUTION" | "NO-GO";
  let verdictColor: string;

  if (overall >= 80)      { grade = "A"; verdict = "GO";      verdictColor = "#10b981"; }
  else if (overall >= 65) { grade = "B"; verdict = "GO";      verdictColor = "#10b981"; }
  else if (overall >= 50) { grade = "C"; verdict = "CAUTION"; verdictColor = "#f59e0b"; }
  else if (overall >= 35) { grade = "D"; verdict = "CAUTION"; verdictColor = "#f97316"; }
  else                    { grade = "F"; verdict = "NO-GO";   verdictColor = "#ef4444"; }

  // ── Build explanation ─────────────────────────────────────────────────────
  const highlights: string[] = [];
  const risks: string[] = [];

  if (trafficScore >= 70)     highlights.push("High daily traffic volume detected in this area");
  if (competitionScore >= 70) highlights.push("Low car wash competition — strong first-mover advantage");
  if (opportunityScore >= 70) highlights.push("Existing competitors have notable service gaps to exploit");
  if (lowRatedCount > 0)      highlights.push(`${lowRatedCount} competitor(s) rated below 3.5 ★ — ripe for disruption`);
  if (marketScore >= 60)      highlights.push("Dense commercial activity signals strong repeat customer pool");

  if (trafficScore < 40)      risks.push("Lower traffic area — aggressive marketing will be essential");
  if (within1Mile >= 2)       risks.push(`${within1Mile} car washes within 1 mile — differentiation is critical`);
  if (avgRating > 4.3 && nearbyCount > 2) risks.push("Competitors have high ratings — you must match or exceed quality");
  if (!financialViable)       risks.push("Estimated traffic may yield thin margins — budget carefully");
  if (trafficSignals.nearbyGasStations < 2) risks.push("Limited highway/gas station proximity — consider signage investment");

  let explanation = "";
  if (verdict === "GO")
    explanation = `This location scores ${overall}/100 and shows strong investment potential. ${highlights[0] ?? "Multiple positive signals detected."}`;
  else if (verdict === "CAUTION")
    explanation = `This location scores ${overall}/100. Opportunity exists but requires strategic positioning. ${risks[0] ?? "Review the risk factors below."}`;
  else
    explanation = `This location scores ${overall}/100 and presents significant challenges. ${risks[0] ?? "Consider alternative locations."}`;

  return { overall, grade, verdict, verdictColor, components, explanation, highlights, risks };
}

// ─── Review insights aggregation ─────────────────────────────────────────────
export function buildReviewInsights(competitors: CompetitorAnalysis[]): ReviewInsights {
  const totalReviews = competitors.reduce(
    (s, c) => s + (c.place.user_ratings_total ?? 0), 0
  );
  const totalReviewsAnalyzed = competitors.reduce(
    (s, c) => s + (c.place.reviews?.length ?? 0), 0
  );
  const avgRating =
    competitors.length > 0
      ? competitors.reduce((s, c) => s + (c.place.rating ?? 0), 0) / competitors.length
      : 0;

  // Aggregate all complaints
  const complaintMap = new Map<string, ComplaintCategory>();
  competitors.forEach((c) => {
    c.sentiment.topComplaints.forEach((complaint) => {
      const existing = complaintMap.get(complaint.category);
      if (existing) {
        existing.count += complaint.count;
      } else {
        complaintMap.set(complaint.category, { ...complaint });
      }
    });
  });

  const dominantComplaints = Array.from(complaintMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Missing services
  const missingServices: string[] = [];
  if (!competitors.some((c) => (c.place.types ?? []).includes("car_detailing")))
    missingServices.push("Professional Interior Detailing");
  if (dominantComplaints.some((c) => c.category === "Vacuums & Amenities"))
    missingServices.push("Free Self-Service Vacuums");
  if (dominantComplaints.some((c) => c.category === "Limited Hours"))
    missingServices.push("Extended Operating Hours (6am–9pm)");
  if (dominantComplaints.some((c) => c.category === "Overpriced"))
    missingServices.push("Competitive Monthly Unlimited Plan");
  if (dominantComplaints.some((c) => c.category === "Vehicle Damage"))
    missingServices.push("Touchless / Soft-Brush Wash Option");

  // ── Weighted saturation score ────────────────────────────────────────────
  // Counts alone are misleading — a single 4.8★ competitor 0.3 miles away
  // saturates the market more than 5 mediocre ones at 4+ miles.
  // Score each competitor by: strength × proximity weight × review authority.
  // Proximity weights: <0.5mi=3.0, 0.5–1mi=2.0, 1–2mi=1.2, 2–3.5mi=0.7, >3.5mi=0.3
  const weightedSaturation = competitors.reduce((total, c) => {
    const d = c.distanceMiles;
    const proximityWeight = d < 0.5 ? 3.0 : d < 1.0 ? 2.0 : d < 2.0 ? 1.2 : d < 3.5 ? 0.7 : 0.3;
    const ratingStrength  = (c.place.rating ?? 3.0) / 5.0;           // 0–1
    const reviewAuthority = Math.min((c.place.user_ratings_total ?? 0) / 500, 1.0); // 0–1, caps at 500 reviews
    const strengthNorm    = c.strengthScore / 100;                    // 0–1
    return total + proximityWeight * (ratingStrength * 0.5 + reviewAuthority * 0.25 + strengthNorm * 0.25);
  }, 0);

  // Scale: 0–2.5 = LOW, 2.5–5.5 = MEDIUM, 5.5+ = HIGH
  const marketSaturationLevel: "LOW" | "MEDIUM" | "HIGH" =
    weightedSaturation < 2.5 ? "LOW" : weightedSaturation < 5.5 ? "MEDIUM" : "HIGH";

  const premiumOpportunity = avgRating < 3.8 || dominantComplaints.length >= 3;
  const unlimitedPlanDemand =
    totalReviews > 200 ||
    dominantComplaints.some((c) => c.category === "Overpriced");

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
      title: "Launch with Express Tunnel + Unlimited Membership",
      description:
        "Lead with a monthly unlimited wash plan ($19.99–$39.99/mo). Recurring subscription revenue stabilizes cash flow and outcompetes pay-per-wash competitors. Target 1,000 subscribers by end of Year 1.",
      icon: "🔑",
    });
  }

  if (insights.dominantComplaints.length > 0) {
    const topComplaint = insights.dominantComplaints[0];
    recs.push({
      priority: "HIGH",
      category: "Competitive Edge",
      title: `Fix What Competitors Can't: ${topComplaint.category}`,
      description: topComplaint.opportunity,
      icon: topComplaint.emoji,
    });
  }

  if (insights.missingServices.includes("Free Self-Service Vacuums")) {
    recs.push({
      priority: "HIGH",
      category: "Amenities",
      title: "Install Free High-Power Vacuums",
      description:
        "Customers consistently complain about dirty interiors. Free vacuums drive dwell time, secondary purchases, and positive reviews. It's the #1 differentiator for new car washes.",
      icon: "✨",
    });
  }

  if (score.components.traffic < 50) {
    recs.push({
      priority: "HIGH",
      category: "Marketing",
      title: "Invest Heavily in Digital & Local Marketing",
      description:
        "Lower traffic area requires aggressive acquisition. Allocate $5,000/month for Google Ads, local SEO, and social media. Partner with nearby dealerships for detailing contracts.",
      icon: "📢",
    });
  }

  if (insights.premiumOpportunity) {
    recs.push({
      priority: "MEDIUM",
      category: "Pricing Strategy",
      title: "Position as the Premium Alternative",
      description:
        "Existing competitors are underperforming in quality. Price at or above market rate and deliver demonstrably superior results. Premium positioning protects margin and attracts loyal clientele.",
      icon: "💎",
    });
  }

  recs.push({
    priority: "MEDIUM",
    category: "Technology",
    title: "Use License Plate Recognition for Memberships",
    description:
      "Modern LPR systems eliminate membership cards, cut lane time to under 30 seconds, and reduce fraud. Customers love the frictionless experience — a key 5-star review driver.",
    icon: "📷",
  });

  if (score.components.competition >= 70) {
    recs.push({
      priority: "LOW",
      category: "Expansion",
      title: "Capture the Market Early — Expand to Second Location",
      description:
        "Low competition means first-mover advantage. Profitable operators in low-saturation markets typically open a second location by Year 3 to lock out future competitors.",
      icon: "🏗️",
    });
  }

  return recs;
}
