// =======================================================
// MotoPortEU — Split definitivo routes.json by country
// Input:  C:\MotoPortEU\_local_backup\routes.json
// Output:
//   client/public/data/routes-index.json
//   client/public/data/routes/IT.json, FR.json, ...
//   client/public/data/routes.json  -> []
// =======================================================

import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const INPUT =
  process.argv[2] ||
  "C:\\MotoPortEU\\_local_backup\\routes.json";

const PUBLIC_DATA = path.join(ROOT, "client", "public", "data");
const ROUTES_DIR = path.join(PUBLIC_DATA, "routes");

const INDEX_FILE = path.join(PUBLIC_DATA, "routes-index.json");
const LEGACY_ROUTES_FILE = path.join(PUBLIC_DATA, "routes.json");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normCountry(route) {
  return String(
    route.country ||
      route.countryCode ||
      route.cc ||
      route.nation ||
      "XX"
  )
    .trim()
    .toUpperCase()
    .slice(0, 2);
}

function routeKey(route, index) {
  return String(
    route.id ||
      route._id ||
      route.slug ||
      `${normCountry(route)}-${route.name || "route"}-${index}`
  )
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lightWaypoint(wp) {
  if (!wp) return null;
  return {
    name: wp.name || "",
    lat: wp.lat ?? wp.latitude ?? null,
    lng: wp.lng ?? wp.lon ?? wp.longitude ?? null,
  };
}

function makeSummary(route, key, country) {
  return {
    ...route,

    // ID stabile per ricaricare il dettaglio completo
    __routeKey: key,
    __country: country,
    __countryFile: `/data/routes/${country}.json`,
    __isSummary: true,

    // rimuove campi pesanti dal file indice
    geometry: undefined,
    coordinates: undefined,
    coords: undefined,
    points: undefined,
    track: undefined,
    gpx: undefined,
    polyline: undefined,
    routeGeometry: undefined,
    routePoints: undefined,

    // waypoints compatti, utili per ricerca / partenza / arrivo
    waypoints: Array.isArray(route.waypoints)
      ? route.waypoints.map(lightWaypoint).filter(Boolean)
      : [],
  };
}

function fileSizeMb(file) {
  if (!fs.existsSync(file)) return 0;
  return fs.statSync(file).size / 1024 / 1024;
}

console.log("🏍️ MotoPortEU — Routes Split Definitivo");
console.log("Input:", INPUT);

if (!fs.existsSync(INPUT)) {
  console.error("❌ File input non trovato:", INPUT);
  process.exit(1);
}

ensureDir(PUBLIC_DATA);
ensureDir(ROUTES_DIR);

const raw = fs.readFileSync(INPUT, "utf8");
const routes = JSON.parse(raw);

if (!Array.isArray(routes)) {
  console.error("❌ routes.json non è un array.");
  process.exit(1);
}

console.log("Routes totali:", routes.length);

const byCountry = {};
const summaries = [];
const countryStats = {};

routes.forEach((route, index) => {
  const country = normCountry(route);
  const key = routeKey(route, index);

  const fullRoute = {
    ...route,
    __routeKey: key,
    __country: country,
  };

  if (!byCountry[country]) byCountry[country] = [];
  byCountry[country].push(fullRoute);

  summaries.push(makeSummary(route, key, country));
});

Object.keys(byCountry)
  .sort()
  .forEach((country) => {
    const file = path.join(ROUTES_DIR, `${country}.json`);
    fs.writeFileSync(file, JSON.stringify(byCountry[country]), "utf8");

    const rideTypes = {};
    const regions = {};

    byCountry[country].forEach((r) => {
      const rt = r.rideType || r.type || "unknown";
      const reg = r.region || r.area || "unknown";
      rideTypes[rt] = (rideTypes[rt] || 0) + 1;
      regions[reg] = (regions[reg] || 0) + 1;
    });

    countryStats[country] = {
      country,
      file: `/data/routes/${country}.json`,
      count: byCountry[country].length,
      sizeMb: Number(fileSizeMb(file).toFixed(2)),
      rideTypes,
      regions,
    };

    console.log(
      `✅ ${country}: ${byCountry[country].length} routes — ${countryStats[country].sizeMb} MB`
    );
  });

const index = {
  version: "split-v1",
  generatedAt: new Date().toISOString(),
  totalRoutes: routes.length,
  countries: countryStats,
  routes: summaries,
};

fs.writeFileSync(INDEX_FILE, JSON.stringify(index), "utf8");

// Legacy leggero per non rompere deploy GitHub/Render
fs.writeFileSync(LEGACY_ROUTES_FILE, "[]", "utf8");

console.log("------------------------------------");
console.log("Creato:", INDEX_FILE);
console.log("Creati file paese in:", ROUTES_DIR);
console.log("routes.json legacy alleggerito:", LEGACY_ROUTES_FILE);
console.log("routes-index size:", fileSizeMb(INDEX_FILE).toFixed(2), "MB");
console.log("✅ Split completato.");