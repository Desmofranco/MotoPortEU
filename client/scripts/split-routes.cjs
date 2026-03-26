// =======================================================
// client/scripts/split-routes.cjs
// MotoPortEU — refine finale su routes già pulite
//
// USO:
//   node .\client\scripts\split-routes.cjs
//
// INPUT:
//   client/public/data/routes.json
//
// OUTPUT:
//   client/public/data/routes.cleaned.json
//   client/public/data/tracks.extracted.json
//   client/public/data/routes.review.json
//
// VERSIONE 2.9:
// - pensata per lavorare su un file routes già pulito
// - routes = bucket di default
// - tracks solo se chiarissimi
// - review quasi nulla
// =======================================================

const fs = require("fs");
const path = require("path");

const INPUT = path.join(process.cwd(), "client", "public", "data", "routes.json");
const OUT_ROUTES = path.join(process.cwd(), "client", "public", "data", "routes.cleaned.json");
const OUT_TRACKS = path.join(process.cwd(), "client", "public", "data", "tracks.extracted.json");
const OUT_REVIEW = path.join(process.cwd(), "client", "public", "data", "routes.review.json");

const HARD_TRACK_KEYWORDS = [
  "cross",
  "motocross",
  "mx",
  "enduro",
  "hard enduro",
  "hard_enduro",
  "single track",
  "singletrack",
  "fettucciato",
  "pista",
  "circuito",
  "circuit",
  "track",
  "race track",
  "motodromo",
  "kartodromo",
  "supermoto track",
  "training track",
  "offroad",
  "off-road",
  "off road",
  "dirt",
  "dirt track",
  "motocross track",
  "enduro track",
  "mx track",
  "crossodromo",
  "autodromo",
  "flat track",
];

const TRACK_TYPES = [
  "cross",
  "motocross",
  "mx",
  "enduro",
  "hard_enduro",
  "offroad",
  "off-road",
  "dirt",
  "track",
  "circuit",
  "race_track",
  "supermoto",
  "motocross_track",
  "enduro_track",
  "flat_track",
];

const NAME_HARD_TRACK_REGEX =
  /\b(cross|motocross|mx|enduro|hard enduro|singletrack|single track|fettucciato|track|race track|circuito|circuit|motodromo|kartodromo|crossodromo|autodromo|dirt|offroad|off road|off-road|supermoto)\b/i;

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
    .replace(/[_\-\/]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(arr) {
  return [...new Set(arr)];
}

function includesAny(text, keywords) {
  return keywords.filter((kw) => text.includes(norm(kw)));
}

function safeReadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function safeWriteJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function pickId(item, idx) {
  return item.id || item.slug || item.name || item.title || `item-${idx + 1}`;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function hasCoordsObject(item) {
  return Boolean(
    item &&
      item.coords &&
      Number.isFinite(Number(item.coords.lat)) &&
      Number.isFinite(Number(item.coords.lng ?? item.coords.lon))
  );
}

function hasLineGeometry(item) {
  return (
    (Array.isArray(item?.points) && item.points.length >= 2) ||
    (Array.isArray(item?.geometry) && item.geometry.length >= 2) ||
    (Array.isArray(item?.polyline) && item.polyline.length >= 2) ||
    (Array.isArray(item?.path) && item.path.length >= 2)
  );
}

function buildSearchText(item) {
  const primaryFields = [
    item.id,
    item.name,
    item.title,
    item.label,
    item.category,
    item.type,
    item.rideType,
    item.surface,
    item.terrain,
    item.kind,
    item.style,
    item.slug,
    item.source,
  ];

  const secondaryFields = [
    item.description,
    item.desc,
    item.summary,
    item.note,
    item.notes,
    Array.isArray(item.tags) ? item.tags.join(" ") : "",
    item.region,
    item.country,
  ];

  const primaryText = norm(primaryFields.filter(Boolean).join(" | "));
  const secondaryText = norm(secondaryFields.filter(Boolean).join(" | "));
  const fullText = `${primaryText} | ${secondaryText}`.trim();

  return {
    primaryText,
    secondaryText,
    fullText,
  };
}

function getSignals(item) {
  const { primaryText, secondaryText, fullText } = buildSearchText(item);

  const typeNorm = norm(item.type);
  const rideTypeNorm = norm(item.rideType);
  const categoryNorm = norm(item.category);
  const surfaceNorm = norm(item.surface);
  const terrainNorm = norm(item.terrain);
  const nameNorm = norm(item.name);
  const titleNorm = norm(item.title);
  const labelNorm = norm(item.label);
  const idNorm = norm(item.id);

  const distanceKm = toNum(item?.distanceKm);
  const durationMin = toNum(item?.durationMin);
  const hasCoords = hasCoordsObject(item);
  const hasLine = hasLineGeometry(item);

  const matchedHardTrackPrimary = includesAny(primaryText, HARD_TRACK_KEYWORDS);
  const matchedHardTrackSecondary = includesAny(secondaryText, HARD_TRACK_KEYWORDS);

  let trackScore = 0;

  // segnali fortissimi
  trackScore += matchedHardTrackPrimary.length * 20;
  trackScore += matchedHardTrackSecondary.length * 3;

  if (TRACK_TYPES.includes(typeNorm)) trackScore += 12;
  if (TRACK_TYPES.includes(rideTypeNorm)) trackScore += 12;
  if (TRACK_TYPES.includes(categoryNorm)) trackScore += 10;

  if (NAME_HARD_TRACK_REGEX.test(nameNorm)) trackScore += 16;
  if (NAME_HARD_TRACK_REGEX.test(titleNorm)) trackScore += 12;
  if (NAME_HARD_TRACK_REGEX.test(labelNorm)) trackScore += 10;

  if (/\b(motocross|cross|enduro|mx|crossodromo)\b/.test(nameNorm)) trackScore += 18;
  if (/\b(track|circuit|circuito|motodromo|kartodromo|autodromo)\b/.test(nameNorm)) trackScore += 14;
  if (/\b(offroad|off road|off-road|dirt|singletrack|single track)\b/.test(nameNorm)) trackScore += 14;

  if (surfaceNorm.includes("dirt")) trackScore += 7;
  if (surfaceNorm.includes("sterr")) trackScore += 7;
  if (surfaceNorm.includes("mud")) trackScore += 5;
  if (surfaceNorm.includes("sand")) trackScore += 5;

  if (terrainNorm.includes("dirt")) trackScore += 7;
  if (terrainNorm.includes("sterr")) trackScore += 7;
  if (terrainNorm.includes("offroad")) trackScore += 8;
  if (terrainNorm.includes("off road")) trackScore += 8;
  if (terrainNorm.includes("enduro")) trackScore += 10;
  if (terrainNorm.includes("motocross")) trackScore += 10;
  if (terrainNorm.includes("trail")) trackScore += 4;
  if (terrainNorm.includes("technical")) trackScore += 4;

  if (idNorm.startsWith("trk")) trackScore += 6;
  if (idNorm.startsWith("track")) trackScore += 6;
  if (idNorm.startsWith("circuit")) trackScore += 6;

  // piccolo freno per itinerari veri con geometria e distanza
  let routeSafety = 0;
  if (hasLine) routeSafety += 4;
  if (distanceKm > 20) routeSafety += 4;
  else if (distanceKm > 5) routeSafety += 2;
  if (durationMin > 30) routeSafety += 3;
  else if (durationMin > 8) routeSafety += 1;
  if (hasCoords) routeSafety += 0.5;

  return {
    primaryText,
    secondaryText,
    fullText,
    matchedHardTrackPrimary: uniq(matchedHardTrackPrimary),
    matchedHardTrackSecondary: uniq(matchedHardTrackSecondary),
    trackScore,
    routeSafety,
    distanceKm,
    durationMin,
    hasCoords,
    hasLine,
  };
}

function classify(item) {
  const signals = getSignals(item);
  const {
    trackScore,
    routeSafety,
    matchedHardTrackPrimary,
    fullText,
    primaryText,
    hasLine,
    distanceKm,
    durationMin,
  } = signals;

  const hardTrackByName =
    NAME_HARD_TRACK_REGEX.test(primaryText) ||
    /\b(cross|motocross|enduro|mx|crossodromo|motodromo|kartodromo|autodromo)\b/.test(fullText);

  // 1. hard track esplicito
  if (matchedHardTrackPrimary.length > 0 || hardTrackByName) {
    return {
      bucket: "tracks",
      reason: "hard_track_primary",
      signals,
    };
  }

  // 2. track forte ma solo se non sembra una route vera
  if (trackScore >= 18 && trackScore >= routeSafety + 8) {
    return {
      bucket: "tracks",
      reason: "strong_track_signals",
      signals,
    };
  }

  // 3. record assurdo / vuoto vero
  const isVeryPoor =
    !hasLine &&
    distanceKm <= 0 &&
    durationMin <= 0 &&
    trackScore === 0 &&
    routeSafety === 0;

  if (isVeryPoor) {
    return {
      bucket: "review",
      reason: "no_clear_signals",
      signals,
    };
  }

  // 4. default: resta route
  return {
    bucket: "routes",
    reason: "route_default_safe",
    signals,
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`File non trovato: ${INPUT}`);
    process.exit(1);
  }

  const data = safeReadJson(INPUT);

  if (!Array.isArray(data)) {
    console.error("routes.json deve contenere un array JSON.");
    process.exit(1);
  }

  const routes = [];
  const tracks = [];
  const review = [];

  const stats = {
    total: data.length,
    routes: 0,
    tracks: 0,
    review: 0,
    reasons: {},
  };

  data.forEach((item, idx) => {
    const result = classify(item);

    const enriched = {
      ...item,
      _classification: {
        bucket: result.bucket,
        reason: result.reason,
        trackScore: result.signals.trackScore,
        routeSafety: result.signals.routeSafety,
        distanceKm: result.signals.distanceKm,
        durationMin: result.signals.durationMin,
        hasCoords: result.signals.hasCoords,
        hasLine: result.signals.hasLine,
        matchedHardTrackPrimary: result.signals.matchedHardTrackPrimary,
        matchedHardTrackSecondary: result.signals.matchedHardTrackSecondary,
      },
    };

    if (result.bucket === "routes") {
      routes.push(enriched);
      stats.routes++;
    } else if (result.bucket === "tracks") {
      tracks.push(enriched);
      stats.tracks++;
    } else {
      review.push(enriched);
      stats.review++;
    }

    stats.reasons[result.reason] = (stats.reasons[result.reason] || 0) + 1;
  });

  safeWriteJson(OUT_ROUTES, routes);
  safeWriteJson(OUT_TRACKS, tracks);
  safeWriteJson(OUT_REVIEW, review);

  console.log("====================================");
  console.log("MotoPortEU — Split completato");
  console.log("====================================");
  console.log(`Input totale:   ${stats.total}`);
  console.log(`Routes pulite:  ${stats.routes}`);
  console.log(`Tracks estratti:${stats.tracks}`);
  console.log(`Review:         ${stats.review}`);
  console.log("------------------------------------");
  console.log("Reason breakdown:");
  Object.entries(stats.reasons)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`- ${reason}: ${count}`);
    });
  console.log("------------------------------------");
  console.log(`Creato: ${OUT_ROUTES}`);
  console.log(`Creato: ${OUT_TRACKS}`);
  console.log(`Creato: ${OUT_REVIEW}`);

  if (tracks.length) {
    console.log("------------------------------------");
    console.log("Primi elementi in tracks:");
    tracks.slice(0, 15).forEach((item, i) => {
      console.log(
        `${i + 1}. ${pickId(item, i)} | trackScore=${item._classification.trackScore} | routeSafety=${item._classification.routeSafety} | reason=${item._classification.reason}`
      );
    });
  }

  if (review.length) {
    console.log("------------------------------------");
    console.log("Primi elementi in review:");
    review.slice(0, 10).forEach((item, i) => {
      console.log(
        `${i + 1}. ${pickId(item, i)} | trackScore=${item._classification.trackScore} | routeSafety=${item._classification.routeSafety} | reason=${item._classification.reason}`
      );
    });
  }
}

main();