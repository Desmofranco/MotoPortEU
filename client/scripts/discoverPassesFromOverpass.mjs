import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.resolve(ROOT, "client/public/data");
const OUT_PATH = path.resolve(DATA_DIR, "passes.osm.discovery.preview.json");

// ======================================================
// Config
// ======================================================

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const SWISS_ENDPOINT = "https://overpass.osm.ch/api/interpreter";

const COUNTRIES = [
  {
    code: "IT",
    name: "Italy",
    areaQuery: `area["ISO3166-1"="IT"][admin_level=2];`,
  },
  {
    code: "FR",
    name: "France",
    areaQuery: `area["ISO3166-1"="FR"][admin_level=2];`,
  },
  {
    code: "CH",
    name: "Switzerland",
    areaQuery: `area["ISO3166-1"="CH"][admin_level=2];`,
    endpoints: [SWISS_ENDPOINT, ...ENDPOINTS],
  },
  {
    code: "AT",
    name: "Austria",
    areaQuery: `area["ISO3166-1"="AT"][admin_level=2];`,
  },
  {
    code: "DE",
    name: "Germany",
    areaQuery: `area["ISO3166-1"="DE"][admin_level=2];`,
  },
  {
    code: "ES",
    name: "Spain",
    areaQuery: `area["ISO3166-1"="ES"][admin_level=2];`,
  },
  {
    code: "RO",
    name: "Romania",
    areaQuery: `area["ISO3166-1"="RO"][admin_level=2];`,
  },
];

const REQUEST_TIMEOUT_SEC = 90;
const MAX_RETRIES_PER_ENDPOINT = 3;
const BASE_DELAY_MS = 2500;

// ======================================================
// Utils
// ======================================================

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
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

function lowerJoin(...parts) {
  return parts
    .flat()
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
}

// ======================================================
// Filters
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
  "hochalpenstrasse",
  "hochalpenstraße",
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
  "funpark",
];

const BANNED_HIGHWAY_VALUES = [
  "raceway",
  "track",
  "path",
  "bridleway",
  "footway",
  "cycleway",
];

function containsAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

function looksLikeValidDiscoveredPass(item) {
  const text = lowerJoin(
    item?.name,
    item?.description,
    item?.tags?.name,
    item?.tags?.description,
    item?.tags?.note,
    item?.tags?.highway,
    item?.tags?.route,
    item?.tags?.surface,
    item?.tags?.sport,
    item?.tags?.leisure
  );

  if (!item?.coords) return false;
  if (!norm(item?.name)) return false;
  if (containsAny(text, BANNED_WORDS)) return false;

  const highway = String(item?.tags?.highway || "").toLowerCase();
  if (BANNED_HIGHWAY_VALUES.includes(highway)) return false;

  const elevation = toNum(item?.elevation);
  const hasKeyword = containsAny(text, PASS_WORDS);
  const hasElevation = elevation != null && elevation >= 700;

  if (!hasKeyword && !hasElevation) return false;

  return true;
}

// ======================================================
// Overpass helpers
// ======================================================

function buildQuery(country) {
  return `
[out:json][timeout:${REQUEST_TIMEOUT_SEC}];
${country.areaQuery}
->.searchArea;
(
  node["name"](area.searchArea);
  way["name"](area.searchArea);
  relation["name"](area.searchArea);
);
out center tags;
`;
}

async function fetchOverpass(endpoint, query) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain; charset=UTF-8",
      "Accept": "application/json",
    },
    body: query,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${text.slice(0, 180)}`);
  }

  return res.json();
}

async function fetchWithFallback(country, query) {
  const endpoints = country.endpoints || ENDPOINTS;
  let lastErr = null;

  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= MAX_RETRIES_PER_ENDPOINT; attempt++) {
      try {
        console.log(`→ ${country.code} via ${endpoint} (tentativo ${attempt}/${MAX_RETRIES_PER_ENDPOINT})`);
        const json = await fetchOverpass(endpoint, query);
        return { endpoint, json };
      } catch (err) {
        lastErr = err;
        const delay = BASE_DELAY_MS * attempt;
        console.log(`   ⏳ errore ${String(err.message || err).slice(0, 140)} | attendo ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastErr || new Error(`Nessun endpoint disponibile per ${country.code}`);
}

// ======================================================
// OSM normalize
// ======================================================

function getCoords(el) {
  if (toNum(el?.lat) != null && toNum(el?.lon) != null) {
    return {
      lat: Number(Number(el.lat).toFixed(6)),
      lng: Number(Number(el.lon).toFixed(6)),
    };
  }

  if (toNum(el?.center?.lat) != null && toNum(el?.center?.lon) != null) {
    return {
      lat: Number(Number(el.center.lat).toFixed(6)),
      lng: Number(Number(el.center.lon).toFixed(6)),
    };
  }

  return null;
}

function getElevation(tags) {
  return (
    toNum(tags?.ele) ??
    toNum(tags?.elevation) ??
    toNum(tags?.altitude) ??
    toNum(tags?.alt) ??
    null
  );
}

function inferCurvesScore(tags, elevation, name) {
  const highway = String(tags?.highway || "").toLowerCase();
  const mountain = containsAny(name, ["joch", "stelvio", "gavia", "galibier", "furka", "gottardo", "izoard"]);
  const el = Number(elevation || 0) || 0;

  let score = 6;
  if (el >= 2200) score = 8;
  if (el >= 2500) score = 9;
  if (mountain) score = Math.max(score, 8);
  if (highway === "tertiary" || highway === "secondary") score += 0.5;

  return Math.min(10, Math.round(score));
}

function normalizeElement(el, countryCode, sourceEndpoint) {
  const tags = el?.tags || {};
  const name = norm(tags?.name || "");
  const coords = getCoords(el);

  if (!name || !coords) return null;

  const elevation = getElevation(tags);
  const region = norm(
    tags?.addr_state ||
      tags?.state ||
      tags?.province ||
      tags?.is_in_state ||
      tags?.is_in_region ||
      tags?.region ||
      ""
  );

  const item = {
    name,
    country: countryCode,
    region,
    lat: coords.lat,
    lng: coords.lng,
    elevation: elevation ?? undefined,
    curvesScore: inferCurvesScore(tags, elevation, name),
    source: "overpass_discovery",
    _osmType: el?.type,
    _osmId: el?.id,
    _endpoint: sourceEndpoint,
    tags,
    coords,
  };

  return looksLikeValidDiscoveredPass(item)
    ? {
        name: item.name,
        country: item.country,
        region: item.region,
        lat: item.lat,
        lng: item.lng,
        elevation: item.elevation,
        curvesScore: item.curvesScore,
        _source: item.source,
        _osmType: item._osmType,
        _osmId: item._osmId,
        _endpoint: item._endpoint,
      }
    : null;
}

function seedKey(item) {
  const name = slugify(item?.name || "");
  const country = norm(item?.country || "").toUpperCase();
  const lat = Number(item?.lat || 0).toFixed(3);
  const lng = Number(item?.lng || 0).toFixed(3);
  return `${name}:${country}:${lat}:${lng}`;
}

// ======================================================
// Main
// ======================================================

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error("❌ DATA_DIR non trovata:", DATA_DIR);
    process.exit(1);
  }

  const all = [];
  const stats = [];

  for (const country of COUNTRIES) {
    const query = buildQuery(country);

    try {
      const { endpoint, json } = await fetchWithFallback(country, query);
      const elements = Array.isArray(json?.elements) ? json.elements : [];

      const normalized = uniqueBy(
        elements
          .map((el) => normalizeElement(el, country.code, endpoint))
          .filter(Boolean),
        seedKey
      );

      all.push(...normalized);

      stats.push({
        code: country.code,
        endpoint,
        raw: elements.length,
        valid: normalized.length,
      });

      console.log(`   ${country.code}: raw=${elements.length} | validi=${normalized.length}`);
      await sleep(1500);
    } catch (err) {
      stats.push({
        code: country.code,
        endpoint: null,
        raw: 0,
        valid: 0,
        error: String(err.message || err),
      });
      console.log(`   ${country.code}: ❌ ${String(err.message || err).slice(0, 180)}`);
    }
  }

  const dedup = uniqueBy(all, seedKey).sort((a, b) => {
    if ((a.country || "") !== (b.country || "")) {
      return String(a.country || "").localeCompare(String(b.country || ""));
    }
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  writeJSON(OUT_PATH, dedup);

  console.log("");
  console.log("✅ discoverPassesFromOverpass completato");
  console.log("Paesi processati:", COUNTRIES.length);
  console.log("Passi trovati deduplicati:", dedup.length);
  console.log("Output:", path.basename(OUT_PATH));
  console.log("");

  console.log("Breakdown:");
  for (const s of stats) {
    if (s.error) {
      console.log(`- ${s.code}: errore | ${s.error}`);
    } else {
      console.log(`- ${s.code}: ${s.valid}/${s.raw} via ${s.endpoint}`);
    }
  }
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});