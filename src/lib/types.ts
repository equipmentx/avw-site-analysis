export interface PlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  formatted_address?: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: { open_now?: boolean };
  photos?: Array<{ photo_reference: string }>;
  reviews?: PlaceReview[];
  business_status?: string;
  types?: string[];
  distance_meters?: number;
}

export interface PlaceReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

export interface ReviewSentiment {
  positives: string[];
  negatives: string[];
  topComplaints: ComplaintCategory[];
  opportunities: string[];
}

export interface ComplaintCategory {
  category: string;
  count: number;
  keywords: string[];
  emoji: string;
  opportunity: string;
}

export interface CompetitorAnalysis {
  place: PlaceResult;
  distanceMiles: number;
  sentiment: ReviewSentiment;
  strengthScore: number;
  threatLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface TrafficSignals {
  nearbyGasStations: number;
  nearbyGroceryStores: number;
  nearbyFastFood: number;
  nearbyShopping: number;
  nearbySchools: number;
  estimatedDailyTraffic: number;
  trafficScore: number;
  trafficEstimationMethod?: string;
}

export interface LocationScore {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  verdict: "GO" | "CAUTION" | "NO-GO";
  verdictColor: string;
  components: {
    traffic: number;
    competition: number;
    opportunity: number;
    market: number;
    financial: number;
  };
  explanation: string;
  highlights: string[];
  risks: string[];
}

export interface FinancialProjection {
  totalProjectCost: number;
  downPayment: number;
  loanAmount: number;
  monthlyDebtService: number;
  year1Revenue: number;
  year1EBITDA: number;
  year1NetIncome: number;
  year3Revenue: number;
  year5Revenue: number;
  paybackYears: number;
  irr5Year: number;
  breakEvenMonthlyRevenue: number;
  projections: YearlyProjection[];
  assumptions: FinancialAssumptions;
}

export interface YearlyProjection {
  year: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  sgna: number;
  ebitda: number;
  netIncome: number;
  cars: number;
  margin: number;
}

export interface FinancialAssumptions {
  dailyTrafficCount: number;
  captureRate: number;
  dailyCarsWashed: number;
  avgRevenuePerCar: number;
  totalCapex: number;
  landCost: number;
  equipmentCost: number;
  constructionCost: number;
  interestRate: number;
  loanTermYears: number;
}

export interface InvestmentSuggestion {
  minEstimateUSD: number;
  maxEstimateUSD: number;
  cityTier: string;
  countryCode: string;
  countryName: string;
  breakdown: {
    land:         { min: number; max: number };
    construction: { min: number; max: number };
    equipment:    { min: number; max: number };
    fees:         { min: number; max: number };
  };
  rationale: string;
  marketContext: string;
  dataTimestamp: string;
  sourceNote: string;
  methodology?: string;
}

// ── AI / Rule-based investment decision ──────────────────────────────────────
export interface AiDecision {
  verdict: "INVEST" | "PROCEED WITH CAUTION" | "DO NOT INVEST";
  budgetFeasible: boolean;
  budgetUSD: number;
  minimumRequiredUSD: number;
  budgetAnalysis: string;
  decisionSummary: string;
  keyFactors: string[];
  redFlags: string[];
  greenFlags: string[];
  calculationBreakdown: string;
  recommendation: string;
  poweredBy: "rules" | "claude" | "openai";
}

export interface SiteAnalysisResult {
  address: string;
  placeId: string;
  coordinates: { lat: number; lng: number };
  analyzedAt: string;
  countryCode: string;
  competitors: CompetitorAnalysis[];
  trafficSignals: TrafficSignals;
  score: LocationScore;
  financialProjection: FinancialProjection;
  reviewInsights: ReviewInsights;
  recommendations: Recommendation[];
  investmentSuggestion: InvestmentSuggestion;
  budgetUSD?: number;
}

export interface ReviewInsights {
  totalReviewsAnalyzed: number;
  avgCompetitorRating: number;
  marketSaturationLevel: "LOW" | "MEDIUM" | "HIGH";
  dominantComplaints: ComplaintCategory[];
  missingServices: string[];
  premiumOpportunity: boolean;
  unlimitedPlanDemand: boolean;
}

export interface Recommendation {
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  title: string;
  description: string;
  icon: string;
}

// ── Currency types ────────────────────────────────────────────────────────────
export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  flag: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$",    name: "US Dollar",          flag: "🇺🇸" },
  { code: "GBP", symbol: "£",    name: "British Pound",      flag: "🇬🇧" },
  { code: "EUR", symbol: "€",    name: "Euro",               flag: "🇪🇺" },
  { code: "NGN", symbol: "₦",    name: "Nigerian Naira",     flag: "🇳🇬" },
  { code: "CAD", symbol: "C$",   name: "Canadian Dollar",    flag: "🇨🇦" },
  { code: "AUD", symbol: "A$",   name: "Australian Dollar",  flag: "🇦🇺" },
  { code: "ZAR", symbol: "R",    name: "South African Rand", flag: "🇿🇦" },
  { code: "GHS", symbol: "₵",    name: "Ghanaian Cedi",      flag: "🇬🇭" },
  { code: "KES", symbol: "KSh",  name: "Kenyan Shilling",    flag: "🇰🇪" },
  { code: "AED", symbol: "د.إ",  name: "UAE Dirham",         flag: "🇦🇪" },
  { code: "INR", symbol: "₹",    name: "Indian Rupee",       flag: "🇮🇳" },
  { code: "BRL", symbol: "R$",   name: "Brazilian Real",     flag: "🇧🇷" },
  { code: "MXN", symbol: "MX$",  name: "Mexican Peso",       flag: "🇲🇽" },
  { code: "JPY", symbol: "¥",    name: "Japanese Yen",       flag: "🇯🇵" },
  { code: "CNY", symbol: "CN¥",  name: "Chinese Yuan",       flag: "🇨🇳" },
  { code: "SAR", symbol: "﷼",   name: "Saudi Riyal",        flag: "🇸🇦" },
];
