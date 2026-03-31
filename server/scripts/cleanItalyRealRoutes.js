#!/usr/bin/env node
/**
 * MotoPortEU — Pulizia Itinerari Italia Reale (v3)
 *
 * Obiettivo:
 * - leggere client/public/data/routes.json
 * - identificare davvero gli itinerari italiani
 * - non perdere route valide per colpa di formati diversi dei campi
 * - separare:
 *    1) itinerari reali
 *    2) review
 *    3) scarti evidenti (track/enduro/non-italy forti)
 *
 * Output:
 *   - client/public/data/routes.it.real.cleaned.json
 *   - client/public/data/routes.it.real.review.json
 *   - client/public/data/routes.it.real.stats.json
 *
 * Uso:
 *   node .\server\scripts\cleanItalyRealRoutes.js
 */

import fs from "fs/promises";
import path from "path";
import process from "process";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "client", "public", "data", "routes.json");
const OUTPUT_CLEAN = path.join(ROOT, "client", "public", "data", "routes.it.real.cleaned.json");
const OUTPUT_REVIEW = path.join(ROOT, "client", "public", "data", "routes.it.real.review.json");
const OUTPUT_STATS = path.join(ROOT, "client", "public", "data", "routes.it.real.stats.json");

const MIN_REAL_DISTANCE_KM = 60;
const PREFERRED_MIN_DISTANCE_KM = 80;
const MAX_DUP_NAME_DISTANCE_DIFF_KM = 25;
const MAX_DUP_CENTER_KM = 35;
const MAX_DUP_START_END_KM = 30;
const MAX_DUP_BBOX_SCORE = 0.82;

const ITALY_BBOX = {
  minLat: 35.0,
  maxLat: 47.9,
  minLng: 6.0,
  maxLng: 19.2,
};

const TRACK_WORDS = [
  "circuit",
  "track",
  "racetrack",
  "kart",
  "speedway",
  "motocross",
  "mx",
  "crossodromo",
  "autodromo",
  "pista",
  "pista da cross",
  "pista cross",
  "enduro park",
  "off-road park",
  "trackday",
  "pit lane",
  "pitlane",
  "go-kart",
  "gokart",
];

const HARD_OFFROAD_WORDS = [
  "enduro",
  "hard enduro",
  "motocross",
  "cross",
  "mx",
  "single track",
  "mulattiera",
  "enduro park",
  "off-road park",
  "off road park",
  "crossodromo",
];

const SOFT_OFFROAD_WORDS = [
  "gravel",
  "sterrato",
  "white road",
  "strada bianca",
  "mixed surface",
  "mixed",
  "dirt road",
];

const PASS_WORDS = [
  "passo",
  "pass",
  "joch",
  "colle",
  "forcella",
  "sella",
  "valico",
];

const ITALIA_WORDS = [
  "italy",
  "italia",
  "trentino",
  "alto adige",
  "sudtirol",
  "südtirol",
  "veneto",
  "lombardia",
  "piemonte",
  "liguria",
  "friuli",
  "friuli venezia giulia",
  "emilia romagna",
  "emilia-romagna",
  "toscana",
  "umbria",
  "marche",
  "lazio",
  "abruzzo",
  "molise",
  "campania",
  "puglia",
  "basilicata",
  "calabria",
  "sicilia",
  "sardegna",
  "valle d aosta",
  "valle d'aosta",
  "aosta",
  "dolomiti",
  "appennino",
  "etna",
  "garda",
  "como",
  "amalfi",
  "amalfitana",
  "stelvio",
  "muraglione",
  "cisa",
  "giau",
  "pordoi",
  "falzarego",
  "gardena",
  "campolongo",
  "raticosa",
  "giogo",
  "gran sasso",
  "campo imperatore",
  "rombo",
  "timmelsjoch",
  "ligure",
  "etruschi",
  "val d orcia",
  "val d'orcia",
  "crete senesi",
  "langhe",
  "chianti",
  "salento",
  "aspromonte",
  "gennargentu",
  "barbagia",
  "sila",
  "madonie",
  "nebrodi",
  "gargano",
  "umbria",
  "chianti",
  "monferrato",
  "maremma",
  "garda",
  "iseo",
  "maggiore",
  "orta",
  "isole egadi",
  "etna",
];

const HERO_HINTS = [
  "stelvio",
  "sellaronda",
  "sella",
  "giau",
  "pordoi",
  "falzarego",
  "gardena",
  "campolongo",
  "muraglione",
  "cisa",
  "ss125",
  "etna",
  "costiera amalfitana",
  "amalfitana",
  "dolomiti",
  "val d orcia",
  "val d'orcia",
  "crete senesi",
  "langhe",
  "gran sasso",
  "campo imperatore",
  "raticosa",
  "giogo",
  "rombo",
  "timmelsjoch",
  "garda",
  "barbagia",
  "gennargentu",
  "madonie",
  "nebrodi",
];

const COASTAL_WORDS = [
  "coast",
  "coastal",
  "costiera",
  "mare",
  "sea",
  "riviera",
  "gulf",
  "golfo",
  "litorale",
  "lungomare",
  "adriatic",
  "tirreno",
  "tirrenica",
  "ionio",
  "ionica",
  "mediterraneo",
  "amalfi",
  "amalfitana",
  "salento",
  "ligure",
  "cinque terre",
  "sardegna",
  "sicilia",
  "isola",
];

const LAKE_WORDS = [
  "lake",
  "lago",
  "garda",
  "como",
  "iseo",
  "maggiore",
  "orta",
  "trasimeno",
  "ledro",
  "idro",
];

const MOUNTAIN_WORDS = [
  "mountain",
  "montagna",
  "alps",
  "alpi",
  "dolomiti",
  "appennino",
  "passo",
  "pass",
  "joch",
  "colle",
  "forcella",
  "valico",
  "stelvio",
  "giau",
  "pordoi",
  "gardena",
  "campolongo",
  "muraglione",
  "raticosa",
  "giogo",
  "cisa",
  "rombo",
  "timmelsjoch",
  "gran sasso",
  "campo imperatore",
  "etna",
  "barbagia",
  "gennargentu",
];

const SCENIC_WORDS = [
  "scenic",
  "panoramic",
  "panoramica",
  "viewpoint",
  "belvedere",
  "vista",
  "curve",
  "winding",
  "twisty",
  "touring",
  "paesaggi",
  "paesaggio",
  "panorama",
];

function safeDecodeMojibake(value) {
  if (typeof value !== "string") return value;
  if (!/[ÃÂâ€™â€œâ€\uFFFD]/.test(value)) return value;
  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function normalizeText(value) {
  return String(safeDecodeMojibake(value || ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = toRad((b.lat || 0) - (a.lat || 0));
  const dLng = toRad((b.lng || 0) - (a.lng || 0));
  const lat1 = toRad(a.lat || 0);
  const lat2 = toRad(b.lat || 0);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function pickFirst(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

function inItalyBBox(lat, lng) {
  return (
    lat >= ITALY_BBOX.minLat &&
    lat <= ITALY_BBOX.maxLat &&
    lng >= ITALY_BBOX.minLng &&
    lng <= ITALY_BBOX.maxLng
  );
}

function pushCoord(pts, lat, lng, source = "unknown") {
  const la = numberOrNull(lat);
  const ln = numberOrNull(lng);
  if (la === null || ln === null) return;

  if (inItalyBBox(la, ln)) {
    pts.push({ lat: la, lng: ln, source });
    return;
  }

  if (inItalyBBox(ln, la)) {
    pts.push({ lat: ln, lng: la, source });
    return;
  }

  // fallback generico: se non rientrano in bbox, salva comunque nel formato più probabile [lat,lng]
  // utile per route che passano appena fuori confine o dati sporchi ma recuperabili
  if (Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
    pts.push({ lat: la, lng: ln, source });
  }
}

function extractPointLike(value, source, pts) {
  if (!value) return;

  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] !== "object") {
      pushCoord(pts, value[0], value[1], source);
      return;
    }

    for (const item of value) {
      if (Array.isArray(item) && item.length >= 2) {
        pushCoord(pts, item[0], item[1], source);
      } else if (item && typeof item === "object") {
        pushCoord(pts, item.lat, item.lng ?? item.lon, source);
      }
    }
    return;
  }

  if (typeof value === "object") {
    pushCoord(pts, value.lat, value.lng ?? value.lon, source);
  }
}

function dedupeCoords(points) {
  const out = [];
  const seen = new Set();

  for (const p of points) {
    const key = `${Number(p.lat).toFixed(5)}|${Number(p.lng).toFixed(5)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }

  return out;
}

function extractCoords(route) {
  const pts = [];

  extractPointLike(route?.start, "start", pts);
  extractPointLike(route?.end, "end", pts);
  extractPointLike(route?.center, "center", pts);
  extractPointLike(route?.coords, "coords", pts);
  extractPointLike(route?.points, "points", pts);
  extractPointLike(route?.polyline, "polyline", pts);

  if (Array.isArray(route?.geometry?.coordinates)) {
    for (const c of route.geometry.coordinates) {
      if (Array.isArray(c) && c.length >= 2) {
        const a = numberOrNull(c[0]);
        const b = numberOrNull(c[1]);
        if (a !== null && b !== null) {
          if (inItalyBBox(b, a)) pts.push({ lat: b, lng: a, source: "geometry" });
          else if (inItalyBBox(a, b)) pts.push({ lat: a, lng: b, source: "geometry" });
          else if (Math.abs(b) <= 90 && Math.abs(a) <= 180) pts.push({ lat: b, lng: a, source: "geometry" });
        }
      }
    }
  }

  if (Array.isArray(route?.waypoints)) {
    for (const w of route.waypoints) {
      if (!w) continue;
      if (Array.isArray(w) && w.length >= 2) {
        pushCoord(pts, w[0], w[1], "waypoint");
      } else {
        pushCoord(pts, w.lat, w.lng ?? w.lon, "waypoint");
      }
    }
  }

  return dedupeCoords(pts);
}

function computeCenter(points) {
  if (!points.length) return null;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}

function computePolylineDistance(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total > 0 ? total : null;
}

function guessDistanceKm(route, points) {
  const explicit =
    numberOrNull(route.distanceKm) ??
    numberOrNull(route.distance) ??
    numberOrNull(route.km) ??
    numberOrNull(route.lengthKm) ??
    numberOrNull(route.totalKm) ??
    numberOrNull(route.length);

  if (explicit) return explicit;

  const polyDistance = computePolylineDistance(points);
  if (polyDistance && points.length >= 4) return Math.round(polyDistance);

  const directDistance =
    points.length >= 2 ? haversineKm(points[0], points[points.length - 1]) : null;

  if (!directDistance) return null;

  if (points.length >= 3) return Math.round(directDistance * 1.35);
  return Math.round(directDistance * 1.2);
}

function collectSearchBlob(route) {
  const fields = [
    route?.id,
    route?.slug,
    route?.name,
    route?.title,
    safeDecodeMojibake(route?.description),
    safeDecodeMojibake(route?.summary),
    route?.country,
    route?.countryName,
    route?.region,
    route?.province,
    route?.state,
    route?.area,
    route?.zone,
    route?.rideType,
    route?.surface,
    route?.bestSeason,
    route?.searchText,
    ...(Array.isArray(route?.aliases) ? route.aliases : []),
    ...(Array.isArray(route?.tags) ? route.tags : []),
    ...(Array.isArray(route?.spots) ? route.spots.map((s) => s?.name).filter(Boolean) : []),
    ...(Array.isArray(route?.waypoints) ? route.waypoints.map((w) => w?.name).filter(Boolean) : []),
  ];

  return normalizeText(fields.filter(Boolean).join(" | "));
}

function containsAny(blob, words) {
  return words.some((w) => blob.includes(normalizeText(w)));
}

function countAny(blob, words) {
  return words.reduce((n, w) => n + (blob.includes(normalizeText(w)) ? 1 : 0), 0);
}

function countPassHints(blob) {
  return PASS_WORDS.reduce((n, w) => n + (blob.includes(normalizeText(w)) ? 1 : 0), 0);
}

function countItalyPoints(points) {
  return points.filter((p) => inItalyBBox(p.lat, p.lng)).length;
}

function isLikelyItalian(route, blob, points) {
  const country = normalizeText(route?.country || route?.countryName);
  if (country === "it" || country === "italy" || country === "italia") {
    return { yes: true, confidence: "high" };
  }

  if (ITALIA_WORDS.some((w) => blob.includes(normalizeText(w)))) {
    return { yes: true, confidence: "high" };
  }

  const italyPoints = countItalyPoints(points);
  if (italyPoints >= 2) return { yes: true, confidence: "high" };
  if (italyPoints === 1) return { yes: true, confidence: "medium" };

  const center = computeCenter(points);
  if (center && inItalyBBox(center.lat, center.lng)) {
    return { yes: true, confidence: "medium" };
  }

  return { yes: false, confidence: "low" };
}

function isTrackLike(route, blob) {
  if (containsAny(blob, TRACK_WORDS)) return true;

  const type = normalizeText(route?.type);
  const rideType = normalizeText(route?.rideType);
  const category = normalizeText(route?.category);

  return [type, rideType, category].some((v) =>
    TRACK_WORDS.some((w) => v.includes(normalizeText(w)))
  );
}

function getOffroadSeverity(route, blob) {
  const surface = normalizeText(route?.surface);
  const rideType = normalizeText(route?.rideType);
  const category = normalizeText(route?.category);
  const type = normalizeText(route?.type);
  const joined = [surface, rideType, category, type, blob].join(" ");

  if (containsAny(joined, HARD_OFFROAD_WORDS)) return "hard";
  if (containsAny(joined, SOFT_OFFROAD_WORDS)) return "soft";

  if (
    surface.includes("offroad") ||
    surface.includes("off road") ||
    surface.includes("hard enduro")
  ) {
    return "hard";
  }

  if (
    surface.includes("dirt") ||
    surface.includes("gravel") ||
    surface.includes("mixed") ||
    surface.includes("sterrato")
  ) {
    return "soft";
  }

  return "none";
}

function buildBBox(points) {
  if (!points.length) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function bboxSimilarity(a, b) {
  if (!a || !b) return 0;

  const latOverlap = Math.max(0, Math.min(a.maxLat, b.maxLat) - Math.max(a.minLat, b.minLat));
  const lngOverlap = Math.max(0, Math.min(a.maxLng, b.maxLng) - Math.max(a.minLng, b.minLng));

  const aLatSpan = Math.max(0.0001, a.maxLat - a.minLat);
  const aLngSpan = Math.max(0.0001, a.maxLng - a.minLng);
  const bLatSpan = Math.max(0.0001, b.maxLat - b.minLat);
  const bLngSpan = Math.max(0.0001, b.maxLng - b.minLng);

  const latScore = latOverlap / Math.max(aLatSpan, bLatSpan);
  const lngScore = lngOverlap / Math.max(aLngSpan, bLngSpan);

  return (latScore + lngScore) / 2;
}

function endpointsNear(pointsA, pointsB) {
  if (!pointsA?.length || !pointsB?.length) return false;

  const aStart = pointsA[0];
  const aEnd = pointsA[pointsA.length - 1];
  const bStart = pointsB[0];
  const bEnd = pointsB[pointsB.length - 1];

  const direct =
    haversineKm(aStart, bStart) <= MAX_DUP_START_END_KM &&
    haversineKm(aEnd, bEnd) <= MAX_DUP_START_END_KM;

  const reverse =
    haversineKm(aStart, bEnd) <= MAX_DUP_START_END_KM &&
    haversineKm(aEnd, bStart) <= MAX_DUP_START_END_KM;

  return direct || reverse;
}

function classifyRouteFamily(blob, points, route = {}) {
  const coastalScore = countAny(blob, COASTAL_WORDS);
  const lakeScore = countAny(blob, LAKE_WORDS);
  const mountainScore = countAny(blob, MOUNTAIN_WORDS);
  const scenicScore = countAny(blob, SCENIC_WORDS);

  const regionBlob = normalizeText([
    route?.region,
    route?.state,
    route?.area,
    route?.province,
    route?.countryName,
    route?.country
  ].filter(Boolean).join(" | "));

  const hasLakeStrong =
    lakeScore >= 1 ||
    regionBlob.includes("lago") ||
    regionBlob.includes("lake") ||
    regionBlob.includes("garda") ||
    regionBlob.includes("como") ||
    regionBlob.includes("maggiore") ||
    regionBlob.includes("iseo") ||
    regionBlob.includes("trasimeno");

  const hasCoastalStrong =
    coastalScore >= 1 ||
    regionBlob.includes("coast") ||
    regionBlob.includes("costiera") ||
    regionBlob.includes("liguria") ||
    regionBlob.includes("salento") ||
    regionBlob.includes("sardegna") ||
    regionBlob.includes("sicilia") ||
    regionBlob.includes("riviera");

  const hasMountainStrong =
    mountainScore >= 1 ||
    regionBlob.includes("alpi") ||
    regionBlob.includes("dolomiti") ||
    regionBlob.includes("appennino") ||
    regionBlob.includes("stelvio") ||
    regionBlob.includes("passo");

  // priorità commerciale: laghi e mare prima di montagna
  if (hasLakeStrong) return "lake";
  if (hasCoastalStrong) return "coastal";
  if (hasMountainStrong) return "mountain";

  if (scenicScore >= 1) return "scenic";
  if (points.length >= 4) return "scenic";
  return "scenic";
}
function buildSearchTags(blob, family, hero, region, route) {
  const tags = new Set();

  tags.add("italy");
  if (family) tags.add(family);
  if (hero) tags.add("hero");
  if (region) tags.add(normalizeText(region).replace(/\s+/g, "-"));

  if (containsAny(blob, COASTAL_WORDS)) tags.add("mare");
  if (containsAny(blob, LAKE_WORDS)) tags.add("lago");
  if (containsAny(blob, MOUNTAIN_WORDS)) tags.add("montagna");
  if (containsAny(blob, SCENIC_WORDS)) tags.add("panoramico");
  if (containsAny(blob, PASS_WORDS)) tags.add("passi");

  const bestSeason = normalizeText(route?.bestSeason);
  if (bestSeason) tags.add(bestSeason.replace(/\s+/g, "-"));

  return [...tags].filter(Boolean);
}

function classify(route) {
  const points = extractCoords(route);
  const blob = collectSearchBlob(route);
  const center = computeCenter(points);
  const distanceKm = guessDistanceKm(route, points);
  const passHints = countPassHints(blob);
  const italyCheck = isLikelyItalian(route, blob, points);
  const trackLike = isTrackLike(route, blob);
  const offroadSeverity = getOffroadSeverity(route, blob);
  const bbox = buildBBox(points);

  const name = safeDecodeMojibake(pickFirst(route?.name, route?.title, "Untitled route"));
  const normalizedName = normalizeText(name);

  const isLoop =
    normalizeText(route?.shape).includes("loop") ||
    normalizeText(route?.routeType).includes("loop") ||
    normalizeText(route?.kind).includes("loop") ||
    (points.length >= 2 && haversineKm(points[0], points[points.length - 1]) <= 25);

  const hero = HERO_HINTS.some((w) => blob.includes(normalizeText(w)));
const routeFamily = classifyRouteFamily(blob, points, route);
const isLakeFamily = routeFamily === "lake";
const isCoastalFamily = routeFamily === "coastal";
const relaxedDistanceFloor = isLakeFamily || isCoastalFamily ? 35 : MIN_REAL_DISTANCE_KM;
const relaxedPreferredFloor = isLakeFamily || isCoastalFamily ? 55 : PREFERRED_MIN_DISTANCE_KM;
  let status = "keep";
  let reason = "real_route";

  if (!italyCheck.yes) {
    status = "review";
    reason = "not_italy_or_unresolved";
  } else if (trackLike) {
    status = "discard";
    reason = "track_or_circuit";
  } else if (offroadSeverity === "hard") {
    status = "discard";
    reason = "hard_offroad_or_enduro";
  } else if (offroadSeverity === "soft") {
    status = "review";
    reason = "mixed_surface_review";
} else if (!distanceKm || distanceKm < relaxedDistanceFloor) {
  status = "review";
  reason =
    isLakeFamily || isCoastalFamily
      ? "short_lake_or_coastal_route"
      : passHints >= 1
      ? "single_pass_or_micro_route"
      : "too_short";
} else if (passHints >= 2 && distanceKm < relaxedPreferredFloor && !isLakeFamily && !isCoastalFamily) {
  status = "review";
  reason = "pass_cluster_but_not_full_itinerary";
}
  let sourceQuality = "medium";
  if (
    points.length >= 5 &&
    distanceKm >= 100 &&
    italyCheck.confidence === "high" &&
    offroadSeverity === "none"
  ) {
    sourceQuality = "high";
  } else if (points.length < 2 || italyCheck.confidence === "low") {
    sourceQuality = "low";
  }

  return {
    original: route,
    meta: {
      name,
      normalizedName,
      blob,
      center,
      bbox,
      points,
      distanceKm,
      passHints,
      isLoop,
      hero,
      routeFamily,
      sourceQuality,
      italian: italyCheck.yes,
      italianConfidence: italyCheck.confidence,
      trackLike,
      offroadSeverity,
      status,
      reason,
      pointsCount: points.length,
      italyPoints: countItalyPoints(points),
    },
  };
}

function similarName(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const wa = new Set(a.split(" ").filter(Boolean));
  const wb = new Set(b.split(" ").filter(Boolean));
  const common = [...wa].filter((x) => wb.has(x)).length;
  const minSize = Math.min(wa.size, wb.size) || 1;

  return common / minSize >= 0.7;
}

function chooseBest(a, b) {
  const score = (x) => {
    let s = 0;
    s += Math.min(x.meta.distanceKm || 0, 400);
    s += x.meta.hero ? 40 : 0;
    s += x.meta.isLoop ? 10 : 0;
    s += x.meta.pointsCount > 5 ? 10 : 0;
    s += x.meta.italianConfidence === "high" ? 20 : x.meta.italianConfidence === "medium" ? 10 : 0;
    s += x.meta.sourceQuality === "high" ? 20 : x.meta.sourceQuality === "medium" ? 10 : 0;
    s += x.meta.routeFamily === "lake" ? 18 : 0;
s += x.meta.routeFamily === "coastal" ? 14 : 0;
    s += (x.original?.rating || 0) * 5;
    s += (x.original?.curvesScore || 0) * 3;
    return s;
  };

  return score(a) >= score(b) ? a : b;
}

function arePotentialDuplicates(a, b) {
  const sameName = similarName(a.meta.normalizedName, b.meta.normalizedName);

  const distA = a.meta.distanceKm ?? 0;
  const distB = b.meta.distanceKm ?? 0;
  const nearDistance = Math.abs(distA - distB) <= MAX_DUP_NAME_DISTANCE_DIFF_KM;

  const centerNear =
    a.meta.center &&
    b.meta.center &&
    haversineKm(a.meta.center, b.meta.center) <= MAX_DUP_CENTER_KM;

  const startEndNear = endpointsNear(a.meta.points, b.meta.points);
  const bboxScore = bboxSimilarity(a.meta.bbox, b.meta.bbox);

  if (sameName && nearDistance) return true;
  if (sameName && centerNear) return true;
  if (sameName && startEndNear) return true;
  if (sameName && bboxScore >= MAX_DUP_BBOX_SCORE) return true;

  // caso cloni geografici anche con nome leggermente diverso
  if (centerNear && startEndNear && nearDistance) return true;
  if (centerNear && bboxScore >= 0.9 && nearDistance) return true;

  return false;
}

function dedupeKeep(items) {
  const kept = [];
  const removed = [];

  for (const item of items) {
    let dupIndex = -1;

    for (let i = 0; i < kept.length; i++) {
      const k = kept[i];
      if (arePotentialDuplicates(item, k)) {
        dupIndex = i;
        break;
      }
    }

    if (dupIndex === -1) {
      kept.push(item);
    } else {
      const current = kept[dupIndex];
      const best = chooseBest(current, item);
      const other = best === current ? item : current;
      kept[dupIndex] = best;

      removed.push({
        removedName: other.meta.name,
        keptName: best.meta.name,
        removedDistanceKm: other.meta.distanceKm,
        keptDistanceKm: best.meta.distanceKm,
        reason: "duplicate_route",
      });
    }
  }

  return { kept, removed };
}

function normalizePointField(value) {
  if (!value) return value;

  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] !== "object") {
      return [Number(value[0]), Number(value[1])];
    }
    return value;
  }

  if (typeof value === "object") {
    const lat = numberOrNull(value.lat);
    const lng = numberOrNull(value.lng ?? value.lon);
    if (lat !== null && lng !== null) return [lat, lng];
  }

  return value;
}

function buildFinalRoute(item) {
  const r = { ...item.original };

  const region =
    safeDecodeMojibake(pickFirst(r.region, r.state, r.area, r.province, "Italia")) || "Italia";

  const searchTags = buildSearchTags(
    item.meta.blob,
    item.meta.routeFamily,
    item.meta.hero,
    region,
    r
  );

  return {
    ...r,
    name: safeDecodeMojibake(r.name || r.title || item.meta.name),
    description: safeDecodeMojibake(r.description || r.summary || ""),
    country: "IT",
    countryName: "Italy",
    region,
    start: normalizePointField(r.start),
    end: normalizePointField(r.end),
    center: normalizePointField(r.center),
    distanceKm: item.meta.distanceKm,
    hero: Boolean(r.hero || item.meta.hero),
    qualityTag: item.meta.distanceKm >= 120 ? "full_itinerary" : "short_real_itinerary",
    italianConfidence: item.meta.italianConfidence,
    routeFamily: item.meta.routeFamily,
    sourceQuality: item.meta.sourceQuality,
    isLoop: item.meta.isLoop,
    searchTags,
    cleanedAt: new Date().toISOString(),
    cleanedBy: "cleanItalyRealRoutes_v3",
  };
}

async function main() {
  const raw = await fs.readFile(INPUT, "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("routes.json non contiene un array");
  }

  const classified = data.map(classify);

  const discarded = [];
  const review = [];
  const preliminaryKeep = [];

  for (const item of classified) {
    if (item.meta.status === "discard") discarded.push(item);
    else if (item.meta.status === "review") review.push(item);
    else preliminaryKeep.push(item);
  }

  const { kept, removed } = dedupeKeep(preliminaryKeep);

  const finalRoutes = kept
    .map(buildFinalRoute)
    .sort((a, b) => {
      const heroA = a.hero ? 1 : 0;
      const heroB = b.hero ? 1 : 0;
      if (heroB !== heroA) return heroB - heroA;

      const qualityOrder = { high: 3, medium: 2, low: 1 };
      const qa = qualityOrder[a.sourceQuality] || 0;
      const qb = qualityOrder[b.sourceQuality] || 0;
      if (qb !== qa) return qb - qa;

      return (b.distanceKm || 0) - (a.distanceKm || 0);
    });

  const reviewOut = [
    ...review.map((x) => ({
      ...x.original,
      _review: x.meta.reason,
      _distanceKm: x.meta.distanceKm,
      _passHints: x.meta.passHints,
      _italianConfidence: x.meta.italianConfidence,
      _italyPoints: x.meta.italyPoints,
      _routeFamily: x.meta.routeFamily,
      _sourceQuality: x.meta.sourceQuality,
      _offroadSeverity: x.meta.offroadSeverity,
    })),
    ...discarded.map((x) => ({
      ...x.original,
      _review: x.meta.reason,
      _distanceKm: x.meta.distanceKm,
      _passHints: x.meta.passHints,
      _italianConfidence: x.meta.italianConfidence,
      _italyPoints: x.meta.italyPoints,
      _routeFamily: x.meta.routeFamily,
      _sourceQuality: x.meta.sourceQuality,
      _offroadSeverity: x.meta.offroadSeverity,
    })),
    ...removed.map((x) => ({
      type: "dedupe_removed",
      ...x,
    })),
  ];

  const stats = {
    inputTotal: data.length,
    preliminaryKeep: preliminaryKeep.length,
    discarded: discarded.length,
    review: review.length,
    dedupeRemoved: removed.length,
    finalRoutes: finalRoutes.length,
    reasonBreakdown: classified.reduce((acc, item) => {
      const key = item.meta.reason;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    finalHeroRoutes: finalRoutes.filter((r) => r.hero).length,
    finalLongRoutes120Plus: finalRoutes.filter((r) => (r.distanceKm || 0) >= 120).length,
    finalRegions: finalRoutes.reduce((acc, r) => {
      const key = r.region || "Italia";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    finalByRouteFamily: finalRoutes.reduce((acc, r) => {
      const key = r.routeFamily || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    sourceQualityBreakdown: finalRoutes.reduce((acc, r) => {
      const key = r.sourceQuality || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    italianConfidenceBreakdown: finalRoutes.reduce((acc, r) => {
      const key = r.italianConfidence || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };

  await fs.writeFile(OUTPUT_CLEAN, JSON.stringify(finalRoutes, null, 2), "utf8");
  await fs.writeFile(OUTPUT_REVIEW, JSON.stringify(reviewOut, null, 2), "utf8");
  await fs.writeFile(OUTPUT_STATS, JSON.stringify(stats, null, 2), "utf8");

  console.log("====================================");
  console.log("MotoPortEU — Pulizia Itinerari Italia Reale v3");
  console.log("====================================");
  console.log(`Input totale:        ${stats.inputTotal}`);
  console.log(`Keep preliminare:    ${stats.preliminaryKeep}`);
  console.log(`Scartati:            ${stats.discarded}`);
  console.log(`Review:              ${stats.review}`);
  console.log(`Duplicati rimossi:   ${stats.dedupeRemoved}`);
  console.log(`Output finale:       ${stats.finalRoutes}`);
  console.log("------------------------------------");
  console.log("Reason breakdown:");
  for (const [k, v] of Object.entries(stats.reasonBreakdown)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("------------------------------------");
  console.log("By route family:");
  for (const [k, v] of Object.entries(stats.finalByRouteFamily)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("------------------------------------");
  console.log("Source quality:");
  for (const [k, v] of Object.entries(stats.sourceQualityBreakdown)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("------------------------------------");
  console.log(`Creato: ${OUTPUT_CLEAN}`);
  console.log(`Creato: ${OUTPUT_REVIEW}`);
  console.log(`Creato: ${OUTPUT_STATS}`);
  console.log("====================================");
}

main().catch((err) => {
  console.error("❌ Errore cleanItalyRealRoutes:", err);
  process.exit(1);
});