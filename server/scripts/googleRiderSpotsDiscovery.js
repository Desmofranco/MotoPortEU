// =======================================================
// server/scripts/googleRiderSpotsDiscovery.js
// MotoPortEU — European Rider Spots Discovery
//
// Scopo:
// Generare un dataset europeo pulito di rider spots reali
// usando Google Places API.
//
// Output:
//   client/public/data/rider-spots.cleaned.google.json
//
// Tipi supportati:
// - mountain_pass
// - coastal_view
// - lake_view
// - scenic_road
// - hill_road
// - fjord_view
// - cliff_road
// - forest_road
//
// Requisiti:
//   GOOGLE_PLACES_KEY=...
//
// Avvio:
//   node server/scripts/googleRiderSpotsDiscovery.js
// =======================================================

import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import process from "process";

dotenv.config({ path: path.resolve("server/.env") });

const API_KEY = String(process.env.GOOGLE_PLACES_KEY || "").trim();

if (!API_KEY) {
  console.error("❌ GOOGLE_PLACES_KEY mancante in server/.env");
  process.exit(1);
}

const GOOGLE_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const OUT_FILE = path.resolve("client/public/data/rider-spots.cleaned.google.json");

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

const EUROPE_AREAS = [
  // Italia
  { name: "IT-Alpi-Ovest", lat: 45.95, lng: 7.15, radius: 50000, country: "IT", profile: ["mountain"] },
  { name: "IT-Alpi-Centro", lat: 46.35, lng: 10.30, radius: 50000, country: "IT", profile: ["mountain", "lake"] },
  { name: "IT-Alpi-Est", lat: 46.55, lng: 12.25, radius: 50000, country: "IT", profile: ["mountain"] },
  { name: "IT-Lago-Garda", lat: 45.65, lng: 10.62, radius: 50000, country: "IT", profile: ["lake", "scenic"] },
  { name: "IT-Lago-Como", lat: 46.00, lng: 9.26, radius: 50000, country: "IT", profile: ["lake", "scenic"] },
  { name: "IT-Liguria", lat: 44.20, lng: 8.40, radius: 50000, country: "IT", profile: ["coastal", "scenic"] },
  { name: "IT-Costiera-Amalfi", lat: 40.63, lng: 14.60, radius: 50000, country: "IT", profile: ["coastal", "scenic"] },
  { name: "IT-Appennino-Nord", lat: 44.20, lng: 10.20, radius: 50000, country: "IT", profile: ["mountain", "hill", "forest", "scenic"] },
  { name: "IT-Appennino-Centro", lat: 42.60, lng: 13.30, radius: 50000, country: "IT", profile: ["mountain", "hill", "forest", "scenic"] },

  // Francia
  { name: "FR-Alpes-Nord", lat: 45.90, lng: 6.85, radius: 50000, country: "FR", profile: ["mountain"] },
  { name: "FR-Alpes-Sud", lat: 44.70, lng: 6.40, radius: 50000, country: "FR", profile: ["mountain"] },
  { name: "FR-Pyrenees-Est", lat: 42.60, lng: 2.10, radius: 50000, country: "FR", profile: ["mountain", "scenic"] },
  { name: "FR-Pyrenees-Centre", lat: 42.85, lng: 0.25, radius: 50000, country: "FR", profile: ["mountain"] },
  { name: "FR-Pyrenees-Ouest", lat: 43.00, lng: -0.65, radius: 50000, country: "FR", profile: ["mountain"] },
  { name: "FR-Cote-Azur", lat: 43.55, lng: 6.98, radius: 50000, country: "FR", profile: ["coastal", "scenic"] },
  { name: "FR-Corsica", lat: 42.20, lng: 9.10, radius: 50000, country: "FR", profile: ["coastal", "mountain", "scenic"] },
  { name: "FR-Massif-Central", lat: 45.25, lng: 2.95, radius: 50000, country: "FR", profile: ["mountain", "hill", "forest"] },
  { name: "FR-Vosges", lat: 48.05, lng: 7.00, radius: 50000, country: "FR", profile: ["forest", "hill", "scenic"] },

  // Svizzera
  { name: "CH-Centrale", lat: 46.65, lng: 8.35, radius: 50000, country: "CH", profile: ["mountain", "lake"] },
  { name: "CH-Est", lat: 46.85, lng: 9.80, radius: 50000, country: "CH", profile: ["mountain", "lake"] },
  { name: "CH-Ovest", lat: 46.20, lng: 7.20, radius: 50000, country: "CH", profile: ["mountain", "lake"] },

  // Austria
  { name: "AT-Tirolo", lat: 47.15, lng: 11.15, radius: 50000, country: "AT", profile: ["mountain"] },
  { name: "AT-Salisburgo", lat: 47.30, lng: 13.10, radius: 50000, country: "AT", profile: ["mountain", "lake"] },
  { name: "AT-Carinzia", lat: 46.90, lng: 13.80, radius: 50000, country: "AT", profile: ["mountain", "lake", "scenic"] },

  // Germania
  { name: "DE-Baviera-Alpi", lat: 47.60, lng: 11.40, radius: 50000, country: "DE", profile: ["mountain", "lake"] },
  { name: "DE-Foresta-Nera", lat: 48.20, lng: 8.20, radius: 50000, country: "DE", profile: ["forest", "hill", "scenic"] },

  // Spagna
  { name: "ES-Pirenei-Est", lat: 42.55, lng: 1.85, radius: 50000, country: "ES", profile: ["mountain"] },
  { name: "ES-Pirenei-Centro", lat: 42.70, lng: 0.25, radius: 50000, country: "ES", profile: ["mountain"] },
  { name: "ES-Pirenei-Ovest", lat: 42.95, lng: -0.90, radius: 50000, country: "ES", profile: ["mountain"] },
  { name: "ES-Picos", lat: 43.18, lng: -4.75, radius: 50000, country: "ES", profile: ["mountain", "scenic"] },
  { name: "ES-Sierra-Nevada", lat: 37.05, lng: -3.35, radius: 50000, country: "ES", profile: ["mountain"] },
  { name: "ES-Costa-Brava", lat: 41.90, lng: 3.20, radius: 50000, country: "ES", profile: ["coastal", "scenic"] },
  { name: "ES-Costa-Vasca", lat: 43.35, lng: -2.80, radius: 50000, country: "ES", profile: ["coastal", "scenic"] },

  // Slovenia / Balcani
  { name: "SI-Alpi-Giulie", lat: 46.38, lng: 13.80, radius: 50000, country: "SI", profile: ["mountain", "lake"] },
  { name: "HR-Velebit", lat: 44.75, lng: 15.00, radius: 50000, country: "HR", profile: ["mountain", "coastal", "scenic"] },
  { name: "HR-Adriatic", lat: 43.50, lng: 16.40, radius: 50000, country: "HR", profile: ["coastal", "scenic"] },
  { name: "BA-Dinariche", lat: 43.80, lng: 17.90, radius: 50000, country: "BA", profile: ["mountain", "forest"] },
  { name: "ME-Durmitor", lat: 43.10, lng: 19.05, radius: 50000, country: "ME", profile: ["mountain", "scenic"] },
  { name: "AL-Alpi-Albanesi", lat: 42.45, lng: 19.80, radius: 50000, country: "AL", profile: ["mountain", "scenic", "coastal"] },

  // Romania / Carpazi
  { name: "RO-Carpazi-Nord", lat: 47.05, lng: 24.60, radius: 50000, country: "RO", profile: ["mountain", "forest"] },
  { name: "RO-Carpazi-Centro", lat: 45.55, lng: 25.50, radius: 50000, country: "RO", profile: ["mountain", "forest", "scenic"] },
  { name: "RO-Transfagarasan", lat: 45.60, lng: 24.60, radius: 50000, country: "RO", profile: ["mountain", "scenic"] },

  // Slovacchia / Cechia / Polonia
  { name: "SK-Tatra", lat: 49.15, lng: 20.15, radius: 50000, country: "SK", profile: ["mountain", "lake"] },
  { name: "CZ-Beskydy", lat: 49.50, lng: 18.45, radius: 50000, country: "CZ", profile: ["forest", "hill", "scenic"] },
  { name: "PL-Tatra", lat: 49.25, lng: 19.95, radius: 50000, country: "PL", profile: ["mountain", "lake"] },

  // Nord Europa
  { name: "NO-Fjordland", lat: 61.45, lng: 7.75, radius: 50000, country: "NO", profile: ["fjord", "mountain", "scenic"] },
  { name: "NO-Trollstigen", lat: 62.45, lng: 7.67, radius: 50000, country: "NO", profile: ["fjord", "mountain", "scenic"] },
  { name: "UK-Highlands", lat: 57.15, lng: -4.85, radius: 50000, country: "GB", profile: ["mountain", "lake", "scenic"] },
];

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

  if (
    s.includes("hill") ||
    s.includes("collina") ||
    s.includes("colline")
  ) {
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
    country: area.country || null,
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

            if (!looksRelevantSpot(item.name, item.address, group.family, item.types)) continue;

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
  console.log("MotoPortEU — European Rider Spots Discovery");
  console.log("====================================");

  const raw = [];

  for (const area of EUROPE_AREAS) {
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
    country: x.country || null,
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