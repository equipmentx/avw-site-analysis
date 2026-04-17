// ── Shared country cost data ─────────────────────────────────────────────────
// Used by both /api/analyze and /api/decision

export interface CountryEntry {
  multiplier: number; // relative to US = 1.0
  name: string;
  context: string;
  minViableUSD: number; // minimum budget to build a real car wash tunnel
}

// US Excel model baseline: $3,663,000 (Express Car Wash Investment Pro Forma, 2017)
// minViable = baseline × multiplier × 0.41 (minimum viable fraction for a working tunnel)
export const COUNTRY_DATA: Record<string, CountryEntry> = {
  US: { multiplier: 1.00, minViableUSD: 1_500_000, name: "United States",    context: "US market — benchmark pricing with high land and labor costs. Equipment from US suppliers (Belanger, PDQ, Washworld)." },
  GB: { multiplier: 0.88, minViableUSD: 1_320_000, name: "United Kingdom",   context: "UK market — slightly lower land costs outside London, comparable equipment costs. Factor in VAT." },
  AU: { multiplier: 0.92, minViableUSD: 1_380_000, name: "Australia",        context: "Australian market — high labor costs but competitive equipment sourcing. High car ownership per capita." },
  CA: { multiplier: 0.93, minViableUSD: 1_395_000, name: "Canada",           context: "Canadian market — similar to US with regional cost variations. Cold weather requires heated bays." },
  AE: { multiplier: 0.78, minViableUSD: 1_170_000, name: "UAE",              context: "UAE market — lower construction labor, moderate land costs in commercial zones. High vehicle ownership, strong car culture." },
  SA: { multiplier: 0.72, minViableUSD: 1_080_000, name: "Saudi Arabia",     context: "Saudi market — lower labor costs, strong government infrastructure support. High dust environment increases wash frequency." },
  ZA: { multiplier: 0.22, minViableUSD:   330_000, name: "South Africa",     context: "South African market — significantly lower land and labor costs vs US. Growing middle class driving car ownership." },
  NG: { multiplier: 0.14, minViableUSD:   210_000, name: "Nigeria",          context: "Nigerian market — factor in generator costs ($30-50K), security infrastructure, and 40-60% import duties on equipment." },
  GH: { multiplier: 0.13, minViableUSD:   195_000, name: "Ghana",            context: "Ghanaian market — attractive entry costs, growing middle-class demand. Factor in equipment import tariffs." },
  KE: { multiplier: 0.11, minViableUSD:   165_000, name: "Kenya",            context: "Kenyan market — very low land and labor costs, but factor in equipment import duties of 35-50%." },
  IN: { multiplier: 0.18, minViableUSD:   270_000, name: "India",            context: "Indian market — low labor and construction costs, large urbanizing consumer base. Equipment often sourced locally at lower cost." },
  BR: { multiplier: 0.34, minViableUSD:   510_000, name: "Brazil",           context: "Brazilian market — moderate costs, strong car culture and urban density. High import taxes on equipment." },
  MX: { multiplier: 0.30, minViableUSD:   450_000, name: "Mexico",           context: "Mexican market — lower costs than US, proximity to US supply chains. Growing middle-class car ownership." },
  JP: { multiplier: 0.95, minViableUSD: 1_425_000, name: "Japan",            context: "Japanese market — high precision equipment standards, premium consumer expectations. In-bay automatic tunnels are dominant format." },
  CN: { multiplier: 0.35, minViableUSD:   525_000, name: "China",            context: "Chinese market — low construction costs but rapidly rising land costs in Tier 1 cities. Strong domestic equipment suppliers." },
  DE: { multiplier: 0.82, minViableUSD: 1_230_000, name: "Germany",          context: "German market — high labor costs offset by efficient construction. Washbox and tunnel formats both common." },
  FR: { multiplier: 0.80, minViableUSD: 1_200_000, name: "France",           context: "French market — moderate land costs outside Paris, established car wash industry with strong brand presence." },
  NL: { multiplier: 0.85, minViableUSD: 1_275_000, name: "Netherlands",      context: "Dutch market — premium real estate costs, environmentally regulated operations. High car wash usage per capita." },
  SG: { multiplier: 0.90, minViableUSD: 1_350_000, name: "Singapore",        context: "Singapore market — very high land costs, strong per-capita vehicle ownership but limited land availability." },
  EM: { multiplier: 0.50, minViableUSD:   750_000, name: "Emerging Market",  context: "Emerging market — estimate based on regional cost indices. Verify all costs with local contractors and suppliers." },
};

export function getCountry(code: string): CountryEntry {
  return COUNTRY_DATA[code] ?? COUNTRY_DATA["EM"];
}
