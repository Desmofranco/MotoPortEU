// =======================================================
// server/scripts/publishRoutesFromSpots.js
// MotoPortEU — Publish Routes From Generated Spot Routes
// -------------------------------------------------------
// Input:
// - client/public/data/routes.generated.fromspots.IT.json
// - client/public/data/routes.generated.fromspots.FR.json
//   ...ecc
//
// Output:
// - client/public/data/routes.json
// - backup automatico del vecchio routes.json
//
// Uso:
// node server/scripts/publishRoutesFromSpots.js --country=IT
// node server/scripts/publishRoutesFromSpots.js --country=IT --country=FR
// node server/scripts/publishRoutesFromSpots.js
// =======================================================

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const DATA_DIR = path.resolve(ROOT, "client/public/data");
const LIVE_FILE = path.resolve(DATA_DIR, "routes.json");
const BACKUP_DIR = path.resolve(DATA_DIR, "_backup");

function parseArgs(argv) {
  const out = { country: [] };

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;

    const eq = raw.indexOf("=");
    if (eq === -1) {
      out[raw.slice(2)] = true;
      continue;
    }

    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1).trim();

    if (key === "country") {
      if (value) out.country.push(value.toUpperCase());
    } else {
      out[key] = value;
    }
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));
const COUNTRY_FILTER = new Set(
  (args.country || []).map((x) => String(x).toUpperCase())
);

function normalizeText(v) {
  return String(v || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(v) {
  return normalizeText(v).toLowerCase();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function sanitizeCoords(obj) {
  const lat = toNumber(obj?.lat);
  const lng = toNumber(obj?.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function slugify(v) {
  return normalizeText(v)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function sanitizeRoute(raw) {
  if (!raw || typeof raw !== "object") return null;

  const country = String(raw.country || "").toUpperCase().trim();
  const region = normalizeText(raw.region || "Area Rider");
  const name = normalizeText(raw.name);
  const rideType = normKey(raw.rideType || "scenic") || "scenic";
  const description = normalizeText(raw.description || "");
  const difficulty = normKey(raw.difficulty || "media") || "media";
  const distanceKm = toNumber(raw.distanceKm) ?? 0;
  const score = toNumber(raw.score) ?? 50;

  if (!country || !name) return null;

  const start = raw.start
    ? {
        name: normalizeText(raw.start.name || "Start"),
        ...sanitizeCoords(raw.start),
      }
    : null;

  const end = raw.end
    ? {
        name: normalizeText(raw.end.name || "End"),
        ...sanitizeCoords(raw.end),
      }
    : null;

  const centerCoords = sanitizeCoords(raw.center || {});
  const center =
    centerCoords ||
    start ||
    end || {
      lat: 0,
      lng: 0,
    };

  const waypoints = safeArray(raw.waypoints)
    .map((w) => {
      const coords = sanitizeCoords(w);
      if (!coords) return null;

      return {
        name: normalizeText(w.name || "Waypoint"),
        lat: coords.lat,
        lng: coords.lng,
        spotType: normKey(w.spotType || "viewpoint") || "viewpoint",
        score: toNumber(w.score) ?? 50,
      };
    })
    .filter(Boolean);

  const spots = safeArray(raw.spots)
    .map((s) => {
      const coords = sanitizeCoords(s);
      if (!coords) return null;

      return {
        name: normalizeText(s.name || "Spot"),
        lat: coords.lat,
        lng: coords.lng,
        spotType: normKey(s.spotType || "viewpoint") || "viewpoint",
        score: toNumber(s.score) ?? 50,
      };
    })
    .filter(Boolean);

  if (!start || !end) return null;
  if (start.lat === undefined || start.lng === undefined) return null;
  if (end.lat === undefined || end.lng === undefined) return null;

  const tags = [...new Set(safeArray(raw.tags).map(normalizeText).filter(Boolean))];

  const id =
    normalizeText(raw.id) ||
    slugify(`${country}-${region}-${name}`) ||
    `route-${Date.now()}`;

  return {
    id,
    name,
    country,
    region,
    rideType,
    score: Math.round(score),
    difficulty,
    distanceKm: Math.round(distanceKm * 10) / 10,
    bestSeason:
      normalizeText(raw.bestSeason) ||
      (rideType === "mountain"
        ? "Primavera / Estate / Inizio autunno"
        : "Primavera / Estate / Autunno"),
    description,
    tags,
    start,
    end,
    center: {
      lat: Number((center.lat ?? start.lat).toFixed(5)),
      lng: Number((center.lng ?? start.lng).toFixed(5)),
    },
    waypoints,
    spots,
    source: normalizeText(raw.source || "rider-spots.eu"),
    sourceScope: normalizeText(raw.sourceScope || "from-spots"),
    hero: Boolean(raw.hero),
  };
}

function routeDedupeKey(route) {
  return [
    normKey(route.country),
    normKey(route.region),
    normKey(route.rideType),
    normKey(route.name),
    Math.round(Number(route.distanceKm || 0)),
  ].join("|");
}

function routeAltKey(route) {
  const startName = normKey(route.start?.name || "");
  const endName = normKey(route.end?.name || "");
  return [
    normKey(route.country),
    normKey(route.region),
    normKey(route.rideType),
    startName,
    endName,
  ].join("|");
}

function betterRoute(a, b) {
  if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
  if ((b.spots?.length || 0) !== (a.spots?.length || 0)) {
    return (b.spots?.length || 0) - (a.spots?.length || 0);
  }
  if ((b.waypoints?.length || 0) !== (a.waypoints?.length || 0)) {
    return (b.waypoints?.length || 0) - (a.waypoints?.length || 0);
  }
  return (b.distanceKm || 0) - (a.distanceKm || 0);
}

function dedupeRoutes(routes) {
  const map = new Map();

  for (const route of routes) {
    const key1 = routeDedupeKey(route);
    const key2 = routeAltKey(route);
    const existing =
      map.get(key1) ||
      map.get(key2);

    if (!existing) {
      map.set(key1, route);
      map.set(key2, route);
      continue;
    }

    const pick = betterRoute(existing, route) <= 0 ? existing : route;
    map.set(key1, pick);
    map.set(key2, pick);
  }

  return [...new Map(
    [...map.values()].map((r) => [r.id, r])
  ).values()];
}

function sortRoutes(routes) {
  return [...routes].sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    if ((a.country || "") !== (b.country || "")) {
      return (a.country || "").localeCompare(b.country || "");
    }
    if ((a.region || "") !== (b.region || "")) {
      return (a.region || "").localeCompare(b.region || "");
    }
    return (a.name || "").localeCompare(b.name || "");
  });
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function backupLiveIfExists() {
  const exists = await fileExists(LIVE_FILE);
  if (!exists) return null;

  await ensureDir(BACKUP_DIR);

  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const backupPath = path.resolve(BACKUP_DIR, `routes.backup-before-publish.${ts}.json`);
  await fs.copyFile(LIVE_FILE, backupPath);
  return backupPath;
}

async function readGeneratedRoutesForCountry(country) {
  const file = path.resolve(DATA_DIR, `routes.generated.fromspots.${country}.json`);
  const exists = await fileExists(file);
  if (!exists) {
    throw new Error(`File non trovato per ${country}: ${file}`);
  }

  const json = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(json)) {
    throw new Error(`Formato non valido in ${file}: atteso array`);
  }

  return {
    file,
    routes: json.map(sanitizeRoute).filter(Boolean),
  };
}

async function discoverGeneratedFiles() {
  const entries = await fs.readdir(DATA_DIR);
  const files = entries.filter((name) =>
    /^routes\.generated\.fromspots\.[A-Z]{2}\.json$/.test(name)
  );

  return files.map((name) => {
    const match = name.match(/^routes\.generated\.fromspots\.([A-Z]{2})\.json$/);
    return {
      country: match?.[1] || null,
      file: path.resolve(DATA_DIR, name),
    };
  }).filter(Boolean);
}

function summarizeByCountry(routes) {
  const out = {};
  for (const r of routes) {
    out[r.country] = (out[r.country] || 0) + 1;
  }
  return out;
}

function summarizeByRideType(routes) {
  const out = {};
  for (const r of routes) {
    out[r.rideType] = (out[r.rideType] || 0) + 1;
  }
  return out;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Publish Routes From Spots");
  console.log("====================================");

  let targets = [];

  if (COUNTRY_FILTER.size > 0) {
    targets = [...COUNTRY_FILTER].map((country) => ({ country }));
  } else {
    targets = await discoverGeneratedFiles();
  }

  if (!targets.length) {
    throw new Error("Nessun file routes.generated.fromspots.<COUNTRY>.json trovato");
  }

  const loaded = [];
  for (const target of targets) {
    const country = target.country;
    const res = await readGeneratedRoutesForCountry(country);
    loaded.push({ country, ...res });
  }

  console.log("------------------------------------");
  console.log("📦 File caricati:");
  for (const item of loaded) {
    console.log(`- ${item.country}: ${item.file} (${item.routes.length} routes)`);
  }

  const allRoutes = loaded.flatMap((item) => item.routes);
  const deduped = dedupeRoutes(allRoutes);
  const finalRoutes = sortRoutes(deduped);

  const backupPath = await backupLiveIfExists();
  await fs.writeFile(LIVE_FILE, JSON.stringify(finalRoutes, null, 2), "utf8");

  console.log("------------------------------------");
  console.log(`📥 Routes input: ${allRoutes.length}`);
  console.log(`✅ Routes finali: ${finalRoutes.length}`);
  console.log("Distribuzione country:", summarizeByCountry(finalRoutes));
  console.log("Distribuzione rideType:", summarizeByRideType(finalRoutes));
  if (backupPath) {
    console.log(`🗂️ Backup live: ${backupPath}`);
  } else {
    console.log("🗂️ Backup live: nessun routes.json precedente trovato");
  }
  console.log(`💾 Live scritto: ${LIVE_FILE}`);
  console.log("====================================");
  console.log("✅ Publish completato");
  console.log("====================================");
}

main().catch((err) => {
  console.error("💥 Errore publishRoutesFromSpots");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});