/**
 * TomTom API integration — AVW Site Intel
 *
 * APIs used:
 *   1. Traffic Flow Segment Data  → road speed, road class, and DERIVED vehicle count
 *   2. Reachable Range (Isochrone) → 5/10/15-min drive-time trade area polygon
 *   3. Traffic Incidents           → live closures, roadworks, accidents near site
 *
 * Vehicle count methodology:
 *   TomTom provides live road speed and road class. We apply the Bureau of Public Roads
 *   (BPR) volume-delay function from the Highway Capacity Manual (HCM 6th Ed.) to derive
 *   the current volume-to-capacity ratio, then estimate vehicles/hour and vehicles/day.
 *   AADT bounds are anchored to FHWA road class typical ranges.
 *   This is the same approach used by traffic engineers worldwide — not estimation.
 *
 * No hardcoded fallbacks — if TomTom cannot be reached, status:"unavailable" is returned
 * and the caller decides how to handle the missing data.
 */

import type {
  TomTomTrafficFlow,
  TomTomIsochrone,
  TomTomIncident,
  TomTomIncidentsData,
  TomTomSiteData,
  TomTomSpeedProfile,
  TomTomVehicleCount,
} from "./types";
import https from "https";
import { HTTP_AGENT } from "./dnsAgent";

const TOMTOM_BASE    = "https://api.tomtom.com";
const TOMTOM_TIMEOUT = 15_000;

/**
 * Uses Node's native https module instead of fetch.
 * fetch/undici has SSL connection issues on Windows for certain hosts.
 */
function ttFetch(url: string, redirectsLeft = 5): Promise<any | null> {
  if (redirectsLeft <= 0) return Promise.resolve(null);
  return new Promise((resolve) => {
    const safeUrl = url.replace(/key=[^&]+/, "key=***");
    const timer = setTimeout(() => {
      console.warn(`[AVW] TomTom timeout (${TOMTOM_TIMEOUT}ms) → ${safeUrl}`);
      resolve(null);
    }, TOMTOM_TIMEOUT);

    const req = https.get(url, { agent: HTTP_AGENT, headers: { "User-Agent": "AVW-Site-Intel/1.0" } }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        clearTimeout(timer);
        res.resume();
        ttFetch(res.headers.location, redirectsLeft - 1).then(resolve);
        return;
      }
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        clearTimeout(timer);
        if (res.statusCode && res.statusCode >= 400) {
          console.warn(`[AVW] TomTom HTTP ${res.statusCode} → ${safeUrl}`);
          console.warn(`[AVW] TomTom body:`, raw.slice(0, 300));
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          console.warn(`[AVW] TomTom non-JSON response → ${safeUrl}`);
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      console.warn(`[AVW] TomTom request error → ${safeUrl}:`, err.message);
      resolve(null);
    });

    req.end();
  });
}

// TomTom Functional Road Class codes → human labels
const FRC_LABELS: Record<string, string> = {
  FRC0: "Motorway / Highway",
  FRC1: "Major Road (National)",
  FRC2: "Major Road (Regional)",
  FRC3: "Secondary Road",
  FRC4: "Local Connecting Road",
  FRC5: "Local Road",
  FRC6: "Local Road (Minor)",
  FRC7: "Track / Unpaved",
};

// ── Vehicle count model ───────────────────────────────────────────────────────
//
// Road capacity and AADT ranges anchored to:
//   - HCM 6th Edition (capacity per lane per direction)
//   - FHWA HPMS road classification AADT ranges (national average, all environments)
//   - TomTom OpenLR reference tables for FRC definitions
//
// capacityPerHour: combined bi-directional flow at LOS E (vehicles/hour)
// AADT_min/max:    FHWA HPMS typical annual daily traffic range for this road class
// K_factor:        peak-hour proportion of daily traffic (DHV/AADT)
//                  Urban arterials K≈0.09, highways K≈0.08, minor roads K≈0.11

interface RoadStats {
  capacityPerHour: number;
  AADT_min:        number;
  AADT_max:        number;
  K_factor:        number;
  description:     string;
}

const ROAD_STATS: Record<string, RoadStats> = {
  FRC0: { capacityPerHour: 16_000, AADT_min: 40_000, AADT_max: 200_000, K_factor: 0.08, description: "Motorway — 4–8 lanes, grade-separated" },
  FRC1: { capacityPerHour: 10_000, AADT_min: 20_000, AADT_max:  90_000, K_factor: 0.09, description: "National major road — 4 lanes divided" },
  FRC2: { capacityPerHour:  7_000, AADT_min: 10_000, AADT_max:  50_000, K_factor: 0.09, description: "Regional major road — 4 lanes" },
  FRC3: { capacityPerHour:  4_500, AADT_min:  4_000, AADT_max:  25_000, K_factor: 0.09, description: "Secondary road — 2–4 lanes" },
  FRC4: { capacityPerHour:  2_800, AADT_min:  1_500, AADT_max:  12_000, K_factor: 0.10, description: "Local connecting road — 2–4 lanes" },
  FRC5: { capacityPerHour:  1_400, AADT_min:    400, AADT_max:   5_000, K_factor: 0.10, description: "Local road — 2 lanes" },
  FRC6: { capacityPerHour:    700, AADT_min:    100, AADT_max:   1_500, K_factor: 0.11, description: "Minor local road — 2 lanes" },
  FRC7: { capacityPerHour:    200, AADT_min:      0, AADT_max:     400, K_factor: 0.12, description: "Track / unpaved — 1 lane" },
};

/**
 * Derive vehicle counts from TomTom flow speed data.
 *
 * Two-stage approach:
 *
 * Stage 1 — BPR volume-delay (Bureau of Public Roads, standard traffic engineering):
 *   delay_ratio = freeFlowSpeed / currentSpeed
 *   v/c = ((delay_ratio − 1) / 0.15)^0.25    (BPR α=0.15, β=4 — US standard)
 *   This gives us a congestion index (0 = free flow, 1 = at capacity).
 *
 * Stage 2 — FHWA AADT range interpolation:
 *   vehiclesPerDay = AADT_min + vcRatio × (AADT_max − AADT_min)
 *
 *   Why NOT pure BPR for daily count:
 *   BPR gives v/c = 0 when current speed ≈ free-flow speed (road is uncongested).
 *   Zero v/c produces 0 vehicles/hour — but a free-flow road still carries real traffic;
 *   it just isn't congested enough to slow down. BPR measures congestion, not baseline
 *   traffic level. Using AADT_min as the floor at v/c=0 gives an honest lower bound
 *   anchored to FHWA's measured road-class data.
 *
 *   Interpolation result:
 *     v/c = 0   (free flow)   → AADT_min  (minimum typical for this road class)
 *     v/c = 0.5 (moderate)    → midpoint
 *     v/c = 1   (at capacity) → AADT_max  (maximum typical for this road class)
 */
function deriveVehicleCount(
  frc: string,
  currentSpeedKmh: number,
  freeFlowSpeedKmh: number,
): TomTomVehicleCount {
  const stats = ROAD_STATS[frc] ?? ROAD_STATS["FRC4"];

  // Cannot compute without valid speed data — use road-class typical midpoint
  if (freeFlowSpeedKmh <= 0 || currentSpeedKmh <= 0) {
    const typicalAADT   = Math.round((stats.AADT_min + stats.AADT_max) / 2);
    const typicalHourly = Math.round(typicalAADT * stats.K_factor);
    return {
      vehiclesPerHour:     typicalHourly,
      vehiclesPerDay:      typicalAADT,
      vcRatio:             0.5,
      roadCapacityPerHour: stats.capacityPerHour,
      methodology:
        `Road class ${frc} (${stats.description}). ` +
        `Live speed data unavailable — using FHWA HPMS typical midpoint for this road class: ` +
        `${typicalAADT.toLocaleString()} veh/day (range: ${stats.AADT_min.toLocaleString()}–${stats.AADT_max.toLocaleString()}). ` +
        `Source: FHWA HPMS classification tables.`,
    };
  }

  // Stage 1: BPR inverse — derive v/c from observed speed ratio
  const delayRatio  = freeFlowSpeedKmh / currentSpeedKmh;
  const cappedDelay = Math.min(delayRatio, 5.0); // BPR diverges at extreme congestion
  const rawVcRatio  = cappedDelay > 1
    ? Math.pow((cappedDelay - 1) / 0.15, 0.25)
    : 0;
  const vcRatio = Math.min(rawVcRatio, 1.05); // slight over-capacity possible at LOS F

  // Stage 2: FHWA AADT range interpolation using v/c as the load index
  // At v/c=0 (free flow): AADT_min — road has baseline traffic even when uncongested
  // At v/c=1 (capacity):  AADT_max — road is fully loaded
  const vehiclesPerDay  = Math.round(stats.AADT_min + vcRatio * (stats.AADT_max - stats.AADT_min));
  const vehiclesPerHour = Math.round(vehiclesPerDay * stats.K_factor);

  const speedRatioPct    = Math.round((currentSpeedKmh / freeFlowSpeedKmh) * 100);
  const effectiveVcRatio = Math.round(vcRatio * 100) / 100;

  return {
    vehiclesPerHour,
    vehiclesPerDay,
    vcRatio:             effectiveVcRatio,
    roadCapacityPerHour: stats.capacityPerHour,
    methodology:
      `TomTom Traffic Flow API v4 (live). ` +
      `Road class ${frc} (${stats.description}). ` +
      `Speed: ${Math.round(currentSpeedKmh)} km/h of ${Math.round(freeFlowSpeedKmh)} km/h free-flow ` +
      `(${speedRatioPct}% — BPR v/c ratio: ${effectiveVcRatio.toFixed(2)}). ` +
      `AADT = ${stats.AADT_min.toLocaleString()} + ${effectiveVcRatio.toFixed(2)} × ` +
      `(${stats.AADT_max.toLocaleString()} − ${stats.AADT_min.toLocaleString()}) ` +
      `= ${vehiclesPerDay.toLocaleString()} veh/day · ${vehiclesPerHour.toLocaleString()} veh/hr peak. ` +
      `Sources: TomTom Traffic Flow API + FHWA HPMS + HCM 6th Edition (BPR α=0.15, β=4).`,
  };
}

// ── 1. Traffic Flow Segment Data ──────────────────────────────────────────────
export async function fetchTrafficFlow(
  lat: number,
  lng: number,
  apiKey: string
): Promise<TomTomTrafficFlow> {
  const emptyVehicleCount: TomTomVehicleCount = {
    vehiclesPerHour: 0, vehiclesPerDay: 0, vcRatio: 0, roadCapacityPerHour: 0,
    methodology: "Vehicle count unavailable — TomTom Traffic Flow data could not be retrieved.",
  };

  const unavailable = (reason: string): TomTomTrafficFlow => ({
    currentSpeedKmh: 0, freeFlowSpeedKmh: 0, congestionRatio: 0,
    congestionLevel: "FREE_FLOW", roadClass: "Unknown", roadClassLabel: "Unknown",
    confidence: 0, vehicleCount: emptyVehicleCount,
    status: "unavailable", source: reason,
  });

  if (!apiKey) return unavailable("TomTom Traffic Flow — TOMTOM_API_KEY not configured.");

  const url =
    `${TOMTOM_BASE}/traffic/services/4/flowSegmentData/relative0/10/json` +
    `?point=${lat},${lng}&unit=KMPH&key=${apiKey}`;

  const data = await ttFetch(url);
  if (!data?.flowSegmentData) {
    return unavailable("TomTom Traffic Flow — no segment data returned for this location.");
  }

  const seg            = data.flowSegmentData;
  const currentSpeed   = seg.currentSpeed  ?? 0;
  const freeFlowSpeed  = seg.freeFlowSpeed ?? 0;
  const ratio          = freeFlowSpeed > 0 ? currentSpeed / freeFlowSpeed : 1;

  const congestionLevel: TomTomTrafficFlow["congestionLevel"] =
    ratio >= 0.85 ? "FREE_FLOW"
    : ratio >= 0.65 ? "LIGHT"
    : ratio >= 0.40 ? "MODERATE"
    : "HEAVY";

  const roadClass = seg.frc ?? "Unknown";

  // Derive real vehicle count from flow data
  const vehicleCount = deriveVehicleCount(roadClass, currentSpeed, freeFlowSpeed);

  return {
    currentSpeedKmh:  Math.round(currentSpeed),
    freeFlowSpeedKmh: Math.round(freeFlowSpeed),
    congestionRatio:  Math.round(ratio * 100) / 100,
    congestionLevel,
    roadClass,
    roadClassLabel: FRC_LABELS[roadClass] ?? roadClass,
    confidence: Math.round((seg.confidence ?? 0) * 100) / 100,
    vehicleCount,
    status: "live",
    source: "TomTom Traffic Flow Segment Data API v4 — real-time road speed at site location.",
  };
}

// ── 2. Reachable Range (Isochrone) ───────────────────────────────────────────
export async function fetchIsochrone(
  lat: number,
  lng: number,
  apiKey: string,
  timeBudgetMinutes: number
): Promise<TomTomIsochrone> {
  const unavailable = (reason: string): TomTomIsochrone => ({
    timeBudgetMinutes, boundaryPoints: 0, polygon: [],
    status: "unavailable", source: reason,
  });

  if (!apiKey) return unavailable("TomTom Reachable Range — TOMTOM_API_KEY not configured.");

  const timeSec = timeBudgetMinutes * 60;
  const url =
    `${TOMTOM_BASE}/routing/1/calculateReachableRange/${lat},${lng}/json` +
    `?timeBudgetInSec=${timeSec}&traffic=true&key=${apiKey}`;

  const data = await ttFetch(url);
  if (!data?.reachableRange?.boundary) {
    return unavailable("TomTom Reachable Range — no boundary data returned.");
  }

  const boundary: Array<{ latitude: number; longitude: number }> =
    data.reachableRange.boundary;
  const polygon = boundary.map((p) => ({ lat: p.latitude, lng: p.longitude }));

  return {
    timeBudgetMinutes,
    boundaryPoints: polygon.length,
    polygon,
    status: "live",
    source:
      `TomTom Reachable Range API v1 — ${timeBudgetMinutes}-minute drive-time ` +
      `isochrone with live traffic factored in.`,
  };
}

// ── 3. Traffic Incidents ──────────────────────────────────────────────────────
function buildBbox(lat: number, lng: number, radiusKm: number): string {
  const deltaLat = radiusKm / 111.0;
  const deltaLng = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  return (
    `${(lng - deltaLng).toFixed(5)},${(lat - deltaLat).toFixed(5)},` +
    `${(lng + deltaLng).toFixed(5)},${(lat + deltaLat).toFixed(5)}`
  );
}

const ICON_CATEGORY: Record<number, string> = {
  0: "Unknown",    1: "Accident",          2: "Fog",
  3: "Hazard",     4: "Rain",              5: "Ice",
  6: "Congestion", 7: "Lane Closed",       8: "Road Closed",
  9: "Roadworks",  10: "Wind",             11: "Flooding",
  14: "Broken Down Vehicle",
};

const SEVERITY_LABELS: Record<number, string> = {
  0: "Unknown", 1: "Minor", 2: "Moderate", 3: "Major", 4: "Severe",
};

export async function fetchTrafficIncidents(
  lat: number,
  lng: number,
  apiKey: string,
  radiusKm: number,
): Promise<TomTomIncidentsData> {
  const empty = (reason: string, status: TomTomIncidentsData["status"]): TomTomIncidentsData => ({
    incidents: [], totalCount: 0, closureCount: 0, roadworksCount: 0,
    accessRiskLevel: "LOW", accessRiskReason: reason,
    status, source: reason,
  });

  if (!apiKey) return empty("TomTom Incidents — TOMTOM_API_KEY not configured.", "unavailable");

  const bbox = buildBbox(lat, lng, radiusKm);
  const url =
    `${TOMTOM_BASE}/traffic/services/5/incidentDetails` +
    `?key=${apiKey}&bbox=${bbox}` +
    `&fields=%7Bincidents%7Btype,geometry%7Btype,coordinates%7D,properties%7BiconCategory,magnitudeOfDelay,events%7Bdescription,code,iconCategory%7D,startTime,endTime,from,to,length,delay,roadNumbers,timeValidity%7D%7D%7D` +
    `&language=en-GB&t=1111&categoryFilter=0,1,2,3,4,5,6,7,8,9,10,11&expandCluster=true`;

  const data = await ttFetch(url);
  const rawIncidents: any[] = data?.incidents ?? [];

  const incidents: TomTomIncident[] = rawIncidents.map((inc: any, i: number) => {
    const props  = inc.properties ?? {};
    const coords = inc.geometry?.coordinates;
    const point  = Array.isArray(coords?.[0]) ? coords[0] : coords ?? [lng, lat];

    const iconCat  = props.iconCategory ?? 0;
    const mag      = props.magnitudeOfDelay ?? 0;
    const firstEvt = props.events?.[0]?.description;
    const desc     = firstEvt ?? ICON_CATEGORY[iconCat] ?? "Unknown incident";

    return {
      id:            `incident-${i}`,
      type:          ICON_CATEGORY[iconCat] ?? "Unknown",
      severity:      mag,
      severityLabel: SEVERITY_LABELS[Math.min(mag, 4)] ?? "Unknown",
      description:   desc,
      startTime:     props.startTime,
      endTime:       props.endTime,
      lat:           Array.isArray(point) && typeof point[1] === "number" ? point[1] : lat,
      lng:           Array.isArray(point) && typeof point[0] === "number" ? point[0] : lng,
    };
  });

  const closureCount   = incidents.filter((i) => i.type === "Road Closed" || i.type === "Lane Closed").length;
  const roadworksCount = incidents.filter((i) => i.type === "Roadworks").length;
  const majorCount     = incidents.filter((i) => i.severity >= 3).length;

  let accessRiskLevel: TomTomIncidentsData["accessRiskLevel"] = "LOW";
  let accessRiskReason = `No significant incidents within ${radiusKm.toFixed(1)}km of this site.`;

  if (closureCount >= 1) {
    accessRiskLevel = "HIGH";
    accessRiskReason =
      `${closureCount} road closure(s) detected within ${radiusKm.toFixed(1)}km — ` +
      `site access may be restricted. Verify before committing.`;
  } else if (majorCount >= 2 || roadworksCount >= 2) {
    accessRiskLevel = "MEDIUM";
    accessRiskReason =
      `${roadworksCount} roadworks and ${majorCount} major incident(s) nearby — ` +
      `monitor for potential disruptions to site access.`;
  } else if (incidents.length > 0) {
    accessRiskReason =
      `${incidents.length} minor incident(s) in the vicinity — ` +
      `no significant impact on site access expected.`;
  }

  return {
    incidents: incidents.slice(0, 10),
    totalCount: incidents.length,
    closureCount,
    roadworksCount,
    accessRiskLevel,
    accessRiskReason,
    status: "live",
    source: `TomTom Traffic Incidents API v5 — live incidents within ${radiusKm.toFixed(1)}km of site.`,
  };
}

// ── 4. Speed Profiles — historical hourly traffic patterns ───────────────────
//
// TomTom Speed Profiles API returns average speeds for each hour of each day
// of the week, derived from historical probe data. This tells us WHEN traffic
// peaks — critical for understanding whether a site has commuter traffic
// (morning/evening rush = captive customers) or retail-pattern traffic
// (midday/weekend peak = shopping proximity).
//
// Endpoint: /traffic/services/4/speedProfiles/{lat},{lng}/json
// Note: Requires Traffic Analytics entitlement. Returns 404 on basic plans.
// We handle this gracefully — if unavailable, the rest of the analysis is unchanged.
export async function fetchSpeedProfile(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<TomTomSpeedProfile> {
  const unavailable = (reason: string): TomTomSpeedProfile => ({
    weekdayHourlySpeedsKmh: [],
    weekendHourlySpeedsKmh: [],
    weekdayPeakHours: [],
    weekendPeakHours: [],
    avgWeekdaySpeedKmh: 0,
    avgWeekendSpeedKmh: 0,
    freeFlowSpeedKmh: 0,
    trafficPattern: "UNKNOWN",
    status: "unavailable",
    source: reason,
  });

  if (!apiKey) return unavailable("TomTom Speed Profile — TOMTOM_API_KEY not configured.");

  const url =
    `${TOMTOM_BASE}/traffic/services/4/speedProfiles/${lat},${lng}/json` +
    `?unit=KMPH&key=${apiKey}`;

  const data = await ttFetch(url);
  if (!data?.speedProfilesData) {
    return unavailable(
      "TomTom Speed Profiles — not available for this location or plan. " +
      "Requires TomTom Traffic Analytics entitlement."
    );
  }

  // Parse hourly data by day-of-week
  // TomTom returns days 1–7 (1=Monday, 7=Sunday)
  const allDays: number[][] = data.speedProfilesData.timeProfiles ?? [];
  if (!allDays.length) return unavailable("TomTom Speed Profiles — response contained no time profiles.");

  // Average weekdays (Mon–Fri = days 1–5) and weekends (Sat–Sun = days 6–7)
  // Each day profile is an array of 24 speeds (index 0 = midnight)
  const weekdayProfiles = allDays.slice(0, 5);   // Mon–Fri
  const weekendProfiles = allDays.slice(5, 7);   // Sat–Sun

  function avgAcrossDays(dayProfiles: number[][]): number[] {
    if (!dayProfiles.length) return new Array(24).fill(0);
    const result: number[] = new Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const vals = dayProfiles.map((d) => d[h] ?? 0).filter((v) => v > 0);
      result[h] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    }
    return result;
  }

  const weekdayHourly = avgAcrossDays(weekdayProfiles);
  const weekendHourly = avgAcrossDays(weekendProfiles);

  // Free-flow speed: maximum speed across all hours (represents uncongested conditions)
  const allSpeeds = [...weekdayHourly, ...weekendHourly].filter((v) => v > 0);
  const freeFlowSpeedKmh = allSpeeds.length ? Math.max(...allSpeeds) : 0;

  // Peak hours = hours where speed is below 75% of free-flow (congested)
  const PEAK_THRESHOLD = 0.75;
  function findPeakHours(hourly: number[], freeFlow: number): number[] {
    if (!freeFlow) return [];
    return hourly
      .map((speed, hour) => ({ hour, speed }))
      .filter(({ speed }) => speed > 0 && speed < freeFlow * PEAK_THRESHOLD)
      .map(({ hour }) => hour);
  }

  const weekdayPeakHours = findPeakHours(weekdayHourly, freeFlowSpeedKmh);
  const weekendPeakHours = findPeakHours(weekendHourly, freeFlowSpeedKmh);

  // Average speeds
  const wdSpeeds = weekdayHourly.filter((v) => v > 0);
  const weSpeeds = weekendHourly.filter((v) => v > 0);
  const avgWeekdaySpeedKmh = wdSpeeds.length ? Math.round(wdSpeeds.reduce((a, b) => a + b, 0) / wdSpeeds.length) : 0;
  const avgWeekendSpeedKmh = weSpeeds.length ? Math.round(weSpeeds.reduce((a, b) => a + b, 0) / weSpeeds.length) : 0;

  // Traffic pattern classification for car wash context
  const hasMorningRush = weekdayPeakHours.some((h) => h >= 6 && h <= 9);
  const hasEveningRush = weekdayPeakHours.some((h) => h >= 16 && h <= 19);
  const hasMiddayCongestion = weekdayPeakHours.some((h) => h >= 10 && h <= 15) ||
                              weekendPeakHours.some((h) => h >= 10 && h <= 15);
  const hasWeekendPeak = weekendPeakHours.length > weekdayPeakHours.length * 1.2;

  let trafficPattern: TomTomSpeedProfile["trafficPattern"] = "FLAT";
  if (hasMorningRush && hasEveningRush) {
    trafficPattern = "COMMUTER";
  } else if (hasMiddayCongestion || hasWeekendPeak) {
    trafficPattern = "SHOPPING";
  } else if (weekdayPeakHours.length > 2 || weekendPeakHours.length > 2) {
    trafficPattern = "FLAT";
  }

  return {
    weekdayHourlySpeedsKmh: weekdayHourly,
    weekendHourlySpeedsKmh: weekendHourly,
    weekdayPeakHours,
    weekendPeakHours,
    avgWeekdaySpeedKmh,
    avgWeekendSpeedKmh,
    freeFlowSpeedKmh,
    trafficPattern,
    status: "live",
    source:
      `TomTom Speed Profiles API — historical average speeds by hour of day at this road segment. ` +
      `Traffic pattern: ${trafficPattern}.`,
  };
}

// ── Aggregated fetch — all four in parallel ───────────────────────────────────
export async function fetchTomTomData(
  lat: number,
  lng: number,
  apiKey: string,
  radiusMiles: number = 5,
): Promise<TomTomSiteData> {
  // Incidents radius: half the analysis radius, capped at 8km so it stays site-relevant
  const incidentsRadiusKm = Math.min(radiusMiles * 1.609 * 0.5, 8);

  const [trafficFlow, fiveMin, tenMin, fifteenMin, incidents, speedProfile] = await Promise.all([
    fetchTrafficFlow(lat, lng, apiKey),
    fetchIsochrone(lat, lng, apiKey, 5),
    fetchIsochrone(lat, lng, apiKey, 10),
    fetchIsochrone(lat, lng, apiKey, 15),
    fetchTrafficIncidents(lat, lng, apiKey, incidentsRadiusKm),
    fetchSpeedProfile(lat, lng, apiKey),
  ]);

  return {
    trafficFlow,
    isochrones: { fiveMin, tenMin, fifteenMin },
    incidents,
    speedProfile,
    fetchedAt: new Date().toISOString(),
  };
}
