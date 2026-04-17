// ── Car Wash Configuration Catalogue ─────────────────────────────────────────
// Sources: Tommy Car Wash Systems, International Carwash Association (ICA),
// Professional Carwashing & Detailing magazine, PDQ Manufacturing,
// Washworld, Motor City Wash Works operator benchmarks.

export type ConfigCategory = "tunnel" | "inbay" | "selfserve" | "combo" | "specialized";

export interface CarWashConfig {
  id: string;
  name: string;
  shortName: string;
  category: ConfigCategory;
  categoryLabel: string;
  tagline: string;
  description: string;

  minLotWidthFt: number;
  minLotDepthFt: number;
  minLotSqFt: number;
  tunnelLengthFt: number | null;

  carsPerHour: { min: number; max: number };
  staffRequired: { min: number; max: number };
  investmentRangeUSD: { min: number; max: number };

  features: string[];
  bestFor: string;
  notIdealFor: string;
  membershipFriendly: boolean;
  revenueModel: string;

  captureRateMultiplier: number;
  avgTicketUSD: number;

  // Which SVG diagram to render (allows diagram reuse across similar configs)
  diagramType: string;
  diagramParams?: Record<string, unknown>;
}

export const CAR_WASH_CONFIGS: CarWashConfig[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 1 — CONVEYOR / TUNNEL
  // Car rides a conveyor belt through stationary equipment.
  // Gold standard for high-volume, membership-driven operations.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "express-100",
    name: "Express Exterior Tunnel — 100ft",
    shortName: "Express 100ft",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "Entry-level express tunnel — low capex, proven format",
    description:
      "The 100ft express exterior conveyor is the smallest viable tunnel format. " +
      "Ideal for tighter lots or lower-traffic markets where a larger tunnel is not yet " +
      "justified. The car rides a conveyor through exterior-only cleaning in under 2 minutes. " +
      "Supports unlimited membership from day one.",
    minLotWidthFt: 120,
    minLotDepthFt: 215,
    minLotSqFt: 25_800,
    tunnelLengthFt: 100,
    carsPerHour: { min: 70, max: 90 },
    staffRequired: { min: 2, max: 4 },
    investmentRangeUSD: { min: 2_100_000, max: 3_400_000 },
    features: [
      "100ft conveyor tunnel",
      "Automated pay stations",
      "Unlimited membership ready",
      "6–8 vacuum stations at exit",
      "Branded entry arch + LED lighting",
      "Entry-level capex vs larger tunnels",
    ],
    bestFor: "Tighter lots (25,000–30,000 sqft) or medium-traffic suburban markets",
    notIdealFor: "High-volume sites — throughput ceiling limits peak-hour revenue",
    membershipFriendly: true,
    revenueModel: "Per-wash ($10–$22) + unlimited monthly memberships ($20–$40/mo)",
    captureRateMultiplier: 0.85,
    avgTicketUSD: 15,
    diagramType: "express-tunnel",
    diagramParams: { tunnelW: 136, label: "100FT TUNNEL" },
  },

  {
    id: "express-130",
    name: "Express Exterior Tunnel — 130ft",
    shortName: "Express 130ft",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "Industry-standard express format — highest ROI per square foot",
    description:
      "The 130ft express exterior tunnel is the most proven high-volume car wash format. " +
      "The conveyor moves the customer's car through a 130-foot cleaning sequence in under 3 " +
      "minutes while they stay seated. No interior service — maximum throughput, minimal labour. " +
      "The go-to format for subscription/unlimited membership models.",
    minLotWidthFt: 125,
    minLotDepthFt: 245,
    minLotSqFt: 30_625,
    tunnelLengthFt: 130,
    carsPerHour: { min: 100, max: 120 },
    staffRequired: { min: 3, max: 6 },
    investmentRangeUSD: { min: 2_800_000, max: 4_500_000 },
    features: [
      "130ft conveyor tunnel",
      "Automated pay stations — no cashier needed",
      "Unlimited wash membership ready",
      "8–12 free-vacuum stations at exit",
      "Branded entry arch + LED tunnel lighting",
      "2–3 minute average cycle time",
      "High-pressure rinse + triple-foam application",
    ],
    bestFor: "High-traffic arterial roads with 15,000+ daily vehicles",
    notIdealFor: "Lots under 30,000 sqft or low-traffic suburban streets",
    membershipFriendly: true,
    revenueModel: "Per-wash ($12–$25) + unlimited monthly memberships ($25–$45/mo)",
    captureRateMultiplier: 1.0,
    avgTicketUSD: 18,
    diagramType: "express-tunnel",
    diagramParams: { tunnelW: 170, label: "130FT TUNNEL" },
  },

  {
    id: "express-150",
    name: "Express Exterior Tunnel — 150ft",
    shortName: "Express 150ft",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "Longer tunnel, higher throughput — the premium express format",
    description:
      "The 150ft tunnel gives 15% more cleaning capacity than the 130ft model, " +
      "allowing additional chemical arches, foam stages, and a longer drying section. " +
      "Achieves up to 150 cars/hour at peak. Standard on high-revenue Tommy Car Wash sites.",
    minLotWidthFt: 150,
    minLotDepthFt: 270,
    minLotSqFt: 40_500,
    tunnelLengthFt: 150,
    carsPerHour: { min: 120, max: 150 },
    staffRequired: { min: 4, max: 8 },
    investmentRangeUSD: { min: 3_200_000, max: 5_200_000 },
    features: [
      "150ft conveyor tunnel",
      "Additional chemical application arches",
      "Extended high-velocity drying section",
      "12–16 vacuum stations",
      "Dual stacking lanes at entry",
      "Triple-foam colour application",
      "Up to 150 cars/hour peak throughput",
    ],
    bestFor: "Premium locations with 20,000+ daily vehicles and strong membership demand",
    notIdealFor: "Lots under 40,000 sqft",
    membershipFriendly: true,
    revenueModel: "Per-wash ($15–$30) + unlimited monthly memberships ($30–$50/mo)",
    captureRateMultiplier: 1.05,
    avgTicketUSD: 22,
    diagramType: "express-tunnel",
    diagramParams: { tunnelW: 198, label: "150FT TUNNEL" },
  },

  {
    id: "express-200",
    name: "Express Exterior Tunnel — 200ft",
    shortName: "Express 200ft",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "High-volume powerhouse — built for 200+ cars/hour",
    description:
      "The 200ft tunnel is the large-scale format for dominant market sites. " +
      "Requires significant lot depth but delivers the highest throughput of any " +
      "single-tunnel format — up to 200 cars/hour with optimised stacking and staffing. " +
      "Popular for franchise anchor sites and high-density urban corridors.",
    minLotWidthFt: 175,
    minLotDepthFt: 320,
    minLotSqFt: 56_000,
    tunnelLengthFt: 200,
    carsPerHour: { min: 150, max: 200 },
    staffRequired: { min: 5, max: 10 },
    investmentRangeUSD: { min: 4_200_000, max: 6_800_000 },
    features: [
      "200ft conveyor tunnel",
      "Multiple foam, wax and tyre-shine arches",
      "High-capacity triple stacking lanes",
      "16–20 vacuum stations at exit",
      "Dominant market positioning",
      "Up to 200 cars/hour peak throughput",
      "Optimised for unlimited membership scale",
    ],
    bestFor: "Dominant anchor sites with 25,000+ daily vehicles — franchise flagship locations",
    notIdealFor: "Lots under 56,000 sqft — few suburban lots meet this requirement",
    membershipFriendly: true,
    revenueModel: "Per-wash ($18–$35) + high-volume membership at scale ($35–$55/mo)",
    captureRateMultiplier: 1.15,
    avgTicketUSD: 25,
    diagramType: "express-tunnel",
    diagramParams: { tunnelW: 238, label: "200FT TUNNEL" },
  },

  {
    id: "touchless-conveyor",
    name: "Touchless Conveyor Tunnel",
    shortName: "Touchless Conveyor",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "High-pressure only — zero contact, zero scratch risk",
    description:
      "A touchless conveyor uses only high-pressure water jets and detergents — " +
      "no brushes or cloth contact the vehicle. Eliminates any risk of paint scratches, " +
      "making it the preferred choice for luxury and high-end vehicle owners. " +
      "Slightly lower cleaning performance on heavy soiling vs friction wash.",
    minLotWidthFt: 125,
    minLotDepthFt: 245,
    minLotSqFt: 30_625,
    tunnelLengthFt: 130,
    carsPerHour: { min: 80, max: 100 },
    staffRequired: { min: 2, max: 5 },
    investmentRangeUSD: { min: 2_600_000, max: 4_200_000 },
    features: [
      "130ft touchless conveyor tunnel",
      "High-pressure water jets — no brushes",
      "Zero scratch / zero contact",
      "Attracts luxury and exotic vehicle owners",
      "Lower chemical usage vs friction",
      "Membership ready",
    ],
    bestFor: "Affluent markets with high concentration of luxury vehicles",
    notIdealFor: "Markets where heavily soiled trucks and vans are the primary customer",
    membershipFriendly: true,
    revenueModel: "Premium per-wash ($18–$35) + memberships ($30–$55/mo)",
    captureRateMultiplier: 0.9,
    avgTicketUSD: 22,
    diagramType: "express-tunnel",
    diagramParams: { tunnelW: 170, label: "TOUCHLESS TUNNEL", variant: "touchless" },
  },

  {
    id: "soft-touch-conveyor",
    name: "Soft-Touch (Friction) Conveyor",
    shortName: "Soft-Touch Conveyor",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "Cloth and foam friction wash — superior cleaning, lower capex",
    description:
      "The soft-touch friction conveyor uses cloth wraps and foam brushes to agitate " +
      "and remove dirt. Delivers a deeper clean than touchless on everyday grime, " +
      "especially on lower-profile sedans and SUVs. Lower water and chemical consumption " +
      "than touchless. The most common tunnel type installed globally.",
    minLotWidthFt: 125,
    minLotDepthFt: 245,
    minLotSqFt: 30_625,
    tunnelLengthFt: 130,
    carsPerHour: { min: 100, max: 130 },
    staffRequired: { min: 3, max: 6 },
    investmentRangeUSD: { min: 2_500_000, max: 4_000_000 },
    features: [
      "130ft soft-touch friction conveyor",
      "Cloth wraps + foam brush contact wash",
      "Superior everyday dirt removal",
      "Lower water usage vs touchless",
      "Industry's most common tunnel format",
      "Membership ready",
      "Tyre-shine applicator at exit",
    ],
    bestFor: "General consumer markets — everyday vehicles in all conditions",
    notIdealFor: "Markets dominated by luxury car owners who object to brush contact",
    membershipFriendly: true,
    revenueModel: "Per-wash ($12–$24) + unlimited memberships ($22–$42/mo)",
    captureRateMultiplier: 1.0,
    avgTicketUSD: 17,
    diagramType: "express-tunnel",
    diagramParams: { tunnelW: 170, label: "SOFT-TOUCH TUNNEL" },
  },

  {
    id: "hybrid-conveyor",
    name: "Hybrid Conveyor (Touch + Touchless)",
    shortName: "Hybrid Conveyor",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "Best of both worlds — touchless pre-soak + friction deep clean",
    description:
      "The hybrid conveyor opens with a high-pressure touchless pre-soak section, " +
      "then transitions into a soft-touch friction section. This combination delivers " +
      "the deepest clean of any tunnel format — pre-soaking loosens heavy grime before " +
      "the brushes finish it off. Premium positioning, higher ticket price.",
    minLotWidthFt: 150,
    minLotDepthFt: 270,
    minLotSqFt: 40_500,
    tunnelLengthFt: 150,
    carsPerHour: { min: 90, max: 120 },
    staffRequired: { min: 4, max: 7 },
    investmentRangeUSD: { min: 3_500_000, max: 5_500_000 },
    features: [
      "150ft hybrid conveyor tunnel",
      "Touchless pre-soak section (first 50ft)",
      "Soft-touch friction section (remaining 100ft)",
      "Highest clean quality of any tunnel format",
      "Premium wash packages at premium price",
      "Dual-technology marketing advantage",
      "Membership ready",
    ],
    bestFor: "Premium markets where wash quality is a key differentiator",
    notIdealFor: "Budget-conscious markets — higher ticket price reduces volume",
    membershipFriendly: true,
    revenueModel: "Premium per-wash ($20–$40) + memberships ($35–$60/mo)",
    captureRateMultiplier: 0.95,
    avgTicketUSD: 28,
    diagramType: "express-tunnel",
    diagramParams: { tunnelW: 198, label: "HYBRID TUNNEL", variant: "hybrid" },
  },

  {
    id: "flex-serve",
    name: "Flex-Serve Tunnel",
    shortName: "Flex-Serve",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "Best of both worlds — express speed with full-service option",
    description:
      "Flex-Serve offers customers a choice at the same facility: exterior-only express, " +
      "or full interior service at a premium. The conveyor handles exterior cleaning while " +
      "a dedicated interior team services cars in a finishing bay. Captures both value " +
      "and premium customer segments on the same site.",
    minLotWidthFt: 160,
    minLotDepthFt: 245,
    minLotSqFt: 39_200,
    tunnelLengthFt: 130,
    carsPerHour: { min: 80, max: 100 },
    staffRequired: { min: 6, max: 12 },
    investmentRangeUSD: { min: 3_000_000, max: 4_800_000 },
    features: [
      "130ft conveyor tunnel (exterior)",
      "4–6 interior finish bays",
      "Dual service menu — express or full",
      "Vacuum, wipe-down, window cleaning",
      "Higher average ticket than express-only",
      "Membership + premium upsell revenue",
    ],
    bestFor: "Suburban markets where customers expect full service and will pay a premium",
    notIdealFor: "High-speed urban locations where customers prioritise fast turnover",
    membershipFriendly: true,
    revenueModel: "Tiered wash packages ($18–$85/visit)",
    captureRateMultiplier: 0.9,
    avgTicketUSD: 32,
    diagramType: "flex-serve",
  },

  {
    id: "full-service",
    name: "Full-Service Tunnel",
    shortName: "Full-Service",
    category: "tunnel",
    categoryLabel: "Conveyor Tunnel",
    tagline: "Premium concierge experience — interior + exterior, attendant-served",
    description:
      "The traditional full-service car wash. Every car receives exterior tunnel cleaning " +
      "and interior service (vacuum, windows, dash wipe) by attendants. Highest ticket price " +
      "per car, lowest throughput. Premium brand positioning — appeals to affluent customers " +
      "who value a concierge experience over speed.",
    minLotWidthFt: 165,
    minLotDepthFt: 280,
    minLotSqFt: 46_200,
    tunnelLengthFt: 130,
    carsPerHour: { min: 20, max: 40 },
    staffRequired: { min: 8, max: 20 },
    investmentRangeUSD: { min: 2_500_000, max: 4_000_000 },
    features: [
      "130ft conveyor tunnel",
      "Full interior service team",
      "Hand-dry and detail finish",
      "Premium vacuum + window cleaning",
      "Towel-dry crew at exit",
      "Customer lounge with refreshments",
      "Detailing add-on packages available",
    ],
    bestFor: "Affluent suburban markets — customers who value quality over speed",
    notIdealFor: "High-traffic sites where throughput is critical",
    membershipFriendly: false,
    revenueModel: "Premium per-visit pricing ($35–$75/car)",
    captureRateMultiplier: 0.6,
    avgTicketUSD: 48,
    diagramType: "full-service",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 2 — IN-BAY AUTOMATIC
  // Gantry or arch moves over a stationary car. Low footprint, lower volume.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "inbay-touchless",
    name: "Single In-Bay — Touchless",
    shortName: "In-Bay Touchless",
    category: "inbay",
    categoryLabel: "In-Bay Automatic",
    tagline: "Zero-contact high-pressure wash — ideal for small lots",
    description:
      "A touchless in-bay automatic uses high-pressure water and strong detergents only — " +
      "no brushes or cloth contact the vehicle. The gantry travels back and forth over the " +
      "stationary car. Zero scratch risk. Minimal staff. Requires as little as 6,400 sqft.",
    minLotWidthFt: 80,
    minLotDepthFt: 80,
    minLotSqFt: 6_400,
    tunnelLengthFt: null,
    carsPerHour: { min: 15, max: 20 },
    staffRequired: { min: 0, max: 1 },
    investmentRangeUSD: { min: 350_000, max: 650_000 },
    features: [
      "Touchless high-pressure gantry",
      "No brushes — zero scratch risk",
      "Fully automatic — no attendant needed",
      "Minimal lot (80×80 ft minimum)",
      "Pay-at-machine, 24/7 operation",
      "Ideal as gas station or retail add-on",
    ],
    bestFor: "Small lots, gas station add-ons, lower-traffic but high-margin locations",
    notIdealFor: "High-traffic locations — 15–20 cars/hr creates queues at peak",
    membershipFriendly: false,
    revenueModel: "Pay-per-wash ($10–$20/car)",
    captureRateMultiplier: 0.4,
    avgTicketUSD: 14,
    diagramType: "inbay-single",
  },

  {
    id: "inbay-soft-touch",
    name: "Single In-Bay — Soft-Touch",
    shortName: "In-Bay Soft-Touch",
    category: "inbay",
    categoryLabel: "In-Bay Automatic",
    tagline: "Rotating brush gantry — deeper clean, same small footprint",
    description:
      "A soft-touch in-bay uses a rotating brush or cloth gantry that moves over " +
      "the stationary vehicle. Delivers a deeper clean than touchless for everyday " +
      "dirt. Popular choice for markets where customers want more than just a rinse " +
      "but budgets do not support a full tunnel installation.",
    minLotWidthFt: 80,
    minLotDepthFt: 80,
    minLotSqFt: 6_400,
    tunnelLengthFt: null,
    carsPerHour: { min: 12, max: 18 },
    staffRequired: { min: 0, max: 1 },
    investmentRangeUSD: { min: 300_000, max: 550_000 },
    features: [
      "Rotating brush/cloth gantry",
      "Deeper clean than touchless on everyday dirt",
      "Fully automatic — no attendant needed",
      "Minimal lot (80×80 ft minimum)",
      "Pay-at-machine, 24/7 operation",
      "Lower equipment cost than touchless IBA",
    ],
    bestFor: "Budget-sensitive markets, small lots, gas station add-ons",
    notIdealFor: "Luxury vehicle markets where brush contact is a concern",
    membershipFriendly: false,
    revenueModel: "Pay-per-wash ($8–$18/car)",
    captureRateMultiplier: 0.38,
    avgTicketUSD: 12,
    diagramType: "inbay-single",
  },

  {
    id: "inbay-dual",
    name: "Dual In-Bay Automatic",
    shortName: "In-Bay Dual",
    category: "inbay",
    categoryLabel: "In-Bay Automatic",
    tagline: "Two units, double the throughput — compact footprint",
    description:
      "Two side-by-side in-bay automatic units double throughput while keeping " +
      "the footprint well below what a tunnel requires. Combined 30–40 cars/hour " +
      "capacity at roughly half the capital cost of an express tunnel. " +
      "A natural step-up from a single unit as traffic grows.",
    minLotWidthFt: 90,
    minLotDepthFt: 120,
    minLotSqFt: 10_800,
    tunnelLengthFt: null,
    carsPerHour: { min: 30, max: 40 },
    staffRequired: { min: 0, max: 1 },
    investmentRangeUSD: { min: 600_000, max: 1_100_000 },
    features: [
      "2× in-bay gantry units side-by-side",
      "30–40 combined cars/hour",
      "Individual pay terminal per bay",
      "24/7 unattended operation",
      "Expandable to triple later",
      "Shared vacuum area",
    ],
    bestFor: "Medium-traffic sites where a tunnel is not yet justified",
    notIdealFor: "Sites with membership ambitions — IBAs do not support subscriptions well",
    membershipFriendly: false,
    revenueModel: "Pay-per-wash ($10–$20/car)",
    captureRateMultiplier: 0.55,
    avgTicketUSD: 15,
    diagramType: "inbay-dual",
  },

  {
    id: "inbay-triple",
    name: "Triple In-Bay Automatic",
    shortName: "In-Bay Triple",
    category: "inbay",
    categoryLabel: "In-Bay Automatic",
    tagline: "Three units, triple revenue — maximum output from a compact lot",
    description:
      "Three side-by-side in-bay automatic units multiply throughput without the lot " +
      "requirements of a full tunnel. Combined capacity of 45–60 cars/hour rivals a " +
      "small express tunnel at a fraction of the capital cost. Ideal for medium-traffic " +
      "sites where a tunnel is not yet economically justified.",
    minLotWidthFt: 100,
    minLotDepthFt: 180,
    minLotSqFt: 18_000,
    tunnelLengthFt: null,
    carsPerHour: { min: 45, max: 60 },
    staffRequired: { min: 0, max: 2 },
    investmentRangeUSD: { min: 900_000, max: 1_500_000 },
    features: [
      "3× in-bay gantry units side-by-side",
      "45–60 combined cars/hour",
      "Individual pay terminal per bay",
      "24/7 unattended operation",
      "Shared vacuum area",
      "Expandable — add a fourth unit later",
    ],
    bestFor: "Medium-traffic sites — efficient capital use vs a full tunnel",
    notIdealFor: "Sites with strong membership potential — IBAs do not support subscriptions",
    membershipFriendly: false,
    revenueModel: "Pay-per-wash ($12–$22/car), potential fleet accounts",
    captureRateMultiplier: 0.7,
    avgTicketUSD: 16,
    diagramType: "inbay-triple",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 3 — SELF-SERVE
  // Customer manually washes their vehicle using a high-pressure wand.
  // Lowest capex, lowest operating cost, lowest throughput per bay.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "self-serve-4",
    name: "4-Bay Self-Serve",
    shortName: "Self-Serve 4-Bay",
    category: "selfserve",
    categoryLabel: "Self-Serve",
    tagline: "Entry-level self-serve — lowest capex in the car wash industry",
    description:
      "Four self-serve bays offer the absolute lowest entry point into the car wash " +
      "business. Customers pay per cycle and use a pressure wand to wash at their own " +
      "pace. Near-zero operating costs — no staff required. Ideal for rural areas, " +
      "small towns, or as a test before a larger investment.",
    minLotWidthFt: 80,
    minLotDepthFt: 120,
    minLotSqFt: 9_600,
    tunnelLengthFt: null,
    carsPerHour: { min: 12, max: 24 },
    staffRequired: { min: 0, max: 1 },
    investmentRangeUSD: { min: 280_000, max: 550_000 },
    features: [
      "4 individual drive-through wash bays",
      "High-pressure wand + foam brush per bay",
      "Coin/card payment per bay",
      "Spot-free rinse option",
      "Vending add-ons (air, fragrance, vacuums)",
      "Near-zero staff cost",
    ],
    bestFor: "Rural areas, small towns, first-time investors with limited capital",
    notIdealFor: "High-traffic urban locations — too slow and low-volume",
    membershipFriendly: false,
    revenueModel: "Time-based coin/card ($3–$8 per session), vacuum revenue",
    captureRateMultiplier: 0.25,
    avgTicketUSD: 7,
    diagramType: "self-serve",
    diagramParams: { bays: 4 },
  },

  {
    id: "self-serve-6",
    name: "6-Bay Self-Serve",
    shortName: "Self-Serve 6-Bay",
    category: "selfserve",
    categoryLabel: "Self-Serve",
    tagline: "Coin-op classic — lowest capex, consistent community revenue",
    description:
      "Six self-serve bays where customers use a high-pressure wand to wash their " +
      "vehicle at their own pace. Extremely low operating costs — no staff required, " +
      "minimal maintenance. Generates consistent coin/card revenue 24/7. " +
      "Popular in rural and suburban markets, especially for truck owners.",
    minLotWidthFt: 80,
    minLotDepthFt: 200,
    minLotSqFt: 16_000,
    tunnelLengthFt: null,
    carsPerHour: { min: 18, max: 36 },
    staffRequired: { min: 0, max: 1 },
    investmentRangeUSD: { min: 500_000, max: 900_000 },
    features: [
      "6 individual drive-through wash bays",
      "High-pressure wand + foam brush per bay",
      "Coin/card payment per bay",
      "Spot-free rinse option",
      "Air/fragrance/vacuum vending add-ons",
      "Virtually zero staff cost",
      "Accommodates trucks and oversized vehicles",
    ],
    bestFor: "Truck-heavy markets, DIY-oriented communities, rural and suburban areas",
    notIdealFor: "Urban locations where speed and convenience are expected",
    membershipFriendly: false,
    revenueModel: "Time-based coin/card ($3–$8 per session), vacuum and vending revenue",
    captureRateMultiplier: 0.35,
    avgTicketUSD: 9,
    diagramType: "self-serve",
    diagramParams: { bays: 6 },
  },

  {
    id: "self-serve-8",
    name: "8-Bay Self-Serve",
    shortName: "Self-Serve 8-Bay",
    category: "selfserve",
    categoryLabel: "Self-Serve",
    tagline: "Large self-serve site — maximum coin-op revenue, truck-friendly",
    description:
      "Eight bays is the maximum practical self-serve configuration before the site " +
      "starts to feel better suited to a tunnel. At 8 bays, the revenue potential " +
      "approaches in-bay automatic territory while still serving the DIY segment " +
      "that a tunnel cannot capture — particularly truck, van, and RV owners.",
    minLotWidthFt: 80,
    minLotDepthFt: 250,
    minLotSqFt: 20_000,
    tunnelLengthFt: null,
    carsPerHour: { min: 24, max: 48 },
    staffRequired: { min: 0, max: 1 },
    investmentRangeUSD: { min: 700_000, max: 1_200_000 },
    features: [
      "8 individual drive-through wash bays",
      "High-pressure wand + foam brush per bay",
      "Coin/card payment per bay",
      "Dedicated truck and RV oversized bays",
      "Vacuum island cluster at exit",
      "Vending machines (air, fragrance, detail products)",
      "Near-zero operating cost",
    ],
    bestFor: "High-truck markets, agricultural areas, communities with large vehicles",
    notIdealFor: "Urban or suburban markets where convenience customers dominate",
    membershipFriendly: false,
    revenueModel: "Time-based coin/card ($3–$10 per session), vacuum and vending revenue",
    captureRateMultiplier: 0.45,
    avgTicketUSD: 10,
    diagramType: "self-serve",
    diagramParams: { bays: 8 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 4 — COMBINATION / HYBRID SITES
  // Two or more formats on one lot. Maximises revenue per sqft.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "tunnel-selfserve-combo",
    name: "Express Tunnel + Self-Serve Combo",
    shortName: "Tunnel + Self-Serve",
    category: "combo",
    categoryLabel: "Combination",
    tagline: "Two revenue streams, one site — captures every customer type",
    description:
      "Combines a 130ft express tunnel for high-volume throughput with 4–6 self-serve " +
      "bays for customers who prefer to wash their own vehicle. The combo maximises revenue " +
      "per square foot and captures both convenience-driven and DIY segments. Self-serve " +
      "bays also handle trucks and oversized vehicles that may not fit the tunnel.",
    minLotWidthFt: 175,
    minLotDepthFt: 245,
    minLotSqFt: 42_875,
    tunnelLengthFt: 130,
    carsPerHour: { min: 100, max: 130 },
    staffRequired: { min: 3, max: 7 },
    investmentRangeUSD: { min: 3_500_000, max: 5_500_000 },
    features: [
      "130ft express conveyor tunnel",
      "4–6 self-serve bays (trucks + DIY)",
      "Unlimited membership on tunnel",
      "Shared vacuum stations across site",
      "Dual revenue streams from day one",
      "Captures 100% of car wash customer types",
      "Higher revenue per sqft than either alone",
    ],
    bestFor: "Large lots with a diverse customer base — maximises total site revenue",
    notIdealFor: "Small or narrow lots — requires 42,000+ sqft minimum",
    membershipFriendly: true,
    revenueModel: "Tunnel: per-wash + memberships. Bays: coin/card per session.",
    captureRateMultiplier: 1.1,
    avgTicketUSD: 20,
    diagramType: "tunnel-combo",
  },

  {
    id: "inbay-selfserve-combo",
    name: "In-Bay Automatic + Self-Serve Combo",
    shortName: "In-Bay + Self-Serve",
    category: "combo",
    categoryLabel: "Combination",
    tagline: "Automated and manual wash on one compact lot",
    description:
      "Pairs one or two in-bay automatic units with 4–6 self-serve bays. " +
      "The in-bay captures customers who want a fast, hands-off wash while the " +
      "self-serve bays serve the DIY segment. No tunnel required — fits lots " +
      "that are too small for a conveyor system but too large to leave underused.",
    minLotWidthFt: 130,
    minLotDepthFt: 180,
    minLotSqFt: 23_400,
    tunnelLengthFt: null,
    carsPerHour: { min: 30, max: 55 },
    staffRequired: { min: 0, max: 2 },
    investmentRangeUSD: { min: 900_000, max: 1_700_000 },
    features: [
      "1–2 in-bay automatic units",
      "4–6 self-serve bays",
      "Shared vacuum island cluster",
      "Dual revenue streams",
      "24/7 unattended operation possible",
      "Fits mid-size lots (23,000+ sqft)",
      "Low operating cost",
    ],
    bestFor: "Mid-size lots where a tunnel is not feasible — two revenue streams on a budget",
    notIdealFor: "High-traffic sites where a tunnel would deliver better ROI",
    membershipFriendly: false,
    revenueModel: "IBA: pay-per-wash. Bays: coin/card per session.",
    captureRateMultiplier: 0.65,
    avgTicketUSD: 13,
    diagramType: "inbay-selfserve-combo",
  },

  {
    id: "tunnel-detail-combo",
    name: "Tunnel + Detail Centre Combo",
    shortName: "Tunnel + Detail",
    category: "combo",
    categoryLabel: "Combination",
    tagline: "Volume exterior wash plus premium detailing under one roof",
    description:
      "Combines a high-volume express tunnel with a dedicated detailing centre. " +
      "The tunnel handles high-frequency express customers on memberships while " +
      "the detail centre upsells monthly details, paint correction, and ceramic " +
      "coatings. The highest average spend per visit of any combination format.",
    minLotWidthFt: 160,
    minLotDepthFt: 280,
    minLotSqFt: 44_800,
    tunnelLengthFt: 130,
    carsPerHour: { min: 90, max: 110 },
    staffRequired: { min: 5, max: 15 },
    investmentRangeUSD: { min: 3_800_000, max: 6_000_000 },
    features: [
      "130ft express conveyor tunnel",
      "4–8 enclosed indoor detail bays",
      "Paint correction and ceramic coating services",
      "Monthly detail upsell packages",
      "Unlimited membership on tunnel",
      "Highest average spend per customer",
      "Premium brand positioning",
    ],
    bestFor: "Affluent markets where customers invest heavily in vehicle care",
    notIdealFor: "Budget-conscious markets where detail pricing exceeds willingness to pay",
    membershipFriendly: true,
    revenueModel: "Tunnel memberships + detail packages ($150–$2,000/service)",
    captureRateMultiplier: 0.95,
    avgTicketUSD: 38,
    diagramType: "tunnel-detail-combo",
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 5 — SPECIALISED FORMATS
  // Non-standard formats for specific markets or emerging trends.
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: "hand-wash",
    name: "Hand Wash / Full Detail Centre",
    shortName: "Hand Wash",
    category: "specialized",
    categoryLabel: "Specialised",
    tagline: "Artisan hand wash — premium experience, no automated equipment",
    description:
      "A hand wash centre relies entirely on trained staff for every wash — " +
      "no conveyor, no gantry, no automated equipment. Each car is washed by hand " +
      "using professional detailing techniques. Extremely high labour cost but also " +
      "the highest possible ticket price. Popular in urban centres and luxury markets.",
    minLotWidthFt: 80,
    minLotDepthFt: 150,
    minLotSqFt: 12_000,
    tunnelLengthFt: null,
    carsPerHour: { min: 5, max: 15 },
    staffRequired: { min: 4, max: 20 },
    investmentRangeUSD: { min: 200_000, max: 800_000 },
    features: [
      "No automated equipment required",
      "Full hand wash by trained staff",
      "Interior vacuum and wipe-down included",
      "Detailing services available",
      "Lowest capex of any wash format",
      "Premium positioning, premium pricing",
      "Flexible facility — adapts to any lot shape",
    ],
    bestFor: "Urban centres, dense city markets, luxury residential areas",
    notIdealFor: "High-volume ambitions — labour cost caps throughput and margin",
    membershipFriendly: false,
    revenueModel: "Per-wash ($30–$80) + detailing packages ($100–$500+)",
    captureRateMultiplier: 0.3,
    avgTicketUSD: 45,
    diagramType: "hand-wash",
  },

  {
    id: "ev-express",
    name: "EV-Optimised Express Tunnel",
    shortName: "EV Express",
    category: "specialized",
    categoryLabel: "Specialised",
    tagline: "Future-ready express tunnel with integrated EV charging stations",
    description:
      "An express exterior tunnel designed specifically for the growing EV market. " +
      "EV-safe conveyor systems (no undercarriage spray near battery packs), " +
      "Level 2 and DC fast chargers at vacuum stations, and EV membership tiers. " +
      "Positions the site as the destination for EV drivers who need both clean " +
      "and charged at the same stop.",
    minLotWidthFt: 140,
    minLotDepthFt: 260,
    minLotSqFt: 36_400,
    tunnelLengthFt: 130,
    carsPerHour: { min: 90, max: 115 },
    staffRequired: { min: 3, max: 6 },
    investmentRangeUSD: { min: 3_500_000, max: 5_800_000 },
    features: [
      "130ft EV-safe conveyor tunnel",
      "4–8 Level 2 EV chargers at vacuum stations",
      "2 DC fast chargers (destination charging)",
      "EV membership tier with charge credits",
      "Undercarriage-safe wash protocol for EVs",
      "EV-first brand positioning",
      "Future-proofed for growing EV market share",
    ],
    bestFor: "Markets with high EV adoption — tech-forward cities, California, Northwest US, UK, Europe",
    notIdealFor: "Markets with low EV penetration where charger ROI is poor",
    membershipFriendly: true,
    revenueModel: "Wash memberships + EV charging revenue per kWh",
    captureRateMultiplier: 0.92,
    avgTicketUSD: 24,
    diagramType: "ev-express",
  },

  {
    id: "mobile-container",
    name: "Mobile / Container Car Wash",
    shortName: "Mobile / Container",
    category: "specialized",
    categoryLabel: "Specialised",
    tagline: "Low-risk entry format — relocatable, minimal construction",
    description:
      "A container-based or fully mobile car wash requires minimal construction, " +
      "no permanent foundation, and can be relocated if the site underperforms. " +
      "Typically a single in-bay automatic unit or a compact self-serve setup " +
      "inside a converted shipping container. Used as a market test or for " +
      "semi-permanent placements in car parks, supermarkets, and event venues.",
    minLotWidthFt: 40,
    minLotDepthFt: 60,
    minLotSqFt: 2_400,
    tunnelLengthFt: null,
    carsPerHour: { min: 8, max: 15 },
    staffRequired: { min: 1, max: 3 },
    investmentRangeUSD: { min: 80_000, max: 350_000 },
    features: [
      "Container-based or fully mobile structure",
      "No permanent foundation required",
      "Relocatable if site underperforms",
      "Minimal planning permission in most markets",
      "Fast to deploy — weeks not months",
      "Ideal as a market validation tool",
      "Can operate in car parks and shopping centres",
    ],
    bestFor: "Market testing, temporary sites, car parks, shopping centres — low risk entry",
    notIdealFor: "Long-term high-revenue ambitions — throughput and brand are limited",
    membershipFriendly: false,
    revenueModel: "Pay-per-wash ($8–$18/car)",
    captureRateMultiplier: 0.2,
    avgTicketUSD: 12,
    diagramType: "mobile",
  },
];

export function getConfig(id: string): CarWashConfig | undefined {
  return CAR_WASH_CONFIGS.find((c) => c.id === id);
}

export const CONFIG_CATEGORIES: Array<{
  id: ConfigCategory;
  label: string;
  description: string;
  icon: string;
  count: number;
}> = [
  {
    id: "tunnel",
    label: "Conveyor Tunnel",
    description: "Car rides a belt through stationary equipment",
    icon: "🏗️",
    count: CAR_WASH_CONFIGS.filter((c) => c.category === "tunnel").length,
  },
  {
    id: "inbay",
    label: "In-Bay Automatic",
    description: "Equipment arch moves over a stationary car",
    icon: "🤖",
    count: CAR_WASH_CONFIGS.filter((c) => c.category === "inbay").length,
  },
  {
    id: "selfserve",
    label: "Self-Serve",
    description: "Customer uses a pressure wand manually",
    icon: "🚿",
    count: CAR_WASH_CONFIGS.filter((c) => c.category === "selfserve").length,
  },
  {
    id: "combo",
    label: "Combination",
    description: "Two formats on one site",
    icon: "⚡",
    count: CAR_WASH_CONFIGS.filter((c) => c.category === "combo").length,
  },
  {
    id: "specialized",
    label: "Specialised",
    description: "EV, hand wash, mobile and emerging formats",
    icon: "✨",
    count: CAR_WASH_CONFIGS.filter((c) => c.category === "specialized").length,
  },
];
