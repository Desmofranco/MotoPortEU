// =======================================================
// server/scripts/buildNamedRoutesDataset.js
// MotoPortEU — Build Named Final Routes Dataset
//
// Input:
//   client/public/data/routes.merged.json
//   client/public/data/rider-spots.cleaned.google.json
//   server/data/europeanRoutesCatalog.js
//
// Output:
//   client/public/data/routes.named.final.json
//
// Avvio:
//   node server/scripts/buildNamedRoutesDataset.js
// =======================================================

import path from "path";
import fs from "fs/promises";
import process from "process";
import { EUROPEAN_ROUTES_CATALOG } from "../data/europeanRoutesCatalog.js";

const ROUTES_FILE = path.resolve("client/public/data/routes.merged.json");
const SPOTS_FILE = path.resolve("client/public/data/rider-spots.cleaned.google.json");
const OUT_FILE = path.resolve("client/public/data/routes.named.final.json");
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundCoord(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Number(x.toFixed(5)) : null;
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
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}

function averageLatLng(items) {
  if (!items.length) return { lat: 0, lng: 0 };
  const lat = items.reduce((s, x) => s + Number(x.lat || 0), 0) / items.length;
  const lng = items.reduce((s, x) => s + Number(x.lng || 0), 0) / items.length;
  return { lat, lng };
}

function buildSearchText(route) {
  const parts = [
    route.name,
    route.description,
    route.country,
    route.region,
    ...(route.tags || []),
    ...(route.aliases || []),
    ...((route.spots || []).map((s) => s.name)),
    ...((route.waypoints || []).map((w) => w.name)),
    route.start?.name,
    route.end?.name,
  ].filter(Boolean);

  return Array.from(new Set(parts.map((x) => normalizeText(x)).filter(Boolean))).join(" ");
}

function routeCorpus(route) {
  return normalizeText([
    route.name,
    route.description,
    route.country,
    route.region,
    ...(route.tags || []),
    ...(route.spots || []).map((s) => s.name),
    ...(route.waypoints || []).map((w) => w.name),
    route.start?.name,
    route.end?.name,
  ].filter(Boolean).join(" "));
}

function scoreRouteAgainstCatalog(route, item) {
  const corpus = routeCorpus(route);
  let score = 0;

  if (route.country && item.country && route.country === item.country) score += 15;
  if (route.region && item.region && normalizeText(route.region).includes(normalizeText(item.region))) score += 10;
  if (route.rideType && item.rideType && route.rideType === item.rideType) score += 12;

  for (const a of item.aliases || []) {
    const n = normalizeText(a);
    if (!n) continue;
    if (corpus.includes(n)) score += 12;
  }

  for (const m of item.mustInclude || []) {
    const n = normalizeText(m);
    if (corpus.includes(n)) score += 25;
  }

  for (const o of item.optionalInclude || []) {
    const n = normalizeText(o);
    if (corpus.includes(n)) score += 8;
  }

  return score;
}

function normalizeRoute(route) {
  return {
    ...route,
    slug: route.slug || slugify(route.name),
    aliases: Array.from(new Set(route.aliases || [])),
    tags: Array.from(new Set(route.tags || [])),
    coords: Array.isArray(route.coords) ? route.coords : [],
    waypoints: Array.isArray(route.waypoints) ? route.waypoints : [],
    spots: Array.isArray(route.spots) ? route.spots : [],
  };
}

function applyCatalogToRoute(route, item) {
  const mergedTags = Array.from(new Set([...(route.tags || []), ...(item.tags || [])]));
  const aliases = Array.from(new Set([...(route.aliases || []), ...(item.aliases || []), item.name]));

  const out = {
    ...route,
    id: route.id || item.id,
    canonicalId: item.id,
    name: item.name,
    slug: slugify(item.name),
    country: route.country || item.country || null,
    region: route.region || item.region || null,
    rideType: route.rideType || item.rideType || null,
    hero: Boolean(item.hero),
    aliases,
    tags: mergedTags,
  };

  out.searchText = buildSearchText(out);
  return out;
}

function pickMatchingSpots(spots, item) {
  const countryFiltered = spots.filter((s) => !item.country || s.country === item.country);
  const aliasNorm = (item.aliases || []).map(normalizeText);
  const mustNorm = (item.mustInclude || []).map(normalizeText);
  const optNorm = (item.optionalInclude || []).map(normalizeText);

  const scored = countryFiltered.map((s) => {
    const corpus = normalizeText([
      s.name,
      s.regionHint,
      s.address,
      ...(s.tags || []),
      ...(s.aliases || []),
    ].filter(Boolean).join(" "));

    let score = 0;

    if (item.rideType && s.rideType === item.rideType) score += 10;
    if (item.region && normalizeText(s.regionHint || "").includes(normalizeText(item.region))) score += 8;

    for (const a of aliasNorm) {
      if (a && corpus.includes(a)) score += 12;
    }
    for (const m of mustNorm) {
      if (m && corpus.includes(m)) score += 30;
    }
    for (const o of optNorm) {
      if (o && corpus.includes(o)) score += 10;
    }

    return { ...s, _score: score };
  });

  const picked = scored
    .filter((s) => s._score > 0)
    .sort((a, b) => (b._score - a._score) || ((b.score || 0) - (a.score || 0)))
    .slice(0, 5);

  const mustOk = mustNorm.every((m) =>
    picked.some((p) => normalizeText([p.name, p.address, p.regionHint].join(" ")).includes(m))
  );

  if (!picked.length || !mustOk) return [];
  return picked;
}

async function getOsrmRoute(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OSRM ${res.status} ${res.statusText} ${txt.slice(0, 180)}`);
  }

  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error("Geometria OSRM vuota");
  }

  return {
    geometry: route.geometry,
    distanceKm: Math.round((route.distance || 0) / 100) / 10,
    durationMin: Math.round((route.duration || 0) / 60),
  };
}

function sampleCoords(coords) {
  return coords
    .map(([lng, lat], i, arr) => {
      if (i !== 0 && i !== arr.length - 1 && i % 3 !== 0) return null;
      return [roundCoord(lat), roundCoord(lng)];
    })
    .filter(Boolean);
}

async function buildHeroRouteFromCatalog(item, spots) {
  const matched = pickMatchingSpots(spots, item);
  if (matched.length < 2) return null;

  const ordered = [...matched].sort((a, b) => (b._score - a._score) || ((b.score || 0) - (a.score || 0)));
  const points = ordered.slice(0, Math.min(ordered.length, 4));

  const osrm = await getOsrmRoute(points);

  const center = averageLatLng(points);
  const route = {
    id: item.id,
    canonicalId: item.id,
    name: item.name,
    slug: slugify(item.name),
    type: "touring",
    rideType: item.rideType || "scenic",
    mode: points.length >= 3 ? "linear" : "point_to_point",
    country: item.country || points[0]?.country || null,
    region: item.region || null,
    source: "hero_catalog_generated",
    hero: true,
    distanceKm: osrm.distanceKm,
    durationMin: osrm.durationMin,
    difficulty: osrm.distanceKm >= 260 ? "hard" : osrm.distanceKm >= 140 ? "medium" : "easy",
    surface: item.rideType === "forest" ? "mixed" : "asphalt",
    tags: Array.from(new Set([...(item.tags || []), "hero", "named", "canonical"])),
    aliases: Array.from(new Set([...(item.aliases || []), item.name])),
    description: `Itinerario iconico ${item.rideType || "rider"} in ${item.region || item.country || "Europa"}, costruito sul catalogo canonico MotoPortEU. Punti chiave: ${points.map((p) => p.name).join(", ")}.`,
    center: {
      lat: roundCoord(center.lat),
      lng: roundCoord(center.lng),
    },
    start: {
      name: points[0].name,
      lat: roundCoord(points[0].lat),
      lng: roundCoord(points[0].lng),
    },
    end: {
      name: points[points.length - 1].name,
      lat: roundCoord(points[points.length - 1].lat),
      lng: roundCoord(points[points.length - 1].lng),
    },
    waypoints: points.slice(1, -1).map((p) => ({
      name: p.name,
      lat: roundCoord(p.lat),
      lng: roundCoord(p.lng),
      type: p.type || "scenic_road",
      rideType: p.rideType || "scenic",
    })),
    spots: points.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug || slugify(p.name),
      type: p.type || "scenic_road",
      rideType: p.rideType || "scenic",
      lat: roundCoord(p.lat),
      lng: roundCoord(p.lng),
      country: p.country || null,
    })),
    coords: sampleCoords(osrm.geometry.coordinates),
  };

  route.searchText = buildSearchText(route);
  return route;
}

function dedupeRoutes(routes) {
  const out = [];
  const seen = new Set();

  for (const r of routes) {
    const sig = [
      r.canonicalId || "",
      r.country || "",
      r.region || "",
      normalizeText(r.name),
      Math.round(Number(r.distanceKm || 0)),
      ...(r.spots || []).map((s) => slugify(s.slug || s.name)).sort(),
    ].join("|");

    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(r);
  }

  return out;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Build Named Final Routes");
  console.log("====================================");

  const routesRaw = JSON.parse(await fs.readFile(ROUTES_FILE, "utf8"));
  const spotsRaw = JSON.parse(await fs.readFile(SPOTS_FILE, "utf8"));

  let routes = Array.isArray(routesRaw) ? routesRaw.map(normalizeRoute) : [];
  const spots = Array.isArray(spotsRaw) ? spotsRaw : [];

  let matchedCount = 0;
  let builtHeroCount = 0;

  const catalogMatchedIds = new Set();

  // 1) match catalog su route esistenti
  routes = routes.map((route) => {
    let best = null;
    let bestScore = 0;

    for (const item of EUROPEAN_ROUTES_CATALOG) {
      const score = scoreRouteAgainstCatalog(route, item);
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    if (best && bestScore >= 45) {
      matchedCount += 1;
      catalogMatchedIds.add(best.id);
      return applyCatalogToRoute(route, best);
    }

    route.searchText = buildSearchText(route);
    route.hero = Boolean(route.hero);
    return route;
  });

  // 2) costruisci hero routes mancanti
  for (const item of EUROPEAN_ROUTES_CATALOG) {
    if (catalogMatchedIds.has(item.id)) continue;

    try {
      const built = await buildHeroRouteFromCatalog(item, spots);
      if (built) {
        routes.push(built);
        builtHeroCount += 1;
      }
    } catch (err) {
      console.warn(`⚠️ Hero skip ${item.name}: ${err.message}`);
    }
  }

  // 3) dedupe finale
  routes = dedupeRoutes(routes).sort((a, b) => {
    if (Boolean(b.hero) !== Boolean(a.hero)) return Number(b.hero) - Number(a.hero);
    return (
      (a.country || "").localeCompare(b.country || "") ||
      (a.region || "").localeCompare(b.region || "") ||
      a.name.localeCompare(b.name)
    );
  });

  await fs.writeFile(OUT_FILE, JSON.stringify(routes, null, 2), "utf8");

  const heroCount = routes.filter((r) => r.hero).length;

  console.log("------------------------------------");
  console.log(`Route input:          ${routesRaw.length}`);
  console.log(`Catalog matched:      ${matchedCount}`);
  console.log(`Hero routes created:  ${builtHeroCount}`);
  console.log(`Hero routes total:    ${heroCount}`);
  console.log(`Route finali:         ${routes.length}`);
  console.log(`Creato: ${OUT_FILE}`);
  console.log("------------------------------------");
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});