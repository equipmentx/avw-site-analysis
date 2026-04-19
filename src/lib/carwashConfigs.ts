// ── Car Wash Configuration Catalogue ─────────────────────────────────────────
// All figures verified against the following sources (2024–2026 data):
//
//   WEB SOURCES (cross-referenced):
//   • EB3 Construction — "Car Wash Tunnel Cost" (Oct 2025)
//     Full tunnel project range: $2.6M–$7M; 120ft tunnel: $3.5M–$8M+
//   • MMCG Invest — "Tunnel Car Wash Construction Cost Breakdown" (Mar 2025)
//     State-of-the-art express range: $3.85M–$10M+
//   • Maxx Builders — "Cost to Build a Car Wash" (Oct 2025, Texas market)
//     Express/tunnel: $1.8M–$3.5M construction; self-serve: $0.8M–$1.5M
//   • Car Wash Advisory — "Types of Car Washes" & "Build Costs" (2024)
//     Express tunnel: 60–120 cars/hr; full-service: $17–$20 avg; flex-serve: $12–$15 avg
//   • Tommy Car Wash Systems — "Ideal Express Car Wash Location" (2024)
//     Lot size: 0.8–1 acre (express); 1.2–1.5 acres (flex); AADT: 15,000–25,000
//   • Motor City Wash Works — "10 Critical Site Selection Components" (2024)
//     Minimum 225ft depth for a 125ft conveyor; ~1 acre ideal
//   • TopCarWashCost — "2026 Car Wash Prices Guide"
//     Express basic $10–$16; mid-tier $18–$22; premium $25–$32; membership $25–$45/mo
//   • ICA Q4 2024 Pulse Report — industry avg ticket: $15
//   • International Carwash Association (carwash.org) — industry benchmarks
//
//   PDF SOURCES (operator-level verification):
//   • Sonny's Express Pro Forma 2024: $4,950,000 total project; avg ticket $14.27;
//     Year-1 peak 49 cars/hr on a 100-car/hr rated tunnel; pricing $10–$26
//   • AVW Equipment Acknowledgement #38388: $448,862.35 for 60ft conveyor + wash pkg
//   • AVW 2025 Price List: Eurovac vacuum systems $17,360–$48,025 (5–15 bay configs)
//   • Sonny's Site Selection Guide: AADT target 25,000; HH income >$35K (50% express);
//     working pop (ages 25–65) target 55%; HH size target 2.1
//
// NOTE ON THROUGHPUT: carsPerHour = equipment-rated capacity.
// Actual Year-1 operational throughput is typically 40–60% of rated capacity.
// (Sonny's pro forma: 49 cars/hr peak Year 1 on a 100-car/hr rated tunnel.)

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
    tagline: "Entry-level express tunnel — lower capex, proven format",
    description:
      "The 100ft express exterior conveyor is the smallest viable tunnel format. " +
      "Ideal for tighter lots or lower-traffic markets. The car rides a conveyor " +
      "through exterior-only cleaning in under 2 minutes while the customer stays seated. " +
      "Tommy Car Wash recommends a minimum 0.8 acres for a full-size express site; " +
      "a 100ft tunnel can operate on ~0.65 acres with efficient stacking. " +
      "Total project investment typically $2.5M–$4.5M (source: EB3 Construction 2025, " +
      "Sonny's pro forma). Equipment package alone $350K–$450K (AVW pricing). " +
      "Supports unlimited membership from day one.",
    // ~0.65 acres minimum: smaller than Tommy's 0.8-acre standard but viable for 100ft
    minLotWidthFt: 125,
    minLotDepthFt: 220,
    minLotSqFt: 27_500,
    tunnelLengthFt: 100,
    // Equipment-rated capacity (source: Car Wash Advisory). Year-1 actual = 40–60% of max.
    carsPerHour: { min: 60, max: 90 },
    // Sonny's: Manager $30/hr, Asst Manager $20/hr, Attendants $15/hr
    staffRequired: { min: 2, max: 4 },
    // EB3 Construction (Oct 2025): tunnel project $2.6M–$7M.
    // For 100ft (smaller than 120ft benchmark): $2.5M–$4.5M is well-supported.
    investmentRangeUSD: { min: 2_500_000, max: 4_500_000 },
    features: [
      "100ft conveyor tunnel",
      "Automated pay stations",
      "Unlimited membership ready",
      "6–8 vacuum stations at exit",
      "Branded entry arch + LED lighting",
      "Entry-level capex vs larger tunnels",
    ],
    // Tommy's AADT target: 15,000–25,000 vehicles (source: Tommy Car Wash Systems)
    bestFor: "Tighter lots (~0.65 acres) in markets with 15,000–20,000 AADT",
    notIdealFor: "High-volume sites — throughput ceiling limits peak-hour revenue",
    membershipFriendly: true,
    // TopCarWashCost 2026: basic express $10–$16; mid-tier $18–$22; memberships $25–$45/mo
    revenueModel: "Per-wash ($10–$22) + unlimited monthly memberships ($25–$40/mo)",
    captureRateMultiplier: 0.85,
    // ICA industry avg $15; Sonny's pro forma weighted avg $14.27; entry-level format.
    avgTicketUSD: 14,
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
      "Conveyor moves the car through a 130ft exterior-only cleaning sequence in under 3 minutes. " +
      "Tommy Car Wash recommends 0.8–1 acre minimum (35,000–43,560 sqft). " +
      "Motor City Wash Works confirms: minimum 225ft depth to accommodate a 125ft+ conveyor. " +
      "Total project investment: $3.5M–$7M (EB3 Construction Oct 2025: 120ft tunnel $3.5M–$8M+; " +
      "Sonny's 2024 real example = $4,950,000; MMCG Invest 2025: $3.85M–$10M+ for state-of-art). " +
      "AVW equipment package alone: $448,862. The go-to format for unlimited membership models.",
    // Tommy Car Wash: full-size express minimum 0.8 acres = ~34,848 sqft
    // Motor City: minimum 225ft depth for 125ft conveyor
    minLotWidthFt: 150,
    minLotDepthFt: 240,
    minLotSqFt: 36_000,
    tunnelLengthFt: 130,
    // Car Wash Advisory: express tunnel 60–120 cars/hr
    // Sonny's Year-1 actual = 49 cars/hr; Year-5 = 79 cars/hr (equipment rated at 100)
    carsPerHour: { min: 100, max: 120 },
    staffRequired: { min: 3, max: 6 },
    // EB3 Construction (Oct 2025): 120ft tunnel $3.5M–$8M+
    // Sonny's 2024 real build: $4,950,000
    // MMCG Invest (Mar 2025): $3.85M–$10M+ (location-dependent)
    investmentRangeUSD: { min: 3_500_000, max: 7_000_000 },
    features: [
      "130ft conveyor tunnel",
      "Automated pay stations — no cashier needed",
      "Unlimited wash membership ready",
      "8–12 free-vacuum stations at exit",
      "Branded entry arch + LED tunnel lighting",
      "2–3 minute average cycle time",
      "High-pressure rinse + triple-foam application",
    ],
    // Tommy Car Wash Systems: ideal AADT range 15,000–25,000 vehicles
    // Sonny's site selection guide: AADT target 25,000
    bestFor: "High-traffic arterial roads with 15,000–25,000+ AADT on 0.8–1 acre lots",
    notIdealFor: "Lots under 35,000 sqft or markets with fewer than 15,000 daily vehicles",
    membershipFriendly: true,
    // Sonny's exact range: Basic $10, Enhanced ~$15, Premium ~$21, VIP $26
    // TopCarWashCost 2026: basic $10–$16, membership $25–$45/mo
    revenueModel: "Per-wash ($10–$26) + unlimited monthly memberships ($25–$45/mo)",
    captureRateMultiplier: 1.0,
    // ICA Q4 2024 industry avg: $15. Sonny's 2024 weighted avg: $14.27.
    avgTicketUSD: 14,
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
      "The 150ft tunnel adds 15% more cleaning capacity over the 130ft model: " +
      "additional chemical arches, foam stages, and a longer drying section. " +
      "Requires ~1 acre minimum. Investment scales proportionally — expect $4M–$8M " +
      "total project based on EB3 Construction (Oct 2025) benchmarks for this tunnel class. " +
      "Standard on high-revenue Tommy's Express and Mister Car Wash sites.",
    // ~1 acre: top end of Tommy's 0.8–1 acre express range
    minLotWidthFt: 155,
    minLotDepthFt: 275,
    minLotSqFt: 42_625,
    tunnelLengthFt: 150,
    // Car Wash Advisory: express tunnel rated 60–120 cars/hr; 150ft achieves higher end
    carsPerHour: { min: 120, max: 150 },
    staffRequired: { min: 4, max: 8 },
    // EB3 (Oct 2025): 120ft = $3.5M–$8M+. 150ft proportionally higher: $4M–$8.5M
    investmentRangeUSD: { min: 4_000_000, max: 8_500_000 },
    features: [
      "150ft conveyor tunnel",
      "Additional chemical application arches",
      "Extended high-velocity drying section",
      "12–16 vacuum stations",
      "Dual stacking lanes at entry",
      "Triple-foam colour application",
      "Up to 150 cars/hour rated throughput",
    ],
    bestFor: "Premium 1-acre+ locations with 20,000–30,000+ AADT and strong membership demand",
    notIdealFor: "Lots under 42,000 sqft",
    membershipFriendly: true,
    // TopCarWashCost 2026: mid-tier express $18–$22; premium $25–$32
    revenueModel: "Per-wash ($12–$30) + unlimited monthly memberships ($30–$50/mo)",
    captureRateMultiplier: 1.05,
    // Mid-tier express pricing mix yields avg ~$18 (TopCarWashCost 2026: mid $18–$22)
    avgTicketUSD: 18,
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
      "Requires 1.2–1.5 acres. Delivers the highest single-tunnel throughput — up to 200 cars/hour " +
      "rated equipment capacity. Total investment $5.5M–$10M+ (MMCG Invest 2025: " +
      "state-of-the-art express ranges up to $10M+ for premium West Coast locations; " +
      "a West Coast 4,307 sqft example project totalled $10.47M including $4.2M land). " +
      "Popular for franchise anchor sites and high-density urban corridors.",
    // Tommy's: flex sites 1.2–1.5 acres. 200ft tunnel needs equivalent depth.
    minLotWidthFt: 180,
    minLotDepthFt: 325,
    minLotSqFt: 58_500,
    tunnelLengthFt: 200,
    carsPerHour: { min: 150, max: 200 },
    staffRequired: { min: 5, max: 10 },
    // MMCG Invest: $3.85M–$10M+ (state-of-the-art); premium sites exceed $10M
    // Maxx Builders: $1.8M–$3.5M construction cost ONLY (land excluded, Texas market)
    investmentRangeUSD: { min: 5_500_000, max: 10_000_000 },
    features: [
      "200ft conveyor tunnel",
      "Multiple foam, wax and tyre-shine arches",
      "High-capacity triple stacking lanes",
      "16–20 vacuum stations at exit",
      "Dominant market positioning",
      "Up to 200 cars/hour rated throughput",
      "Optimised for unlimited membership scale",
    ],
    bestFor: "Dominant anchor sites with 25,000–35,000+ AADT on 1.2+ acres — franchise flagships",
    notIdealFor: "Lots under 58,000 sqft — few suburban lots meet this requirement",
    membershipFriendly: true,
    // TopCarWashCost 2026: premium express "Works" packages $25–$32
    revenueModel: "Per-wash ($15–$35) + high-volume membership at scale ($35–$55/mo)",
    captureRateMultiplier: 1.15,
    // Premium package mix at flagship volume: avg ~$22
    avgTicketUSD: 22,
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
      "preferred by luxury vehicle owners. Requires higher chemical and water usage vs friction. " +
      "Investment similar to a 130ft express tunnel: $3.5M–$7M " +
      "(EB3 Construction 2025 benchmarks apply equally to touchless systems).",
    minLotWidthFt: 150,
    minLotDepthFt: 240,
    minLotSqFt: 36_000,
    tunnelLengthFt: 130,
    carsPerHour: { min: 80, max: 100 },
    staffRequired: { min: 2, max: 5 },
    investmentRangeUSD: { min: 3_500_000, max: 7_000_000 },
    features: [
      "130ft touchless conveyor tunnel",
      "High-pressure water jets — no brushes",
      "Zero scratch / zero contact",
      "Attracts luxury and exotic vehicle owners",
      "Higher chemical application vs friction",
      "Membership ready",
    ],
    bestFor: "Affluent markets with high concentration of luxury vehicles",
    notIdealFor: "Markets where heavily soiled trucks and vans are the primary customer",
    membershipFriendly: true,
    // TopCarWashCost 2026: touchless/in-bay $12–$28; premium positioning
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
      "and remove dirt. Delivers a deeper clean than touchless on everyday grime. " +
      "Lower water and chemical consumption than touchless. The most common tunnel type globally. " +
      "Investment range matches a standard 130ft express project: $3.5M–$7M " +
      "(EB3 Construction Oct 2025). This is the format used in Sonny's pro forma example.",
    minLotWidthFt: 150,
    minLotDepthFt: 240,
    minLotSqFt: 36_000,
    tunnelLengthFt: 130,
    carsPerHour: { min: 100, max: 130 },
    staffRequired: { min: 3, max: 6 },
    investmentRangeUSD: { min: 3_500_000, max: 7_000_000 },
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
    // Sonny's pricing: $10–$26; TopCarWashCost 2026: basic $10–$16
    revenueModel: "Per-wash ($10–$26) + unlimited memberships ($25–$45/mo)",
    captureRateMultiplier: 1.0,
    // ICA Q4 2024 avg $15; Sonny's actual $14.27 — consistent
    avgTicketUSD: 15,
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
      "then transitions into a soft-touch friction section for maximum cleaning depth. " +
      "Requires a 150ft+ tunnel to fit both stages — increases lot requirement to ~1 acre. " +
      "Premium positioning, higher ticket price. Investment $4M–$9M " +
      "(EB3 Construction 2025 data for the 150ft tunnel class).",
    minLotWidthFt: 155,
    minLotDepthFt: 275,
    minLotSqFt: 42_625,
    tunnelLengthFt: 150,
    carsPerHour: { min: 90, max: 120 },
    staffRequired: { min: 4, max: 7 },
    // EB3 (Oct 2025): 120ft = $3.5–$8M+. 150ft premium hybrid adds $500K–$1M in equipment.
    investmentRangeUSD: { min: 4_000_000, max: 9_000_000 },
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
    // TopCarWashCost 2026: premium express $25–$32; memberships $30–$50/mo
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
      "Flex-Serve offers customers a choice: exterior-only express or full interior " +
      "service at a premium. The conveyor handles exterior cleaning while a dedicated " +
      "interior team services cars in a finishing bay. " +
      "Tommy Car Wash recommends 1.2–1.5 acres for flex-serve sites — larger than express " +
      "due to interior finishing bays. Car Wash Advisory quotes flex-serve avg ticket $12–$15. " +
      "Total investment $3.8M–$7.5M (larger building + interior bays vs express-only).",
    // Tommy Car Wash: flex sites require 1.2–1.5 acres = 52,272–65,340 sqft
    minLotWidthFt: 165,
    minLotDepthFt: 325,
    minLotSqFt: 53_625,
    tunnelLengthFt: 130,
    carsPerHour: { min: 20, max: 100 },
    // Car Wash Advisory: flex-serve throughput 20–100 cars/hr (wide range due to service split)
    staffRequired: { min: 6, max: 12 },
    // Tommy's flex lot ~1.2–1.5 acres means more land cost + larger building
    investmentRangeUSD: { min: 3_800_000, max: 7_500_000 },
    features: [
      "130ft conveyor tunnel (exterior)",
      "4–6 interior finish bays",
      "Dual service menu — express or full",
      "Vacuum, wipe-down, window cleaning",
      "Higher average ticket than express-only",
      "Membership + premium upsell revenue",
    ],
    // Sonny's: flex/full-serve target HH income >$50K
    bestFor: "Suburban markets (HH income $50K+, 1.2–1.5 acre lots) where customers value full service",
    notIdealFor: "High-speed urban locations where customers prioritise fast turnover",
    membershipFriendly: true,
    // Car Wash Advisory flex-serve avg $12–$15; full-service upsell brings blended avg higher
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
      "Every car receives exterior tunnel cleaning and interior service (vacuum, windows, " +
      "dash wipe) by attendants. Highest ticket price per car, lowest throughput. " +
      "Car Wash Advisory (2024): avg ticket $17–$20; throughput 10–30 cars/hr. " +
      "TopCarWashCost (2026): standard full-service $40–$65 per visit; " +
      "Maxx Builders (Oct 2025, Texas): full-service construction $2.5M–$4M (land excluded). " +
      "Total project including land: $3M–$6M depending on market.",
    minLotWidthFt: 165,
    minLotDepthFt: 280,
    minLotSqFt: 46_200,
    tunnelLengthFt: 130,
    // Car Wash Advisory: full-service 10–30 cars/hr
    carsPerHour: { min: 10, max: 30 },
    staffRequired: { min: 8, max: 20 },
    // Maxx Builders: construction $2.5M–$4M (Texas). With land: $3M–$6M.
    investmentRangeUSD: { min: 3_000_000, max: 6_000_000 },
    features: [
      "130ft conveyor tunnel",
      "Full interior service team",
      "Hand-dry and detail finish",
      "Premium vacuum + window cleaning",
      "Towel-dry crew at exit",
      "Customer lounge with refreshments",
      "Detailing add-on packages available",
    ],
    // Sonny's: full-serve targets HH income >$50K
    bestFor: "Affluent suburban markets (HH income $50K+) — customers who value quality over speed",
    notIdealFor: "High-traffic sites where throughput is critical",
    membershipFriendly: false,
    // TopCarWashCost 2026: full-service standard $40–$65; Car Wash Advisory avg $17–$20
    revenueModel: "Premium per-visit pricing ($35–$75/car)",
    captureRateMultiplier: 0.6,
    // Car Wash Advisory 2024 avg: $17–$20. TopCarWashCost 2026 range: $40–$65.
    // Using $48 as blended midpoint for a mid-market full-service operation.
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
      "A touchless in-bay automatic uses high-pressure water and detergents only — " +
      "no brushes contact the vehicle. The gantry moves over the stationary car. " +
      "Car Wash Advisory (2024): throughput 6–10 cars/hour; build cost $70K–$90K per bay + land. " +
      "TopCarWashCost (2026): touchless avg $12–$18 per wash. " +
      "Full project (unit + small building + land): $350K–$700K.",
    minLotWidthFt: 80,
    minLotDepthFt: 80,
    minLotSqFt: 6_400,
    tunnelLengthFt: null,
    // Car Wash Advisory: IBA takes 6–10 minutes per car = 6–10 cars/hr
    carsPerHour: { min: 6, max: 10 },
    staffRequired: { min: 0, max: 1 },
    // Car Wash Advisory: build $70K–$90K per bay + land ($200K–$500K)
    // Total: $270K–$590K; range accounts for land variation
    investmentRangeUSD: { min: 350_000, max: 700_000 },
    features: [
      "Touchless high-pressure gantry",
      "No brushes — zero scratch risk",
      "Fully automatic — no attendant needed",
      "Minimal lot (80×80 ft minimum)",
      "Pay-at-machine, 24/7 operation",
      "Ideal as gas station or retail add-on",
    ],
    bestFor: "Small lots, gas station add-ons, lower-traffic but high-margin locations",
    notIdealFor: "High-traffic locations — 6–10 cars/hr creates queues at peak",
    membershipFriendly: false,
    // TopCarWashCost 2026: touchless/in-bay $12–$18
    revenueModel: "Pay-per-wash ($12–$18/car)",
    captureRateMultiplier: 0.4,
    // TopCarWashCost 2026: in-bay avg $12–$18; using midpoint $14
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
      "the stationary vehicle. Delivers a deeper clean than touchless for everyday dirt. " +
      "Car Wash Advisory (2024): throughput 6–10 cars/hr; build $70K–$90K per bay + land. " +
      "Soft-touch equipment is typically lower cost than touchless, so full project " +
      "comes in slightly below: $300K–$600K.",
    minLotWidthFt: 80,
    minLotDepthFt: 80,
    minLotSqFt: 6_400,
    tunnelLengthFt: null,
    carsPerHour: { min: 6, max: 10 },
    staffRequired: { min: 0, max: 1 },
    // Car Wash Advisory: build $70K–$90K per bay + land
    investmentRangeUSD: { min: 300_000, max: 600_000 },
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
    revenueModel: "Pay-per-wash ($8–$16/car)",
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
      "Two side-by-side in-bay automatic units double throughput to 12–20 combined cars/hour. " +
      "Car Wash Advisory (2024): each unit $70K–$90K to build + land. " +
      "Two units + shared vacuum area + land: $600K–$1.1M total project.",
    minLotWidthFt: 90,
    minLotDepthFt: 120,
    minLotSqFt: 10_800,
    tunnelLengthFt: null,
    // 2× IBA: 2 × 6–10 cars/hr = 12–20 combined
    carsPerHour: { min: 12, max: 20 },
    staffRequired: { min: 0, max: 1 },
    investmentRangeUSD: { min: 600_000, max: 1_100_000 },
    features: [
      "2× in-bay gantry units side-by-side",
      "12–20 combined cars/hour",
      "Individual pay terminal per bay",
      "24/7 unattended operation",
      "Expandable to triple later",
      "Shared vacuum area",
    ],
    bestFor: "Medium-traffic sites where a tunnel is not yet justified",
    notIdealFor: "Sites with membership ambitions — IBAs do not support subscriptions well",
    membershipFriendly: false,
    revenueModel: "Pay-per-wash ($10–$18/car)",
    captureRateMultiplier: 0.55,
    avgTicketUSD: 14,
    diagramType: "inbay-dual",
  },

  {
    id: "inbay-triple",
    name: "Triple In-Bay Automatic",
    shortName: "In-Bay Triple",
    category: "inbay",
    categoryLabel: "In-Bay Automatic",
    tagline: "Three units — maximum output from a compact lot",
    description:
      "Three side-by-side in-bay automatic units provide 18–30 combined cars/hour. " +
      "Car Wash Advisory (2024): $70K–$90K per unit to build + land. " +
      "Three units + shared area + land: $900K–$1.5M total project. " +
      "Rivals a small express tunnel at a fraction of the capital cost.",
    minLotWidthFt: 100,
    minLotDepthFt: 180,
    minLotSqFt: 18_000,
    tunnelLengthFt: null,
    // 3× IBA: 3 × 6–10 cars/hr = 18–30 combined
    carsPerHour: { min: 18, max: 30 },
    staffRequired: { min: 0, max: 2 },
    investmentRangeUSD: { min: 900_000, max: 1_500_000 },
    features: [
      "3× in-bay gantry units side-by-side",
      "18–30 combined cars/hour",
      "Individual pay terminal per bay",
      "24/7 unattended operation",
      "Shared vacuum area",
      "Expandable — add a fourth unit later",
    ],
    bestFor: "Medium-traffic sites — efficient capital use vs a full tunnel",
    notIdealFor: "Sites with strong membership potential — IBAs do not support subscriptions",
    membershipFriendly: false,
    revenueModel: "Pay-per-wash ($10–$18/car), potential fleet accounts",
    captureRateMultiplier: 0.7,
    avgTicketUSD: 15,
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
      "Four self-serve bays — the absolute lowest entry point into the car wash business. " +
      "Car Wash Advisory (2024): avg ticket ~$5 per wash; throughput 3–6 cars/hr per bay. " +
      "TopCarWashCost (2026): self-serve starts at $4–$7. " +
      "Build cost $25K–$30K per bay + land (Car Wash Advisory 2024). " +
      "Total project for 4 bays: $280K–$550K. Near-zero operating costs.",
    minLotWidthFt: 80,
    minLotDepthFt: 120,
    minLotSqFt: 9_600,
    tunnelLengthFt: null,
    // Car Wash Advisory: 3–6 cars/hr per bay; 4 bays = 12–24 combined
    carsPerHour: { min: 12, max: 24 },
    staffRequired: { min: 0, max: 1 },
    // Car Wash Advisory: $25K–$30K per bay to build + land
    // 4 bays = $100–$120K construction + land ($150K–$400K) = $250K–$520K total
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
    // Car Wash Advisory: avg ~$5; TopCarWashCost 2026: $4–$7 start
    revenueModel: "Time-based coin/card ($4–$8 per session), vacuum revenue",
    captureRateMultiplier: 0.25,
    avgTicketUSD: 6,
    diagramType: "self-serve",
    diagramParams: { bays: 4 },
  },

  {
    id: "self-serve-6",
    name: "6-Bay Self-Serve",
    shortName: "Self-Serve 6-Bay",
    category: "selfserve",
    categoryLabel: "Self-Serve",
    tagline: "Coin-op classic — consistent community revenue, truck-friendly",
    description:
      "Six self-serve bays where customers use a high-pressure wand at their own pace. " +
      "Car Wash Advisory (2024): build $25K–$30K per bay + land; avg ticket ~$5. " +
      "6 bays = $150K–$180K construction + land + structure: total $500K–$900K. " +
      "AVW 2025 Price List: Eurovac 5-bay vacuum island from $17,360. " +
      "Generates consistent coin/card revenue 24/7 with minimal maintenance.",
    minLotWidthFt: 80,
    minLotDepthFt: 200,
    minLotSqFt: 16_000,
    tunnelLengthFt: null,
    // 6 bays × 3–6 cars/hr = 18–36 combined
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
    revenueModel: "Time-based coin/card ($4–$8 per session), vacuum and vending revenue",
    captureRateMultiplier: 0.35,
    avgTicketUSD: 7,
    diagramType: "self-serve",
    diagramParams: { bays: 6 },
  },

  {
    id: "self-serve-8",
    name: "8-Bay Self-Serve",
    shortName: "Self-Serve 8-Bay",
    category: "selfserve",
    categoryLabel: "Self-Serve",
    tagline: "Large self-serve site — maximum coin-op revenue, truck and RV friendly",
    description:
      "Eight bays is the maximum practical self-serve configuration. " +
      "Car Wash Advisory (2024): $25K–$30K per bay; 8 bays = $200K–$240K construction + land + structure. " +
      "Maxx Builders (Oct 2025): self-serve total projects $0.8M–$1.5M. " +
      "AVW 2025 Price List: Eurovac 15-bay vacuum island up to $48,025. " +
      "Still serves the DIY segment (trucks, vans, RVs) that a tunnel cannot capture.",
    minLotWidthFt: 80,
    minLotDepthFt: 250,
    minLotSqFt: 20_000,
    tunnelLengthFt: null,
    // 8 bays × 3–6 cars/hr = 24–48 combined
    carsPerHour: { min: 24, max: 48 },
    staffRequired: { min: 0, max: 1 },
    // Maxx Builders: self-serve $0.8M–$1.5M total (aligns with 8-bay + larger structure)
    investmentRangeUSD: { min: 700_000, max: 1_300_000 },
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
    revenueModel: "Time-based coin/card ($4–$10 per session), vacuum and vending revenue",
    captureRateMultiplier: 0.45,
    avgTicketUSD: 8,
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
      "Combines a 130ft express tunnel with 4–6 self-serve bays. " +
      "Self-serve bays handle trucks/oversized vehicles that may not fit the tunnel. " +
      "Total project = tunnel cost ($3.5M–$7M) + self-serve bays ($150K–$250K) " +
      "on a larger 1.2–1.5 acre lot. Combined: $4M–$8M (EB3 Construction & Maxx Builders 2025).",
    minLotWidthFt: 175,
    minLotDepthFt: 245,
    minLotSqFt: 42_875,
    tunnelLengthFt: 130,
    carsPerHour: { min: 100, max: 130 },
    staffRequired: { min: 3, max: 7 },
    investmentRangeUSD: { min: 4_000_000, max: 8_000_000 },
    features: [
      "130ft express conveyor tunnel",
      "4–6 self-serve bays (trucks + DIY)",
      "Unlimited membership on tunnel",
      "Shared vacuum stations across site",
      "Dual revenue streams from day one",
      "Captures 100% of car wash customer types",
      "Higher revenue per sqft than either alone",
    ],
    bestFor: "Large lots (1.2+ acres) with a diverse customer base — maximises total site revenue",
    notIdealFor: "Small or narrow lots — requires 42,000+ sqft minimum",
    membershipFriendly: true,
    revenueModel: "Tunnel: per-wash ($10–$26) + memberships ($25–$45/mo). Bays: coin/card per session.",
    captureRateMultiplier: 1.1,
    avgTicketUSD: 18,
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
      "Pairs 1–2 in-bay automatic units with 4–6 self-serve bays. " +
      "Car Wash Advisory (2024): IBA $70K–$90K per unit + self-serve $25K–$30K per bay + land. " +
      "Total project: $900K–$1.7M. Fits lots too small for a tunnel.",
    minLotWidthFt: 130,
    minLotDepthFt: 180,
    minLotSqFt: 23_400,
    tunnelLengthFt: null,
    carsPerHour: { min: 20, max: 40 },
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
    revenueModel: "IBA: pay-per-wash ($10–$18). Bays: coin/card per session ($4–$8).",
    captureRateMultiplier: 0.65,
    avgTicketUSD: 12,
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
      "The tunnel runs unlimited memberships while the detail centre upsells monthly " +
      "details, paint correction, and ceramic coatings. " +
      "Total project = tunnel ($3.5M–$7M) + indoor detail bays ($400K–$1M): $4M–$8M total " +
      "(EB3 Construction 2025 + ICA operator benchmarks).",
    minLotWidthFt: 160,
    minLotDepthFt: 280,
    minLotSqFt: 44_800,
    tunnelLengthFt: 130,
    carsPerHour: { min: 90, max: 110 },
    staffRequired: { min: 5, max: 15 },
    investmentRangeUSD: { min: 4_000_000, max: 8_000_000 },
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
      "A hand wash centre relies entirely on trained staff — no conveyor, no gantry. " +
      "TopCarWashCost (2026): full-service standard $40–$65; premium $80–$110. " +
      "Lowest capex of any format (no automated equipment). Labour is the primary cost. " +
      "Popular in urban centres and luxury residential markets.",
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
    // TopCarWashCost 2026: full-service $40–$65; premium with detailing $80–$110
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
      "An express exterior tunnel designed for the growing EV market: EV-safe conveyor " +
      "(no undercarriage spray near battery packs), Level 2 and DC fast chargers at vacuum " +
      "stations, EV membership tiers. " +
      "Base tunnel investment $3.5M–$7M (EB3 Construction 2025) plus EV charging " +
      "infrastructure $300K–$800K, bringing total to $3.8M–$7.8M.",
    minLotWidthFt: 150,
    minLotDepthFt: 260,
    minLotSqFt: 39_000,
    tunnelLengthFt: 130,
    carsPerHour: { min: 90, max: 115 },
    staffRequired: { min: 3, max: 6 },
    // Standard 130ft tunnel ($3.5M–$7M) + EV charging ($300K–$800K)
    investmentRangeUSD: { min: 3_800_000, max: 7_800_000 },
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
    revenueModel: "Wash memberships ($25–$45/mo) + EV charging revenue per kWh",
    captureRateMultiplier: 0.92,
    avgTicketUSD: 22,
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
      "A container-based or fully mobile car wash requires no permanent foundation " +
      "and can be relocated if the site underperforms. Typically a single IBA or compact " +
      "self-serve inside a converted shipping container. Used as a market test or for " +
      "semi-permanent placements in car parks, supermarkets, and event venues. " +
      "Lowest investment of any format: $80K–$350K depending on equipment spec.",
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
