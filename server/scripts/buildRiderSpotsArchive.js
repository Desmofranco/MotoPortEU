// =======================================================
// server/scripts/buildRiderSpotsArchive.js
// MotoPortEU — Build Rider Spots Europe Raw Archive
// -------------------------------------------------------
// Scansiona client/public/data e aggrega tutti i file
// rider-spots*.json utili in un unico archivio grezzo:
//
// Output:
// - client/public/data/rider-spots.eu.raw.json
//
// Uso:
// node server/scripts/buildRiderSpotsArchive.js
// =======================================================

import fs from "fs/promises";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");
const DATA_DIR = path.resolve(ROOT, "client/public/data");
const OUTPUT_FILE = path.resolve(DATA_DIR, "rider-spots.eu.raw.json");

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

function inferCountryFromFilename(name) {
  const m = name.match(/(?:^|\.)(IT|FR|CH|AT|DE|ES|PT|SI|HR|BA|ME|AL|RO|SK|CZ|PL|NO|SE|FI|DK|NL|BE|LU|IE|UK|GB|GR|BG|RS|HU|LT|LV|EE|IS|MD|UA)(?:\.|$)/i);
  return m?.[1]?.toUpperCase() || "";
}

function isJsonFile(name) {
  return /\.json$/i.test(name);
}

function isIncludedSourceFile(name) {
  const n = name.toLowerCase();

  if (!isJsonFile(n)) return false;
  if (!n.startsWith("rider-spots")) return false;

  // escludi output finali / backup / file live già aggregati
  if (
    n === "rider-spots.eu.raw.json" ||
    n === "rider-spots.eu.json" ||
    n === "rider-spots.cleaned.json"
  ) {
    return false;
  }

  // escludi backup/archivi interni
  if (
    n.includes(".backup.") ||
    n.includes("routes.") ||
    n.includes("review") ||
    n.includes("_archive")
  ) {
    return false;
  }

  return true;
}

function sanitizeSpot(raw, fileName) {
  if (!raw || typeof raw !== "object") return null;

  const lat =
    toNumber(raw.lat) ??
    toNumber(raw.latitude) ??
    toNumber(raw.center?.lat) ??
    null;

  const lng =
    toNumber(raw.lng) ??
    toNumber(raw.lon) ??
    toNumber(raw.longitude) ??
    toNumber(raw.center?.lng) ??
    toNumber(raw.center?.lon) ??
    null;

  if (lat === null || lng === null) return null;

  const name = normalizeText(raw.name || raw.title || raw.label);
  if (!name) return null;

  const country =
    String(raw.country || raw.countryCode || inferCountryFromFilename(fileName) || "")
      .toUpperCase()
      .trim();

  if (!country) return null;

  const region = normalizeText(
    raw.region ||
      raw.area ||
      raw.zone ||
      raw.scope ||
      raw.province ||
      raw.state ||
      "Area Rider"
  );

  const rideType = normKey(raw.rideType || raw.type || "scenic") || "scenic";
  const spotType = normKey(raw.spotType || raw.kind || "viewpoint") || "viewpoint";
  const score = Number.isFinite(Number(raw.score)) ? Number(raw.score) : 50;

  const tags = Array.isArray(raw.tags)
    ? [...new Set(raw.tags.map(normalizeText).filter(Boolean))]
    : [];

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
    tags,
    sourceFile: fileName,
  };
}

function looseDedupeKey(spot) {
  return [
    normKey(spot.country),
    normKey(spot.name),
    spot.spotType,
    Math.round(spot.lat * 1000) / 1000,
    Math.round(spot.lng * 1000) / 1000,
  ].join("|");
}

function betterSpot(a, b) {
  const as = Number(a.score || 0);
  const bs = Number(b.score || 0);
  if (bs !== as) return bs - as;

  const at = Array.isArray(a.tags) ? a.tags.length : 0;
  const bt = Array.isArray(b.tags) ? b.tags.length : 0;
  if (bt !== at) return bt - at;

  const ar = normalizeText(a.region || "").length;
  const br = normalizeText(b.region || "").length;
  return br - ar;
}

function summarizeByCountry(arr) {
  const out = {};
  for (const x of arr) {
    out[x.country] = (out[x.country] || 0) + 1;
  }
  return out;
}

function summarizeByRideType(arr) {
  const out = {};
  for (const x of arr) {
    out[x.rideType] = (out[x.rideType] || 0) + 1;
  }
  return out;
}

function summarizeBySpotType(arr) {
  const out = {};
  for (const x of arr) {
    out[x.spotType] = (out[x.spotType] || 0) + 1;
  }
  return out;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Build Rider Spots Archive");
  console.log("====================================");

  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter(isIncludedSourceFile)
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    throw new Error("Nessun file rider-spots*.json trovato in client/public/data");
  }

  console.log("------------------------------------");
  console.log("📦 File sorgente inclusi:");
  for (const file of files) {
    console.log(`- ${file}`);
  }

  const collected = [];
  const fileStats = [];

  for (const file of files) {
    const fullPath = path.resolve(DATA_DIR, file);
    const json = JSON.parse(await fs.readFile(fullPath, "utf8"));

    if (!Array.isArray(json)) {
      console.log(`⚠️ Saltato ${file}: non è un array`);
      continue;
    }

    let valid = 0;

    for (const item of json) {
      const spot = sanitizeSpot(item, file);
      if (!spot) continue;
      collected.push(spot);
      valid += 1;
    }

    fileStats.push({ file, input: json.length, valid });
  }

  if (!collected.length) {
    throw new Error("Nessuno spot valido trovato nei file sorgente");
  }

  const dedupedMap = new Map();

  for (const spot of collected) {
    const key = looseDedupeKey(spot);
    const prev = dedupedMap.get(key);

    if (!prev) {
      dedupedMap.set(key, spot);
      continue;
    }

    const pick = betterSpot(prev, spot) <= 0 ? prev : spot;
    dedupedMap.set(key, pick);
  }

  const finalSpots = [...dedupedMap.values()].sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country);
    if ((a.region || "") !== (b.region || "")) return (a.region || "").localeCompare(b.region || "");
    return (a.name || "").localeCompare(b.name || "");
  });

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalSpots, null, 2), "utf8");

  console.log("------------------------------------");
  console.log("📊 File stats:");
  for (const s of fileStats) {
    console.log(`- ${s.file}: input=${s.input} | valid=${s.valid}`);
  }

  console.log("------------------------------------");
  console.log(`Input raccolti:        ${collected.length}`);
  console.log(`Final spots archive:   ${finalSpots.length}`);
  console.log("Distribuzione country:", summarizeByCountry(finalSpots));
  console.log("Distribuzione rideType:", summarizeByRideType(finalSpots));
  console.log("Distribuzione spotType:", summarizeBySpotType(finalSpots));
  console.log("------------------------------------");
  console.log(`Creato: ${OUTPUT_FILE}`);
  console.log("====================================");
  console.log("✅ Build completato");
  console.log("====================================");
}

main().catch((err) => {
  console.error("💥 Errore buildRiderSpotsArchive");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});