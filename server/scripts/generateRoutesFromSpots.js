// =======================================================
// server/scripts/generateRoutesFromSpots.js
// MotoPortEU — Generate Routes From Clean Rider Spots
// -------------------------------------------------------
// Input:
// - client/public/data/rider-spots.eu.json
//
// Output:
// - client/public/data/routes.generated.fromspots.<COUNTRY>.json
//
// Uso:
// node server/scripts/generateRoutesFromSpots.js --country=IT
// node server/scripts/generateRoutesFromSpots.js --country=FR
// node server/scripts/generateRoutesFromSpots.js --country=IT --country=FR
// =======================================================

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const INPUT_FILE = path.resolve(ROOT, "client/public/data/rider-spots.eu.json");
const DATA_DIR = path.resolve(ROOT, "client/public/data");

function parseArgs(argv) {
  const out = { country: [] };

  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;

    const eq = raw.indexOf("=");
    if (eq === -1) {
      out[raw.slice(2)] = true;
      continue;
    }

    const key = raw.slice(2, eq);
    const value = raw.slice(eq + 1).trim();

    if (key === "country") {
      if (value) out.country.push(value.toUpperCase());
    } else {
      out[key] = value;
    }
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));
const COUNTRY_FILTER = new Set(
  (args.country || []).map((x) => String(x).toUpperCase())
);

function normalizeText(v) {
  return String(v || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(v) {
  return normalizeText(v).toLowerCase();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hasValidCoords(obj) {
  const lat = toNumber(obj?.lat);
  const lng = toNumber(obj?.lng);
  return lat !== null && lng !== null;
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;

  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(sa));
}

function regionKey(spot) {
  return normKey(spot.region || "unknown-region");
}

function routeRideType(spots) {
  const score = {};
  for (const s of spots) {
    const rt = normKey(s.rideType || "scenic") || "scenic";
    score[rt] = (score[rt] || 0) + 1;
  }
  return Object.entries(score).sort((a, b) => b[1] - a[1])[0]?.[0] || "scenic";
}

function routeName(region, rideType, spots) {
  const names = spots.map((s) => s.name).filter(Boolean);

  const prefixMap = {
    mountain: "Giro Montagna",
    scenic: "Giro Panoramico",
    lake: "Giro Lago",
    coastal: "Giro Costiero",
    forest: "Giro Foresta",
  };

  const prefix = prefixMap[rideType] || "Giro Rider";
  return `${prefix} ${region}: ${names.join(" → ")}`;
}

function chunkCandidates(sorted, size, step = 1) {
  const out = [];
  if (sorted.length < size) return out;

  for (let i = 0; i <= sorted.length - size; i += step) {
    out.push(sorted.slice(i, i + size));
  }

  return out;
}

function isRouteDiverseEnough(spots) {
  const names = new Set(spots.map((s) => normKey(s.name)));
  return names.size >= Math.min(2, spots.length);
}

function scoreRoute(spots) {
  let score = 0;

  for (const s of spots) {
    score += Number(s.score || 50);

    if (s.spotType === "pass") score += 8;
    if (s.spotType === "viewpoint") score += 5;
    if (s.rideType === "mountain") score += 3;
  }

  return Math.round(score / Math.max(1, spots.length));
}

function buildRouteId(country, region, spots) {
  const slug = `${country}-${region}-${spots.map((s) => s.name).join("-")}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return slug || `route-${country.toLowerCase()}-${Date.now()}`;
}

function distanceSummary(spots) {
  let total = 0;

  for (let i = 1; i < spots.length; i++) {
    total += haversineKm(
      spots[i - 1].lat,
      spots[i - 1].lng,
      spots[i].lat,
      spots[i].lng
    );
  }

  return Math.round(total * 10) / 10;
}

function estimateDifficulty(rideType, totalKm, passCount) {
  if (rideType === "mountain" && (passCount >= 2 || totalKm >= 80)) return "alta";
  if (rideType === "lake" || rideType === "coastal") return "media";
  return totalKm >= 100 ? "media" : "bassa";
}

function makeDescription(route) {
  const rideTypeLabel =
    {
      mountain: "itinerario di montagna",
      scenic: "itinerario panoramico",
      lake: "itinerario tra laghi e panorami",
      coastal: "itinerario costiero",
      forest: "itinerario tra boschi e strade verdi",
    }[route.rideType] || "itinerario rider";

  return `${rideTypeLabel} nell'area ${route.region}, costruito su spot rider reali e pensato per offrire una guida piacevole, coerente e credibile.`;
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const out = [];

  for (const r of routes) {
    const key = [
      normKey(r.country),
      normKey(r.region),
      normKey(r.name),
      normKey(r.rideType),
      Math.round(Number(r.distanceKm || 0)),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

function sortSpotsForRoute(spots) {
  if (spots.length <= 2) return [...spots];

  return [...spots].sort((a, b) => {
    if (a.lat !== b.lat) return a.lat - b.lat;
    return a.lng - b.lng;
  });
}

function cleanTags(spots) {
  const tags = [];
  for (const s of spots) {
    if (!Array.isArray(s.tags)) continue;
    for (const t of s.tags) {
      const v = normalizeText(t);
      if (v) tags.push(v);
    }
  }
  return [...new Set(tags)];
}

function sanitizeSpot(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!hasValidCoords(raw)) return null;

  const lat = toNumber(raw.lat);
  const lng = toNumber(raw.lng);
  const name = normalizeText(raw.name);
  const country = String(raw.country || "").toUpperCase().trim();
  const region = normalizeText(raw.region || "Area Rider");
  const rideType = normKey(raw.rideType || "scenic") || "scenic";
  const spotType = normKey(raw.spotType || "viewpoint") || "viewpoint";
  const score = Number.isFinite(Number(raw.score)) ? Number(raw.score) : 50;

  if (!name || !country) return null;

  return {
    ...raw,
    name,
    country,
    region,
    rideType,
    spotType,
    lat,
    lng,
    score,
  };
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Generate Routes From Spots");
  console.log("====================================");

  const input = JSON.parse(await fs.readFile(INPUT_FILE, "utf8"));
  if (!Array.isArray(input)) {
    throw new Error("Input non valido: rider-spots.eu.json non è un array");
  }

  const spots = input
    .map(sanitizeSpot)
    .filter(Boolean)
    .filter((s) => {
      if (COUNTRY_FILTER.size > 0 && !COUNTRY_FILTER.has(s.country)) return false;
      return true;
    });

  if (!spots.length) {
    throw new Error("Nessuno spot trovato con i filtri richiesti");
  }

  const byCountry = new Map();

  for (const s of spots) {
    if (!byCountry.has(s.country)) byCountry.set(s.country, []);
    byCountry.get(s.country).push(s);
  }

  for (const [country, countrySpots] of byCountry.entries()) {
    console.log("------------------------------------");
    console.log(`🌍 Country: ${country}`);
    console.log(`📍 Spots input: ${countrySpots.length}`);

    const buckets = new Map();

    for (const s of countrySpots) {
      const rk = regionKey(s);
      const rt = normKey(s.rideType || "scenic") || "scenic";
      const key = `${rk}__${rt}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(s);
    }

    const routes = [];

    for (const [, bucketSpots] of buckets.entries()) {
      const regionName = bucketSpots[0]?.region || "Area Rider";

      const ranked = [...bucketSpots]
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 24);

      const candidates = [
        ...chunkCandidates(ranked, 2, 1),
        ...chunkCandidates(ranked, 3, 1),
        ...chunkCandidates(ranked, 4, 1),
      ];

      for (const candidate of candidates) {
        const ordered = sortSpotsForRoute(candidate);
        if (!isRouteDiverseEnough(ordered)) continue;

        const rideType = routeRideType(ordered);
        const passCount = ordered.filter((s) => s.spotType === "pass").length;
        const totalKm = distanceSummary(ordered);

        if (ordered.length >= 2 && totalKm > 320) continue;
        if (ordered.length === 2 && totalKm < 8) continue;
        if (ordered.length >= 3 && totalKm < 15) continue;

        const centerLat =
          ordered.reduce((sum, s) => sum + s.lat, 0) / ordered.length;
        const centerLng =
          ordered.reduce((sum, s) => sum + s.lng, 0) / ordered.length;

        const route = {
          id: buildRouteId(country, regionName, ordered),
          name: routeName(regionName, rideType, ordered),
          country,
          region: regionName,
          rideType,
          score: scoreRoute(ordered),
          difficulty: estimateDifficulty(rideType, totalKm, passCount),
          distanceKm: totalKm,
          bestSeason:
            rideType === "mountain"
              ? "Primavera / Estate / Inizio autunno"
              : "Primavera / Estate / Autunno",
          description: "",
          tags: cleanTags(ordered),
          start: {
            name: ordered[0].name,
            lat: ordered[0].lat,
            lng: ordered[0].lng,
          },
          end: {
            name: ordered[ordered.length - 1].name,
            lat: ordered[ordered.length - 1].lat,
            lng: ordered[ordered.length - 1].lng,
          },
          center: {
            lat: Number(centerLat.toFixed(5)),
            lng: Number(centerLng.toFixed(5)),
          },
          waypoints: ordered.map((s) => ({
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            spotType: s.spotType,
            score: s.score,
          })),
          spots: ordered.map((s) => ({
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            spotType: s.spotType,
            score: s.score,
          })),
          source: "rider-spots.eu",
          sourceScope: "from-spots",
        };

        route.description = makeDescription(route);
        routes.push(route);
      }
    }

const dedupedRoutes = dedupeRoutes(routes).sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (a.region !== b.region) return a.region.localeCompare(b.region);
  return a.name.localeCompare(b.name);
});

const caps =
  country === "IT"
    ? { mountain: 110, lake: 60, scenic: 40, coastal: 10, forest: 5 }
    : { mountain: 35, lake: 20, scenic: 15, coastal: 5, forest: 5 };

const grouped = {
  mountain: [],
  lake: [],
  scenic: [],
  coastal: [],
  forest: [],
  other: [],
};

for (const r of dedupedRoutes) {
  if (grouped[r.rideType]) grouped[r.rideType].push(r);
  else grouped.other.push(r);
}

let finalRoutes = [
  ...grouped.mountain.slice(0, caps.mountain || 0),
  ...grouped.lake.slice(0, caps.lake || 0),
  ...grouped.scenic.slice(0, caps.scenic || 0),
  ...grouped.coastal.slice(0, caps.coastal || 0),
  ...grouped.forest.slice(0, caps.forest || 0),
];

const hardCap = country === "IT" ? 220 : 80;

if (finalRoutes.length < hardCap) {
  const used = new Set(finalRoutes.map((r) => r.id));
  const leftovers = dedupedRoutes.filter((r) => !used.has(r.id));
  finalRoutes = [...finalRoutes, ...leftovers].slice(0, hardCap);
}
    const outFile = path.resolve(
      DATA_DIR,
      `routes.generated.fromspots.${country}.json`
    );

    await fs.writeFile(outFile, JSON.stringify(finalRoutes, null, 2), "utf8");

    const byRideType = {};
    for (const r of finalRoutes) {
      byRideType[r.rideType] = (byRideType[r.rideType] || 0) + 1;
    }

    console.log(`🛣️ Routes generated: ${finalRoutes.length}`);
    console.log("Distribuzione rideType:", byRideType);
    console.log(`💾 Output: ${outFile}`);
  }

  console.log("====================================");
  console.log("✅ Generazione completata");
  console.log("====================================");
}

main().catch((err) => {
  console.error("💥 Errore generateRoutesFromSpots");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});