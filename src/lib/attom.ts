/**
 * ATTOM Data API — AVW Site Intel
 *
 * Pulls every field ATTOM offers that is relevant to car wash site selection.
 *
 * Endpoints called in parallel (after initial snapshot):
 *   property/detail      — lot, owner, assessment, building, utilities, zoning, sale
 *   avm/detail           — automated valuation model (current market estimate)
 *   saleshistory/detail  — full transaction history (price trend, buyer/seller type)
 *   allevents/detail     — liens, mortgages, foreclosures, NODs (due diligence)
 *
 * Car-wash-critical fields extracted:
 *   sewerType            — must be municipal/public for car wash wastewater compliance
 *   waterType            — must be municipal/public for adequate supply
 *   cornerLot            — highest-value car wash real estate
 *   siteInfluence        — corner, cul-de-sac, water-front, etc.
 *   buildingSqFt         — size of existing structure that may need demolition
 *   existingBuildingCount— number of structures on parcel
 *   existingParkingSpaces— current parking layout
 *   absenteeOwner        — absentee owners are more motivated sellers
 *   corporateOwner       — LLC/trust ownership (common for commercial parcels)
 *   saleTransactionType  — arm's-length vs. foreclosure vs. inter-family
 *   taxYear              — year the tax figure applies to
 *   saleHistory          — last 5 transactions (price trend, appreciation)
 *   activeLienCount      — number of open liens (encumbrances)
 *   hasForeclosure       — active foreclosure or NOD
 *   lienTypes            — types of liens (mortgage, HOA, IRS, mechanic's)
 *
 * API base: https://api.gateway.attomdata.com/propertyapi/v1.0.0
 * Auth:     apikey header
 */

import https from "https";
import { HTTP_AGENT } from "./dnsAgent";
import type { RegridParcelData } from "./types";

const ATTOM_BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";
// ATTOM snapshot endpoint takes 20–30s on first call — use a generous timeout
const SNAPSHOT_TIMEOUT_MS = 40_000;
// Detail/AVM/history/events endpoints should respond in <3s on a good network.
// Use 15s so we fail fast when they're blocked, without being too aggressive.
const DETAIL_TIMEOUT_MS = 15_000;
// Legacy alias — kept so the helper default still works
const TIMEOUT_MS = SNAPSHOT_TIMEOUT_MS;

const US_BOUNDS = { minLat: 24.0, maxLat: 71.5, minLng: -180, maxLng: -66 };

function isInUS(lat: number, lng: number): boolean {
  return (
    lat >= US_BOUNDS.minLat && lat <= US_BOUNDS.maxLat &&
    lng >= US_BOUNDS.minLng && lng <= US_BOUNDS.maxLng
  );
}

// ── HTTP helper — follows redirects ─────────────────────────────────────────
function attomGet(path: string, apiKey: string, redirectsLeft = 5, timeoutMs = TIMEOUT_MS): Promise<any | null> {
  if (redirectsLeft <= 0) return Promise.resolve(null);

  const fullUrl = `${ATTOM_BASE}${path}`;
  const urlObj  = new URL(fullUrl);

  return new Promise((resolve) => {
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname + urlObj.search,
      method:   "GET",
      agent:    HTTP_AGENT,
      headers:  { "apikey": apiKey, "Accept": "application/json", "User-Agent": "AVW-Site-Intel/1.0" },
    };

    const timer = setTimeout(() => {
      console.warn(`[AVW] ATTOM timeout (${Math.round(timeoutMs / 1000)}s) →`, urlObj.pathname);
      resolve(null);
    }, timeoutMs);

    const req = https.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        res.resume();
        // Rebuild path from redirect location
        try {
          const redir = new URL(res.headers.location);
          attomGet(redir.pathname + redir.search, apiKey, redirectsLeft - 1, timeoutMs).then(resolve);
        } catch { resolve(null); }
        return;
      }

      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) {
          console.warn(`[AVW] ATTOM HTTP ${res.statusCode} on ${urlObj.pathname}:`, raw.slice(0, 300));
          resolve(null);
          return;
        }
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      console.warn("[AVW] ATTOM request error:", err.message);
      resolve(null);
    });

    req.end();
  });
}

// ── Dollar helper ────────────────────────────────────────────────────────────
function dollar(v: any): number | null {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) || n <= 0 ? null : Math.round(n);
}

function intVal(v: any): number | null {
  const n = parseInt(v, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// ── Dimension helper ─────────────────────────────────────────────────────────
function parseDimensions(
  frontage: number | undefined,
  depth:    number | undefined,
): { widthFt: number; depthFt: number; frontageEstimateFt: number } | null {
  const w = typeof frontage === "number" && frontage > 0 ? frontage : null;
  const d = typeof depth    === "number" && depth    > 0 ? depth    : null;
  if (!w || !d) return null;
  return { widthFt: Math.min(w, d), depthFt: Math.max(w, d), frontageEstimateFt: w };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ATTOMSaleHistoryItem {
  price:       number | null;
  date:        string | null;
  recordDate:  string | null;
  transType:   string | null;   // "Resale", "Foreclosure", "Inter-Family Transfer", etc.
  buyerName:   string | null;
  sellerName:  string | null;
  pricePerSqFt: number | null;
}

export interface ATTOMParcelData extends RegridParcelData {
  // Identification
  attomId:       number | null;

  // AVM
  avmEstimateUSD: number | null;
  avmHighUSD:     number | null;
  avmLowUSD:      number | null;
  avmDate:        string | null;
  avmFSD:         number | null;  // Forecast Standard Deviation — AVM accuracy indicator (lower = more accurate)

  // Building details
  yearBuilt:              number | null;
  yearBuiltEffective:     number | null;  // year of last major renovation
  buildingSqFt:           number | null;  // total building sq ft on parcel
  buildingStories:        number | null;
  existingBuildingCount:  number | null;  // number of structures on parcel
  existingParkingSpaces:  number | null;
  buildingCondition:      string | null;  // "Average", "Good", "Fair", "Poor"
  buildingQuality:        string | null;

  // Utilities — CRITICAL for car wash feasibility
  sewerType:  string | null;  // "Municipal" / "Septic" / "None" — must be municipal
  waterType:  string | null;  // "Municipal" / "Well" / "None" — must be municipal

  // Site characteristics
  cornerLot:      boolean | null;  // corner lot = prime car wash real estate
  siteInfluence:  string | null;   // raw ATTOM site influence code
  legalDesc:      string | null;   // legal description

  // Ownership context
  absenteeOwner:    boolean | null;  // absentee = more motivated seller
  corporateOwner:   boolean | null;  // LLC/trust/corp ownership
  owner2:           string | null;   // second owner name
  ownerCorporation: string | null;   // corporate entity name if corporate-owned

  // Tax
  annualTaxUSD:  number | null;
  taxYear:       number | null;
  taxExemption:  string | null;  // homestead, senior, etc.

  // Sale context
  saleTransactionType: string | null;  // "Arms Length", "Foreclosure", "REO Sale", "Inter-Family"
  saleReasonCode:      string | null;

  // Sale history — last 5 transactions (price trend, holding periods)
  saleHistory: ATTOMSaleHistoryItem[];

  // Due diligence — from allevents
  activeLienCount:    number | null;  // number of open liens on title
  hasForeclosure:     boolean | null; // active foreclosure proceeding
  hasNOD:             boolean | null; // Notice of Default filed
  lienTypes:          string[];       // types: "Mortgage", "HOA", "IRS", "Mechanics Lien", etc.
  openMortgageAmount: number | null;  // outstanding mortgage balance if available
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function fetchATTOMParcel(
  lat:    number,
  lng:    number,
  apiKey: string,
): Promise<ATTOMParcelData> {
  const blankAttom = () => ({
    attomId: null,
    avmEstimateUSD: null, avmHighUSD: null, avmLowUSD: null, avmDate: null, avmFSD: null,
    yearBuilt: null, yearBuiltEffective: null, buildingSqFt: null, buildingStories: null,
    existingBuildingCount: null, existingParkingSpaces: null,
    buildingCondition: null, buildingQuality: null,
    sewerType: null, waterType: null,
    cornerLot: null, siteInfluence: null, legalDesc: null,
    absenteeOwner: null, corporateOwner: null, owner2: null, ownerCorporation: null,
    annualTaxUSD: null, taxYear: null, taxExemption: null,
    saleTransactionType: null, saleReasonCode: null,
    saleHistory: [],
    activeLienCount: null, hasForeclosure: null, hasNOD: null, lienTypes: [], openMortgageAmount: null,
  });

  const unavailable = (reason: string): ATTOMParcelData => ({
    parcelNumber: "", path: "",
    address: "", city: "", state: "", zip: "",
    owner: "", ownerMailingAddress: "",
    lotSqFt: null, lotAcres: null, dimensions: null,
    assessedTotalUSD: null, assessedLandUSD: null,
    assessedImprovementUSD: null, parcelMarketValueUSD: null,
    lastSalePrice: null, lastSaleDate: null,
    zoning: "", zoningDescription: "", landUse: "",
    polygon: [],
    status: "unavailable",
    source: reason,
    fetchedAt: new Date().toISOString(),
    ...blankAttom(),
  });

  if (!apiKey) return unavailable("ATTOM API key not configured (ATTOM_API_KEY).");
  if (!isInUS(lat, lng)) return unavailable("ATTOM covers US parcels only. This location is outside the United States.");

  // ── Step 1: snapshot — find closest parcel, get ATTOM ID ─────────────────
  let snapshotJson: any = null;
  for (const radius of [0.05, 0.1, 0.25]) {
    snapshotJson = await attomGet(
      `/property/snapshot?latitude=${lat}&longitude=${lng}&radius=${radius}&pageSize=1`,
      apiKey,
    );
    if (snapshotJson?.property?.length > 0) break;
    console.warn(`[AVW] ATTOM snapshot: no results at radius ${radius} mi — expanding`);
  }

  if (!snapshotJson?.property?.length) {
    return unavailable("No parcel record found at this location in ATTOM's database.");
  }

  const snapProp = snapshotJson.property[0];
  const attomId: number = snapProp?.identifier?.attomId;
  if (!attomId) return unavailable("ATTOM returned a parcel record with no ATTOM ID.");

  console.log(`[AVW] ATTOM hit → attomId: ${attomId}`);

  // ── Step 2: all endpoints in parallel ────────────────────────────────────
  // Use DETAIL_TIMEOUT_MS (15s) for these — they respond in <3s on a healthy
  // network, so 15s is generous while still failing fast when blocked.
  const [detailJson, avmJson, historyJson, eventsJson] = await Promise.all([
    attomGet(`/property/detail?attomid=${attomId}`,        apiKey, 5, DETAIL_TIMEOUT_MS),
    attomGet(`/avm/detail?attomid=${attomId}`,             apiKey, 5, DETAIL_TIMEOUT_MS),
    attomGet(`/saleshistory/detail?attomid=${attomId}`,    apiKey, 5, DETAIL_TIMEOUT_MS),
    attomGet(`/allevents/detail?attomid=${attomId}`,       apiKey, 5, DETAIL_TIMEOUT_MS),
  ]);

  const p   = detailJson?.property?.[0] ?? snapProp;
  const avm = avmJson?.property?.[0]?.avm ?? null;

  // ── Field extraction ─────────────────────────────────────────────────────
  const id    = p?.identifier  ?? {};
  const addr  = p?.address     ?? {};
  const own   = p?.owner       ?? {};
  const lot   = p?.lot         ?? {};
  const area  = p?.area        ?? {};
  const summ  = p?.summary     ?? {};
  const asmt  = p?.assessment  ?? {};
  const sale  = p?.sale        ?? {};
  const bldg  = p?.building    ?? {};
  const util  = p?.utilities   ?? {};

  // Address
  const fullAddress = addr.oneLine ?? [addr.line1, addr.line2].filter(Boolean).join(", ");
  const city        = addr.locality ?? "";
  const state       = addr.countrySubd ?? "";
  const zip         = addr.postal1 ?? "";

  // Owner
  const ownerName  = own.owner1?.fullname  ?? own.owner1?.lastName ?? "Not on record";
  const owner2Name = own.owner2?.fullname  ?? own.owner2?.lastName ?? null;
  const ownerMail  = own.owner1?.mailoneline ?? own.mailingaddressoneline ?? "";

  // Absentee / corporate flags
  // ATTOM absenteeInd: "O" = owner-occupied, "A" = absentee
  // Field confirmed at summary.absenteeInd in live data; owner.absenteeInd is secondary fallback
  const absenteeRaw     = summ.absenteeInd ?? own.absenteeInd ?? null;
  const absenteeOwner   = absenteeRaw === "A" || absenteeRaw === "Y" ? true
                        : absenteeRaw === "O" || absenteeRaw === "N" ? false
                        : null;
  // corporateindicator "Y" = corporate entity
  const corpFlag        = own.corporateindicator ?? own.owner1?.corporateindicator ?? null;
  const corporateOwner  = corpFlag === "Y" ? true : corpFlag === "N" ? false : null;
  const ownerCorp       = corporateOwner ? (ownerName !== "Not on record" ? ownerName : null) : null;

  // Lot — ATTOM field meaning confirmed across multiple properties:
  //   lotsize1 = ACRES  (e.g. 0.18, 0.1595, 9.183)
  //   lotsize2 = SQ FT  (e.g. 7857, 6948, 400011)
  // snapshot endpoint may only return lotsize1 (acres); convert as fallback
  const lotAcres = lot.lotsize1 ? parseFloat(parseFloat(lot.lotsize1).toFixed(3)) : null;
  const lotSqFt  = dollar(lot.lotsize2) ?? (lotAcres ? Math.round(lotAcres * 43560) : null);
  const dims     = parseDimensions(lot.frontage, lot.depth);

  // Corner lot — siteinfluence code 3 = Corner, code 7 = Corner/Cul-de-sac
  const siteInf  = lot.siteinfluence ?? null;
  const cornerLot = siteInf
    ? ["3", "7", "CORNER", "COR"].some((c) => String(siteInf).toUpperCase().includes(c))
    : null;

  // Legal description
  const legalDesc = summ.legal1 ?? summ.legal ?? null;

  // Building
  const bldgSize     = bldg.size     ?? {};
  const bldgSumm     = bldg.summary  ?? {};
  const bldgParking  = bldg.parking  ?? {};
  const bldgConst    = bldg.construction ?? {};

  const buildingSqFt          = dollar(bldgSize.bldgsize ?? bldgSize.grosssize ?? bldgSize.universalsize);
  const buildingStories       = intVal(bldgSumm.levels ?? bldgSumm.storiescount);
  const existingBuildingCount = intVal(bldgSumm.bldgsNum ?? bldgSumm.bldgcount);
  const existingParkingSpaces = intVal(bldgParking.prkgSpaces ?? bldgParking.prkgsize);
  const buildingCondition     = bldgSumm.condition ?? bldgConst.condition ?? null;
  const buildingQuality       = bldgSumm.quality   ?? null;

  // yearbuilt confirmed at summary.yearbuilt (top-level) in live ATTOM data,
  // as well as building.summary.yearbuilt — check both paths
  const rawYearBuilt = parseInt(bldgSumm.yearbuilt ?? bldgSumm.yearBuilt ?? summ.yearbuilt ?? "0", 10);
  const yearBuilt    = rawYearBuilt > 1800 && rawYearBuilt <= new Date().getFullYear() ? rawYearBuilt : null;
  const rawYearEff   = parseInt(bldgSumm.yearbuilteffective ?? bldgSumm.yearBuiltEffective ?? "0", 10);
  const yearBuiltEffective = rawYearEff > 1800 && rawYearEff <= new Date().getFullYear() ? rawYearEff : null;

  // Utilities — critical for car wash
  // ATTOM sewer/water codes vary by county; we normalise to readable strings
  const sewerRaw = util.sewertype ?? util.sewerType ?? util.sewer ?? null;
  // ATTOM confirmed response uses capital T: utilities.waterType — check both casings
  const waterRaw = util.waterType ?? util.watertype ?? util.water ?? null;

  function normaliseUtility(raw: string | null): string | null {
    if (!raw) return null;
    const u = String(raw).toUpperCase();
    if (u.includes("MUNI") || u.includes("PUBLIC") || u === "1" || u === "Y") return "Municipal / Public";
    if (u.includes("SEPT") || u.includes("PRIV"))   return "Septic / Private";
    if (u.includes("WELL"))                          return "Well";
    if (u.includes("NONE") || u === "0" || u === "N") return "None";
    return raw; // return raw code if unrecognised
  }

  const sewerType = normaliseUtility(sewerRaw);
  const waterType = normaliseUtility(waterRaw);

  // Assessment
  const assessed = asmt.assessed ?? {};
  const market   = asmt.market   ?? {};
  const taxObj   = asmt.tax      ?? {};

  const annualTaxUSD   = dollar(taxObj.taxtotalamt ?? taxObj.taxamt);
  const taxYear        = intVal(taxObj.taxyear ?? taxObj.taxYear);
  const taxExemption   = taxObj.taxexemptiontype ?? null;

  // Sale
  const saleAmt           = dollar(sale.amount?.saleamt ?? sale.saleamt);
  const saleDate          = sale.salesearchdate ?? sale.salerecdate ?? null;
  const saleTrans         = sale.amount?.saletranstype ?? sale.saletranstype ?? null;
  const saleReason        = sale.salereasoncodedesc ?? sale.salereasoncode ?? null;

  // Land use / zoning
  const zoningCode = lot.zoningtype ?? "";
  const landUse    = area.countyuse1 ?? summ.propLandUse ?? summ.propclass ?? "";

  // ── Sale history (saleshistory/detail) ───────────────────────────────────
  const saleHistory: ATTOMSaleHistoryItem[] = [];
  const histEvents = historyJson?.property?.[0]?.saleHistory
    ?? historyJson?.saleHistory
    ?? [];
  for (const ev of (Array.isArray(histEvents) ? histEvents : []).slice(0, 5)) {
    saleHistory.push({
      price:       dollar(ev.amount?.saleamt ?? ev.saleamt),
      date:        ev.salesearchdate ?? ev.salerecdate ?? null,
      recordDate:  ev.salerecdate ?? null,
      transType:   ev.amount?.saletranstype ?? ev.saletranstype ?? null,
      buyerName:   ev.buyer?.name1 ?? ev.buyername ?? null,
      sellerName:  ev.seller?.name1 ?? ev.sellername ?? null,
      pricePerSqFt: dollar(ev.calculation?.priceperSqFt ?? ev.pricepersqft),
    });
  }

  // ── Liens / events (allevents/detail) ────────────────────────────────────
  let activeLienCount    = 0;
  let hasForeclosure     = false;
  let hasNOD             = false;
  const lienTypeSet      = new Set<string>();
  let openMortgageAmount: number | null = null;

  const allEvents: any[] = eventsJson?.property?.[0]?.eventHistory
    ?? eventsJson?.eventHistory
    ?? [];

  for (const ev of allEvents) {
    const evType = String(ev.eventType ?? ev.type ?? "").toUpperCase();
    const status = String(ev.recordingStatus ?? ev.status ?? "").toUpperCase();
    const isOpen = !status.includes("RELEASE") && !status.includes("PAID") && !status.includes("SATISFIED");

    if (evType.includes("FORECLOS")) { hasForeclosure = true; }
    if (evType.includes("NOTICE OF DEFAULT") || evType.includes("NOD")) { hasNOD = true; }

    if (isOpen) {
      if (evType.includes("MORTGAGE") || evType.includes("DEED OF TRUST")) {
        lienTypeSet.add("Mortgage");
        activeLienCount++;
        if (!openMortgageAmount) {
          openMortgageAmount = dollar(ev.amount?.loanamount ?? ev.loanamount);
        }
      } else if (evType.includes("HOA") || evType.includes("HOMEOWNER")) {
        lienTypeSet.add("HOA Lien");
        activeLienCount++;
      } else if (evType.includes("IRS") || evType.includes("FEDERAL TAX")) {
        lienTypeSet.add("IRS / Federal Tax Lien");
        activeLienCount++;
      } else if (evType.includes("MECHANIC") || evType.includes("CONTRACTOR")) {
        lienTypeSet.add("Mechanic's Lien");
        activeLienCount++;
      } else if (evType.includes("JUDGMENT")) {
        lienTypeSet.add("Judgment Lien");
        activeLienCount++;
      } else if (evType.includes("LIEN")) {
        lienTypeSet.add("Other Lien");
        activeLienCount++;
      }
    }
  }

  // ── AVM ──────────────────────────────────────────────────────────────────
  const avmAmount = avm?.amount ?? null;
  const avmFSD    = avm?.condition?.fsd ? parseFloat(avm.condition.fsd) : null;

  // ── Source note — only list endpoints that actually returned data ───────
  const endpointsLoaded = [
    "property/snapshot",
    detailJson  ? "property/detail"        : null,
    avmJson     ? "avm/detail"             : null,
    historyJson ? "saleshistory/detail"    : null,
    eventsJson  ? "allevents/detail"       : null,
  ].filter(Boolean).join(" · ");

  const sourceNote =
    `ATTOM Property API (api.gateway.attomdata.com). ` +
    `ATTOM ID ${attomId}${id.apn ? ` · APN ${id.apn}` : ""}. ` +
    `Endpoints loaded: ${endpointsLoaded}. ` +
    `Assessor parcel data — timeliness varies by county.` +
    (avm ? ` AVM computed ${avm?.eventDate ?? "recently"}.` : "") +
    (saleHistory.length > 0 ? ` ${saleHistory.length} historical transactions found.` : "") +
    (activeLienCount > 0 ? ` ${activeLienCount} active lien(s) on record.` : "") +
    (!detailJson ? " Note: detail endpoint unavailable — assessment/financial values may be limited." : "");

  return {
    // ── RegridParcelData base ──────────────────────────────────────────────
    parcelNumber: id.apn ?? id.fips ?? "",
    path:         `attom/${attomId}`,
    address:      fullAddress,
    city, state, zip,
    owner:               ownerName,
    ownerMailingAddress: ownerMail,
    lotSqFt, lotAcres, dimensions: dims,
    assessedTotalUSD:       dollar(assessed.assdttlvalue),
    assessedLandUSD:        dollar(assessed.assdlandvalue),
    assessedImprovementUSD: dollar(assessed.assdimprvalue),
    parcelMarketValueUSD:   dollar(market.mktttlvalue),
    lastSalePrice:  saleAmt,
    lastSaleDate:   saleDate,
    zoning:         zoningCode,
    zoningDescription: lot.zoningdescription ?? lot.zoningtype ?? "",
    landUse,
    polygon: [],   // parcel boundary polygon from OSM (merged in analyze route)
    status:    "live",
    source:    sourceNote,
    fetchedAt: new Date().toISOString(),

    // ── ATTOM extended fields ──────────────────────────────────────────────
    attomId,

    // AVM
    avmEstimateUSD: dollar(avmAmount?.value),
    avmHighUSD:     dollar(avmAmount?.high),
    avmLowUSD:      dollar(avmAmount?.low),
    avmDate:        avm?.eventDate ?? null,
    avmFSD,

    // Building
    yearBuilt, yearBuiltEffective,
    buildingSqFt, buildingStories, existingBuildingCount, existingParkingSpaces,
    buildingCondition, buildingQuality,

    // Utilities — car wash critical
    sewerType, waterType,

    // Site
    cornerLot, siteInfluence: siteInf ? String(siteInf) : null, legalDesc,

    // Ownership
    absenteeOwner, corporateOwner,
    owner2: owner2Name,
    ownerCorporation: ownerCorp,

    // Tax
    annualTaxUSD, taxYear, taxExemption,

    // Sale context
    saleTransactionType: saleTrans,
    saleReasonCode:      saleReason,

    // Sale history
    saleHistory,

    // Due diligence
    activeLienCount: activeLienCount > 0 ? activeLienCount : null,
    hasForeclosure:  hasForeclosure || null,
    hasNOD:          hasNOD || null,
    lienTypes:       Array.from(lienTypeSet),
    openMortgageAmount,
  };
}
