#!/usr/bin/env node
/**
 * MotoPortEU — Merge Italy All Scopes
 *
 * Obiettivo:
 * - unire tutti gli scope Italia:
 *   italy-nw, italy-ne, italy-center, italy-south, sicily, sardinia
 * - deduplicare route simili
 * - scartare route troppo corte / sporche / offroad / naming brutto
 * - normalizzare nomi, rideType e regioni
 *
 * Output:
 * - client/public/data/routes.it.final.json
 * - client/public/data/routes.it.final.review.json
 * - client/public/data/routes.it.final.stats.json
 *
 * Uso:
 *   node .\server\scripts\mergeItalyAllScopes.js
 */

import fs from "fs/promises";
import path from "path";
import process from "process";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "client", "public", "data");

const SCOPES = [
  "italy-nw",
  "italy-ne",
  "italy-center",
  "italy-south",
  "sicily",
  "sardinia",
];

const INPUTS = SCOPES.map((scope) =>
  path.join(DATA_DIR, `routes.generated.IT.${scope}.json`)
);

const OUTPUT_FINAL = path.join(DATA_DIR, "routes.it.final.json");
const OUTPUT_REVIEW = path.join(DATA_DIR, "routes.it.final.review.json");
const OUTPUT_STATS = path.join(DATA_DIR, "routes.it.final.stats.json");

const MIN_DISTANCE_KM = 60;
const HERO_DISTANCE_KM = 120;
const MAX_DISTANCE_KM = 420;

const DIRTY_WORDS = [
  "off road",
  "off-road",
  "mx",
  "park",
  "crater",
  "cratere",
  "motocross",
  "crossodromo",
  "enduro",
  "simeto off road",
  "moto park",
];

const FOREIGN_WORDS = [
  "carnic alps",
  "south eastern crater",
  "eastern crater",
];

const REGION_RULES = [
  {
    region: "Lombardia / Alpi",
    rideType: "mountain",
    terms: [
      "stelvio", "gavia", "mortirolo", "tonale", "spluga", "bernina",
      "bormio", "livigno", "tirano", "como", "garda", "lake como", "lake garda",
    ],
  },
  {
    region: "Valle d'Aosta / Alpi",
    rideType: "mountain",
    terms: [
      "aosta", "aosta valley", "courmayeur", "monte bianco", "gran paradiso",
      "col ferret", "col du loson", "col de joux",
    ],
  },
  {
    region: "Piemonte / Alpi",
    rideType: "mountain",
    terms: [
      "cuneo", "fauniera", "valcavera", "rocca brancia", "san chiaffredo",
      "col de tende", "tanarello", "fronte", "guardia", "gardetta",
    ],
  },
  {
    region: "Liguria / Appennino",
    rideType: "scenic",
    terms: [
      "liguria", "appennino ligure", "imperia", "savona", "genova", "la spezia",
    ],
  },
  {
    region: "Dolomiti",
    rideType: "mountain",
    terms: [
      "dolomiti", "sellaronda", "pordoi", "gardena", "campolongo",
      "falzarego", "giau", "fedaia", "cortina", "sella", "sella derbi",
    ],
  },
  {
    region: "Trentino / Veneto / Friuli",
    rideType: "mountain",
    terms: [
      "trentino", "veneto", "friuli", "carnia", "monte baldo", "lessinia",
      "san boldo", "sant osvaldo", "valbana", "col alto", "col bechei", "passo limo",
    ],
  },
  {
    region: "Toscana / Emilia-Romagna / Appennino",
    rideType: "appennino",
    terms: [
      "raticosa", "giogo", "muraglione", "futa", "serra", "monte serra",
      "garfagnana", "apuane", "bracco", "brattello", "cisa", "cirone",
      "cerreto", "ospedalaccio", "cerratano", "passo del lupo", "fociomboli",
    ],
  },
  {
    region: "Centro Italia",
    rideType: "appennino",
    terms: [
      "gran sasso", "majella", "sibillini", "terminillo", "amiata", "chianti",
      "val d orcia", "crete senesi", "casentino",
    ],
  },
  {
    region: "Sud Italia",
    rideType: "mountain",
    terms: [
      "conza", "crocelle", "s vito", "s.vito", "sila", "aspromonte",
      "cornacchie", "acquabona", "gargano", "pollino", "cilento",
    ],
  },
  {
    region: "Sicilia",
    rideType: "mountain",
    terms: [
      "sicilia", "etna", "madonie", "zingaro", "peloritani", "nebrodi", "val di noto",
    ],
  },
  {
    region: "Sardegna",
    rideType: "scenic",
    terms: [
      "sardegna", "ghenna silana", "genna arramene", "correboi", "tascusi",
      "supramonte", "ogliastra", "barbagia", "costa smeralda", "bosa",
    ],
  },
];

function norm(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeText(str = "") {
  return norm(str).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(str = "") {
  return normalizeText(str).replace(/\s+/g, "-");
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeDecodeMojibake(value) {
  if (typeof value !== "string") return value;
  if (!/[ÃÂâ€™â€œâ€\uFFFD]/.test(value)) return value;
  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function routeName(route) {
  return safeDecodeMojibake(route.name || route.title || "Untitled");
}

function routeDescription(route) {
  return safeDecodeMojibake(route.description || route.summary || "");
}

function routeBlob(route) {
  return normalizeText(
    [
      routeName(route),
      routeDescription(route),
      route.region,
      route.scope,
      route.scopeName,
      ...(Array.isArray(route.tags) ? route.tags : []),
      ...(Array.isArray(route.waypoints) ? route.waypoints.map((w) => w?.name).filter(Boolean) : []),
      route.start?.name,
      route.end?.name,
    ]
      .filter(Boolean)
      .join(" | ")
  );
}

function getPoint(p) {
  if (!p) return null;

  if (Array.isArray(p) && p.length >= 2) {
    const lat = toNum(p[0]);
    const lng = toNum(p[1]);
    if (lat != null && lng != null) return { lat, lng };
  }

  if (typeof p === "object") {
    const lat = toNum(p.lat);
    const lng = toNum(p.lng ?? p.lon);
    if (lat != null && lng != null) return { lat, lng };
  }

  return null;
}

function getCoords(route) {
  if (Array.isArray(route.coords) && route.coords.length) {
    return route.coords
      .map((c) => {
        if (Array.isArray(c) && c.length >= 2) {
          const lat = toNum(c[0]);
          const lng = toNum(c[1]);
          if (lat != null && lng != null) return [lat, lng];
        }
        return null;
      })
      .filter(Boolean);
  }

  if (Array.isArray(route.geometry?.coordinates) && route.geometry.coordinates.length) {
    return route.geometry.coordinates
      .map((c) => {
        if (Array.isArray(c) && c.length >= 2) {
          const a = toNum(c[0]);
          const b = toNum(c[1]);
          if (a != null && b != null) {
            // tentativo semplice: GeoJSON [lng,lat]
            if (Math.abs(a) <= 20 && Math.abs(b) <= 90) return [b, a];
          }
        }
        return null;
      })
      .filter(Boolean);
  }

  return [];
}

function hasUsefulGeometry(route) {
  return Boolean(
    (Array.isArray(route.coords) && route.coords.length) ||
      (route.start && route.end) ||
      route.center ||
      (route.geometry && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length)
  );
}

function canonicalNameKey(name = "") {
  return normalizeText(name)
    .replace(
      /\b(giro|montagna|panoramico|panoramica|scenic|route|ride|tour|alpi|dolomiti|sicilia|sardegna|appennino|passo|colle|col|pass)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function hasDirtyWord(route) {
  const blob = routeBlob(route);
  return DIRTY_WORDS.some((w) => blob.includes(normalizeText(w)));
}

function hasForeignWord(route) {
  const blob = routeBlob(route);
  return FOREIGN_WORDS.some((w) => blob.includes(normalizeText(w)));
}

function inferRideTypeFromText(route) {
  const blob = routeBlob(route);

  if (
    blob.includes("costiera") ||
    blob.includes("coast") ||
    blob.includes("mare") ||
    blob.includes("sea") ||
    blob.includes("costa")
  ) {
    return "coastal";
  }

  if (
    blob.includes("lake") ||
    blob.includes("lago") ||
    blob.includes("garda") ||
    blob.includes("como")
  ) {
    return "lake";
  }

  if (
    blob.includes("raticosa") ||
    blob.includes("giogo") ||
    blob.includes("muraglione") ||
    blob.includes("cisa") ||
    blob.includes("appennino")
  ) {
    return "appennino";
  }

  return "mountain";
}

function inferRegion(route) {
  const blob = routeBlob(route);

  for (const rule of REGION_RULES) {
    if (rule.terms.some((t) => blob.includes(normalizeText(t)))) {
      return {
        region: rule.region,
        rideType: rule.rideType,
      };
    }
  }

  const scope = String(route.scope || "");
  if (scope === "sicily") return { region: "Sicilia", rideType: "mountain" };
  if (scope === "sardinia") return { region: "Sardegna", rideType: "scenic" };
  if (scope === "italy-south") return { region: "Sud Italia", rideType: "mountain" };
  if (scope === "italy-center") return { region: "Centro Italia", rideType: "appennino" };
  if (scope === "italy-ne") return { region: "Nord-Est", rideType: "mountain" };
  if (scope === "italy-nw") return { region: "Nord-Ovest", rideType: "mountain" };

  return {
    region: route.region || "Italia",
    rideType: route.rideType || inferRideTypeFromText(route),
  };
}

function normalizeName(name = "", route = {}) {
  let out = safeDecodeMojibake(name || "");

  const replacements = [
    [/Carnic Alps/gi, "Alpi Carniche"],
    [/Cisa Pass/gi, "Passo della Cisa"],
    [/Etna's South Eastern Crater/gi, "Etna Sud-Est"],
    [/MXSIMETO OFF ROAD PARK/gi, "Area Simeto"],
    [/Passeggiata Panoramica/gi, "Panoramica"],
    [/Passo S\.Vito/gi, "Passo San Vito"],
    [/ a Passo Lento/gi, ""],
    [/Dolomiti:/gi, "Sud Italia:"],
  ];

  for (const [rx, rep] of replacements) {
    out = out.replace(rx, rep);
  }

  const inferred = inferRegion(route);

  if (inferred.region === "Sud Italia") {
    out = out.replace(/Giro Montagna Dolomiti/gi, "Giro Montagna Sud Italia");
  }

  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function routeScore(route) {
  let score = 0;

  const distanceKm = toNum(route.distanceKm) || 0;
  const rideType = route.rideType || "";
  const blob = routeBlob(route);

  score += Math.min(distanceKm, 260);

  if (distanceKm >= HERO_DISTANCE_KM) score += 20;
  if (distanceKm >= 180) score += 8;
  if (distanceKm < 80) score -= 10;
  if (distanceKm < MIN_DISTANCE_KM) score -= 30;

  if (rideType === "mountain") score += 12;
  if (rideType === "appennino") score += 10;
  if (rideType === "coastal") score += 8;
  if (rideType === "lake") score += 6;

  const waypointsCount = Array.isArray(route.waypoints) ? route.waypoints.length : 0;
  score += Math.min(waypointsCount * 4, 16);

  if ((Array.isArray(route.coords) && route.coords.length > 300) || (Array.isArray(route.geometry?.coordinates) && route.geometry.coordinates.length > 300)) {
    score += 8;
  }

  if (blob.includes("stelvio")) score += 12;
  if (blob.includes("gavia")) score += 10;
  if (blob.includes("mortirolo")) score += 10;
  if (blob.includes("pordoi")) score += 10;
  if (blob.includes("gardena")) score += 10;
  if (blob.includes("campolongo")) score += 10;
  if (blob.includes("falzarego")) score += 10;
  if (blob.includes("giau")) score += 10;
  if (blob.includes("raticosa")) score += 8;
  if (blob.includes("giogo")) score += 8;
  if (blob.includes("muraglione")) score += 8;
  if (blob.includes("etna")) score += 7;
  if (blob.includes("sila")) score += 7;
  if (blob.includes("sardegna")) score += 7;

  if (hasDirtyWord(route)) score -= 40;
  if (hasForeignWord(route)) score -= 25;

  return score;
}

function similarNames(a, b) {
  const ka = canonicalNameKey(a);
  const kb = canonicalNameKey(b);

  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;

  const wa = new Set(ka.split(" ").filter(Boolean));
  const wb = new Set(kb.split(" ").filter(Boolean));
  const common = [...wa].filter((x) => wb.has(x)).length;
  const minSize = Math.min(wa.size, wb.size) || 1;

  return common / minSize >= 0.72;
}

function coordsSignature(route) {
  const coords = getCoords(route);
  if (!coords.length) return "";

  const sampled = [];
  const step = Math.max(1, Math.floor(coords.length / 8));

  for (let i = 0; i < coords.length; i += step) {
    const c = coords[i];
    sampled.push(`${c[0].toFixed(2)},${c[1].toFixed(2)}`);
    if (sampled.length >= 8) break;
  }

  return sampled.join("|");
}

function areDuplicates(a, b) {
  const sameName = similarNames(routeName(a), routeName(b));
  const distA = toNum(a.distanceKm) || 0;
  const distB = toNum(b.distanceKm) || 0;
  const distNear = Math.abs(distA - distB) <= 28;

  const sigA = coordsSignature(a);
  const sigB = coordsSignature(b);
  const sameSig = sigA && sigB && sigA === sigB;

  const startA = getPoint(a.start);
  const startB = getPoint(b.start);
  const endA = getPoint(a.end);
  const endB = getPoint(b.end);

  const startNear =
    startA && startB
      ? haversineKm(startA.lat, startA.lng, startB.lat, startB.lng) <= 18
      : false;
  const endNear =
    endA && endB
      ? haversineKm(endA.lat, endA.lng, endB.lat, endB.lng) <= 18
      : false;

  return sameSig || (sameName && distNear) || (sameName && startNear && endNear);
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}

function chooseBetterRoute(a, b) {
  return routeScore(a) >= routeScore(b) ? a : b;
}

function normalizeRoute(route) {
  const inferred = inferRegion(route);
  const name = normalizeName(routeName(route), route);
  const description = routeDescription(route);

  return {
    ...route,
    id: route.id || `route-it-final-${slugify(name)}`,
    name,
    slug: route.slug || slugify(name),
    description,
    country: "IT",
    countryName: "Italy",
    region: inferred.region,
    rideType: route.rideType || inferred.rideType || inferRideTypeFromText(route),
    distanceKm: toNum(route.distanceKm),
    durationMin: toNum(route.durationMin),
    qualityTag: (toNum(route.distanceKm) || 0) >= HERO_DISTANCE_KM ? "hero_itinerary" : "real_itinerary",
    hero: (toNum(route.distanceKm) || 0) >= HERO_DISTANCE_KM,
    mergedFromItalyScopes: true,
    cleanedAt: new Date().toISOString(),
    cleanedBy: "mergeItalyAllScopes",
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Merge Italy All Scopes");
  console.log("====================================");

  let allRoutes = [];
  const inputByScope = {};

  for (let i = 0; i < SCOPES.length; i++) {
    const scope = SCOPES[i];
    const file = INPUTS[i];

    try {
      const data = await readJson(file);
      const arr = Array.isArray(data) ? data : [];
      inputByScope[scope] = arr.length;
      allRoutes.push(...arr);
      console.log(`📥 ${scope}: ${arr.length}`);
    } catch (err) {
      inputByScope[scope] = 0;
      console.log(`⚠️ ${scope}: file non trovato o non leggibile`);
    }
  }

  const review = [];
  const preliminary = [];

  for (const route of allRoutes) {
    const normalized = normalizeRoute(route);
    const distanceKm = toNum(normalized.distanceKm) || 0;

    if (!hasUsefulGeometry(normalized)) {
      review.push({ ...normalized, _review: "missing_geometry" });
      continue;
    }

    if (distanceKm <= 0 || distanceKm > MAX_DISTANCE_KM) {
      review.push({ ...normalized, _review: "bad_distance" });
      continue;
    }

    if (distanceKm < MIN_DISTANCE_KM) {
      review.push({ ...normalized, _review: "too_short" });
      continue;
    }

    if (hasDirtyWord(normalized)) {
      review.push({ ...normalized, _review: "dirty_source_or_name" });
      continue;
    }

    preliminary.push(normalized);
  }

  const deduped = [];
  const dedupeRemoved = [];

  for (const route of preliminary) {
    let matchedIndex = -1;

    for (let i = 0; i < deduped.length; i++) {
      if (areDuplicates(route, deduped[i])) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      deduped.push(route);
    } else {
      const existing = deduped[matchedIndex];
      const best = chooseBetterRoute(existing, route);
      const removed = best === existing ? route : existing;
      deduped[matchedIndex] = best;
      dedupeRemoved.push({
        _review: "duplicate_removed",
        keptId: best.id,
        keptName: best.name,
        removedId: removed.id,
        removedName: removed.name,
        removedDistanceKm: removed.distanceKm,
      });
    }
  }

  const finalRoutes = deduped.sort((a, b) => {
    const heroA = a.hero ? 1 : 0;
    const heroB = b.hero ? 1 : 0;
    if (heroB !== heroA) return heroB - heroA;
    return (b.distanceKm || 0) - (a.distanceKm || 0);
  });

  const finalReview = [...review, ...dedupeRemoved];

  const stats = {
    inputScopes: inputByScope,
    inputTotal: allRoutes.length,
    preliminaryAccepted: preliminary.length,
    reviewCount: review.length,
    dedupeRemoved: dedupeRemoved.length,
    finalRoutes: finalRoutes.length,
    finalHeroRoutes: finalRoutes.filter((r) => r.hero).length,
    finalByRideType: finalRoutes.reduce((acc, r) => {
      const key = r.rideType || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    finalByRegion: finalRoutes.reduce((acc, r) => {
      const key = r.region || "Italia";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    reviewBreakdown: finalReview.reduce((acc, r) => {
      const key = r._review || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };

  await fs.writeFile(OUTPUT_FINAL, JSON.stringify(finalRoutes, null, 2), "utf8");
  await fs.writeFile(OUTPUT_REVIEW, JSON.stringify(finalReview, null, 2), "utf8");
  await fs.writeFile(OUTPUT_STATS, JSON.stringify(stats, null, 2), "utf8");

  console.log("------------------------------------");
  console.log(`✅ Input totale: ${stats.inputTotal}`);
  console.log(`✅ Accettate preliminare: ${stats.preliminaryAccepted}`);
  console.log(`✅ Review: ${stats.reviewCount}`);
  console.log(`✅ Duplicati rimossi: ${stats.dedupeRemoved}`);
  console.log(`✅ Finali: ${stats.finalRoutes}`);
  console.log(`⭐ Hero routes: ${stats.finalHeroRoutes}`);
  console.log("------------------------------------");
  console.log("RideType:");
  for (const [k, v] of Object.entries(stats.finalByRideType)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("------------------------------------");
  console.log(`📁 Creato: ${OUTPUT_FINAL}`);
  console.log(`📁 Creato: ${OUTPUT_REVIEW}`);
  console.log(`📁 Creato: ${OUTPUT_STATS}`);
  console.log("====================================");
}

main().catch((err) => {
  console.error("❌ Errore mergeItalyAllScopes:", err);
  process.exit(1);
});