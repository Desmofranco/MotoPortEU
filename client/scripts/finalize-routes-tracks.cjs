// =======================================================
// client/scripts/finalize-routes-tracks.cjs
// MotoPortEU — finalizzazione pulita routes/tracks
//
// USO:
//   node .\client\scripts\finalize-routes-tracks.cjs
//
// INPUT:
//   client/public/data/routes.cleaned.json
//   client/public/data/tracks.extracted.json
//   client/public/data/tracks.json
//
// OUTPUT:
//   client/public/data/routes.final.json
//   client/public/data/tracks.final.json
//
// BACKUP:
//   client/public/data/routes.json.backup-final-<timestamp>
//   client/public/data/tracks.json.backup-final-<timestamp>
//
// COSA FA:
// - fa backup degli originali
// - usa routes.cleaned.json come base finale routes
// - unisce tracks.json + tracks.extracted.json
// - deduplica in modo severo
// - salva i file finali senza toccare subito gli originali
// =======================================================

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "client", "public", "data");

const ROUTES_ORIGINAL = path.join(DATA_DIR, "routes.json");
const TRACKS_ORIGINAL = path.join(DATA_DIR, "tracks.json");

const ROUTES_CLEANED = path.join(DATA_DIR, "routes.cleaned.json");
const TRACKS_EXTRACTED = path.join(DATA_DIR, "tracks.extracted.json");

const ROUTES_FINAL = path.join(DATA_DIR, "routes.final.json");
const TRACKS_FINAL = path.join(DATA_DIR, "tracks.final.json");

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-\/]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fileTimestamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function backupIfExists(sourcePath, label) {
  if (!fs.existsSync(sourcePath)) return null;
  const backupPath = `${sourcePath}.backup-final-${fileTimestamp()}`;
  fs.copyFileSync(sourcePath, backupPath);
  return backupPath;
}

function extractLatLng(item) {
  if (item?.coords && typeof item.coords === "object") {
    const lat = Number(item.coords.lat);
    const lng = Number(item.coords.lng ?? item.coords.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }

  if (Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng))) {
    return [Number(item.lat), Number(item.lng)];
  }

  if (Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lon))) {
    return [Number(item.lat), Number(item.lon)];
  }

  return [null, null];
}

function dedupeKey(item) {
  const id = norm(item?.id);
  if (id) return `id:${id}`;

  const name = norm(item?.name || item?.title);
  const country = norm(item?.country);
  const region = norm(item?.region);
  const [lat, lng] = extractLatLng(item);

  if (name && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `namecoord:${name}|${country}|${region}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
  }

  if (name) {
    return `name:${name}|${country}|${region}`;
  }

  return `fallback:${JSON.stringify(item).slice(0, 120)}`;
}

function scoreTrackQuality(item) {
  let score = 0;

  if (item?._classification?.bucket === "tracks") score += 20;
  if (item?._classification?.reason === "hard_track_primary") score += 20;
  if (item?._classification?.trackScore) score += Number(item._classification.trackScore) || 0;

  const type = norm(item?.type);
  const rideType = norm(item?.rideType);
  const name = norm(item?.name || item?.title);
  const source = norm(item?.source);
  const surface = norm(item?.surface);
  const terrain = norm(item?.terrain);

  const hardWords = [
    "motocross",
    "cross",
    "enduro",
    "hard enduro",
    "mx",
    "track",
    "circuit",
    "circuito",
    "pista",
    "motodromo",
    "kartodromo",
    "singletrack",
    "single track",
    "offroad",
    "off road",
    "dirt",
  ];

  for (const w of hardWords) {
    if (name.includes(w)) score += 8;
    if (type.includes(w)) score += 6;
    if (rideType.includes(w)) score += 6;
    if (terrain.includes(w)) score += 5;
    if (surface.includes(w)) score += 4;
  }

  if (source === "passes") score += 1;
  if (item?._generated) score -= 1;

  return score;
}

function preferBetterTrack(a, b) {
  const sa = scoreTrackQuality(a);
  const sb = scoreTrackQuality(b);

  if (sa !== sb) return sa > sb ? a : b;

  const aUpdated = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
  const bUpdated = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
  if (aUpdated !== bUpdated) return aUpdated > bUpdated ? a : b;

  const aFields = Object.keys(a || {}).length;
  const bFields = Object.keys(b || {}).length;
  return aFields >= bFields ? a : b;
}

function dedupeTracks(items) {
  const map = new Map();

  for (const item of items) {
    const key = dedupeKey(item);
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      map.set(key, preferBetterTrack(map.get(key), item));
    }
  }

  return Array.from(map.values());
}

function stripClassification(item) {
  const cloned = { ...item };
  delete cloned._classification;
  return cloned;
}

function main() {
  const routesOriginal = readJson(ROUTES_ORIGINAL, []);
  const tracksOriginal = readJson(TRACKS_ORIGINAL, []);
  const routesCleaned = readJson(ROUTES_CLEANED, null);
  const tracksExtracted = readJson(TRACKS_EXTRACTED, null);

  if (!Array.isArray(routesCleaned)) {
    console.error("Manca o non è valido: client/public/data/routes.cleaned.json");
    process.exit(1);
  }

  if (!Array.isArray(tracksExtracted)) {
    console.error("Manca o non è valido: client/public/data/tracks.extracted.json");
    process.exit(1);
  }

  if (!Array.isArray(tracksOriginal)) {
    console.error("tracks.json non è un array valido.");
    process.exit(1);
  }

  const routesBackup = backupIfExists(ROUTES_ORIGINAL, "routes");
  const tracksBackup = backupIfExists(TRACKS_ORIGINAL, "tracks");

  const finalRoutes = routesCleaned.map(stripClassification);

  const mergedTracksRaw = [
    ...tracksOriginal,
    ...tracksExtracted,
  ].map(stripClassification);

  const finalTracks = dedupeTracks(mergedTracksRaw);

  writeJson(ROUTES_FINAL, finalRoutes);
  writeJson(TRACKS_FINAL, finalTracks);

  console.log("====================================");
  console.log("MotoPortEU — Finalizzazione completata");
  console.log("====================================");
  console.log(`Routes originali:   ${Array.isArray(routesOriginal) ? routesOriginal.length : 0}`);
  console.log(`Routes pulite:      ${finalRoutes.length}`);
  console.log(`Tracks originali:   ${tracksOriginal.length}`);
  console.log(`Tracks estratti:    ${tracksExtracted.length}`);
  console.log(`Tracks finali:      ${finalTracks.length}`);
  console.log("------------------------------------");
  if (routesBackup) console.log(`Backup routes: ${routesBackup}`);
  if (tracksBackup) console.log(`Backup tracks: ${tracksBackup}`);
  console.log("------------------------------------");
  console.log(`Creato: ${ROUTES_FINAL}`);
  console.log(`Creato: ${TRACKS_FINAL}`);
}

main();