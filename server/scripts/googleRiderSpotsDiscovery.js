// server/scripts/googleRiderSpotsDiscovery.js

import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import process from "process";

dotenv.config({ path: path.resolve("server/.env") });

const API_KEY = (process.env.GOOGLE_PLACES_KEY || "").trim();

if (!API_KEY) {
  console.error("❌ GOOGLE_PLACES_KEY mancante nelle env");
  process.exit(1);
}

/**
 * 38 aree europee rider-oriented.
 * Radius sempre <= 50000 per compatibilità Google Places.
 */
const AREAS = [
  // Italia
  { name: "IT-Alpi-Ovest", lat: 45.9, lng: 7.2, radius: 50000 },
  { name: "IT-Alpi-Centro", lat: 46.3, lng: 10.4, radius: 50000 },
  { name: "IT-Alpi-Est", lat: 46.5, lng: 12.3, radius: 50000 },
  { name: "IT-Appennino-Nord", lat: 44.1, lng: 10.1, radius: 50000 },
  { name: "IT-Appennino-Centro", lat: 42.6, lng: 13.2, radius: 50000 },
  { name: "IT-Appennino-Sud", lat: 40.2, lng: 15.8, radius: 50000 },
  { name: "IT-Sardegna", lat: 40.1, lng: 9.0, radius: 50000 },
  { name: "IT-Sicilia", lat: 37.7, lng: 14.1, radius: 50000 },

  // Francia
  { name: "FR-Alps-North", lat: 45.95, lng: 6.45, radius: 50000 },
  { name: "FR-Alps-South", lat: 44.85, lng: 6.35, radius: 50000 },
  { name: "FR-Pyrenees", lat: 42.8, lng: 0.3, radius: 50000 },
  { name: "FR-Massif-Central", lat: 44.8, lng: 2.9, radius: 50000 },
  { name: "FR-Corsica", lat: 42.2, lng: 9.0, radius: 50000 },

  // Spagna e Portogallo
  { name: "ES-Pyrenees", lat: 42.7, lng: 0.8, radius: 50000 },
  { name: "ES-Picos", lat: 43.15, lng: -4.85, radius: 50000 },
  { name: "ES-Sistema-Central", lat: 40.8, lng: -4.1, radius: 50000 },
  { name: "ES-Sierra-Nevada", lat: 37.05, lng: -3.35, radius: 50000 },
  { name: "PT-North", lat: 41.7, lng: -7.9, radius: 50000 },
  { name: "PT-Center", lat: 40.2, lng: -7.8, radius: 50000 },

  // DACH
  { name: "CH", lat: 46.7, lng: 8.2, radius: 50000 },
  { name: "AT-West", lat: 47.1, lng: 10.4, radius: 50000 },
  { name: "AT-Central", lat: 47.25, lng: 13.25, radius: 50000 },
  { name: "AT-East", lat: 47.3, lng: 15.6, radius: 50000 },
  { name: "DE-Bavaria", lat: 47.75, lng: 11.6, radius: 50000 },
  { name: "DE-Black-Forest", lat: 48.0, lng: 8.2, radius: 50000 },

  // Centro Europa / Balcani / Est
  { name: "SI", lat: 46.3, lng: 14.0, radius: 50000 },
  { name: "HR-Inland", lat: 45.2, lng: 15.3, radius: 50000 },
  { name: "BA", lat: 43.9, lng: 17.7, radius: 50000 },
  { name: "ME", lat: 42.8, lng: 19.2, radius: 50000 },
  { name: "AL", lat: 41.3, lng: 20.1, radius: 50000 },
  { name: "RO-Carpathians-North", lat: 47.0, lng: 24.8, radius: 50000 },
  { name: "RO-Carpathians-South", lat: 45.5, lng: 24.7, radius: 50000 },
  { name: "SK", lat: 48.9, lng: 20.2, radius: 50000 },
  { name: "PL-South", lat: 49.5, lng: 20.2, radius: 50000 },
  { name: "CZ-Mountains", lat: 50.4, lng: 15.7, radius: 50000 },
  { name: "GR-Mountains", lat: 39.8, lng: 21.5, radius: 50000 },

  // Nord
  { name: "UK-Scotland-Highlands", lat: 57.2, lng: -4.8, radius: 50000 },
  { name: "NO-South", lat: 61.2, lng: 8.2, radius: 50000 },
  { name: "NO-Fjords", lat: 61.8, lng: 6.8, radius: 50000 },
];

/**
 * Query multilanguage per passi reali.
 */
const KEYWORDS = [
  "mountain pass",
  "alpine pass",
  "alp pass",
  "mountain road pass",
  "passo alpino",
  "passo montano",
  "passo",
  "pass",
  "col",
  "joch",
  "puerto de montaña",
  "puerto de",
  "collado de montaña",
  "col de montagne",
  "porto di montagna",
  "road saddle",
];

const GOOD_NAME_PATTERNS = [
  "passo ",
  " passo",
  "pass ",
  " pass",
  "col ",
  " col",
  "joch",
  "puerto ",
  "collado ",
  "port de ",
  "porto di ",
  "sella ",
  "forcella ",
  "bocca ",
  "colle ",
  "col du ",
  "col de ",
];

const BAD_TEXT_PATTERNS = [
  "hotel",
  "ristorante",
  "restaurant",
  "bar",
  "cafe",
  "caffè",
  "caffé",
  "museum",
  "museo",
  "parking",
  "parking lot",
  "parcheggio",
  "campeggio",
  "camping",
  "resort",
  "spa",
  "shop",
  "store",
  "benzinaio",
  "fuel station",
  "gas station",
  "lodging",
  "supermarket",
  "market",
  "rifugio",
  "hut",
  "bivacco",
  "hostel",
  "farmhouse",
  "agriturismo",
  "dealer",
  "concessionaria",
  "noleggio",
  "rental",
  "autodromo",
  "motocross",
  "crossodromo",
  "kart",
  "karting",
  "speedway",
  "raceway",
  "racetrack",
  "go-kart",
  "pista",
  "circuit",
  "circuito",
];

const GOOD_TYPES = new Set([
  "natural_feature",
  "route",
  "premise",
  "point_of_interest",
  "establishment",
  "tourist_attraction",
  "locality",
  "political",
]);

const BAD_TYPES = new Set([
  "parking",
  "parking_lot",
  "restaurant",
  "cafe",
  "bar",
  "lodging",
  "hotel",
  "gas_station",
  "museum",
  "store",
  "supermarket",
  "campground",
  "rv_park",
  "car_repair",
  "car_dealer",
  "car_rental",
  "night_club",
  "meal_takeaway",
  "meal_delivery",
  "bakery",
  "shopping_mall",
  "gym",
  "hospital",
  "pharmacy",
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeName(name = "") {
  return String(name).replace(/\s+/g, " ").trim();
}

function norm(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePass(name = "", address = "") {
  const text = norm(`${name} ${address}`);
  return GOOD_NAME_PATTERNS.some((k) => text.includes(norm(k)));
}

function containsBadText(name = "", address = "") {
  const text = norm(`${name} ${address}`);
  return BAD_TEXT_PATTERNS.some((w) => text.includes(norm(w)));
}

function isBadType(types = []) {
  return types.some((t) => BAD_TYPES.has(String(t || "").toLowerCase()));
}

function goodTypeScore(types = []) {
  let score = 0;
  for (const t of types) {
    const tt = String(t || "").toLowerCase();
    if (GOOD_TYPES.has(tt)) score += 2;
    if (tt === "natural_feature") score += 8;
    if (tt === "route") score += 6;
    if (tt === "tourist_attraction") score += 2;
    if (tt === "locality") score += 1;
  }
  return score;
}

function badTypePenalty(types = []) {
  let score = 0;
  for (const t of types) {
    const tt = String(t || "").toLowerCase();
    if (BAD_TYPES.has(tt)) score += 5;
    if (tt === "parking_lot" || tt === "parking") score += 10;
    if (tt === "restaurant" || tt === "lodging" || tt === "hotel") score += 10;
    if (tt === "gas_station") score += 12;
  }
  return score;
}

function mapCountryFromArea(areaName = "") {
  const x = areaName.toUpperCase();
  if (x.startsWith("IT-")) return "IT";
  if (x.startsWith("FR-")) return "FR";
  if (x.startsWith("ES-")) return "ES";
  if (x.startsWith("PT-")) return "PT";
  if (x.startsWith("DE-")) return "DE";
  if (x.startsWith("RO-")) return "RO";
  if (x.startsWith("UK-")) return "UK";
  return x.split("-")[0] || null;
}

function inferTypeFromName(name = "") {
  const n = norm(name);

  if (n.includes("joch")) return "mountain_pass";
  if (n.includes("col ") || n.includes("col de ") || n.includes("col du ")) {
    return "mountain_pass";
  }
  if (n.includes("puerto ")) return "mountain_pass";
  if (n.includes("collado ")) return "mountain_pass";
  if (n.includes("passo ") || n.includes(" passo")) return "mountain_pass";
  if (n.includes(" pass") || n.includes("pass ")) return "mountain_pass";

  return "mountain_pass";
}

function buildTags(name = "", keyword = "", types = []) {
  const text = norm(`${name} ${keyword}`);
  const tags = new Set(["passo", "montagna", "curve", "panorama", "rider-spot"]);

  if (
    text.includes("pass") ||
    text.includes("passo") ||
    text.includes("joch") ||
    text.includes("col") ||
    text.includes("puerto")
  ) {
    tags.add("mountain-pass");
  }

  if (types.map((t) => String(t || "").toLowerCase()).includes("natural_feature")) {
    tags.add("natural-feature");
  }

  return [...tags];
}

function computeSpotScore(place) {
  const name = normalizeName(place.displayName?.text || place.name || "");
  const address = place.formattedAddress || "";
  const types = Array.isArray(place.types) ? place.types : [];
  const rating = Number(place.rating || 0);
  const userRatingCount = Number(place.userRatingCount || 0);

  let score = 0;

  if (looksLikePass(name, address)) score += 25;
  if (!containsBadText(name, address)) score += 10;

  score += goodTypeScore(types);
  score -= badTypePenalty(types);

  const nn = norm(name);

  if (nn.startsWith("passo ")) score += 14;
  if (nn.includes(" pass")) score += 10;
  if (nn.includes("col ")) score += 10;
  if (nn.includes("joch")) score += 10;
  if (nn.includes("puerto ")) score += 10;
  if (nn.includes("collado ")) score += 10;
  if (nn.includes("forcella ")) score += 7;
  if (nn.includes("sella ")) score += 7;
  if (nn.includes("colle ")) score += 7;
  if (nn.includes("bocca ")) score += 6;

  if (rating >= 4.6) score += 4;
  else if (rating >= 4.2) score += 2;

  if (userRatingCount >= 100) score += 4;
  else if (userRatingCount >= 20) score += 2;
  else if (userRatingCount >= 5) score += 1;

  if (containsBadText(name, address)) score -= 18;
  if (isBadType(types)) score -= 10;

  return score;
}

function shouldKeepPlace(place) {
  const name = normalizeName(place.displayName?.text || place.name || "");
  const address = place.formattedAddress || "";
  const types = Array.isArray(place.types) ? place.types : [];
  const score = computeSpotScore(place);

  if (!name) return false;
  if (!looksLikePass(name, address)) return false;
  if (containsBadText(name, address) && !types.includes("natural_feature")) return false;
  if (isBadType(types) && !types.includes("natural_feature")) return false;

  return score >= 12;
}

function mapResultToSpot(place, areaName, keyword) {
  const name = normalizeName(place.displayName?.text || place.name || "");
  const lat = place.location?.latitude ?? null;
  const lng = place.location?.longitude ?? null;
  const address = place.formattedAddress || "";
  const rawTypes = Array.isArray(place.types) ? place.types : [];

  return {
    id: `spot-${slugify(name)}-${slugify(areaName)}`,
    sourceId: place.id || null,
    name,
    lat,
    lng,
    address,
    country: mapCountryFromArea(areaName),
    region: areaName,
    type: inferTypeFromName(name),
    source: "google_places",
    keyword,
    tags: buildTags(name, keyword, rawTypes),
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    googleMapsUri: place.googleMapsUri || null,
    rawTypes,
    score: computeSpotScore(place),
  };
}

async function searchTextPlaces(query, area) {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const safeRadius = Math.max(1, Math.min(Number(area.radius || 50000), 50000));

  const body = {
    textQuery: query,
    pageSize: 20,
    locationBias: {
      circle: {
        center: {
          latitude: area.lat,
          longitude: area.lng,
        },
        radius: safeRadius,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.types",
        "places.rating",
        "places.userRatingCount",
        "places.googleMapsUri",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${txt}`);
  }

  const data = await res.json();
  return Array.isArray(data.places) ? data.places : [];
}

function distanceKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function dedupeSpots(spots) {
  const bySourceOrName = new Map();

  for (const spot of spots) {
    const srcKey = spot.sourceId ? `src:${spot.sourceId}` : null;
    const nameKey = `name:${slugify(spot.name)}:${spot.country || "xx"}`;

    if (srcKey && !bySourceOrName.has(srcKey)) {
      bySourceOrName.set(srcKey, spot);
      continue;
    }

    if (!bySourceOrName.has(nameKey)) {
      bySourceOrName.set(nameKey, spot);
      continue;
    }

    const prev = bySourceOrName.get(nameKey);
    if ((spot.score || 0) > (prev.score || 0)) {
      bySourceOrName.set(nameKey, spot);
    }
  }

  const coarse = [];
  const used = new Set();

  const arr = [...bySourceOrName.values()].sort(
    (a, b) => (b.score || 0) - (a.score || 0)
  );

  for (let i = 0; i < arr.length; i++) {
    if (used.has(i)) continue;

    const base = arr[i];
    let best = base;

    for (let j = i + 1; j < arr.length; j++) {
      if (used.has(j)) continue;
      const cand = arr[j];

      const sameName =
        slugify(base.name) === slugify(cand.name) ||
        slugify(base.name).includes(slugify(cand.name)) ||
        slugify(cand.name).includes(slugify(base.name));

      const sameCountry = (base.country || "") === (cand.country || "");
      const closeEnough =
        Number.isFinite(base.lat) &&
        Number.isFinite(base.lng) &&
        Number.isFinite(cand.lat) &&
        Number.isFinite(cand.lng) &&
        distanceKm(base.lat, base.lng, cand.lat, cand.lng) <= 2.5;

      if (sameName && (sameCountry || closeEnough)) {
        if ((cand.score || 0) > (best.score || 0)) {
          best = cand;
        }
        used.add(j);
      }
    }

    coarse.push(best);
  }

  return coarse.sort((a, b) => a.name.localeCompare(b.name, "it"));
}

async function main() {
  const collected = [];

  console.log("🚀 Avvio discovery passi europei...");
  console.log(`🗺️ Aree: ${AREAS.length}`);
  console.log(`🔎 Query per area: ${KEYWORDS.length}`);

  for (const area of AREAS) {
    console.log(`\n📍 Area: ${area.name}`);

    for (const keyword of KEYWORDS) {
      const query = `${keyword} in ${area.name}`;
      console.log(`→ ${query}`);

      try {
        const results = await searchTextPlaces(query, area);

        const filtered = results
          .filter(shouldKeepPlace)
          .map((p) => mapResultToSpot(p, area.name, keyword));

        console.log(`   grezzi: ${results.length} | tenuti: ${filtered.length}`);
        collected.push(...filtered);
      } catch (err) {
        console.error(`   ❌ errore: ${err.message}`);
      }

      await sleep(250);
    }

    await sleep(500);
  }

  const final = dedupeSpots(collected);

  const outPath = path.resolve("client/public/data/rider-spots.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(final, null, 2), "utf8");

  console.log(`\n✅ Salvati ${final.length} rider spots in: ${outPath}`);
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});