// =======================================================
// server/scripts/cleanRiderSpotsArchive.js
// MotoPortEU — Clean Rider Spots Archive
// -------------------------------------------------------
// Input:
// - client/public/data/rider-spots.eu.raw.json
//
// Output:
// - client/public/data/rider-spots.eu.json
//
// Fa:
// - filtro validità
// - dedupe avanzato
// - normalizzazione minima
// - rimozione spot deboli
// =======================================================

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

const INPUT_FILE = path.resolve(ROOT, "client/public/data/rider-spots.eu.raw.json");
const OUTPUT_FILE = path.resolve(ROOT, "client/public/data/rider-spots.eu.json");

function normalizeText(v) {
  return String(v || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normKey(v) {
  return normalizeText(v).toLowerCase();
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validLatLng(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
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

function cleanName(name) {
  return normalizeText(name)
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*→\s*/g, " → ")
    .replace(/[|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanRegion(region) {
  return normalizeText(region)
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function inferSpotType(name = "", rideType = "", current = "") {
  const text = `${name} ${rideType} ${current}`.toLowerCase();

  if (
    text.includes("passo") ||
    text.includes("colle") ||
    text.includes("pass ") ||
    text.includes("mountain pass") ||
    text.includes("joch")
  ) {
    return "pass";
  }

  if (
    text.includes("viewpoint") ||
    text.includes("belvedere") ||
    text.includes("panoramic") ||
    text.includes("panoramica")
  ) {
    return "viewpoint";
  }

  if (text.includes("lake") || text.includes("lago")) {
    return "lake_point";
  }

  if (
    text.includes("coast") ||
    text.includes("costa") ||
    text.includes("mare")
  ) {
    return "coastal_point";
  }

  if (
    text.includes("road") ||
    text.includes("strada") ||
    text.includes("route")
  ) {
    return "scenic_road";
  }

  return current || "rider_stop";
}

function cleanRideType(v) {
  const rt = normKey(v);
  if (["mountain", "scenic", "lake", "coastal", "forest"].includes(rt)) {
    return rt;
  }
  return "scenic";
}

function isWeakName(name) {
  const n = normKey(name);

  if (!n || n.length < 3) return true;

  const badExact = new Set([
    "spot rider",
    "start",
    "end",
    "center",
    "waypoint",
    "point",
    "place",
  ]);

  if (badExact.has(n)) return true;

  const weakPatterns = [
    "rent",
    "locations",
    "atelier",
    "cable car",
    "parking",
    "hotel",
    "bar",
    "ristorante",
    "restaurant",
    "cafe",
    "campeggio",
    "camping",
    "shop",
    "store",
  ];

  return weakPatterns.some((w) => n.includes(w));
}

function isRiderRelevant(spot) {
  if (!spot) return false;
  if (!validLatLng(spot.lat, spot.lng)) return false;
  if (!spot.country) return false;

  const name = normKey(spot.name);
  const rideType = normKey(spot.rideType);
  const spotType = normKey(spot.spotType);

  if (isWeakName(name)) return false;

  if (
    spotType === "pass" ||
    spotType === "viewpoint" ||
    spotType === "scenic_road" ||
    spotType === "lake_point" ||
    spotType === "coastal_point"
  ) {
    return true;
  }

  if (
    rideType === "mountain" ||
    rideType === "lake" ||
    rideType === "coastal" ||
    rideType === "scenic"
  ) {
    return true;
  }

  return false;
}

function spotKeyLoose(spot) {
  return [
    normKey(spot.country),
    normKey(spot.name),
    Math.round(spot.lat * 1000) / 1000,
    Math.round(spot.lng * 1000) / 1000,
  ].join("|");
}

function dedupeSpotsAdvanced(spots) {
  const out = [];
  const used = new Set();

  for (let i = 0; i < spots.length; i++) {
    if (used.has(i)) continue;

    let base = { ...spots[i] };
    used.add(i);

    for (let j = i + 1; j < spots.length; j++) {
      if (used.has(j)) continue;

      const other = spots[j];
      if (normKey(base.country) !== normKey(other.country)) continue;

      const sameName = normKey(base.name) === normKey(other.name);
      const dist = haversineKm(base.lat, base.lng, other.lat, other.lng);

      // stesso nome e molto vicini
      if (sameName && dist <= 5) {
        if ((other.score || 0) > (base.score || 0)) {
          base = {
            ...base,
            ...other,
            aliases: [...new Set([...(base.aliases || []), ...(other.aliases || [])])],
            tags: [...new Set([...(base.tags || []), ...(other.tags || [])])],
          };
        } else {
          base.aliases = [...new Set([...(base.aliases || []), ...(other.aliases || [])])];
          base.tags = [...new Set([...(base.tags || []), ...(other.tags || [])])];
        }
        used.add(j);
      }
    }

    out.push(base);
  }

  return out;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Clean Rider Spots Archive");
  console.log("====================================");

  const raw = JSON.parse(await fs.readFile(INPUT_FILE, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error("Input non valido: rider-spots.eu.raw.json non è un array");
  }

  const cleaned = raw
    .map((s) => ({
      ...s,
      name: cleanName(s.name),
      region: cleanRegion(s.region),
      country: normalizeText(s.country).toUpperCase(),
      rideType: cleanRideType(s.rideType),
      spotType: inferSpotType(s.name, s.rideType, s.spotType),
      lat: toNum(s.lat),
      lng: toNum(s.lng),
      score: Math.max(1, Math.min(100, Number(s.score || 50))),
      aliases: Array.isArray(s.aliases)
        ? [...new Set(s.aliases.map(cleanName).filter(Boolean))]
        : [],
      tags: Array.isArray(s.tags)
        ? [...new Set(s.tags.map(normalizeText).filter(Boolean))]
        : [],
    }))
    .filter(isRiderRelevant);

  const uniqueLoose = [];
  const seenLoose = new Set();

  for (const spot of cleaned) {
    const k = spotKeyLoose(spot);
    if (seenLoose.has(k)) continue;
    seenLoose.add(k);
    uniqueLoose.push(spot);
  }

  const finalSpots = dedupeSpotsAdvanced(uniqueLoose).sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country);
    if (a.region !== b.region) return a.region.localeCompare(b.region);
    if (a.spotType !== b.spotType) return a.spotType.localeCompare(b.spotType);
    return a.name.localeCompare(b.name);
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalSpots, null, 2), "utf8");

  const byCountry = {};
  const byRideType = {};
  const bySpotType = {};

  for (const s of finalSpots) {
    byCountry[s.country] = (byCountry[s.country] || 0) + 1;
    byRideType[s.rideType] = (byRideType[s.rideType] || 0) + 1;
    bySpotType[s.spotType] = (bySpotType[s.spotType] || 0) + 1;
  }

  console.log("------------------------------------");
  console.log(`Input raw:             ${raw.length}`);
  console.log(`Dopo filtro base:      ${cleaned.length}`);
  console.log(`Dopo dedupe loose:     ${uniqueLoose.length}`);
  console.log(`Final spots:           ${finalSpots.length}`);
  console.log("------------------------------------");
  console.log("Distribuzione country:", byCountry);
  console.log("Distribuzione rideType:", byRideType);
  console.log("Distribuzione spotType:", bySpotType);
  console.log("------------------------------------");
  console.log(`Creato: ${OUTPUT_FILE}`);
  console.log("====================================");
}

main().catch((err) => {
  console.error("💥 Errore clean rider spots archive");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});