import fs from "fs/promises";
import path from "path";

const IN_PATH = path.resolve("client/public/data/rider-spots.json");
const OUT_PATH = path.resolve("client/public/data/rider-spots.cleaned.json");

function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function norm(str = "") {
  return String(str).toLowerCase().trim();
}

function textOf(spot) {
  return `${spot.name || ""} ${spot.address || ""}`.toLowerCase();
}

function rawTypesOf(spot) {
  return Array.isArray(spot.rawTypes) ? spot.rawTypes.map((t) => norm(t)) : [];
}

function hasPassSignal(name = "", address = "", rawTypes = []) {
  const text = `${name} ${address}`.toLowerCase();
  const types = rawTypes.map((t) => norm(t));

  const textSignals = [
    "passo ",
    " passo",
    " pass ",
    "pass ",
    "col ",
    " col ",
    "joch",
    "passhöhe",
    "mountain pass",
    "alp pass"
  ];

  const typeSignals = [
    "natural_feature"
  ];

  return (
    textSignals.some((k) => text.includes(k)) ||
    types.some((t) => typeSignals.includes(t))
  );
}

function hasBadWord(text = "") {
  const badWords = [
    "hotel",
    "restaurant",
    "ristorante",
    "bar",
    "cafe",
    "caffè",
    "parking",
    "parcheggio",
    "camping",
    "campeggio",
    "museum",
    "museo",
    "resort",
    "spa",
    "shop",
    "store",
    "fuel station",
    "benzinaio",
    "autogrill",
    "rental",
    "rent",
    "dealer",
    "concessionaria",
    "rifugio",
    "hut",
    "hostel",
    "bivouac"
  ];

  return badWords.some((w) => text.includes(w));
}

function hasBadRawType(rawTypes = []) {
  const badTypes = new Set([
    "restaurant",
    "austrian_restaurant",
    "italian_restaurant",
    "european_restaurant",
    "bar",
    "cafe",
    "coffee_shop",
    "hotel",
    "lodging",
    "hostel",
    "parking",
    "parking_lot",
    "campground",
    "camping_cabin",
    "museum",
    "store",
    "gas_station",
    "car_rental",
    "vehicle_dealer",
    "rv_park"
  ]);

  return rawTypes.map((t) => norm(t)).some((t) => badTypes.has(t));
}

function inferCountry(address = "", region = "") {
  const text = `${address} ${region}`.toLowerCase();

  if (text.includes("italy") || text.includes("italia") || text.includes("it-alpi")) return "IT";
  if (text.includes("switzerland") || text.includes("svizzera") || /\bch\b/.test(text)) return "CH";
  if (text.includes("austria") || text.includes("österreich") || /\bat\b/.test(text)) return "AT";
  if (text.includes("france") || text.includes("francia") || text.includes("fr-alps")) return "FR";
  if (text.includes("germany") || text.includes("germania") || text.includes("de-south")) return "DE";

  return null;
}

function buildScore(spot) {
  const name = norm(spot.name);
  const rawTypes = rawTypesOf(spot);

  let score = 0;

  if (name.includes("passo")) score += 35;
  if (name.includes("col ")) score += 30;
  if (name.includes("joch")) score += 30;
  if (name.includes("passhöhe")) score += 30;
  if (name.includes("pass")) score += 15;

  if (spot.rating >= 4.5) score += 10;
  if (spot.userRatingCount >= 20) score += 5;
  if (spot.userRatingCount >= 100) score += 10;
  if (spot.userRatingCount >= 500) score += 10;

  if (rawTypes.includes("natural_feature")) score += 10;

  return Math.min(score, 100);
}

function dedupe(spots) {
  const map = new Map();

  for (const s of spots) {
    const key = s.sourceId || `${slugify(s.name)}_${s.lat}_${s.lng}`;
    const prev = map.get(key);

    if (!prev || (s.riderScore || 0) > (prev.riderScore || 0)) {
      map.set(key, s);
    }
  }

  return [...map.values()];
}

async function main() {
  const raw = JSON.parse(await fs.readFile(IN_PATH, "utf8"));

  const filtered = raw
    .filter((spot) => spot && spot.name && spot.lat != null && spot.lng != null)
    .filter((spot) => hasPassSignal(spot.name, spot.address, spot.rawTypes || []))
    .filter((spot) => !hasBadWord(textOf(spot)))
    .filter((spot) => !hasBadRawType(rawTypesOf(spot)))
    .map((spot) => {
      const country = inferCountry(spot.address, spot.region);
      const riderScore = buildScore(spot);

      return {
        ...spot,
        country,
        tags: Array.from(new Set([...(spot.tags || []), "rider-spot", "mountain-pass"])),
        riderScore
      };
    })
    .filter((spot) => spot.riderScore >= 35);

  const unique = dedupe(filtered).sort((a, b) => {
    if ((b.riderScore || 0) !== (a.riderScore || 0)) {
      return (b.riderScore || 0) - (a.riderScore || 0);
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "it");
  });

  await fs.writeFile(OUT_PATH, JSON.stringify(unique, null, 2), "utf8");

  console.log(`✅ Input: ${raw.length}`);
  console.log(`✅ Output pulito v3: ${unique.length}`);
  console.log(`📁 Salvato in: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});