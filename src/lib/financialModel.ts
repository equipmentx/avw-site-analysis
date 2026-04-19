/**
 * Financial Model derived from the Express Car Wash Investment Pro Forma spreadsheet,
 * updated with 2024-2025 industry benchmarks.
 *
 * Data sources:
 *   - ICA (International Carwash Association) 2024 Industry Report
 *   - Rinsed Q4 2024 Car Wash Industry Benchmarks
 *   - MMCG Invest / Motor City Wash Works 2024/2025 project cost data
 *   - ZipRecruiter / BLS 2024 wage data for car wash operators
 *   - SharpSheets 2024 car wash financial model benchmarks
 *
 * HOW IT WORKS:
 * 1. The user's budget is their Total Project Cost — the formula doesn't change, the budget drives it.
 * 2. Based on the budget, we determine what TYPE of car wash is feasible.
 * 3. The operating model (pricing tiers, costs per car, salaries, SG&A) is FIXED at 2024-2025 benchmarks.
 * 4. Revenue is driven by traffic (from TomTom real-time road data), not by the budget.
 * 5. The budget drives financing: 20% down payment, 80% bank loan at 7% for 20 years.
 */

import type { FinancialProjection, FinancialAssumptions, YearlyProjection } from "./types";
import type { WageRates } from "./iloWages";

// ─── Car Wash Format Tiers ────────────────────────────────────────────────────
// Budget determines what you can realistically build.
// Operating parameters change per format — you can't run an express tunnel model
// on a self-serve budget.

export interface CarWashFormat {
  id:          "none" | "self_serve" | "in_bay" | "mini_tunnel" | "express" | "premium";
  name:        string;
  description: string;
  minBudgetUSD: number;
  captureRate:  number;   // % of passing daily traffic that stops
  avgRevPerCar: number;   // weighted avg revenue per wash (USD)
  feasible:     boolean;
}

export function getCarWashFormat(budgetUSD: number): CarWashFormat {
  if (budgetUSD >= 4_000_000) {
    return {
      id: "premium", name: "Premium Express Tunnel", feasible: true,
      description: "Full-scale flagship tunnel (100ft+) with unlimited membership kiosks, free vacuums, and all amenities. The highest-revenue format in the industry.",
      minBudgetUSD: 4_000_000, captureRate: 0.013, avgRevPerCar: 14.00,
    };
  }
  if (budgetUSD >= 3_500_000) {
    return {
      id: "express", name: "Express Tunnel (Standard)", feasible: true,
      description: "The industry's proven sweet spot — a conveyor-belt tunnel (80–100ft) with pay stations and free vacuums. Built around 2024-2025 industry benchmarks.",
      minBudgetUSD: 3_500_000, captureRate: 0.0085, avgRevPerCar: 14.00,
    };
  }
  if (budgetUSD >= 2_000_000) {
    return {
      id: "mini_tunnel", name: "Mini Express Tunnel", feasible: true,
      description: "A shorter conveyor-belt tunnel (40–70ft). Lower throughput than the standard express but still a proper automated wash. Good for smaller markets.",
      minBudgetUSD: 2_000_000, captureRate: 0.007, avgRevPerCar: 12.00,
    };
  }
  if (budgetUSD >= 800_000) {
    return {
      id: "in_bay", name: "In-Bay Automatic", feasible: true,
      description: "A rollover machine — customers pull in and stay in the car while the machine moves over them. Lower throughput (10–15 cars/hr) but much lower build cost.",
      minBudgetUSD: 800_000, captureRate: 0.005, avgRevPerCar: 10.00,
    };
  }
  if (budgetUSD >= 300_000) {
    return {
      id: "self_serve", name: "Self-Serve Bays", feasible: true,
      description: "Customers wash their own car using your wands and foamers. Lowest revenue per car, but lowest build cost. Often used as a stepping stone to a larger format.",
      minBudgetUSD: 300_000, captureRate: 0.003, avgRevPerCar: 6.00,
    };
  }
  return {
    id: "none", name: "Not Feasible", feasible: false,
    description: "Below the minimum investment needed to build any form of car wash facility. Consider increasing your budget or partnering with another investor.",
    minBudgetUSD: 300_000, captureRate: 0, avgRevPerCar: 0,
  };
}

// ─── Operating Constants (2024-2025 Industry Benchmarks) ─────────────────────
//
// Sources:
//   ICA 2024 Industry Report, Rinsed Q4 2024 Benchmarks, SharpSheets 2024,
//   ZipRecruiter/BLS 2024 wage data, MMCG Invest / Motor City Wash Works project costs.

// Pricing tiers — 2024-2025 US express tunnel market
const PRICING_TIERS = [
  { name: "Basic",          price: 9,     varChem: 0.45, mixPct: 0.40 },
  { name: "Standard",       price: 14,    varChem: 0.60, mixPct: 0.25 },
  { name: "Premium",        price: 20,    varChem: 0.75, mixPct: 0.20 },
  { name: "Ultimate",       price: 26,    varChem: 0.90, mixPct: 0.15 },
];

const UNLIMITED_TIERS = [
  { name: "Standard Unlimited", price: 26.00, varChem: 0.60, mixPct: 0.65 },
  { name: "Premium Unlimited",  price: 45.00, varChem: 0.90, mixPct: 0.35 },
];

// Weighted averages — 2024-2025 benchmarks
// ICA 2024: average ticket $14; Rinsed Q4 2024: avg membership $30/month
const WTD_AVG_PRICE_PER_CAR   = 14.00;   // 2024 industry average ticket price
const WTD_AVG_PRICE_UNLIMITED = 30.00;   // 2024 average membership revenue per member/month
const VAR_CHEM_COST_PER_CAR   = 0.64;    // ICA 2024: chemical cost per car (was $1.167 in 2017)

// Variable costs per car — 2024-2025 benchmarks
const VAR_COST_PER_CAR = {
  utilities:    0.55 * 0.9,  // 90% allocated to COGS
  repairsMaint: 0.28 * 0.5,  // 50% allocated to COGS
  autoClaims:   0.06,
  supplies:     0.04,
};
const TOTAL_VAR_COST_PER_CAR = Object.values(VAR_COST_PER_CAR).reduce((a, b) => a + b, 0);

// SG&A — 2024-2025 (insurance costs have risen since 2017)
const FIXED_SGA = {
  marketingMonthly:       2_500,
  bankChargesMonthly:     250,
  insuranceAnnual:        38_000,   // ICA 2024: ~$35-42K typical
  officeMiscMonthly:      1_500,
  computerInternetMthly:  1_500,
};

// Labor — 2024-2025 US benchmarks (ZipRecruiter / BLS data)
// Car wash manager: $16-22/hr avg; attendants/FT: $13-16/hr avg
const LABOR = {
  siteManager: { hourlyRate: 19, hoursPerYear: 2080 },  // 2024 avg: $16-22/hr
  fullTime1:   { hourlyRate: 15, hoursPerYear: 2080 },  // 2024 avg: $13-16/hr
  fullTime2:   { hourlyRate: 15, hoursPerYear: 2080 },
  burden:      0.097 + 0.033,  // FICA taxes + benefits
  yr2Raise:    0.04,           // 4% annual raise (moderating from 8% post-COVID)
};

// Depreciation from Excel rows 58-59
const DEPR = {
  buildingYears:   30,
  equipmentYears:  7,
};

// Traffic & subscriber model from Excel rows 7-27
const TRAFFIC = {
  annualEscalator:   0.02,   // 2% traffic growth per year (Excel row 7)
  daysPerMonth:      26,     // operational days (Excel row 8)
  discountRate:      0.10,   // coupons/discounts (Excel row 9)
  ccFeeRate:         0.02,   // credit card processing (Excel row 10)
  newSubsPerMonth:   100,    // new unlimited subscribers per month (Excel row 26)
  avgWashesPerMonth: 2.5,    // avg washes per subscriber per month (Excel row 23)
  annualSubGrowth:   0.08,   // subscriber growth after year 1 (Excel row 28)
};

// Financing from Excel rows 92-111
const FINANCING = {
  downPaymentPct:  0.20,   // 20% down payment
  loanFeePct:      0.02,   // 2% loan origination fee
  annualInterest:  0.07,   // 7% annual interest rate
  loanTermYears:   20,     // 20-year loan
  propertyTaxRate: 0.015,  // 1.5% of land value per year
  landPct:         0.239,  // land as % of Excel baseline (875K / 3663K)
  reinvestYr1:     0.03,   // 3% reinvestment year 1 (Excel row 86)
  reinvestYr2to5:  0.06,   // 6% reinvestment years 2-5 (Excel row 87)
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcMonthlyPayment(principal: number, annualRate: number, years: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcAnnualLabor(year: number, staffHourly: number, managerHourly: number): number {
  const sm  = managerHourly * LABOR.siteManager.hoursPerYear;
  const ft1 = staffHourly   * LABOR.fullTime1.hoursPerYear;
  const ft2 = staffHourly   * LABOR.fullTime2.hoursPerYear;
  const base = sm + ft1 + ft2;
  // Excel rows 73-74: FT staff get raises each year
  const raise = Math.pow(1 + LABOR.yr2Raise, Math.max(0, year - 1));
  return base * raise * (1 + LABOR.burden);
}

// ─── Single year projection ───────────────────────────────────────────────────

function buildYearProjection(
  year:              number,
  baseDailyTraffic:  number,
  format:            CarWashFormat,
  landCost:          number,
  equipmentCost:     number,
  constructionCost:  number,
  loanAmount:        number,
  monthlyDebtService: number,
  staffHourly:       number,
  managerHourly:     number,
): YearlyProjection {

  // Traffic grows 2%/year (Excel row 7)
  const dailyTraffic = baseDailyTraffic * Math.pow(1 + TRAFFIC.annualEscalator, year - 1);

  // Standard cars per period
  const dailyCars   = dailyTraffic * format.captureRate;
  const monthlyCars = dailyCars * TRAFFIC.daysPerMonth;
  const annualStandardCars = monthlyCars * 12;

  // Unlimited subscribers ramp up over time
  const subsPerMonth = TRAFFIC.newSubsPerMonth * Math.pow(1 + TRAFFIC.annualSubGrowth, year - 1);
  const totalSubs = Math.min(subsPerMonth * 12 * year, annualStandardCars * 0.40); // cap at 40%
  const unlimitedWashes = totalSubs * TRAFFIC.avgWashesPerMonth * 12;

  const totalAnnualCars = annualStandardCars + unlimitedWashes;

  // Revenue — use format's avg revenue per car (scaled from Excel for non-express formats)
  const revenueScale = format.avgRevPerCar / WTD_AVG_PRICE_PER_CAR;
  const standardRevGross   = annualStandardCars * format.avgRevPerCar;
  const unlimitedRevGross  = totalSubs * WTD_AVG_PRICE_UNLIMITED * revenueScale * 12;
  const grossRevenue       = standardRevGross + unlimitedRevGross;

  // Apply discounts and CC fees (Excel rows 9-10)
  const netRevenue = grossRevenue * (1 - TRAFFIC.discountRate) * (1 - TRAFFIC.ccFeeRate);

  // COGS — variable costs per car (FIXED from Excel, same for all formats)
  const chemCost  = totalAnnualCars * VAR_CHEM_COST_PER_CAR;
  const varCost   = totalAnnualCars * TOTAL_VAR_COST_PER_CAR;
  const laborCOGS = calcAnnualLabor(year, staffHourly, managerHourly);
  const totalCOGS = chemCost + varCost + laborCOGS;

  const grossProfit = netRevenue - totalCOGS;

  // SG&A — fixed costs (from Excel, same for all formats)
  const fixedSGA =
    FIXED_SGA.marketingMonthly    * 12 +
    FIXED_SGA.bankChargesMonthly  * 12 +
    FIXED_SGA.insuranceAnnual          +
    FIXED_SGA.officeMiscMonthly   * 12 +
    FIXED_SGA.computerInternetMthly * 12;

  // Property tax (Excel row 89: 1.5% of land, escalating 2%/yr)
  const propTax = landCost * FINANCING.propertyTaxRate * Math.pow(1.02, year - 1);

  const totalSGA  = fixedSGA + propTax;
  const ebit      = grossProfit - totalSGA;

  // Depreciation (Excel rows 58-59)
  const deprBuilding   = constructionCost / DEPR.buildingYears;
  const deprEquipment  = equipmentCost    / DEPR.equipmentYears;
  const depreciation   = deprBuilding + deprEquipment;
  const ebitda         = ebit + depreciation;

  // Interest (approximated from Excel amortization schedule row 19+)
  const annualInterest = year <= FINANCING.loanTermYears
    ? loanAmount * FINANCING.annualInterest * Math.pow(0.95, year - 1)
    : 0;

  const ebt       = ebit - annualInterest;
  const netIncome = ebt; // No corporate tax (pass-through entity, Excel row 32)

  const margin = netRevenue > 0 ? ebitda / netRevenue : 0;

  return {
    year:        `Year ${year}`,
    revenue:     Math.round(netRevenue),
    cogs:        Math.round(totalCOGS),
    grossProfit: Math.round(grossProfit),
    sgna:        Math.round(totalSGA),
    ebitda:      Math.round(ebitda),
    netIncome:   Math.round(netIncome),
    cars:        Math.round(totalAnnualCars),
    margin:      Math.round(margin * 100),
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function runFinancialModel(
  estimatedDailyTraffic: number,
  investmentBudget?: number,
  wageRates?: WageRates,
  actualLandCostUSD?: number | null,                               // real ATTOM parcel land value — overrides the 23.9% ratio
  actualLandCostSource?: FinancialAssumptions["landCostSource"],   // which ATTOM field it came from
): FinancialProjection {

  const budget = investmentBudget && investmentBudget > 0 ? investmentBudget : 0;

  // Use live wages if available (ILO or World Bank); fall back to Excel 2017 baseline
  // When wages are unavailable, the Excel rates are used but clearly disclosed as such.
  const wagesAvailable = wageRates && wageRates.source !== "unavailable" && wageRates.staffHourlyUSD > 0;
  const staffHourly   = wagesAvailable ? wageRates!.staffHourlyUSD   : LABOR.fullTime1.hourlyRate;
  const managerHourly = wagesAvailable ? wageRates!.managerHourlyUSD : LABOR.siteManager.hourlyRate;

  // ── CapEx breakdown ─────────────────────────────────────────────────────────
  // The user's budget IS the Total Project Cost.
  // We split it using the same proportions as the Excel baseline:
  //   Land          23.9%  ($875K / $3,663K)
  //   Equipment     32.8%  ($1,200K / $3,663K)
  //   Construction  29.5%  ($1,080K / $3,663K)
  //   Fees + misc   13.8%  ($250K + $150K + contingency / $3,663K)
  // 2025 midpoint: MMCG / Motor City Wash Works data — express tunnel $3.5M-$6M suburban
  const totalBase = budget > 0 ? budget : 4_500_000;

  // Determine format: if no budget given, use totalBase ($4.5M default) so projections
  // are always computed. Budget=0 previously caused format.feasible=false → zeroed graphs.
  const format = getCarWashFormat(budget > 0 ? budget : totalBase);

  // Use real ATTOM parcel land value when available; fall back to Pro Forma ratio (23.9%)
  // This keeps the financial model consistent with the Investment Suggestion panel land line item
  const useRealLand       = actualLandCostUSD != null && actualLandCostUSD > 0;
  const landCost          = useRealLand ? Math.round(actualLandCostUSD!) : Math.round(totalBase * 0.239);
  const resolvedLandSource: FinancialAssumptions["landCostSource"] =
    actualLandCostSource && useRealLand ? actualLandCostSource : "pro-forma-ratio";

  const equipmentCost     = Math.round(totalBase * 0.328);
  const constructionCost  = Math.round(totalBase * 0.295);
  const feesCost          = totalBase - Math.round(totalBase * 0.239) - equipmentCost - constructionCost;
  const contingency       = Math.round(constructionCost * 0.10);
  const totalProjectCost  = totalBase + contingency;

  // ── Financing (Excel section rows 92-110) ──────────────────────────────────
  const downPayment       = Math.round(totalProjectCost * FINANCING.downPaymentPct);
  const loanAmount        = totalProjectCost - downPayment;
  const loanFees          = Math.round(loanAmount * FINANCING.loanFeePct);
  const netLoanProceeds   = loanAmount - loanFees;
  const monthlyDebtService = calcMonthlyPayment(
    netLoanProceeds,
    FINANCING.annualInterest,
    FINANCING.loanTermYears,
  );

  // ── 5-year projections ─────────────────────────────────────────────────────
  const projections: YearlyProjection[] = [];

  if (!format.feasible || estimatedDailyTraffic <= 0) {
    // Return zeroed projections if budget is too low or no traffic data
    for (let yr = 1; yr <= 5; yr++) {
      projections.push({
        year: `Year ${yr}`, revenue: 0, cogs: 0, grossProfit: 0,
        sgna: 0, ebitda: 0, netIncome: 0, cars: 0, margin: 0,
      });
    }
  } else {
    for (let yr = 1; yr <= 5; yr++) {
      projections.push(buildYearProjection(
        yr, estimatedDailyTraffic, format,
        landCost, equipmentCost, constructionCost,
        loanAmount, monthlyDebtService,
        staffHourly, managerHourly,
      ));
    }
  }

  const year1 = projections[0];
  const year3 = projections[2];
  const year5 = projections[4];

  // ── Payback (how many years to recover down payment) ──────────────────────
  let cumulative = -downPayment;
  let paybackYears = 0;
  for (let i = 0; i < projections.length; i++) {
    cumulative += projections[i].netIncome;
    if (cumulative >= 0 && paybackYears === 0) paybackYears = i + 1;
  }
  if (paybackYears === 0) paybackYears = 7; // beyond 5-year window

  // ── IRR approximation ──────────────────────────────────────────────────────
  const irr5Year = year1.revenue > 0 && downPayment > 0
    ? Math.min(35, Math.round((year5.netIncome / downPayment) * 100 * 0.6))
    : 0;

  // ── Break-even monthly revenue ─────────────────────────────────────────────
  const annualFixed = year1.sgna + monthlyDebtService * 12;
  const contributionMargin = year1.revenue > 0
    ? 1 - (year1.cogs / year1.revenue)
    : 0.5;
  const breakEvenMonthly = contributionMargin > 0
    ? Math.round(annualFixed / contributionMargin / 12)
    : 0;

  const dailyCarsWashed = Math.round(estimatedDailyTraffic * format.captureRate);

  const assumptions: FinancialAssumptions = {
    dailyTrafficCount: estimatedDailyTraffic,
    captureRate:       format.captureRate,
    dailyCarsWashed,
    avgRevenuePerCar:  format.avgRevPerCar,
    totalCapex:        totalProjectCost,
    landCost,
    landCostSource:    resolvedLandSource,
    equipmentCost,
    constructionCost,
    interestRate:      FINANCING.annualInterest,
    loanTermYears:     FINANCING.loanTermYears,
    staffHourlyUSD:    parseFloat(staffHourly.toFixed(2)),
    managerHourlyUSD:  parseFloat(managerHourly.toFixed(2)),
    wageSource:        wagesAvailable ? (wageRates!.source as any) : "excel-baseline",
    wagePeriod:        wagesAvailable ? wageRates!.period : "2024-2025 US industry benchmarks",
    wageNote:          wagesAvailable
      ? wageRates!.note
      : "Live wage data unavailable — using 2024-2025 US industry benchmarks ($15/hr staff · $19/hr manager; ZipRecruiter/BLS 2024). Verify local labour costs with an HR consultant.",
  };

  return {
    totalProjectCost,
    downPayment,
    loanAmount:              netLoanProceeds,
    monthlyDebtService:      Math.round(monthlyDebtService),
    year1Revenue:            year1.revenue,
    year1EBITDA:             year1.ebitda,
    year1NetIncome:          year1.netIncome,
    year3Revenue:            year3.revenue,
    year5Revenue:            year5.revenue,
    paybackYears,
    irr5Year,
    breakEvenMonthlyRevenue: breakEvenMonthly,
    projections,
    assumptions,
  };
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}
