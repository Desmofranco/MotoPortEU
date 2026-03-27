import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.resolve(ROOT, "client/public/data");
const ARCHIVE_DIR = path.resolve(DATA_DIR, "_archive");

const SEED_PATH = path.resolve(DATA_DIR, "passes.eu.seed.json");
const PREVIEW_PATH = path.resolve(DATA_DIR, "passes.eu.seed.expanded.preview.json");

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

function asArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.passes)) return maybe.passes;
  if (Array.isArray(maybe?.items)) return maybe.items;
  if (Array.isArray(maybe?.data)) return maybe.data;
  if (Array.isArray(maybe?.routes)) return maybe.routes;
  if (Array.isArray(maybe?.tracks)) return maybe.tracks;
  if (Array.isArray(maybe?.features)) return maybe.features;
  return [];
}

function pickLatLng(x) {
  const lat =
    x?.lat ??
    x?.latitude ??
    x?.coords?.lat ??
    x?.location?.lat ??
    x?.center?.lat ??
    x?.properties?.lat;

  const lng =
    x?.lng ??
    x?.lon ??
    x?.longitude ??
    x?.coords?.lng ??
    x?.coords?.lon ??
    x?.location?.lng ??
    x?.location?.lon ??
    x?.center?.lng ??
    x?.center?.lon ??
    x?.properties?.lng ??
    x?.properties?.lon;

  if (lat != null && lng != null) {
    const a = Number(lat);
    const b = Number(lng);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180) {
      return { lat: a, lng: b };
    }
  }

  // GeoJSON Point
  const geo = x?.geometry;
  if (geo?.type === "Point" && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) {
    const [lon, lat] = geo.coordinates;
    const a = Number(lat);
    const b = Number(lon);
    if (Number.isFinite(a) && Number.isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180) {
      return { lat: a, lng: b };
    }
  }

  return null;
}

function normalizeCountry(raw) {
  const s = norm(raw).toUpperCase();
  const m = s.match(/\b[A-Z]{2}\b/);
  if (m) return m[0];

  const map = {
    italy: "IT",
    italia: "IT",
    france: "FR",
    francia: "FR",
    switzerland: "CH",
    svizzera: "CH",
    suisse: "CH",
    schweiz: "CH",
    austria: "AT",
    germany: "DE",
    germania: "DE",
    spain: "ES",
    spagna: "ES",
    romania: "RO",
    slovenia: "SI",
    croatia: "HR",
    croazia: "HR",
  };

  const k = s.toLowerCase();
  return map[k] || s.slice(0, 2) || "";
}

function uniqueBy(arr, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// ======================================================
// Pass filters
// ======================================================
const PASS_WORDS = [
  "pass",
  "passo",
  "col",
  "joch",
  "puerto",
  "forca",
  "forcella",
  "sella",
  "colle",
  "bergpass",
  "passhöhe",
  "mountain pass",
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
  "ski",
  "snowpark",
];

const BANNED_SURFACES = [
  "dirt",
  "gravel",
  "mud",
  "sand",
  "earth",
  "unpaved",
  "trail",
];

function containsAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

function getName(item) {
  return norm(
    item?.name ||
      item?.title ||
      item?.pass ||
      item?.col ||
      item?.saddle ||
      item?.properties?.name ||
      item?.properties?.title ||
      item?.properties?.pass ||
      ""
  );
}

function getRegion(item) {
  return norm(
    item?.region ||
      item?.area ||
      item?.state ||
      item?.province ||
      item?.properties?.region ||
      item?.properties?.area ||
      item?.properties?.state ||
      item?.properties?.province ||
      ""
  );
}

function getCountry(item) {
  return normalizeCountry(
    item?.country ||
      item?.nation ||
      item?.iso ||
      item?.properties?.country ||
      item?.properties?.nation ||
      item?.properties?.iso ||
      ""
  );
}

function getElevation(item) {
  return (
    toNum(item?.elevation) ??
    toNum(item?.ele) ??
    toNum(item?.altitude) ??
    toNum(item?.alt) ??
    toNum(item?.meters) ??
    toNum(item?.height) ??
    toNum(item?.properties?.elevation) ??
    toNum(item?.properties?.ele) ??
    toNum(item?.properties?.altitude) ??
    null
  );
}

function getCurvesScore(item) {
  return (
    toNum(item?.curvesScore) ??
    toNum(item?.curves) ??
    toNum(item?.twists) ??
    toNum(item?.properties?.curvesScore) ??
    toNum(item?.properties?.curves) ??
    0
  );
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
    item?.classification,
    item?.properties?.name,
    item?.properties?.title,
    item?.properties?.description,
    item?.properties?.type,
    item?.properties?.category,
    item?.properties?.kind,
    item?.properties?.surface
  );

  if (containsAny(text, BANNED_WORDS)) return true;
  if (containsAny(text, BANNED_SURFACES)) return true;
  return false;
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
    item?.classification,
    item?.properties?.name,
    item?.properties?.title,
    item?.properties?.pass
  );

  const elevation = getElevation(item);
  const hasKeyword = containsAny(text, PASS_WORDS);
  const hasElevation = elevation != null && elevation >= 700;

  return hasKeyword || hasElevation;
}

function looksLikePassItem(item) {
  if (!item || typeof item !== "object") return false;
  const coords = pickLatLng(item);
  if (!coords) return false;

  const name = getName(item);
  if (!name) return false;

  if (isClearlyBad(item)) return false;
  if (!hasPassSignal(item)) return false;

  return true;
}

// ======================================================
// File walking
// ======================================================
function walkJsonFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJsonFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      out.push(full);
    }
  }
  return out;
}

// ======================================================
// Normalize archive item to seed item
// ======================================================
function normalizeArchivePass(item, sourceFile) {
  const name = getName(item);
  const coords = pickLatLng(item);
  if (!name || !coords) return null;

  const country = getCountry(item);
  const region = getRegion(item);
  const elevation = getElevation(item);
  const curvesScore = getCurvesScore(item);

  if (elevation != null && elevation < 700) return null;

  return {
    name,
    country,
    region,
    lat: Number(coords.lat.toFixed(6)),
    lng: Number(coords.lng.toFixed(6)),
    elevation: elevation ?? undefined,
    curvesScore: curvesScore || undefined,
    _sourceFile: path.basename(sourceFile),
  };
}

function seedKey(item) {
  const name = slugify(item?.name || "");
  const country = normalizeCountry(item?.country || "");
  const lat = Number(item?.lat || 0).toFixed(3);
  const lng = Number(item?.lng || 0).toFixed(3);
  return `${name}:${country}:${lat}:${lng}`;
}

function mergeSeed(existingSeed, foundSeed) {
  const merged = [];
  const seen = new Set();

  for (const item of [...existingSeed, ...foundSeed]) {
    const key = seedKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.sort((a, b) => {
    const ca = String(a.country || "");
    const cb = String(b.country || "");
    if (ca !== cb) return ca.localeCompare(cb);
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

// ======================================================
// Main
// ======================================================
function main() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error("❌ Seed non trovato:", SEED_PATH);
    process.exit(1);
  }

  if (!fs.existsSync(ARCHIVE_DIR)) {
    console.error("❌ Cartella _archive non trovata:", ARCHIVE_DIR);
    process.exit(1);
  }

  const seedRaw = readJSON(SEED_PATH);
  const currentSeed = asArray(seedRaw);

  const jsonFiles = walkJsonFiles(ARCHIVE_DIR);
  if (!jsonFiles.length) {
    console.error("❌ Nessun file JSON trovato in _archive.");
    process.exit(1);
  }

  const extracted = [];
  const stats = [];

  for (const filePath of jsonFiles) {
    try {
      const raw = readJSON(filePath);
      const arr = asArray(raw);

      if (!arr.length) {
        stats.push({ file: path.basename(filePath), total: 0, valid: 0 });
        continue;
      }

      let valid = 0;

      for (const item of arr) {
        if (!looksLikePassItem(item)) continue;
        const normalized = normalizeArchivePass(item, filePath);
        if (!normalized) continue;
        extracted.push(normalized);
        valid++;
      }

      stats.push({
        file: path.basename(filePath),
        total: arr.length,
        valid,
      });
    } catch (err) {
      stats.push({
        file: path.basename(filePath),
        total: 0,
        valid: 0,
        error: err.message,
      });
    }
  }

  const dedupExtracted = uniqueBy(extracted, seedKey);

  const currentKeys = new Set(currentSeed.map(seedKey));
  const newOnly = dedupExtracted.filter((item) => !currentKeys.has(seedKey(item)));

  const mergedPreview = mergeSeed(currentSeed, newOnly);

  writeJSON(PREVIEW_PATH, mergedPreview);

  const bestFiles = stats
    .filter((x) => x.valid > 0)
    .sort((a, b) => b.valid - a.valid)
    .slice(0, 10);

  console.log("✅ expandPassSeedFromArchive completato");
  console.log("Seed attuale:", currentSeed.length);
  console.log("File JSON letti:", jsonFiles.length);
  console.log("Passi estratti lordi:", extracted.length);
  console.log("Passi estratti deduplicati:", dedupExtracted.length);
  console.log("Nuovi passi trovati:", newOnly.length);
  console.log("Preview seed scritta:", path.basename(PREVIEW_PATH));
  console.log("Totale preview seed:", mergedPreview.length);
  console.log("");

  if (bestFiles.length) {
    console.log("Top file utili:");
    for (const item of bestFiles) {
      console.log(`- ${item.file}: validi ${item.valid}/${item.total}`);
    }
  } else {
    console.log("ℹ️ Nessun file utile trovato in _archive.");
  }
}

main();