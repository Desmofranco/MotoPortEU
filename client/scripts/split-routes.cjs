// =======================================================
// client/scripts/split-routes.cjs
// MotoPortEU — split automatico routes -> routes / tracks / review
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
// VERSIONE 2.5:
// - severa sui veri track
// - prudente sui record poveri di struttura
// - usa review per gli ambigui invece di buttare tutto in tracks
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
  "sterrato tecnico",
  "technical trail",
  "training track",
  "offroad",
  "off-road",
  "off road",
  "dirt",
  "dirt track",
  "motocross track",
  "enduro track",
  "mx track",
];

const STRONG_TRACK_KEYWORDS = [
  "cross",
  "motocross",
  "mx",
  "enduro",
  "hard enduro",
  "offroad",
  "off-road",
  "off road",
  "dirt",
  "dirt track",
  "trail tecnico",
  "technical trail",
  "training track",
  "supermoto track",
  "pista",
  "circuito",
  "circuit",
  "track",
  "race track",
  "motodromo",
  "kartodromo",
  "fettucciato",
  "sterrato tecnico",
  "single track",
  "singletrack",
  "gravel",
  "sterrato",
  "sterrata",
  "motocross track",
  "enduro track",
  "mx track",
];

const STRONG_ROUTE_KEYWORDS = [
  "sport touring",
  "road trip",
  "scenic",
  "panoram",
  "passo",
  "pass",
  "asfalto",
  "asphalt",
  "mountain pass",
  "coastal road",
  "lago",
  "lake",
  "dolomiti",
  "alpi",
  "alpine",
  "curve",
  "panorama",
  "panoramico",
  "misto veloce",
  "weekend ride",
  "coast",
  "coastal",
  "mountain road",
  "passo alpino",
  "strada panoramica",
  "strada costiera",
  "giro alpino",
];

const WEAK_ROUTE_KEYWORDS = [
  "touring",
  "tour",
  "route",
  "ride",
  "giro",
  "itinerario",
  "strada",
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
];

const ROUTE_TYPES = [
  "touring",
  "sport_touring",
  "road_trip",
  "panoramic",
  "mountain_pass",
  "scenic",
  "coastal_road",
  "weekend_ride",
  "adventure_light",
];

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

function looksLikeSpot(item) {
  return hasCoordsObject(item) && !hasLineGeometry(item);
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

function getStructuralSignals(item) {
  const distanceKm = toNum(item?.distanceKm);
  const durationMin = toNum(item?.durationMin);

  const zeroDistance = distanceKm <= 0;
  const zeroDuration = durationMin <= 0;
  const spotLike = looksLikeSpot(item);
  const lineLike = hasLineGeometry(item);
  const generated = Boolean(item?._generated);

  const likelyNonRoute = zeroDistance && zeroDuration && spotLike;
  const likelyRealRoute = distanceKm > 5 || durationMin > 8 || lineLike;

  return {
    distanceKm,
    durationMin,
    zeroDistance,
    zeroDuration,
    spotLike,
    lineLike,
    generated,
    likelyNonRoute,
    likelyRealRoute,
  };
}

function getSignals(item) {
  const { primaryText, secondaryText, fullText } = buildSearchText(item);
  const structural = getStructuralSignals(item);

  const generated = structural.generated;

  const matchedHardTrackPrimary = includesAny(primaryText, HARD_TRACK_KEYWORDS);
  const matchedTrackPrimary = includesAny(primaryText, STRONG_TRACK_KEYWORDS);
  const matchedRoutePrimary = includesAny(primaryText, STRONG_ROUTE_KEYWORDS);
  const matchedWeakRoutePrimary = includesAny(primaryText, WEAK_ROUTE_KEYWORDS);

  const matchedTrackSecondary = includesAny(secondaryText, STRONG_TRACK_KEYWORDS);
  const matchedRouteSecondary = includesAny(secondaryText, STRONG_ROUTE_KEYWORDS);
  const matchedWeakRouteSecondary = includesAny(secondaryText, WEAK_ROUTE_KEYWORDS);

  const typeNorm = norm(item.type);
  const rideTypeNorm = norm(item.rideType);
  const categoryNorm = norm(item.category);
  const surfaceNorm = norm(item.surface);
  const terrainNorm = norm(item.terrain);
  const idNorm = norm(item.id);
  const nameNorm = norm(item.name);
  const sourceNorm = norm(item.source);

  let trackScore = 0;
  let routeScore = 0;

  trackScore += matchedHardTrackPrimary.length * 14;

  trackScore += matchedTrackPrimary.length * 6;
  routeScore += matchedRoutePrimary.length * 4;
  routeScore += matchedWeakRoutePrimary.length * 1;

  const secondaryTrackWeight = generated ? 1 : 2;
  const secondaryStrongRouteWeight = generated ? 0.75 : 2;
  const secondaryWeakRouteWeight = generated ? 0.25 : 0.75;

  trackScore += matchedTrackSecondary.length * secondaryTrackWeight;
  routeScore += matchedRouteSecondary.length * secondaryStrongRouteWeight;
  routeScore += matchedWeakRouteSecondary.length * secondaryWeakRouteWeight;

  if (TRACK_TYPES.includes(typeNorm)) trackScore += 6;
  if (TRACK_TYPES.includes(rideTypeNorm)) trackScore += 6;
  if (TRACK_TYPES.includes(categoryNorm)) trackScore += 5;

  if (ROUTE_TYPES.includes(typeNorm)) routeScore += 3;
  if (ROUTE_TYPES.includes(rideTypeNorm)) routeScore += 3;
  if (ROUTE_TYPES.includes(categoryNorm)) routeScore += 3;

  if (surfaceNorm.includes("dirt")) trackScore += 5;
  if (surfaceNorm.includes("sterr")) trackScore += 5;
  if (surfaceNorm.includes("gravel")) trackScore += 3;
  if (surfaceNorm.includes("sand")) trackScore += 3;

  if (surfaceNorm.includes("asphalt")) routeScore += 4;
  if (surfaceNorm.includes("asfalto")) routeScore += 4;
  if (surfaceNorm.includes("paved")) routeScore += 3;

  if (terrainNorm.includes("dirt")) trackScore += 5;
  if (terrainNorm.includes("sterr")) trackScore += 5;
  if (terrainNorm.includes("offroad")) trackScore += 5;
  if (terrainNorm.includes("off road")) trackScore += 5;
  if (terrainNorm.includes("technical")) trackScore += 3;
  if (terrainNorm.includes("trail")) trackScore += 3;

  if (terrainNorm.includes("mountain road")) routeScore += 3;
  if (terrainNorm.includes("asphalt")) routeScore += 3;
  if (terrainNorm.includes("scenic")) routeScore += 2;
  if (terrainNorm.includes("panoramic")) routeScore += 2;

  if (idNorm.startsWith("trk")) trackScore += 2;

  if (/\b(circuito|circuit|track|motocross|enduro|cross|mx|pista)\b/.test(nameNorm)) {
    trackScore += 8;
  }

  if (sourceNorm === "passes" && matchedHardTrackPrimary.length > 0) {
    trackScore += 4;
  }

  // struttura: pesa, ma non decide da sola
  if (structural.spotLike) trackScore += 2;
  if (structural.lineLike) routeScore += 3;
  if (structural.distanceKm > 20) routeScore += 4;
  else if (structural.distanceKm > 5) routeScore += 2;

  if (structural.durationMin > 30) routeScore += 3;
  else if (structural.durationMin > 8) routeScore += 1.5;

  if (generated && matchedHardTrackPrimary.length > 0) {
    routeScore -= 2;
  }

  trackScore = Math.max(0, trackScore);
  routeScore = Math.max(0, routeScore);

  return {
    primaryText,
    secondaryText,
    fullText,
    generated,
    structural,
    matchedHardTrackPrimary: uniq(matchedHardTrackPrimary),
    matchedTrackKeywords: uniq([...matchedTrackPrimary, ...matchedTrackSecondary]),
    matchedRouteKeywords: uniq([
      ...matchedRoutePrimary,
      ...matchedWeakRoutePrimary,
      ...matchedRouteSecondary,
      ...matchedWeakRouteSecondary,
    ]),
    trackScore,
    routeScore,
  };
}

function classify(item) {
  const signals = getSignals(item);
  const { trackScore, routeScore, matchedHardTrackPrimary, generated, structural } = signals;

  // 1. hard-track immediato
  if (matchedHardTrackPrimary.length > 0) {
    return {
      bucket: "tracks",
      reason: "hard_track_primary",
      signals,
    };
  }

  // 2. struttura povera + segnali track = tracks
  if (structural.likelyNonRoute && trackScore >= 6) {
    return {
      bucket: "tracks",
      reason: "structural_non_route_with_track_signals",
      signals,
    };
  }

  // 3. route whitelist equilibrata
  if (routeScore >= 6 && routeScore >= trackScore + 1 && !matchedHardTrackPrimary.length) {
    return {
      bucket: "routes",
      reason: "route_whitelist",
      signals,
    };
  }

  // 4. track forte
  if (trackScore >= 10 && trackScore >= routeScore + 2) {
    return {
      bucket: "tracks",
      reason: "strong_track_signals",
      signals,
    };
  }

  // 5. generato + spot povero ma non chiarissimo -> review, non tracks
  if (generated && structural.likelyNonRoute && trackScore < 6) {
    return {
      bucket: "review",
      reason: "generated_structural_ambiguous",
      signals,
    };
  }

  // 6. spot povero e ambiguo -> review
  if (structural.likelyNonRoute && trackScore > 0 && routeScore > 0) {
    return {
      bucket: "review",
      reason: "structural_mixed_signals",
      signals,
    };
  }

  // 7. route forte ma senza hard-track
  if (!structural.spotLike && routeScore >= 8 && routeScore >= trackScore + 3) {
    return {
      bucket: "routes",
      reason: "strong_route_signals",
      signals,
    };
  }

  // 8. misti veri
  if (trackScore > 0 && routeScore > 0) {
    return {
      bucket: "review",
      reason: "mixed_signals",
      signals,
    };
  }

  if (trackScore > 0) {
    return {
      bucket: "tracks",
      reason: "track_leaning",
      signals,
    };
  }

  if (routeScore > 0) {
    return {
      bucket: "routes",
      reason: "route_leaning",
      signals,
    };
  }

  return {
    bucket: "review",
    reason: "no_clear_signals",
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
        routeScore: result.signals.routeScore,
        generated: result.signals.generated,
        structural: result.signals.structural,
        matchedHardTrackPrimary: result.signals.matchedHardTrackPrimary,
        matchedTrackKeywords: result.signals.matchedTrackKeywords,
        matchedRouteKeywords: result.signals.matchedRouteKeywords,
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
    tracks.slice(0, 10).forEach((item, i) => {
      console.log(
        `${i + 1}. ${pickId(item, i)} | trackScore=${item._classification.trackScore} | routeScore=${item._classification.routeScore} | reason=${item._classification.reason}`
      );
    });
  }

  if (review.length) {
    console.log("------------------------------------");
    console.log("Primi elementi in review:");
    review.slice(0, 10).forEach((item, i) => {
      console.log(
        `${i + 1}. ${pickId(item, i)} | trackScore=${item._classification.trackScore} | routeScore=${item._classification.routeScore} | reason=${item._classification.reason}`
      );
    });
  }
}

main();