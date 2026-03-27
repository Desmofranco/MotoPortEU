// client/scripts/importRoutesEuropeOSM.mjs
// Import itinerari stradali / passi panoramici Europa da OSM (Overpass) PER PAESE
// Versione anti-rate-limit / anti-rumore
//
// Output:
//   client/public/data/routes.json
//   client/public/data/routes.review.json
//
// Avvio:
//   node scripts/importRoutesEuropeOSM.mjs
//
// Consigli:
//   prima prova con pochi paesi:
//   ROUTE_ISO2=IT,FR,CH,AT,DE,ES node scripts/importRoutesEuropeOSM.mjs
//
// Variabili opzionali:
//   ROUTE_ISO2=IT,FR,CH,AT
//   OVERPASS_SPACING_MS=2500
//   OVERPASS_RETRY_TRIES=5
//   OVERPASS_RETRY_BASE_MS=3000
//   COMMONS_ENABLED=0
//   COMMONS_MAX_PHOTOS=120

import fs from "fs";
import path from "path";
import crypto from "crypto";

const OVERPASS_ENDPOINTS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

const DEFAULT_EURO_ISO2 = [
  "IT", "FR", "CH", "AT", "DE", "ES", "PT", "SI", "HR", "RO", "NO", "SE"
];

const ROUTE_ISO2 = String(process.env.ROUTE_ISO2 || "")
  .split(",")
  .map((x) => x.trim().toUpperCase())
  .filter(Boolean);

const EURO_ISO2 = ROUTE_ISO2.length ? ROUTE_ISO2 : DEFAULT_EURO_ISO2;

const COUNTRY_NAMES = {
  IT: "Italy",
  FR: "France",
  DE: "Germany",
  ES: "Spain",
  PT: "Portugal",
  GB: "United Kingdom",
  IE: "Ireland",
  NL: "Netherlands",
  BE: "Belgium",
  LU: "Luxembourg",
  CH: "Switzerland",
  AT: "Austria",
  PL: "Poland",
  CZ: "Czech Republic",
  SK: "Slovakia",
  HU: "Hungary",
  SI: "Slovenia",
  HR: "Croatia",
  BA: "Bosnia and Herzegovina",
  RS: "Serbia",
  ME: "Montenegro",
  AL: "Albania",
  MK: "North Macedonia",
  GR: "Greece",
  BG: "Bulgaria",
  RO: "Romania",
  MD: "Moldova",
  UA: "Ukraine",
  BY: "Belarus",
  LT: "Lithuania",
  LV: "Latvia",
  EE: "Estonia",
  FI: "Finland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  IS: "Iceland",
  TR: "Turkey",
  CY: "Cyprus",
  MT: "Malta",
  AD: "Andorra",
  MC: "Monaco",
  SM: "San Marino",
  LI: "Liechtenstein",
};

const COUNTRY_SPACING_MS = Number(process.env.OVERPASS_SPACING_MS || 2500);
const RETRY_TRIES = Number(process.env.OVERPASS_RETRY_TRIES || 5);
const RETRY_BASE_MS = Number(process.env.OVERPASS_RETRY_BASE_MS || 3000);

const COMMONS_ENABLED = String(process.env.COMMONS_ENABLED || "0") !== "0";
const COMMONS_MAX_PHOTOS = Number(process.env.COMMONS_MAX_PHOTOS || 120);

const OUTPUT_ROUTES = path.join(process.cwd(), "public", "data", "routes.json");
const OUTPUT_REVIEW = path.join(process.cwd(), "public", "data", "routes.review.json");

const ALLOWED_HIGHWAYS = new Set(["trunk", "primary", "secondary", "tertiary"]);
const BAD_SURFACES = [
  "dirt",
  "gravel",
  "ground",
  "sand",
  "mud",
  "earth",
  "soil",
  "grass",
  "fine_gravel",
  "pebblestone",
  "woodchips",
];

const BAD_KEYWORDS = [
  "cross",
  "motocross",
  "enduro",
  "hard enduro",
  "singletrack",
  "single track",
  "mx",
  "offroad",
  "off-road",
  "off road",
  "dirt track",
  "crossodromo",
  "kartodromo",
  "motodromo",
  "autodromo",
  "supermoto",
  "trial",
  "bmx",
  "4x4",
  "quad",
  "raceway",
  "circuit",
  "circuito",
];

const GOOD_SCENIC_KEYWORDS = [
  "pass",
  "passo",
  "col",
  "joch",
  "alp",
  "alpine",
  "panoramic",
  "panoramica",
  "scenic",
  "coastal",
  "corniche",
  "lake",
  "lago",
  "mountain",
  "gorge",
  "canyon",
  "ridge",
  "dolom",
  "napoleon",
  "glockner",
  "stelvio",
  "furka",
  "grimsel",
  "susten",
  "rombo",
  "bonette",
  "galibier",
  "izoard",
  "tourmalet",
  "fagarasan",
  "transalpina",
];

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function norm(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'");
}

function normLc(s) {
  return norm(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
}

function round6(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 1e6) / 1e6;
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function uniqueBy(list, makeKey) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = makeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function inferCountryName(iso2) {
  return COUNTRY_NAMES[iso2] || iso2;
}

function inferRegion(tags = {}) {
  return norm(
    tags["addr:state"] ||
      tags["is_in:state"] ||
      tags["addr:province"] ||
      tags["addr:region"] ||
      tags.region ||
      ""
  );
}

function makeRouteId(name, lat, lng, country, type) {
  const key = `${name}|${lat}|${lng}|${country}|${type}`.toLowerCase();
  return `route-${sha1(key).slice(0, 10)}`;
}

function looksBadSurface(surface) {
  const s = normLc(surface);
  return BAD_SURFACES.some((x) => s.includes(x));
}

function looksBadKeyword(text) {
  const s = normLc(text);
  return BAD_KEYWORDS.some((x) => s.includes(x));
}

function countGoodScenicKeywords(text) {
  const s = normLc(text);
  return GOOD_SCENIC_KEYWORDS.reduce((acc, k) => acc + (s.includes(k) ? 1 : 0), 0);
}

function pickCenter(el) {
  const lat = round6(el.lat ?? el.center?.lat);
  const lng = round6(el.lon ?? el.center?.lon);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function estimateRouteMetrics(tags = {}, type = "touring_route") {
  const ele = toNum(tags.ele, 0);

  if (type === "mountain_pass") {
    return {
      distanceKm: ele > 1800 ? 28 : ele > 1200 ? 22 : 16,
      durationMin: ele > 1800 ? 45 : ele > 1200 ? 35 : 28,
    };
  }

  if (type === "scenic_road") {
    return { distanceKm: 42, durationMin: 55 };
  }

  if (type === "coastal_road") {
    return { distanceKm: 60, durationMin: 75 };
  }

  return { distanceKm: 48, durationMin: 65 };
}

function makeDescription({ name, type, country, region, ele, scenicScore }) {
  const place = [region, country].filter(Boolean).join(", ");

  if (type === "mountain_pass") {
    const parts = [
      `${name} è un valico stradale panoramico`,
      place ? `situato tra ${place}` : "",
      ele ? `con quota intorno a ${ele} m` : "",
      "ideale per guida touring su asfalto e curve di montagna.",
    ].filter(Boolean);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  if (type === "coastal_road") {
    return `${name} è una strada costiera panoramica in ${place || country}, adatta a turismo su strada e percorrenze scenic road.`;
  }

  if (scenicScore >= 2) {
    return `${name} è un itinerario stradale panoramico in ${place || country}, selezionato per rilevanza rider e qualità stradale.`;
  }

  return `${name} è un itinerario stradale pubblico in ${place || country}, compatibile con turismo moto su asfalto.`;
}

function classifyRoadType(tags = {}, nameText = "") {
  const scenic = normLc(tags.scenic);
  const text = normLc(
    [
      nameText,
      tags.name,
      tags.description,
      tags.note,
      tags.ref,
      tags.alt_name,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (tags.mountain_pass === "yes" || /\b(pass|passo|col|joch)\b/.test(text)) {
    return "mountain_pass";
  }
  if (scenic === "yes" && /\b(coast|coastal|corniche|riviera)\b/.test(text)) {
    return "coastal_road";
  }
  if (/\b(coast|coastal|corniche|riviera)\b/.test(text)) {
    return "coastal_road";
  }
  if (scenic === "yes" || countGoodScenicKeywords(text) >= 2) {
    return "scenic_road";
  }
  return "touring_route";
}

async function overpassWithRetry(query, tries = RETRY_TRIES) {
  let lastError = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": "MotoPortEU Routes Importer (contact: support@motoporteu.app)",
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (res.status === 429 || res.status === 504) {
          const wait = RETRY_BASE_MS * (i + 1);
          console.log(`   ⏳ ${endpoint} -> ${res.status}, attendo ${wait}ms e riprovo (${i + 1}/${tries})...`);
          await sleep(wait);
          continue;
        }

        if (!res.ok) {
          throw new Error(`Overpass HTTP ${res.status}`);
        }

        return res.json();
      } catch (err) {
        lastError = err;
        const wait = RETRY_BASE_MS * (i + 1);
        console.log(`   ⏳ ${endpoint} errore, attendo ${wait}ms e riprovo (${i + 1}/${tries})...`);
        await sleep(wait);
      }
    }
  }

  throw lastError || new Error("Overpass retry esauriti");
}
// Query molto più stretta: solo veri mountain_pass con nome
function buildPassQuery(iso2) {
  return `
[out:json][timeout:60][maxsize:134217728];
area["ISO3166-1"="${iso2}"][admin_level=2]->.a;
(
  node["mountain_pass"="yes"]["name"](area.a);
);
out body tags;
`;
}
// Query molto più stretta: solo strade nominate, pubbliche, meglio se scenic/ref
function buildRoadQuery(iso2) {
  return `
[out:json][timeout:120];
area["ISO3166-1"="${iso2}"][admin_level=2]->.a;
(
  way["highway"~"trunk|primary|secondary|tertiary"]["name"]["scenic"="yes"](area.a);
  way["highway"~"trunk|primary|secondary|tertiary"]["name"]["ref"](area.a);
);
out center tags;
`;
}

function scorePass(el, iso2) {
  const tags = el.tags || {};
  const center = pickCenter(el);
  if (!center) return null;

  const name = norm(tags.name);
  if (!name) return null;
  if (looksBadKeyword(name)) return null;

  const ele = toNum(tags.ele, 0);

  let score = 20;
  if (tags.mountain_pass === "yes") score += 20;
  if (ele >= 2500) score += 10;
  else if (ele >= 1800) score += 8;
  else if (ele >= 1200) score += 5;
  score += countGoodScenicKeywords(name) * 3;

  const type = "mountain_pass";
  const metrics = estimateRouteMetrics(tags, type);

  return {
    score,
    type,
    name,
    country: inferCountryName(iso2),
    region: inferRegion(tags),
    surface: "asphalt",
    distanceKm: metrics.distanceKm,
    durationMin: metrics.durationMin,
    coords: center,
    tags: ["mountain", "pass", "public-road", "scenic"],
    description: "",
    photo: "",
    ele: ele || undefined,
    _osm: {
      osmType: el.type,
      osmId: el.id,
      source: "overpass_pass",
    },
  };
}

function scoreRoad(el, iso2) {
  const tags = el.tags || {};
  const center = pickCenter(el);
  if (!center) return null;

  const highway = normLc(tags.highway);
  if (!ALLOWED_HIGHWAYS.has(highway)) return null;

  const name = norm(tags.name);
  if (!name) return null;
  if (looksBadKeyword(name)) return null;

  const longText = [
    tags.name,
    tags.description,
    tags.note,
    tags.alt_name,
    tags.ref,
    tags.surface,
    tags.highway,
    tags.route,
    tags.scenic,
    tags.smoothness,
    tags["mtb:scale"],
  ]
    .filter(Boolean)
    .join(" ");

  if (looksBadKeyword(longText)) return null;

  const surface = normLc(tags.surface);
  if (surface && looksBadSurface(surface)) return null;

  const type = classifyRoadType(tags, name);
  const scenicScore = countGoodScenicKeywords(longText);

  let score = 0;
  score += highway === "primary" ? 4 : 0;
  score += highway === "secondary" ? 5 : 0;
  score += highway === "tertiary" ? 4 : 0;
  score += highway === "trunk" ? 2 : 0;
  score += tags.scenic === "yes" ? 10 : 0;
  score += tags.ref ? 2 : 0;
  score += scenicScore * 3;
  score += surface ? 2 : 1;

  const metrics = estimateRouteMetrics(tags, type);
  const routeTags = ["public-road", "road-trip"];
  if (type === "scenic_road") routeTags.push("scenic");
  if (type === "coastal_road") routeTags.push("coast");
  if (type === "mountain_pass") routeTags.push("mountain", "pass");

  return {
    score,
    type,
    name,
    country: inferCountryName(iso2),
    region: inferRegion(tags),
    surface: norm(tags.surface) || "asphalt",
    distanceKm: metrics.distanceKm,
    durationMin: metrics.durationMin,
    coords: center,
    tags: uniqueBy(routeTags, (x) => x),
    description: "",
    photo: "",
    ele: undefined,
    _osm: {
      osmType: el.type,
      osmId: el.id,
      source: "overpass_road",
    },
  };
}

async function fetchCountry(iso2) {
  await sleep(COUNTRY_SPACING_MS);

  console.log(`   query passes...`);
  const passJson = await overpassWithRetry(buildPassQuery(iso2));

  const passes = (passJson.elements || [])
    .map((el) => scorePass(el, iso2))
    .filter(Boolean);

  // Per ora niente roads nazionali: troppo pesanti e poco affidabili
  const roads = [];

  return { passes, roads };
}
function finalizeRoute(item) {
  const scenicScore = countGoodScenicKeywords(
    [item.name, item.region, item.country, item.type].filter(Boolean).join(" ")
  );

  return {
    id: makeRouteId(item.name, item.coords.lat, item.coords.lng, item.country, item.type),
    name: item.name,
    type: item.type,
    country: item.country,
    region: item.region || "",
    surface: item.surface || "asphalt",
    distanceKm: item.distanceKm,
    durationMin: item.durationMin,
    coords: item.coords,
    tags: uniqueBy(item.tags || [], (x) => x),
    description: makeDescription({
      name: item.name,
      type: item.type,
      country: item.country,
      region: item.region,
      ele: item.ele,
      scenicScore,
    }),
    photo: item.photo || "",
    _osm: item._osm,
  };
}

function dedupeRoutes(list) {
  return uniqueBy(
    list,
    (r) =>
      `${normLc(r.name)}|${round6(r.coords?.lat)}|${round6(r.coords?.lng)}|${normLc(r.country)}|${normLc(r.type)}`
  );
}

function splitByQuality(list) {
  const routes = [];
  const review = [];

  for (const item of list) {
    const minScore = item.type === "mountain_pass" ? 22 : 12;
    if (item.score >= minScore) routes.push(item);
    else review.push(item);
  }

  return { routes, review };
}

async function fetchCommonsPhoto(lat, lng, titleHint = "") {
  try {
    const url = new URL(COMMONS_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("generator", "geosearch");
    url.searchParams.set("ggscoord", `${lat}|${lng}`);
    url.searchParams.set("ggsradius", "10000");
    url.searchParams.set("ggslimit", "8");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url");
    url.searchParams.set("iiurlwidth", "1200");

    const res = await fetch(url);
    if (!res.ok) return "";

    const json = await res.json();
    const pages = Object.values(json?.query?.pages || {});
    if (!pages.length) return "";

    const hint = normLc(titleHint);
    const preferred = pages.find((p) => normLc(p.title).includes(hint)) || pages[0];
    return preferred?.imageinfo?.[0]?.thumburl || preferred?.imageinfo?.[0]?.url || "";
  } catch {
    return "";
  }
}

async function enrichPhotos(list) {
  if (!COMMONS_ENABLED) return list;

  const out = [];
  let done = 0;

  for (const item of list) {
    if (done >= COMMONS_MAX_PHOTOS) {
      out.push(item);
      continue;
    }

    const photo = await fetchCommonsPhoto(item.coords.lat, item.coords.lng, item.name);
    out.push({ ...item, photo });
    done += 1;
    await sleep(150);
  }

  return out;
}

function sortRoutes(a, b) {
  return `${a.country}|${a.type}|${a.name}`.localeCompare(`${b.country}|${b.type}|${b.name}`);
}

async function main() {
  console.log("🌍 Download Overpass itinerari stradali Europa per paese…");
  console.log(`⚙ spacing=${COUNTRY_SPACING_MS}ms | retry=${RETRY_TRIES} | base=${RETRY_BASE_MS}ms`);
  console.log(`📸 Commons enabled=${COMMONS_ENABLED} | max=${COMMONS_MAX_PHOTOS}`);
  console.log(`🗺 paesi=${EURO_ISO2.join(",")}`);

  let allCandidates = [];
  let ok = 0;
  let skipped = 0;

  for (const iso2 of EURO_ISO2) {
    try {
      console.log(`→ ${iso2}…`);
      const { passes, roads } = await fetchCountry(iso2);
      console.log(`   ${iso2}: passes=${passes.length} | roads=${roads.length}`);
      allCandidates = allCandidates.concat(passes, roads);
      ok++;
    } catch (e) {
      console.log(`   ⚠️ ${iso2} saltato (${e.message})`);
      skipped++;
    }
  }

  const deduped = dedupeRoutes(allCandidates);
  const { routes: good, review: lowQuality } = splitByQuality(deduped);

  let finalizedRoutes = good.map(finalizeRoute);
  let finalizedReview = lowQuality.map(finalizeRoute);

  finalizedRoutes = await enrichPhotos(finalizedRoutes);
  finalizedReview = await enrichPhotos(finalizedReview.slice(0, Math.min(120, finalizedReview.length)));

  finalizedRoutes.sort(sortRoutes);
  finalizedReview.sort(sortRoutes);

  fs.writeFileSync(OUTPUT_ROUTES, JSON.stringify(finalizedRoutes, null, 2), "utf-8");
  fs.writeFileSync(OUTPUT_REVIEW, JSON.stringify(finalizedReview, null, 2), "utf-8");

  console.log("====================================");
  console.log("MotoPortEU — Import routes Europe OSM");
  console.log("====================================");
  console.log(`✅ Routes salvate: ${finalizedRoutes.length}`);
  console.log(`🟡 Review salvate: ${finalizedReview.length}`);
  console.log(`📊 Paesi ok: ${ok} | saltati: ${skipped}`);
  console.log("------------------------------------");
  console.log(`Creato: ${OUTPUT_ROUTES}`);
  console.log(`Creato: ${OUTPUT_REVIEW}`);

  if (finalizedRoutes.length) {
    console.log("------------------------------------");
    console.log("Prime routes:");
    finalizedRoutes.slice(0, 15).forEach((r, i) => {
      console.log(
        `${i + 1}. ${r.name} | ${r.country} | ${r.type} | ${r.surface} | photo=${r.photo ? "yes" : "no"}`
      );
    });
  }
}

main().catch((e) => {
  console.error("❌ ERRORE:", e.message);
  process.exit(1);
});