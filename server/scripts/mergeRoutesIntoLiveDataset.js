import fs from "fs/promises";
import path from "path";
import process from "process";
import {
  parseCliArgs,
  getScopeConfig,
  getScopeSuffix,
} from "./lib/routeScopes.js";

// =======================================================
// server/scripts/mergeRoutesIntoLiveDataset.js
// MotoPortEU — Merge Routes Into Live Dataset
// =======================================================

const args = parseCliArgs();
const country = String(args.country || "IT").toUpperCase();
const scope = args.scope ? String(args.scope) : null;

const scopeCfg = getScopeConfig({ country, scope });
const scopeSuffix = getScopeSuffix({ country, scope });

const LIVE_PATH = path.resolve("client/public/data/routes.json");
const GENERATED_PATH = path.resolve(
  `client/public/data/routes.generated.${scopeSuffix}.json`
);
const OUT_PATH = path.resolve(
  `client/public/data/routes.merged.${scopeSuffix}.json`
);

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

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function safeJsonParse(raw, label = "JSON") {
  try {
    return JSON.parse(String(raw).replace(/^\uFEFF/, "").trim());
  } catch (err) {
    throw new Error(`Errore parsing ${label}: ${err.message}`);
  }
}

async function readJson(filePath, label) {
  const raw = await fs.readFile(filePath, "utf8");
  return safeJsonParse(raw, label);
}

function canonicalRouteName(name = "") {
  return normalizeText(name)
    .replace(
      /\b(giro|panoramico|tour|touring|route|loop|ride|scenic|mountain|lake|coastal|forest|alpi|lombarde|italia|italy|france|francia|switzerland|svizzera)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function extractPoint(route, key) {
  const p = route?.[key];
  if (!p || typeof p !== "object") return null;
  const lat = toNum(p.lat);
  const lng = toNum(p.lng);
  if (lat == null || lng == null) return null;
  return {
    name: p.name || null,
    lat,
    lng,
  };
}

function routeSignature(route) {
  const start = extractPoint(route, "start");
  const end = extractPoint(route, "end");
  const nameKey = canonicalRouteName(route.name || "");

  if (start && end) {
    return [
      route.country || "??",
      route.scope || "all",
      nameKey,
      start.lat.toFixed(3),
      start.lng.toFixed(3),
      end.lat.toFixed(3),
      end.lng.toFixed(3),
    ].join("|");
  }

  return [
    route.country || "??",
    route.scope || "all",
    nameKey,
  ].join("|");
}

function sameRoute(a, b) {
  const aStart = extractPoint(a, "start");
  const aEnd = extractPoint(a, "end");
  const bStart = extractPoint(b, "start");
  const bEnd = extractPoint(b, "end");

  const aName = canonicalRouteName(a.name || "");
  const bName = canonicalRouteName(b.name || "");

  if (a.id && b.id && String(a.id) === String(b.id)) return true;

  if (aName && bName && aName === bName && aStart && aEnd && bStart && bEnd) {
    const direct =
      haversineKm(aStart.lat, aStart.lng, bStart.lat, bStart.lng) <= 6 &&
      haversineKm(aEnd.lat, aEnd.lng, bEnd.lat, bEnd.lng) <= 6;

    const reverse =
      haversineKm(aStart.lat, aStart.lng, bEnd.lat, bEnd.lng) <= 6 &&
      haversineKm(aEnd.lat, aEnd.lng, bStart.lat, bStart.lng) <= 6;

    if (direct || reverse) return true;
  }

  const sigA = routeSignature(a);
  const sigB = routeSignature(b);
  return sigA === sigB;
}

function routeScore(route) {
  let score = 0;

  score += Number(route.hero ? 40 : 0);
  score += Number(route.rating || 0) * 5;
  score += Number(route.riderScore || 0);
  score += Number(route.score || 0);

  const distanceKm = Number(route.distanceKm || 0);
  if (distanceKm >= 80) score += 10;
  if (distanceKm >= 150) score += 10;

  const waypoints = Array.isArray(route.waypoints) ? route.waypoints.length : 0;
  score += Math.min(waypoints * 2, 20);

  return score;
}

function mergeRouteObjects(base, incoming) {
  const best =
    routeScore(incoming) >= routeScore(base) ? { ...base, ...incoming } : { ...incoming, ...base };

  return {
    ...best,
    aliases: Array.from(
      new Set([...(base.aliases || []), ...(incoming.aliases || []), base.name, incoming.name].filter(Boolean))
    ),
    tags: Array.from(
      new Set([...(base.tags || []), ...(incoming.tags || [])].filter(Boolean))
    ),
    waypoints: Array.isArray(incoming.waypoints) && incoming.waypoints.length
      ? incoming.waypoints
      : Array.isArray(base.waypoints)
      ? base.waypoints
      : [],
    geometry:
      incoming.geometry && Array.isArray(incoming.geometry.coordinates) && incoming.geometry.coordinates.length
        ? incoming.geometry
        : base.geometry || null,
    hero: Boolean(base.hero || incoming.hero),
    riderScore: Math.max(Number(base.riderScore || 0), Number(incoming.riderScore || 0)),
    rating: Math.max(Number(base.rating || 0), Number(incoming.rating || 0)),
  };
}

function dedupeRoutes(routes) {
  const out = [];

  for (const route of routes) {
    let merged = false;

    for (let i = 0; i < out.length; i += 1) {
      if (sameRoute(out[i], route)) {
        out[i] = mergeRouteObjects(out[i], route);
        merged = true;
        break;
      }
    }

    if (!merged) {
      out.push({
        ...route,
        aliases: Array.from(new Set([...(route.aliases || []), route.name].filter(Boolean))),
        tags: Array.isArray(route.tags) ? route.tags : [],
        waypoints: Array.isArray(route.waypoints) ? route.waypoints : [],
      });
    }
  }

  return out;
}

function sortRoutes(routes) {
  return [...routes].sort((a, b) => {
    if (Boolean(b.hero) !== Boolean(a.hero)) {
      return Number(Boolean(b.hero)) - Number(Boolean(a.hero));
    }

    const aScore = routeScore(a);
    const bScore = routeScore(b);
    if (bScore !== aScore) return bScore - aScore;

    return String(a.name || "").localeCompare(String(b.name || ""), "it");
  });
}

function countByCountry(routes) {
  const byCountry = {};
  for (const r of routes) {
    const c = r.country || "??";
    byCountry[c] = (byCountry[c] || 0) + 1;
  }
  return byCountry;
}

function countByRideType(routes) {
  const out = {};
  for (const r of routes) {
    const t = r.rideType || "unknown";
    out[t] = (out[t] || 0) + 1;
  }
  return out;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Merge Routes Into Live");
  console.log("====================================");
  console.log(`🌍 Country: ${scopeCfg.countryName} (${country})`);
  console.log(`🧭 Scope: ${scopeCfg.scopeName}`);
  console.log(`📥 Live: ${LIVE_PATH}`);
  console.log(`📥 Generated: ${GENERATED_PATH}`);
  console.log(`💾 Output: ${OUT_PATH}`);

  const liveRoutes = await readJson(LIVE_PATH, "routes live");
  const generatedRoutes = await readJson(GENERATED_PATH, "routes generated");

  if (!Array.isArray(liveRoutes)) {
    throw new Error("Il live dataset non è un array valido");
  }
  if (!Array.isArray(generatedRoutes)) {
    throw new Error("Il generated dataset non è un array valido");
  }

  console.log(`Live routes:      ${liveRoutes.length}`);
  console.log(`Generated routes: ${generatedRoutes.length}`);
  console.log("------------------------------------");

  const combined = [...liveRoutes, ...generatedRoutes];
  const merged = sortRoutes(dedupeRoutes(combined));

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(merged, null, 2), "utf8");

  console.log(`Merged routes: ${merged.length}`);
  console.log("Distribuzione country:", countByCountry(merged));
  console.log("Distribuzione rideType:", countByRideType(merged));
  console.log(`Creato: ${OUT_PATH}`);
  console.log("------------------------------------");
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});