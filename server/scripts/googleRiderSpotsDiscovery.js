// server/scripts/googleRiderSpotsDiscovery.js

import dotenv from "dotenv";
import path from "path";

// 👇 FORZA il percorso giusto
dotenv.config({ path: path.resolve("server/.env") });
import fs from "fs/promises";
import process from "process";
const API_KEY = (process.env.GOOGLE_PLACES_KEY || "").trim();

if (!API_KEY) {
  console.error("❌ GOOGLE_PLACES_KEY mancante nelle env");
  process.exit(1);
}

const AREAS = [
  { name: "IT-Alpi-Ovest", lat: 45.9, lng: 7.2 },
  { name: "IT-Alpi-Centro", lat: 46.3, lng: 10.4 },
  { name: "IT-Alpi-Est", lat: 46.5, lng: 12.3 },
  { name: "CH", lat: 46.7, lng: 8.2 },
  { name: "AT", lat: 47.3, lng: 13.3 },
  { name: "FR-Alps", lat: 45.9, lng: 6.4 },
  { name: "DE-South", lat: 47.7, lng: 10.3 },
];

const KEYWORDS = [
  "passo alpino",
  "passo montano",
  "mountain pass",
  "alp pass",
  "col de montagne",
  "pass",
  "joch",
  "passo",
  "col"
];

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

function looksLikePass(name = "") {
  const n = name.toLowerCase();
  return [
    "passo ",
    " pass",
    "col ",
    "joch",
    "pass "
  ].some((k) => n.includes(k));
}

function shouldExclude(name = "", address = "") {
  const text = `${name} ${address}`.toLowerCase();

  const badWords = [
    "hotel",
    "ristorante",
    "restaurant",
    "bar",
    "cafe",
    "caffè",
    "museum",
    "museo",
    "parking",
    "parcheggio",
    "campeggio",
    "camping",
    "resort",
    "spa",
    "shop",
    "store",
    "benzinaio",
    "fuel station"
  ];

  return badWords.some((w) => text.includes(w));
}

function mapResultToSpot(place, areaName, keyword) {
  const name = normalizeName(place.displayName?.text || place.name || "");
  const lat = place.location?.latitude ?? null;
  const lng = place.location?.longitude ?? null;
  const address = place.formattedAddress || "";

  return {
    id: `spot-${slugify(name)}-${slugify(areaName)}`,
    sourceId: place.id || null,
    name,
    lat,
    lng,
    address,
    country: null,
    region: areaName,
    type: "mountain_pass",
    source: "google_places",
    keyword,
    tags: ["passo", "montagna", "curve", "panorama"],
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    googleMapsUri: place.googleMapsUri || null,
    rawTypes: Array.isArray(place.types) ? place.types : [],
  };
}

async function searchTextPlaces(query, area) {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const body = {
    textQuery: query,
    pageSize: 20,
locationBias: {
  circle: {
    center: {
      latitude: area.lat,
      longitude: area.lng
    },
    radius: 50000
  }
}
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
        "places.googleMapsUri"
      ].join(",")
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status} ${txt}`);
  }

  const data = await res.json();
  return data.places || [];
}

function dedupeSpots(spots) {
  const map = new Map();

  for (const spot of spots) {
    const key =
      spot.sourceId ||
      `${slugify(spot.name)}_${spot.lat}_${spot.lng}`;

    if (!map.has(key)) {
      map.set(key, spot);
    }
  }

  return [...map.values()];
}

async function main() {
  const collected = [];

  for (const area of AREAS) {
    console.log(`\n📍 Area: ${area.name}`);

    for (const keyword of KEYWORDS) {
      const query = `${keyword} in ${area.name}`;
      console.log(`→ ${query}`);

      try {
        const results = await searchTextPlaces(query, area);

        const filtered = results
          .filter((p) => {
            const name = p.displayName?.text || "";
            const address = p.formattedAddress || "";
            return looksLikePass(name) && !shouldExclude(name, address);
          })
          .map((p) => mapResultToSpot(p, area.name, keyword));

        console.log(`   trovati: ${filtered.length}`);
        collected.push(...filtered);
      } catch (err) {
        console.error(`   ❌ errore: ${err.message}`);
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const final = dedupeSpots(collected).sort((a, b) =>
    a.name.localeCompare(b.name, "it")
  );

  const outPath = path.resolve("client/public/data/rider-spots.json");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(final, null, 2), "utf8");

  console.log(`\n✅ Salvati ${final.length} spot in: ${outPath}`);
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});