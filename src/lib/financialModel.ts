/**
 * Financial Model derived from the 404.xlsx car wash investment spreadsheet.
 * Models a full-service express car wash operation over 5 years.
 */

import type { FinancialProjection, FinancialAssumptions, YearlyProjection } from "./types";

// ─── Pricing Tiers from Excel "Key Assumptions & Drivers" ───────────────────
const PRICING_TIERS = [
  { name: "Bronze",        price: 9,     varChem: 0.58, mixPct: 0.50 },
  { name: "Silver",        price: 12,    varChem: 1.00, mixPct: 0.10 },
  { name: "Gold",          price: 18,    varChem: 1.50, mixPct: 0.10 },
  { name: "Best In Class", price: 23,    varChem: 2.09, mixPct: 0.30 },
];

const UNLIMITED_TIERS = [
  { name: "Gold Unlimited",price: 19.99, varChem: 1.50, mixPct: 0.70 },
  { name: "BIC Unlimited", price: 40,    varChem: 2.09, mixPct: 0.30 },
];

// Weighted averages from Excel
const WTD_AVG_PRICE_PER_CAR   = 12.96;  // standard wash weighted avg
const WTD_AVG_PRICE_UNLIMITED = 25.993; // unlimited plan weighted avg
const UNLIMITED_PLAN_PRICE    = 25.993; // blended for model
const VAR_CHEM_COST_PER_CAR   = 1.167;

// ─── Operating Cost Assumptions (per car, from Excel) ────────────────────────
const VARIABLE_COST_PER_CAR = {
  utilities:    0.66,
  repairsMaint: 0.29,
  autoClaims:   0.06,
  supplies:     0.04,
  wtdAvgChem:   1.23,  // blended chemical cost
  total:        2.28,  // total variable excl. chemicals
};

// ─── Fixed SG&A Assumptions (monthly/annual) ─────────────────────────────────
const FIXED_COSTS = {
  marketingOneTime:     50_000,
  marketingMonthly:     2_500,
  bankChargesMonthly:   200,
  insuranceAnnual:      30_000,
  officeMiscMonthly:    1_500,
  computerInternetMtly: 1_500,
};

// ─── Salary Assumptions ──────────────────────────────────────────────────────
const LABOR = {
  siteManager: { hourlyRate: 30, hoursPerYear: 2080, sgaAlloc: 0.5 },
  fullTime1:   { hourlyRate: 16, hoursPerYear: 2080, sgaAlloc: 1.0 },
  fullTime2:   { hourlyRate: 16, hoursPerYear: 2080, sgaAlloc: 1.0 },
  burdenTaxes: 0.097,
  burdenBenefits: 0.033,
};

// ─── CapEx Defaults ──────────────────────────────────────────────────────────
export const DEFAULT_CAPEX = {
  land:             875_000,
  tapCityFees:      250_000,
  siteImprovements: 150_000,
  equipment:      1_200_000,
  construction:   1_080_000,
  contingency:       0.10,   // 10% on construction
  totalBase:      3_663_000,
};

// ─── Financing Defaults ───────────────────────────────────────────────────────
const FINANCING = {
  downPaymentPct:   0.20,
  loanFeePct:       0.02,
  annualInterest:   0.07,
  loanTermYears:    20,
  taxDrawsPct:      0.25,
};

// ─── Traffic & Capture Assumptions ───────────────────────────────────────────
const TRAFFIC = {
  captureRate:       0.02,   // 2% of daily traffic gets captured
  daysPerMonth:      26,
  annualEscalator:   0.02,
  avgWashesPerMonth: 2.5,
};

// ─── Subscriber Ramp ─────────────────────────────────────────────────────────
const SUBSCRIBER_RAMP = {
  newPerMonth:     100,
  initialMonths:   12,
  annualGrowth:    0.08,
};

// ─── Depreciation ─────────────────────────────────────────────────────────────
const DEPR = {
  buildingYears:  30,
  equipmentYears:  7,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcMonthlyPayment(principal: number, annualRate: number, years: number): number {
  const r = annualRate / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcAnnualLabor(): number {
  const sm = LABOR.siteManager.hourlyRate * LABOR.siteManager.hoursPerYear;
  const ft1 = LABOR.fullTime1.hourlyRate * LABOR.fullTime1.hoursPerYear;
  const ft2 = LABOR.fullTime2.hourlyRate * LABOR.fullTime2.hoursPerYear;
  const base = sm + ft1 + ft2;
  return base * (1 + LABOR.burdenTaxes + LABOR.burdenBenefits);
}

function buildYearlyProjection(
  year: number,
  estimatedDailyTraffic: number,
  capex: typeof DEFAULT_CAPEX,
  loanAmount: number,
  monthlyDebtService: number
): YearlyProjection {
  // Escalate traffic
  const dailyTraffic = estimatedDailyTraffic * Math.pow(1 + TRAFFIC.annualEscalator, year - 1);

  // Cars captured per month
  const dailyCars = dailyTraffic * TRAFFIC.captureRate;
  const monthlyStandardCars = dailyCars * TRAFFIC.daysPerMonth;

  // Unlimited subscriber ramp
  const unlimitedSubscribers = Math.min(
    SUBSCRIBER_RAMP.newPerMonth * 12 * year * (1 + SUBSCRIBER_RAMP.annualGrowth * (year - 1)),
    monthlyStandardCars * 0.4 // cap at 40% of traffic as unlimited
  );
  const unlimitedWashes = unlimitedSubscribers * TRAFFIC.avgWashesPerMonth * 12;

  const annualStandardCars = monthlyStandardCars * 12;
  const totalAnnualCars = annualStandardCars + unlimitedWashes;

  // Revenue
  const standardRevenue = annualStandardCars * WTD_AVG_PRICE_PER_CAR;
  const unlimitedRevenue = unlimitedSubscribers * UNLIMITED_PLAN_PRICE * 12;
  const grossRevenue = standardRevenue + unlimitedRevenue;
  // Apply discounts & CC fees
  const netRevenue = grossRevenue * (1 - 0.10) * (1 - 0.02);

  // COGS
  const varChemCost = totalAnnualCars * VAR_CHEM_COST_PER_CAR;
  const utilsCOGS   = totalAnnualCars * VARIABLE_COST_PER_CAR.utilities * 0.9;
  const rmCOGS      = totalAnnualCars * VARIABLE_COST_PER_CAR.repairsMaint * 0.5;
  const laborCOGS   = calcAnnualLabor() * Math.pow(1.08, year - 1);
  const annualDeprEquip = capex.equipment / DEPR.equipmentYears;
  const annualDeprBuild = capex.construction / DEPR.buildingYears;
  const totalCOGS = varChemCost + utilsCOGS + rmCOGS + laborCOGS;

  const grossProfit = netRevenue - totalCOGS;

  // SG&A
  const fixedSGA =
    FIXED_COSTS.marketingMonthly * 12 +
    FIXED_COSTS.bankChargesMonthly * 12 +
    FIXED_COSTS.insuranceAnnual +
    FIXED_COSTS.officeMiscMonthly * 12 +
    FIXED_COSTS.computerInternetMtly * 12;

  const propTax = capex.land * 0.015 * Math.pow(1.02, year - 1);
  const totalSGA = fixedSGA + propTax;

  const ebit = grossProfit - totalSGA;
  const depreciation = annualDeprEquip + annualDeprBuild;
  const ebitda = ebit + depreciation;

  // Interest
  const annualInterest = monthlyDebtService * 12 - (loanAmount / (FINANCING.loanTermYears * 12)) * 12 * 0.3; // approx
  const actualInterest = year <= 5
    ? loanAmount * FINANCING.annualInterest * Math.pow(0.95, year - 1)
    : 0;

  const ebt = ebit - actualInterest;
  const netIncome = ebt; // No corp tax assumed (pass-through entity)

  const margin = netRevenue > 0 ? ebitda / netRevenue : 0;

  return {
    year: year === 0 ? "Year 1" : `Year ${year}`,
    revenue: Math.round(netRevenue),
    cogs: Math.round(totalCOGS),
    grossProfit: Math.round(grossProfit),
    sgna: Math.round(totalSGA),
    ebitda: Math.round(ebitda),
    netIncome: Math.round(netIncome),
    cars: Math.round(totalAnnualCars),
    margin: Math.round(margin * 100),
  };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function runFinancialModel(
  estimatedDailyTraffic: number,
  investmentBudget?: number
): FinancialProjection {
  // Determine CapEx — scale land cost if budget provided
  const capex = { ...DEFAULT_CAPEX };
  if (investmentBudget && investmentBudget > 0) {
    const scale = investmentBudget / capex.totalBase;
    capex.land             = Math.round(capex.land * scale);
    capex.equipment        = Math.round(capex.equipment * scale);
    capex.construction     = Math.round(capex.construction * scale);
    capex.siteImprovements = Math.round(capex.siteImprovements * scale);
    capex.tapCityFees      = Math.round(capex.tapCityFees * scale);
    capex.totalBase        = investmentBudget;
  }

  const contingencyAmount = Math.round(capex.construction * capex.contingency);
  const totalProjectCost  = capex.totalBase + contingencyAmount;
  const downPayment       = Math.round(totalProjectCost * FINANCING.downPaymentPct);
  const loanAmount        = totalProjectCost - downPayment;
  const loanFees          = Math.round(loanAmount * FINANCING.loanFeePct);
  const netLoanProceeds   = loanAmount - loanFees;
  const monthlyDebtService = calcMonthlyPayment(
    netLoanProceeds,
    FINANCING.annualInterest,
    FINANCING.loanTermYears
  );

  const projections: YearlyProjection[] = [];
  for (let yr = 1; yr <= 5; yr++) {
    projections.push(buildYearlyProjection(yr, estimatedDailyTraffic, capex, loanAmount, monthlyDebtService));
  }

  const year1 = projections[0];
  const year3 = projections[2];
  const year5 = projections[4];

  // Payback calculation (cumulative net income)
  let cumulative = -downPayment;
  let paybackYears = 0;
  for (let i = 0; i < projections.length; i++) {
    cumulative += projections[i].netIncome;
    if (cumulative >= 0 && paybackYears === 0) {
      paybackYears = i + 1;
    }
  }
  if (paybackYears === 0) paybackYears = 7; // beyond 5 years

  // Approximate IRR (simplified)
  const irr5Year = year1.revenue > 0
    ? Math.min(35, Math.round((year5.netIncome / downPayment) * 100 * 0.6))
    : 0;

  // Break-even monthly revenue
  const annualFixed = year1.sgna + monthlyDebtService * 12;
  const contributionMargin = 1 - (year1.cogs / year1.revenue);
  const breakEvenAnnual = contributionMargin > 0 ? annualFixed / contributionMargin : 0;
  const breakEvenMonthly = Math.round(breakEvenAnnual / 12);

  const dailyCars = Math.round(estimatedDailyTraffic * TRAFFIC.captureRate);

  const assumptions: FinancialAssumptions = {
    dailyTrafficCount: estimatedDailyTraffic,
    captureRate: TRAFFIC.captureRate,
    dailyCarsWashed: dailyCars,
    avgRevenuePerCar: WTD_AVG_PRICE_PER_CAR,
    totalCapex: totalProjectCost,
    landCost: capex.land,
    equipmentCost: capex.equipment,
    constructionCost: capex.construction,
    interestRate: FINANCING.annualInterest,
    loanTermYears: FINANCING.loanTermYears,
  };

  return {
    totalProjectCost,
    downPayment,
    loanAmount: netLoanProceeds,
    monthlyDebtService: Math.round(monthlyDebtService),
    year1Revenue: year1.revenue,
    year1EBITDA:  year1.ebitda,
    year1NetIncome: year1.netIncome,
    year3Revenue: year3.revenue,
    year5Revenue: year5.revenue,
    paybackYears,
    irr5Year,
    breakEvenMonthlyRevenue: breakEvenMonthly,
    projections,
    assumptions,
  };
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000)
    return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}
