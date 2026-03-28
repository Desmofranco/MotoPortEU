// =======================================================
// server/scripts/mergeRoutesIntoLiveDataset.js
// MotoPortEU — Merge Generated Routes Into Live Dataset
//
// Input:
//   client/public/data/routes.json
//   client/public/data/routes.generated.json
//
// Output:
//   client/public/data/routes.merged.json
//
// Scopo:
// - unire dataset live + generated
// - deduplicare
// - preferire record migliori/completi
// - mantenere formato compatibile con Routes.jsx
//
// Avvio:
//   node server/scripts/mergeRoutesIntoLiveDataset.js
// =======================================================

import path from "path";
import fs from "fs/promises";
import process from "process";

const LIVE_FILE = path.resolve("client/public/data/routes.json");
const GENERATED_FILE = path.resolve("client/public/data/routes.generated.json");
const OUT_FILE = path.resolve("client/public/data/routes.merged.json");

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function routeNameKey(route) {
  return normalizeText(route?.name || "")
    .replace(/\b(giro|itinerario|tour|route|panoramico|costiero|montagna|lago|fiordi|foreste)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundCoord(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Number(x.toFixed(5)) : null;
}

function normalizeCoords(coords) {
  if (!Array.isArray(coords)) return [];
  return coords
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const lat = roundCoord(pair[0]);
      const lng = roundCoord(pair[1]);
      if (lat == null || lng == null) return null;
      return [lat, lng];
    })
    .filter(Boolean);
}

function normalizeWaypoints(waypoints) {
  if (!Array.isArray(waypoints)) return [];
  return waypoints
    .map((w) => {
      const lat = roundCoord(w?.lat);
      const lng = roundCoord(w?.lng);
      if (lat == null || lng == null) return null;
      return {
        name: w?.name || "Waypoint",
        lat,
        lng,
        type: w?.type || "scenic_road",
        rideType: w?.rideType || null,
      };
    })
    .filter(Boolean);
}

function inferCenter(route) {
  const points = [];

  if (route?.start?.lat != null && route?.start?.lng != null) {
    points.push([Number(route.start.lat), Number(route.start.lng)]);
  }

  for (const w of route?.waypoints || []) {
    if (w?.lat != null && w?.lng != null) {
      points.push([Number(w.lat), Number(w.lng)]);
    }
  }

  if (route?.end?.lat != null && route?.end?.lng != null) {
    points.push([Number(route.end.lat), Number(route.end.lng)]);
  }

  if (!points.length) return null;

  const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lng = points.reduce((s, p) => s + p[1], 0) / points.length;

  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

function normalizeSpots(route) {
  if (!Array.isArray(route?.spots)) return [];
  return route.spots
    .map((s) => {
      const lat = roundCoord(s?.lat);
      const lng = roundCoord(s?.lng);
      if (lat == null || lng == null) return null;

      return {
        id: s?.id || null,
        name: s?.name || "Spot",
        slug: s?.slug || slugify(s?.name || "spot"),
        type: s?.type || "scenic_road",
        rideType: s?.rideType || null,
        lat,
        lng,
        country: s?.country || null,
      };
    })
    .filter(Boolean);
}

function normalizeRoute(route, sourceLabel = "live") {
  const startLat = roundCoord(route?.start?.lat);
  const startLng = roundCoord(route?.start?.lng);
  const endLat = roundCoord(route?.end?.lat);
  const endLng = roundCoord(route?.end?.lng);

  const normalized = {
    id: route?.id || null,
    name: route?.name || "Itinerario Rider",
    slug: route?.slug || slugify(route?.name || "itinerario-rider"),
    type: route?.type || "touring",
    rideType: route?.rideType || null,
    mode: route?.mode || null,
    country: route?.country || null,
    region: route?.region || null,
    source: route?.source || sourceLabel,
    distanceKm: toNum(route?.distanceKm),
    durationMin: toNum(route?.durationMin),
    difficulty: route?.difficulty || null,
    surface: route?.surface || null,
    tags: Array.from(new Set(Array.isArray(route?.tags) ? route.tags.filter(Boolean) : [])),
    description: route?.description || "",
    center: route?.center
      ? {
          lat: roundCoord(route.center.lat),
          lng: roundCoord(route.center.lng),
        }
      : null,
    start:
      startLat != null && startLng != null
        ? {
            name: route?.start?.name || "Start",
            lat: startLat,
            lng: startLng,
          }
        : null,
    end:
      endLat != null && endLng != null
        ? {
            name: route?.end?.name || "End",
            lat: endLat,
            lng: endLng,
          }
        : null,
    waypoints: normalizeWaypoints(route?.waypoints),
    coords: normalizeCoords(route?.coords),
    spots: normalizeSpots(route),
  };

  if (!normalized.center) {
    normalized.center = inferCenter(normalized);
  }

  return normalized;
}

function routeSignature(route) {
  const spotNames = (route?.spots || []).map((s) => slugify(s.slug || s.name)).sort();
  const wpNames = (route?.waypoints || []).map((w) => slugify(w.name)).sort();

  return [
    route?.country || "",
    route?.region || "",
    route?.rideType || "",
    routeNameKey(route),
    spotNames.join(">"),
    wpNames.join(">"),
    Math.round(Number(route?.distanceKm || 0)),
  ].join("|");
}

function softSignature(route) {
  const start = route?.start
    ? `${roundCoord(route.start.lat)},${roundCoord(route.start.lng)}`
    : "";
  const end = route?.end
    ? `${roundCoord(route.end.lat)},${roundCoord(route.end.lng)}`
    : "";

  return [
    route?.country || "",
    route?.region || "",
    route?.rideType || "",
    start,
    end,
    Math.round(Number(route?.distanceKm || 0)),
  ].join("|");
}

function qualityScore(route) {
  let score = 0;

  if (route?.description) score += 8;
  if (Array.isArray(route?.tags) && route.tags.length) score += 5;
  if (route?.distanceKm != null) score += 5;
  if (route?.durationMin != null) score += 4;
  if (route?.difficulty) score += 3;
  if (route?.surface) score += 2;
  if (route?.center?.lat != null && route?.center?.lng != null) score += 3;
  if (route?.start?.lat != null && route?.start?.lng != null) score += 4;
  if (route?.end?.lat != null && route?.end?.lng != null) score += 4;
  if (Array.isArray(route?.waypoints)) score += Math.min(route.waypoints.length, 5);
  if (Array.isArray(route?.spots)) score += Math.min(route.spots.length * 2, 10);
  if (Array.isArray(route?.coords)) score += Math.min(Math.floor(route.coords.length / 20), 10);

  if (route?.source === "generated_from_rider_spots") score += 4;

  return score;
}

function mergeTwoRoutes(a, b) {
  const better = qualityScore(b) > qualityScore(a) ? b : a;
  const other = better === a ? b : a;

  return {
    ...better,
    id: better.id || other.id,
    slug: better.slug || other.slug,
    name: better.name || other.name,
    type: better.type || other.type || "touring",
    rideType: better.rideType || other.rideType || null,
    mode: better.mode || other.mode || null,
    country: better.country || other.country || null,
    region: better.region || other.region || null,
    source: better.source || other.source,
    distanceKm: better.distanceKm ?? other.distanceKm ?? null,
    durationMin: better.durationMin ?? other.durationMin ?? null,
    difficulty: better.difficulty || other.difficulty || null,
    surface: better.surface || other.surface || null,
    description:
      (better.description && better.description.length >= (other.description || "").length
        ? better.description
        : other.description) || "",
    center: better.center || other.center || null,
    start: better.start || other.start || null,
    end: better.end || other.end || null,
    tags: Array.from(new Set([...(a.tags || []), ...(b.tags || [])])),
    waypoints:
      (better.waypoints && better.waypoints.length ? better.waypoints : other.waypoints) || [],
    coords: (better.coords && better.coords.length ? better.coords : other.coords) || [],
    spots: (better.spots && better.spots.length ? better.spots : other.spots) || [],
  };
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Merge Routes Into Live");
  console.log("====================================");

  const liveRaw = JSON.parse(await fs.readFile(LIVE_FILE, "utf8"));
  const generatedRaw = JSON.parse(await fs.readFile(GENERATED_FILE, "utf8"));

  const live = Array.isArray(liveRaw) ? liveRaw.map((r) => normalizeRoute(r, "live")) : [];
  const generated = Array.isArray(generatedRaw)
    ? generatedRaw.map((r) => normalizeRoute(r, "generated_from_rider_spots"))
    : [];

  console.log(`Live routes:      ${live.length}`);
  console.log(`Generated routes: ${generated.length}`);

  const merged = [];
  const byHard = new Map();
  const bySoft = new Map();

  function insertRoute(route) {
    const hard = routeSignature(route);
    const soft = softSignature(route);

    if (byHard.has(hard)) {
      const idx = byHard.get(hard);
      merged[idx] = mergeTwoRoutes(merged[idx], route);
      return;
    }

    if (bySoft.has(soft)) {
      const idx = bySoft.get(soft);
      merged[idx] = mergeTwoRoutes(merged[idx], route);
      const newHard = routeSignature(merged[idx]);
      byHard.set(newHard, idx);
      return;
    }

    const idx = merged.length;
    merged.push(route);
    byHard.set(hard, idx);
    bySoft.set(soft, idx);
  }

  for (const r of live) insertRoute(r);
  for (const r of generated) insertRoute(r);

  const finalRoutes = merged
    .filter((r) => Array.isArray(r.coords) && r.coords.length >= 2)
    .sort((a, b) => {
      return (
        (a.country || "").localeCompare(b.country || "") ||
        (a.region || "").localeCompare(b.region || "") ||
        (a.rideType || "").localeCompare(b.rideType || "") ||
        a.name.localeCompare(b.name)
      );
    })
    .map((r, i) => ({
      ...r,
      id: r.id || `route-merged-${String(i + 1).padStart(5, "0")}`,
      slug: r.slug || slugify(r.name || `route-merged-${i + 1}`),
    }));

  await fs.writeFile(OUT_FILE, JSON.stringify(finalRoutes, null, 2), "utf8");

  const byRideType = finalRoutes.reduce((acc, item) => {
    const k = item.rideType || "unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  console.log("------------------------------------");
  console.log(`Merged routes: ${finalRoutes.length}`);
  console.log("Distribuzione rideType:", byRideType);
  console.log(`Creato: ${OUT_FILE}`);
  console.log("------------------------------------");
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});