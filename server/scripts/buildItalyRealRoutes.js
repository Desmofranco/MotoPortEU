#!/usr/bin/env node
/**
 * MotoPortEU — Build Italy Real Routes v2
 *
 * Obiettivo:
 * - partire da:
 *    1) routes.it.real.cleaned.json
 *    2) routes.it.real.review.json
 * - recuperare solo materiale italiano reale
 * - escludere itinerari esteri / transfrontalieri non italiani
 * - fondere passi e micro-route in veri itinerari rider
 *
 * Output:
 *   - client/public/data/routes.it.real.final.json
 *   - client/public/data/routes.it.real.final.stats.json
 *
 * Uso:
 *   node .\server\scripts\buildItalyRealRoutes.js
 */

import fs from "fs/promises";
import path from "path";
import process from "process";

const ROOT = process.cwd();

const INPUT_CLEAN = path.join(ROOT, "client", "public", "data", "routes.it.real.cleaned.json");
const INPUT_REVIEW = path.join(ROOT, "client", "public", "data", "routes.it.real.review.json");

const OUTPUT_FINAL = path.join(ROOT, "client", "public", "data", "routes.it.real.final.json");
const OUTPUT_STATS = path.join(ROOT, "client", "public", "data", "routes.it.real.final.stats.json");

const CLUSTER_RADIUS_KM = 85;
const MIN_CLUSTER_ITEMS = 2;

const FOREIGN_STRONG_HINTS = [
  "route des grandes alpes",
  "route napoleon",
  "napoleon",
  "grossglockner",
  "hochalpenstrasse",
  "salzburg",
  "carinzia",
  "karinzia",
  "provenza",
  "provence",
  "alpi francesi",
  "francia",
  "france",
  "austria",
  "switzerland",
  "svizzera",
  "croatia",
  "slovenia",
  "germany",
  "germania"
];

const ITALY_STRONG_HINTS = [
  "italia",
  "italy",
  "lombardia",
  "piemonte",
  "veneto",
  "trentino",
  "alto adige",
  "sudtirol",
  "dolomiti",
  "appennino",
  "toscana",
  "emilia romagna",
  "liguria",
  "abruzzo",
  "campania",
  "sicilia",
  "sardegna",
  "stelvio",
  "gavia",
  "mortirolo",
  "tonale",
  "resia",
  "mendola",
  "pordoi",
  "sella",
  "gardena",
  "campolongo",
  "falzarego",
  "giau",
  "fedaia",
  "raticosa",
  "giogo",
  "muraglione",
  "cisa",
  "campo imperatore",
  "gran sasso",
  "etna",
  "amalfi",
  "amalfitana",
  "ss125"
];

function numberOrNull(v) {
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

function normalizeText(value) {
  return String(safeDecodeMojibake(value || ""))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function getPoint(value) {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 2) {
    const lat = numberOrNull(value[0]);
    const lng = numberOrNull(value[1]);
    if (lat !== null && lng !== null) return { lat, lng };
  }

  if (typeof value === "object") {
    const lat = numberOrNull(value.lat);
    const lng = numberOrNull(value.lng ?? value.lon);
    if (lat !== null && lng !== null) return { lat, lng };
  }

  return null;
}

function computeCenterFromRoute(route) {
  const pts = [];

  const start = getPoint(route.start);
  const end = getPoint(route.end);
  const center = getPoint(route.center);

  if (start) pts.push(start);
  if (end) pts.push(end);
  if (center) pts.push(center);

  if (!pts.length) return null;

  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
  };
}

function routeName(route) {
  return safeDecodeMojibake(route.name || route.title || "Untitled");
}

function routeDistance(route) {
  return (
    numberOrNull(route.distanceKm) ??
    numberOrNull(route.distance) ??
    numberOrNull(route.km) ??
    null
  );
}

function routeBlob(route) {
  return normalizeText([
    route.id,
    routeName(route),
    safeDecodeMojibake(route.description),
    safeDecodeMojibake(route.summary),
    route.region,
    route.country,
    route.countryName,
    route.area,
    route.state,
    route.zone,
    ...(Array.isArray(route.aliases) ? route.aliases : []),
  ].filter(Boolean).join(" | "));
}

function hasAny(text, arr) {
  return arr.some((x) => text.includes(normalizeText(x)));
}

function isStronglyItalian(route) {
  const blob = routeBlob(route);
  const conf = normalizeText(route.italianConfidence || route._italianConfidence);

  if (hasAny(blob, FOREIGN_STRONG_HINTS)) return false;
  if (hasAny(blob, ITALY_STRONG_HINTS)) return true;
  return conf === "high";
}

function extractPassName(name) {
  const n = normalizeText(name);

  const map = [
    ["stelvio", "Stelvio"],
    ["gavia", "Gavia"],
    ["mortirolo", "Mortirolo"],
    ["tonale", "Tonale"],
    ["giau", "Giau"],
    ["pordoi", "Pordoi"],
    ["falzarego", "Falzarego"],
    ["gardena", "Gardena"],
    ["campolongo", "Campolongo"],
    ["sella", "Sella"],
    ["rombo", "Rombo"],
    ["timmelsjoch", "Rombo"],
    ["resia", "Resia"],
    ["mendola", "Mendola"],
    ["raticosa", "Raticosa"],
    ["giogo", "Giogo"],
    ["muraglione", "Muraglione"],
    ["cisa", "Cisa"],
    ["campo imperatore", "Campo Imperatore"],
    ["gran sasso", "Gran Sasso"],
    ["etna", "Etna"],
    ["fedaia", "Fedaia"],
  ];

  for (const [needle, label] of map) {
    if (n.includes(needle)) return label;
  }

  return null;
}

function inferRideType(cluster) {
  const text = normalizeText(
    cluster.items
      .map((x) => `${x.region || ""} ${routeName(x)}`)
      .join(" | ")
  );

  if (text.includes("costiera") || text.includes("amalfi") || text.includes("liguria") || text.includes("salento") || text.includes("sardegna") || text.includes("ss125")) {
    return "coastal";
  }

  if (text.includes("etna")) {
    return "volcano";
  }

  if (text.includes("appennino") || text.includes("muraglione") || text.includes("raticosa") || text.includes("giogo") || text.includes("cisa")) {
    return "appennino";
  }

  if (text.includes("garda") || text.includes("como")) {
    return "lake";
  }

  if (
    text.includes("stelvio") ||
    text.includes("gavia") ||
    text.includes("mortirolo") ||
    text.includes("tonale") ||
    text.includes("resia") ||
    text.includes("mendola") ||
    text.includes("dolomiti") ||
    text.includes("pordoi") ||
    text.includes("gardena") ||
    text.includes("campolongo") ||
    text.includes("giau") ||
    text.includes("falzarego") ||
    text.includes("sella") ||
    text.includes("fedaia")
  ) {
    return "mountain";
  }

  return "mountain";
}

function inferRegion(cluster) {
  const regions = new Map();
  for (const item of cluster.items) {
    const r = safeDecodeMojibake(item.region || "Italia");
    regions.set(r, (regions.get(r) || 0) + 1);
  }
  return [...regions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Italia";
}

function inferClusterTitle(cluster) {
  const region = inferRegion(cluster);
  const passLabels = [...new Set(cluster.items.map((x) => extractPassName(routeName(x))).filter(Boolean))];
  const regionN = normalizeText(region);

  if (regionN.includes("dolomiti")) {
    if (passLabels.length >= 2) return `Dolomiti Grand Tour: ${passLabels.slice(0, 3).join(" + ")}`;
    return "Dolomiti Grand Tour";
  }

  if (regionN.includes("lombardia") || regionN.includes("valtellina")) {
    if (passLabels.length >= 2) return `Alta Valtellina Ride: ${passLabels.slice(0, 3).join(" + ")}`;
    return "Alta Valtellina Grand Loop";
  }

  if (regionN.includes("alto adige")) {
    if (passLabels.length >= 2) return `Alto Adige Alpine Ride: ${passLabels.slice(0, 3).join(" + ")}`;
    return "Alto Adige Alpine Ride";
  }

  if (regionN.includes("appennino tosco") || regionN.includes("tosco")) {
    if (passLabels.length >= 2) return `Appennino Tosco-Emiliano: ${passLabels.slice(0, 3).join(" + ")}`;
    return "Appennino Tosco-Emiliano Grand Ride";
  }

  if (regionN.includes("abruzzo")) {
    if (passLabels.length >= 2) return `Abruzzo Mountain Ride: ${passLabels.slice(0, 3).join(" + ")}`;
    return "Abruzzo Mountain Ride";
  }

  if (regionN.includes("liguria")) return "Liguria Coastal Ride";
  if (regionN.includes("sicilia")) return "Sicilia Rider Tour";
  if (regionN.includes("sardegna")) return "Sardegna Rider Tour";

  if (passLabels.length >= 2) return `${region} Ride: ${passLabels.slice(0, 3).join(" + ")}`;

  return `${region} Grand Ride`;
}

function buildDescription(cluster, title, rideType, region, distanceKm) {
  const passLabels = [...new Set(cluster.items.map((x) => extractPassName(routeName(x))).filter(Boolean))];
  const passText = passLabels.length
    ? ` Tocca punti forti come ${passLabels.slice(0, 4).join(", ")}.`
    : "";

  const typeTextMap = {
    mountain: "Itinerario alpino pensato per chi cerca curve vere, ritmo e panorama.",
    appennino: "Itinerario appenninico scorrevole e tecnico, ideale per guida continua e divertente.",
    coastal: "Itinerario costiero pensato per unire vista mare, ritmo e guida piacevole.",
    lake: "Itinerario panoramico tra laghi e curve, adatto a uscite medio-lunghe.",
    volcano: "Itinerario vulcanico e panoramico, con forte carattere stradale e paesaggistico.",
  };

  return `${title} è un itinerario MotoPortEU costruito aggregando tratti reali della zona ${region}. ${typeTextMap[rideType] || "Itinerario rider-oriented, costruito per offrire una vera esperienza di guida."}${passText} La lunghezza stimata è di circa ${distanceKm} km, rendendolo adatto a una giornata piena o a una tappa forte da viaggio.`;
}

function createClusterSeed(route) {
  return {
    center: computeCenterFromRoute(route),
    items: [route],
  };
}

function addToClusters(route, clusters) {
  const center = computeCenterFromRoute(route);
  if (!center) return false;

  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < clusters.length; i++) {
    const d = haversineKm(center, clusters[i].center);
    if (d < CLUSTER_RADIUS_KM && d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }

  if (bestIndex === -1) {
    clusters.push(createClusterSeed(route));
  } else {
    clusters[bestIndex].items.push(route);
    const pts = clusters[bestIndex].items.map((r) => computeCenterFromRoute(r)).filter(Boolean);
    clusters[bestIndex].center = {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    };
  }

  return true;
}

function dedupeByName(routes) {
  const out = [];
  const seen = new Set();

  for (const r of routes) {
    const key = normalizeText(routeName(r));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

function normalizePoint(point) {
  if (!point) return null;
  return [point.lat, point.lng];
}

function buildSyntheticRoute(cluster, index) {
  const region = inferRegion(cluster);
  const rideType = inferRideType(cluster);
  const title = inferClusterTitle(cluster);

  const starts = cluster.items.map((x) => getPoint(x.start)).filter(Boolean);
  const ends = cluster.items.map((x) => getPoint(x.end)).filter(Boolean);
  const center = cluster.center || computeCenterFromRoute(cluster.items[0]);

  const distanceSum = cluster.items.reduce((s, x) => s + (routeDistance(x) || 0), 0);
  const distanceKm = Math.max(95, Math.min(280, Math.round(distanceSum * 0.75)));

  const curvesScore = Math.min(
    10,
    Math.round(
      cluster.items.reduce((s, x) => s + (numberOrNull(x.curvesScore) || 7), 0) / cluster.items.length
    )
  );

  const asphaltScore = Math.min(
    10,
    Math.round(
      cluster.items.reduce((s, x) => s + (numberOrNull(x.asphaltScore) || 7), 0) / cluster.items.length
    )
  );

  const aliases = [...new Set(cluster.items.map((x) => routeName(x)).filter(Boolean))].slice(0, 8);

  return {
    id: `it-real-${String(index + 1).padStart(3, "0")}`,
    name: title,
    country: "IT",
    countryName: "Italy",
    region,
    rideType,
    distanceKm,
    curvesScore,
    asphaltScore,
    bestSeason: "Apr-Oct",
    pace: curvesScore >= 8 ? "tecnico" : "misto",
    start: starts[0] ? normalizePoint(starts[0]) : null,
    end: ends.at(-1) ? normalizePoint(ends.at(-1)) : null,
    center: center ? normalizePoint(center) : null,
    hero: distanceKm >= 140 || curvesScore >= 8,
    qualityTag: "synthetic_real_itinerary",
    aliases,
    sourceRoutes: cluster.items.map((x) => x.id).filter(Boolean),
    description: buildDescription(cluster, title, rideType, region, distanceKm),
    cleanedBy: "buildItalyRealRoutes_v2",
    cleanedAt: new Date().toISOString(),
  };
}

function normalizeBaseRoute(route) {
  return {
    ...route,
    name: safeDecodeMojibake(route.name || route.title || "Untitled"),
    description: safeDecodeMojibake(route.description || route.summary || ""),
    country: "IT",
    countryName: "Italy",
    rideType: route.rideType || inferRideType({ items: [route] }),
    cleanedBy: route.cleanedBy || "buildItalyRealRoutes_v2",
    cleanedAt: route.cleanedAt || new Date().toISOString(),
  };
}

async function readJson(file) {
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const clean = await readJson(INPUT_CLEAN);
  const review = await readJson(INPUT_REVIEW);

  const baseRoutes = (Array.isArray(clean) ? clean : [])
    .filter(isStronglyItalian)
    .map(normalizeBaseRoute);

  const reviewRoutes = Array.isArray(review) ? review : [];

  const recoverable = reviewRoutes.filter((r) => {
    const reviewTag = normalizeText(r._review);
    if (!isStronglyItalian(r)) return false;

    if (reviewTag === "track_or_circuit") return false;
    if (reviewTag === "offroad_or_enduro") return false;
    if (reviewTag === "not_italy_or_unresolved") return false;

    return (
      reviewTag === "single_pass_or_micro_route" ||
      reviewTag === "pass_cluster_but_not_full_itinerary" ||
      reviewTag === "too_short"
    );
  });

  const clusters = [];
  for (const r of recoverable) addToClusters(r, clusters);

  const goodClusters = clusters.filter((c) => c.items.length >= MIN_CLUSTER_ITEMS);
  const syntheticRoutes = goodClusters.map((c, i) => buildSyntheticRoute(c, i));

  const finalRoutes = dedupeByName(
    [...baseRoutes, ...syntheticRoutes].sort((a, b) => (b.distanceKm || 0) - (a.distanceKm || 0))
  );

  const stats = {
    baseRoutes: baseRoutes.length,
    recoverableReviewRoutes: recoverable.length,
    clustersFound: clusters.length,
    goodClusters: goodClusters.length,
    syntheticRoutes: syntheticRoutes.length,
    finalRoutes: finalRoutes.length,
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
  };

  await fs.writeFile(OUTPUT_FINAL, JSON.stringify(finalRoutes, null, 2), "utf8");
  await fs.writeFile(OUTPUT_STATS, JSON.stringify(stats, null, 2), "utf8");

  console.log("====================================");
  console.log("MotoPortEU — Build Italy Real Routes v2");
  console.log("====================================");
  console.log(`Base routes:              ${stats.baseRoutes}`);
  console.log(`Recoverable review:       ${stats.recoverableReviewRoutes}`);
  console.log(`Clusters trovati:         ${stats.clustersFound}`);
  console.log(`Clusters validi:          ${stats.goodClusters}`);
  console.log(`Synthetic routes create:  ${stats.syntheticRoutes}`);
  console.log(`Final routes:             ${stats.finalRoutes}`);
  console.log("------------------------------------");
  console.log("RideType:");
  for (const [k, v] of Object.entries(stats.finalByRideType)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("------------------------------------");
  console.log(`Creato: ${OUTPUT_FINAL}`);
  console.log(`Creato: ${OUTPUT_STATS}`);
  console.log("====================================");
}

main().catch((err) => {
  console.error("❌ Errore buildItalyRealRoutes:", err);
  process.exit(1);
});