// =======================================================
// server/scripts/googleRiderSpotsDiscovery.js
// MotoPortEU — Rider Spots Discovery by Country / Scope
//
// Scopo:
// Generare un dataset pulito di rider spots reali
// usando Google Places API, filtrato per paese / sotto-area.
//
// Output esempio:
//   client/public/data/rider-spots.cleaned.google.IT.italy-nw.json
//
// Requisiti:
//   GOOGLE_PLACES_KEY=...
//
// Avvio:
//   node server/scripts/googleRiderSpotsDiscovery.js --country=IT --scope=italy-nw
//   node server/scripts/googleRiderSpotsDiscovery.js --country=IT --scope=sicily
//   node server/scripts/googleRiderSpotsDiscovery.js --country=IT
// =======================================================

import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import process from "process";
import {
  parseCliArgs,
  getScopeConfig,
  getScopeSuffix,
} from "./lib/routeScopes.js";

dotenv.config({ path: path.resolve("server/.env") });

const API_KEY = String(process.env.GOOGLE_PLACES_KEY || "").trim();

if (!API_KEY) {
  console.error("❌ GOOGLE_PLACES_KEY mancante in server/.env");
  process.exit(1);
}

const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// -------------------------------------------------------
// CLI / SCOPE
// -------------------------------------------------------

const args = parseCliArgs();
const country = String(args.country || "IT").toUpperCase();
const scope = args.scope ? String(args.scope) : null;

const scopeCfg = getScopeConfig({ country, scope });
const scopeSuffix = getScopeSuffix({ country, scope });

const OUT_FILE = path.resolve(
  `client/public/data/rider-spots.cleaned.google.${scopeSuffix}.json`
);

// -------------------------------------------------------
// CONFIG
// -------------------------------------------------------

const SEARCH_GROUPS = [
  {
    family: "mountain",
    rideType: "mountain",
    tags: ["mountain", "scenic", "rider"],
    terms: [
      "mountain pass",
      "alp pass",
      "famous mountain pass",
      "motorcycle mountain road",
      "scenic mountain road",
      "passo di montagna",
      "passo alpino",
      "strada panoramica di montagna",
      "col de montagne",
      "col alpin",
      "route de col",
      "puerto de montaña",
      "puerto de montaña moto",
      "bergpas",
      "joch scenic road",
    ],
  },
  {
    family: "coastal",
    rideType: "coastal",
    tags: ["coast", "sea", "scenic", "rider"],
    terms: [
      "coastal road viewpoint",
      "sea view road",
      "scenic coastal drive",
      "cliff road viewpoint",
      "coastal scenic road",
      "strada panoramica sul mare",
      "strada costiera panoramica",
      "route cotiere panoramique",
      "ruta costera panoramica",
      "coastal motorcycle road",
    ],
  },
  {
    family: "lake",
    rideType: "lake",
    tags: ["lake", "scenic", "rider"],
    terms: [
      "lake scenic road",
      "lake viewpoint",
      "road by lake",
      "panoramic lake road",
      "strada panoramica lago",
      "strada sul lago",
      "route panoramique lac",
      "ruta panoramica lago",
      "motorcycle lake road",
    ],
  },
  {
    family: "scenic",
    rideType: "scenic",
    tags: ["scenic", "panoramic", "rider"],
    terms: [
      "scenic road",
      "panoramic road",
      "viewpoint road",
      "winding road scenic",
      "motorcycle scenic road",
      "strada panoramica",
      "strada tortuosa panoramica",
      "route panoramique",
      "ruta panoramica",
      "road with viewpoint",
    ],
  },
  {
    family: "forest",
    rideType: "forest",
    tags: ["forest", "scenic", "rider"],
    terms: [
      "forest scenic road",
      "road through forest",
      "motorcycle forest road viewpoint",
      "strada panoramica nel bosco",
      "route forestiere panoramique",
      "ruta bosque panoramica",
    ],
  },
  {
    family: "fjord",
    rideType: "fjord",
    tags: ["fjord", "sea", "scenic", "rider"],
    terms: [
      "fjord scenic road",
      "fjord viewpoint road",
      "motorcycle fjord road",
      "strada panoramica fiordo",
      "route fjord panoramique",
      "ruta fiordo panoramica",
    ],
  },
];

// Aree dinamiche lette dal file routeScopes.js
const DISCOVERY_AREAS = scopeCfg.areas.map((area) => {
  const profile = inferProfileFromArea(area);
  return {
    ...area,
    country,
    profile,
  };
});

// -------------------------------------------------------
// UTILS
// -------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function baseNameKey(name) {
  return normalizeText(name)
    .replace(
      /\b(pass|passo|col|puerto|bergpas|mountain|alp|joch|coast|coastal|lake|road|scenic|viewpoint|panoramic)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function inferProfileFromArea(area) {
  const name = normalizeText(area?.name || "");

  const profile = new Set(["scenic"]);

  if (
    name.includes("alpi") ||
    name.includes("dolomiti") ||
    name.includes("gran sasso") ||
    name.includes("majella") ||
    name.includes("sibillini") ||
    name.includes("supramonte") ||
    name.includes("etna") ||
    name.includes("nebrodi") ||
    name.includes("madonie") ||
    name.includes("pollino") ||
    name.includes("sila") ||
    name.includes("aspromonte") ||
    name.includes("barbagia") ||
    name.includes("terminillo") ||
    name.includes("monte bianco") ||
    name.includes("carnia") ||
    name.includes("apuane")
  ) {
    profile.add("mountain");
  }

  if (
    name.includes("lago") ||
    name.includes("laghi") ||
    name.includes("garda") ||
    name.includes("como") ||
    name.includes("maggiore")
  ) {
    profile.add("lake");
  }

  if (
    name.includes("costa") ||
    name.includes("costiera") ||
    name.includes("coast") ||
    name.includes("liguria") ||
    name.includes("amalfitana") ||
    name.includes("cilento") ||
    name.includes("gargano") ||
    name.includes("gallura") ||
    name.includes("alghero") ||
    name.includes("bosa") ||
    name.includes("trapani") ||
    name.includes("palermo")
  ) {
    profile.add("coastal");
  }

  if (
    name.includes("appennino") ||
    name.includes("chianti") ||
    name.includes("crete") ||
    name.includes("orcia") ||
    name.includes("amiata") ||
    name.includes("irpinia") ||
    name.includes("sannio") ||
    name.includes("murge") ||
    name.includes("itria")
  ) {
    profile.add("hill");
  }

  if (
    name.includes("foreste") ||
    name.includes("casentino") ||
    name.includes("bosco") ||
    name.includes("forest") ||
    name.includes("garfagnana")
  ) {
    profile.add("forest");
  }

  return Array.from(profile);
}

function inferType(name = "", address = "", family = "", types = []) {
  const s = normalizeText(`${name} ${address}`);
  const t = Array.isArray(types) ? types.join(" ").toLowerCase() : "";

  if (
    family === "mountain" ||
    s.includes("passo") ||
    s.includes("mountain pass") ||
    s.includes(" col ") ||
    s.startsWith("col ") ||
    s.includes("puerto") ||
    s.includes("joch") ||
    s.includes("bergpas")
  ) {
    return "mountain_pass";
  }

  if (
    family === "coastal" &&
    (s.includes("coast") ||
      s.includes("sea") ||
      s.includes("mare") ||
      s.includes("coastal") ||
      s.includes("cliff"))
  ) {
    return s.includes("cliff") ? "cliff_road" : "coastal_view";
  }

  if (
    family === "lake" ||
    s.includes("lake") ||
    s.includes("lago") ||
    s.includes("lac")
  ) {
    return "lake_view";
  }

  if (family === "fjord" || s.includes("fjord") || s.includes("fiordo")) {
    return "fjord_view";
  }

  if (family === "forest" || s.includes("forest") || s.includes("bosco")) {
    return "forest_road";
  }

  if (s.includes("hill") || s.includes("collina") || s.includes("colline")) {
    return "hill_road";
  }

  if (
    t.includes("route") ||
    t.includes("road") ||
    s.includes("road") ||
    s.includes("strada") ||
    s.includes("route") ||
    s.includes("ruta")
  ) {
    return "scenic_road";
  }

  return "scenic_road";
}

function buildTypeTags(type, familyTags = []) {
  const extra = {
    mountain_pass: ["mountain", "twisty", "panoramic"],
    coastal_view: ["coast", "sea", "panoramic"],
    lake_view: ["lake", "panoramic"],
    scenic_road: ["scenic", "panoramic"],
    hill_road: ["hill", "twisty"],
    fjord_view: ["fjord", "sea", "panoramic"],
    cliff_road: ["cliff", "coast", "panoramic"],
    forest_road: ["forest", "scenic"],
  };

  return Array.from(new Set([...(familyTags || []), ...(extra[type] || [])]));
}

function looksRelevantSpot(name = "", address = "", family = "", types = []) {
  const s = normalizeText(`${name} ${address}`);
  const t = Array.isArray(types) ? types.join(" ").toLowerCase() : "";

  const negative = [
    "hotel",
    "restaurant",
    "ristorante",
    "bar",
    "cafe",
    "museo",
    "museum",
    "parking",
    "parcheggio",
    "camping",
    "lodging",
    "gas station",
    "fuel",
    "dealer",
    "rental",
    "shop",
    "market",
    "supermarket",
    "autogrill",
    "resort",
    "beach club",
  ];

  if (negative.some((k) => s.includes(k))) return false;

  const commonRoad = [
    "road",
    "route",
    "drive",
    "viewpoint",
    "panoramic",
    "scenic",
    "strada",
    "ruta",
    "belvedere",
    "vista",
    "lookout",
  ];

  const familySignals = {
    mountain: [
      "pass",
      "passo",
      "col",
      "puerto",
      "joch",
      "bergpas",
      "mountain",
      "alp",
      "summit road",
      "mountain road",
    ],
    coastal: [
      "coast",
      "coastal",
      "sea",
      "mare",
      "cliff",
      "seaside",
      "ocean",
      "costiera",
      "corniche",
    ],
    lake: ["lake", "lago", "lac", "shore road", "lake road"],
    scenic: ["scenic", "panoramic", "viewpoint", "winding", "twisty", ...commonRoad],
    forest: ["forest", "woods", "bosco", "foresta", "scenic", ...commonRoad],
    fjord: ["fjord", "fiordo", "scenic", "viewpoint", ...commonRoad],
  };

  const signals = familySignals[family] || commonRoad;
  const hasSignal = signals.some((k) => s.includes(k));
  const typeSignal =
    t.includes("point_of_interest") ||
    t.includes("tourist_attraction") ||
    t.includes("natural_feature") ||
    t.includes("establishment");

  return hasSignal && typeSignal;
}

function scoreSpot(item) {
  const s = normalizeText(`${item.name} ${item.address}`);
  let score = 0;

  const keywordBoosts = [
    ["passo", 24],
    ["mountain pass", 24],
    [" col ", 20],
    ["puerto", 18],
    ["joch", 18],
    ["coast", 18],
    ["coastal", 18],
    ["sea", 12],
    ["mare", 12],
    ["lake", 18],
    ["lago", 18],
    ["lac", 16],
    ["fjord", 20],
    ["fiordo", 20],
    ["scenic", 12],
    ["panoramic", 12],
    ["viewpoint", 10],
    ["belvedere", 10],
    ["road", 8],
    ["strada", 8],
  ];

  for (const [kw, pts] of keywordBoosts) {
    if (s.includes(kw)) score += pts;
  }

  const rating = toNum(item.rating);
  if (rating != null) {
    if (rating >= 4.7) score += 15;
    else if (rating >= 4.4) score += 10;
    else if (rating >= 4.0) score += 5;
  }

  const count = toNum(item.userRatingCount);
  if (count != null) {
    if (count >= 1000) score += 15;
    else if (count >= 200) score += 10;
    else if (count >= 30) score += 5;
  }

  if (Array.isArray(item.types)) {
    if (item.types.includes("natural_feature")) score += 8;
    if (item.types.includes("tourist_attraction")) score += 6;
    if (item.types.includes("point_of_interest")) score += 4;
  }

  return score;
}

// -------------------------------------------------------
// GOOGLE SEARCH
// -------------------------------------------------------

async function googleTextSearch({ textQuery, area, pageToken = null }) {
  const body = {
    textQuery,
    pageSize: 20,
    languageCode: "en",
    locationBias: {
      circle: {
        center: {
          latitude: area.lat,
          longitude: area.lng,
        },
        radius: area.radius,
      },
    },
  };

  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(GOOGLE_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,nextPageToken",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} ${txt.slice(0, 250)}`);
  }

  return res.json();
}

function mapPlace(place, area, group) {
  const name = place?.displayName?.text || "";
  const lat = toNum(place?.location?.latitude);
  const lng = toNum(place?.location?.longitude);
  const types = Array.isArray(place.types) ? place.types : [];
  const address = place.formattedAddress || null;
  const spotType = inferType(name, address, group.family, types);

  return {
    id: `spot-${slugify(name)}-${String(place.id || "").slice(0, 8)}`,
    googlePlaceId: place.id || null,
    name,
    slug: slugify(name),
    type: spotType,
    rideType: group.rideType || "scenic",
    country: area.country || country,
    scope: scope || "all",
    scopeName: scopeCfg.scopeName,
    lat,
    lng,
    regionHint: area.name,
    address,
    rating: toNum(place.rating),
    userRatingCount: toNum(place.userRatingCount),
    types,
    source: "google_places",
    tags: buildTypeTags(spotType, group.tags),
    family: group.family,
  };
}

// -------------------------------------------------------
// DEDUPE
// -------------------------------------------------------

function dedupeSpots(items) {
  const out = [];

  for (const item of items) {
    if (!item.name || item.lat == null || item.lng == null) continue;

    let merged = false;
    const key = baseNameKey(item.name);

    for (const ex of out) {
      const sameKey = baseNameKey(ex.name) === key;
      const close = haversineKm(item.lat, item.lng, ex.lat, ex.lng) <= 8;

      if (sameKey && close) {
        if ((item.score || 0) > (ex.score || 0)) {
          ex.name = item.name;
          ex.slug = item.slug;
          ex.address = item.address;
          ex.rating = item.rating;
          ex.userRatingCount = item.userRatingCount;
          ex.types = item.types;
          ex.score = item.score;
          ex.googlePlaceId = item.googlePlaceId;
          ex.type = item.type;
          ex.rideType = item.rideType;
          ex.country = item.country || ex.country;
          ex.scope = item.scope || ex.scope;
          ex.scopeName = item.scopeName || ex.scopeName;
          ex.regionHint = item.regionHint || ex.regionHint;
          ex.tags = Array.from(new Set([...(ex.tags || []), ...(item.tags || [])]));
        } else {
          ex.tags = Array.from(new Set([...(ex.tags || []), ...(item.tags || [])]));
        }

        ex.aliases = Array.from(new Set([...(ex.aliases || []), item.name]));
        merged = true;
        break;
      }
    }

    if (!merged) {
      out.push({
        ...item,
        aliases: [item.name],
      });
    }
  }

  return out;
}

// -------------------------------------------------------
// AREA RUNNER
// -------------------------------------------------------

function getGroupsForArea(area) {
  const profiles = Array.isArray(area.profile) ? area.profile : [];

  return SEARCH_GROUPS.filter((g) => {
    if (profiles.includes("mountain") && g.family === "mountain") return true;
    if (profiles.includes("coastal") && g.family === "coastal") return true;
    if (profiles.includes("lake") && g.family === "lake") return true;
    if (profiles.includes("forest") && g.family === "forest") return true;
    if (profiles.includes("fjord") && g.family === "fjord") return true;
    if (profiles.includes("hill") && g.family === "scenic") return true;
    if (profiles.includes("scenic") && g.family === "scenic") return true;
    return false;
  });
}

async function runArea(area) {
  const found = [];
  const groups = getGroupsForArea(area);

  console.log(`\n🌍 Area: ${area.name}`);

  for (const group of groups) {
    console.log(`   📂 family: ${group.family}`);

    for (const term of group.terms) {
      let pageToken = null;
      let pages = 0;

      console.log(`      → query: ${term}`);

      while (pages < 3) {
        try {
          const json = await googleTextSearch({
            textQuery: term,
            area,
            pageToken,
          });

          const places = Array.isArray(json.places) ? json.places : [];

          for (const place of places) {
            const item = mapPlace(place, area, group);
            if (!item.name || item.lat == null || item.lng == null) continue;

            const dist = haversineKm(area.lat, area.lng, item.lat, item.lng);
            if (dist > area.radius / 1000 + 15) continue;

            if (!looksRelevantSpot(item.name, item.address, group.family, item.types)) {
              continue;
            }

            item.score = scoreSpot(item);
            found.push(item);
          }

          pageToken = json.nextPageToken || null;
          pages += 1;

          if (!pageToken) break;
          await sleep(1800);
        } catch (err) {
          console.warn(`      ⚠️ ${term}: ${err.message}`);
          break;
        }

        await sleep(250);
      }
    }
  }

  console.log(`   ✅ candidati area: ${found.length}`);
  return found;
}

// -------------------------------------------------------
// MAIN
// -------------------------------------------------------

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Rider Spots Discovery");
  console.log("====================================");
  console.log(`🌍 Country: ${scopeCfg.countryName} (${country})`);
  console.log(`🧭 Scope: ${scopeCfg.scopeName}`);
  console.log(`📍 Aree da processare: ${DISCOVERY_AREAS.length}`);
  console.log(`💾 Output: ${OUT_FILE}`);

  const raw = [];

  for (const area of DISCOVERY_AREAS) {
    const areaItems = await runArea(area);
    raw.push(...areaItems);
    await sleep(350);
  }

  const deduped = dedupeSpots(raw)
    .filter((x) => (x.score || 0) >= 28)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name));

  const cleaned = deduped.map((x, i) => ({
    id: x.id || `spot-${i + 1}`,
    name: x.name,
    slug: x.slug || slugify(x.name),
    type: x.type || "scenic_road",
    rideType: x.rideType || "scenic",
    country: x.country || country,
    scope: x.scope || scope || "all",
    scopeName: x.scopeName || scopeCfg.scopeName,
    lat: Number(x.lat),
    lng: Number(x.lng),
    regionHint: x.regionHint || null,
    address: x.address || null,
    rating: x.rating ?? null,
    userRatingCount: x.userRatingCount ?? null,
    types: x.types || [],
    source: "google_places",
    tags: Array.from(new Set(x.tags || [])),
    aliases: Array.from(new Set(x.aliases || [x.name])),
    score: x.score || 0,
  }));

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(cleaned, null, 2), "utf8");

  const byRideType = cleaned.reduce((acc, item) => {
    acc[item.rideType] = (acc[item.rideType] || 0) + 1;
    return acc;
  }, {});

  console.log("\n------------------------------------");
  console.log(`Raw candidates: ${raw.length}`);
  console.log(`Cleaned rider spots: ${cleaned.length}`);
  console.log("Distribuzione rideType:", byRideType);
  console.log(`Creato: ${OUT_FILE}`);
  console.log("------------------------------------");
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});