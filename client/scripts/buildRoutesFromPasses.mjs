import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.resolve(ROOT, "client/public/data");

const SOURCE_PATH = path.resolve(DATA_DIR, "passes.eu.seed.json");
const PREVIEW_PATH = path.resolve(DATA_DIR, "routes.generated.preview.json");
const ROUTES_PATH = path.resolve(DATA_DIR, "routes.json");

// ======================================================
// Utils
// ======================================================
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function norm(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

function slugify(s) {
  return norm(s)
    .toLowerCase()
    .replace(/[’']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function pickLatLng(x) {
  const lat = x?.lat ?? x?.latitude ?? x?.coords?.lat ?? x?.location?.lat;
  const lng = x?.lng ?? x?.lon ?? x?.longitude ?? x?.coords?.lng ?? x?.location?.lng;

  if (lat == null || lng == null) return null;

  const a = Number(lat);
  const b = Number(lng);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  if (a < -90 || a > 90 || b < -180 || b > 180) return null;

  return { lat: a, lng: b };
}

function asArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.passes)) return maybe.passes;
  if (Array.isArray(maybe?.items)) return maybe.items;
  if (Array.isArray(maybe?.data)) return maybe.data;
  return [];
}

function normalizeCountry(raw) {
  const s = norm(raw).toUpperCase();
  const m = s.match(/\b[A-Z]{2}\b/);
  if (m) return m[0];
  return s.slice(0, 2) || "";
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function lowerJoin(...parts) {
  return parts
    .flat()
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
}

// ======================================================
// Dizionari e filtri
// ======================================================

const PASS_WORDS = [
  "pass",
  "passo",
  "col",
  "joch",
  "puerto",
  "port",
  "forca",
  "forcella",
  "sella",
  "bergpass",
  "mountain pass",
  "colle",
  "passhöhe",
];

const BANNED_WORDS = [
  "cross",
  "motocross",
  "mx",
  "enduro",
  "hard enduro",
  "superenduro",
  "offroad",
  "off-road",
  "off road",
  "trial",
  "kart",
  "karting",
  "speedway",
  "dragstrip",
  "drag strip",
  "autodrome",
  "raceway",
  "racetrack",
  "race track",
  "circuit",
  "track",
  "pista",
  "trail park",
  "bike park",
  "dirt park",
  "pump track",
  "bmx",
];

const BANNED_SURFACES = [
  "dirt",
  "gravel",
  "mud",
  "sand",
  "earth",
  "unpaved",
  "ground",
  "trail",
];

const TOURING_SURFACES = [
  "asphalt",
  "paved",
  "tarmac",
  "bitumen",
  "sealed",
];

const ALLOWED_TYPES = [
  "mountain_pass",
  "touring_route",
  "alpine_loop",
];

function containsAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

function hasPassSignal(item) {
  const text = lowerJoin(
    item?.name,
    item?.title,
    item?.pass,
    item?.col,
    item?.saddle,
    item?.type,
    item?.category,
    item?.kind,
    item?.tags,
    item?.classification
  );

  const elevation =
    toNum(item?.elevation) ??
    toNum(item?.ele) ??
    toNum(item?.altitude) ??
    toNum(item?.alt) ??
    toNum(item?.meters) ??
    toNum(item?.height);

  const hasKeyword = containsAny(text, PASS_WORDS);
  const hasElevation = elevation != null && elevation >= 700;

  return hasKeyword || hasElevation;
}

function isClearlyBad(item) {
  const text = lowerJoin(
    item?.name,
    item?.title,
    item?.description,
    item?.desc,
    item?.type,
    item?.category,
    item?.kind,
    item?.discipline,
    item?.sport,
    item?.surface,
    item?.terrain,
    item?.tags,
    item?.classification
  );

  if (containsAny(text, BANNED_WORDS)) return true;
  if (containsAny(text, BANNED_SURFACES)) return true;

  return false;
}

function looksLikeValidPassItem(item) {
  if (!item || typeof item !== "object") return false;

  const coords = pickLatLng(item);
  if (!coords) return false;

  const name = norm(item?.name || item?.title || item?.pass || item?.col || item?.saddle);
  if (!name) return false;

  if (isClearlyBad(item)) return false;
  if (!hasPassSignal(item)) return false;

  return true;
}

// ======================================================
// Classificazione e metadati
// ======================================================

function inferPassKind(item) {
  const name = lowerJoin(item?.name, item?.title);
  const elevation =
    toNum(item?.elevation) ??
    toNum(item?.ele) ??
    toNum(item?.altitude) ??
    toNum(item?.alt) ??
    toNum(item?.meters) ??
    toNum(item?.height) ??
    0;

  const curves =
    toNum(item?.curvesScore) ??
    toNum(item?.curves) ??
    toNum(item?.twists) ??
    0;

  if (elevation >= 1600 || curves >= 7 || containsAny(name, ["joch", "col", "passo", "pass"])) {
    return "mountain_pass";
  }

  return "touring_route";
}

function inferPace({ type, curves, elevation, distanceKm, surface }) {
  const surf = String(surface || "").toLowerCase();

  if (type === "offroad" || containsAny(surf, BANNED_SURFACES)) {
    return "Avventura";
  }

  const el = Number(elevation || 0) || 0;
  const cv = Number(curves || 0) || 0;
  const km = Number(distanceKm || 0) || 0;

  if (cv >= 9 || el >= 2200) return "Tecnico";
  if (cv >= 7) return "Misto";
  if (km >= 280) return "Touring";

  return km ? "Veloce" : "Touring";
}

function inferBestSeason(elevation) {
  const e = Number(elevation || 0) || 0;
  if (e >= 2200) return "Giu–Set";
  if (e >= 1600) return "Mag–Ott";
  if (e >= 900) return "Apr–Ott";
  return "Mar–Nov";
}

function buildDescription(item, elevation, region, country) {
  const raw = norm(item?.description || item?.desc);
  if (raw) return raw;

  const parts = [];

  if (region) parts.push(region);
  if (country) parts.push(country);
  if (elevation != null) parts.push(`quota ${Number(elevation)} m`);

  if (!parts.length) return "Passo panoramico ideale per itinerari moto stradali.";
  return `Passo panoramico ${parts.join(" · ")}.`;
}

// ======================================================
// Mapping
// ======================================================

function passToRoute(item) {
  const nameRaw = norm(item?.name || item?.title || item?.pass || item?.col || item?.saddle || "Passo");
  const name = `🏔 ${nameRaw}`;

  const country = normalizeCountry(item?.country || item?.nation || item?.iso || "");
  const region = norm(item?.region || item?.area || item?.state || "");

  const coords = pickLatLng(item);
  if (!coords) return null;

  const elevation =
    toNum(item?.elevation) ??
    toNum(item?.ele) ??
    toNum(item?.altitude) ??
    toNum(item?.alt) ??
    toNum(item?.height) ??
    toNum(item?.meters);

  const curves =
    toNum(item?.curvesScore) ??
    toNum(item?.curves) ??
    toNum(item?.twists) ??
    0;

  const asphalt =
    toNum(item?.asphaltScore) ??
    toNum(item?.asphalt) ??
    (containsAny(item?.surface, TOURING_SURFACES) ? 8 : 0);

  const distanceKm =
    toNum(item?.distanceKm) ??
    toNum(item?.distance) ??
    0;

  const durationMin =
    toNum(item?.durationMin) ??
    toNum(item?.duration) ??
    0;

  const type = inferPassKind(item);

  if (!ALLOWED_TYPES.includes(type)) return null;

  const id =
    String(item?.id || "").trim() ||
    `pass-${slugify(nameRaw)}-${slugify(country || "xx")}-${slugify(region || "na")}-${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`;

  const pace = inferPace({
    type,
    curves,
    elevation,
    distanceKm,
    surface: item?.surface || item?.terrain,
  });

  return {
    id,
    name,
    country,
    region,
    type,
    pace,
    distanceKm,
    durationMin,
    coords,
    line: Array.isArray(item?.line) ? item.line : undefined,
    curvesScore: curves || undefined,
    asphaltScore: asphalt || undefined,
    elevation: elevation ?? undefined,
    bestSeason: item?.bestSeason || item?.season || inferBestSeason(elevation),
    description: buildDescription(item, elevation, region, country),
    photo: item?.photo || item?.image || item?.cover || undefined,
    source: "passes_seed",
    createdAt: new Date().toISOString(),
    _generated: true,
  };
}

// ======================================================
// Merge e dedup
// ======================================================

function routeKey(r) {
  if (!r) return "";
  const id = String(r?.id || "").trim();
  if (id) return `id:${id}`;

  const name = slugify(r?.name || "");
  const lat = Number(r?.coords?.lat || 0).toFixed(5);
  const lng = Number(r?.coords?.lng || 0).toFixed(5);
  return `fallback:${name}:${lat}:${lng}`;
}

function mergeRoutes(curated, generated) {
  const out = [];
  const seen = new Set();

  for (const item of curated) {
    const key = routeKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  for (const item of generated) {
    const key = routeKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

// ======================================================
// Main
// ======================================================

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error("❌ DATA_DIR non trovata:", DATA_DIR);
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error("❌ File seed non trovato:", SOURCE_PATH);
    process.exit(1);
  }

  const sourceRaw = readJSON(SOURCE_PATH);
  const sourceItems = asArray(sourceRaw);

  const validPasses = sourceItems.filter(looksLikeValidPassItem);
  const rejected = sourceItems.length - validPasses.length;

  const generated = validPasses
    .map(passToRoute)
    .filter(Boolean)
    .filter((r) => r?.id && r?.coords);

  let mergedPreview = generated;

  if (fs.existsSync(ROUTES_PATH)) {
    const curatedRaw = readJSON(ROUTES_PATH);
    const curated = Array.isArray(curatedRaw) ? curatedRaw : asArray(curatedRaw);
    mergedPreview = mergeRoutes(curated, generated);
  }

  writeJSON(PREVIEW_PATH, mergedPreview);

  console.log("✅ buildRoutesFromPasses PRO completato");
  console.log("Seed:", path.basename(SOURCE_PATH));
  console.log("Elementi seed:", sourceItems.length);
  console.log("Passi validi:", validPasses.length);
  console.log("Scartati:", rejected);
  console.log("Generati:", generated.length);
  console.log("Preview scritta:", path.basename(PREVIEW_PATH));
  console.log("Totale preview:", mergedPreview.length);
  console.log("");
  console.log("ℹ️ routes.json NON è stato toccato.");
}

main();