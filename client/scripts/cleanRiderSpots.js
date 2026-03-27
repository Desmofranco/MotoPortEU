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
  return String(str).trim().toLowerCase();
}

function looksLikeRealPass(name = "", address = "") {
  const text = `${name} ${address}`.toLowerCase();

  return (
    text.includes("passo") ||
    text.includes(" pass") ||
    text.includes("col ") ||
    text.includes("joch")
  );
}

function shouldExclude(spot) {
  const text = `${spot.name || ""} ${spot.address || ""}`.toLowerCase();

  const bad = [
    "hotel",
    "restaurant",
    "ristorante",
    "bar",
    "cafe",
    "caffè",
    "parking",
    "parcheggio",
    "campeggio",
    "camping",
    "resort",
    "spa",
    "shop",
    "store",
    "museo",
    "museum",
    "fuel station",
    "benzinaio",
    "autogrill",
    "dealer",
    "concessionaria",
    "rent",
    "rental"
  ];

  return bad.some((w) => text.includes(w));
}

function inferCountry(address = "", region = "") {
  const text = `${address} ${region}`.toLowerCase();

  if (text.includes("italy") || text.includes("italia") || text.includes("it-alpi")) return "IT";
  if (text.includes("switzerland") || text.includes("svizzera") || text.includes("ch")) return "CH";
  if (text.includes("austria") || text.includes("österreich") || text.includes("at")) return "AT";
  if (text.includes("france") || text.includes("francia") || text.includes("fr-alps")) return "FR";
  if (text.includes("germany") || text.includes("germania") || text.includes("de-south")) return "DE";

  return null;
}

function buildScore(spot) {
  let score = 0;

  if ((spot.name || "").toLowerCase().includes("passo")) score += 30;
  if ((spot.name || "").toLowerCase().includes("col ")) score += 25;
  if ((spot.name || "").toLowerCase().includes("joch")) score += 25;
  if (spot.rating >= 4.5) score += 10;
  if (spot.userRatingCount >= 100) score += 10;
  if (spot.userRatingCount >= 500) score += 10;

  return Math.min(score, 100);
}

function dedupe(spots) {
  const map = new Map();

  for (const s of spots) {
    const key = s.sourceId || `${slugify(s.name)}_${s.lat}_${s.lng}`;
    if (!map.has(key)) map.set(key, s);
  }

  return [...map.values()];
}

async function main() {
  const raw = JSON.parse(await fs.readFile(IN_PATH, "utf8"));

  const filtered = raw
    .filter((spot) => spot && spot.name && spot.lat != null && spot.lng != null)
    .filter((spot) => looksLikeRealPass(spot.name, spot.address))
    .filter((spot) => !shouldExclude(spot))
    .map((spot) => {
      const country = inferCountry(spot.address, spot.region);

      return {
        ...spot,
        country,
        tags: Array.from(new Set([...(spot.tags || []), "rider-spot", "mountain-pass"])),
        riderScore: buildScore(spot)
      };
    });

  const unique = dedupe(filtered).sort((a, b) => {
    if ((b.riderScore || 0) !== (a.riderScore || 0)) {
      return (b.riderScore || 0) - (a.riderScore || 0);
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "it");
  });

  await fs.writeFile(OUT_PATH, JSON.stringify(unique, null, 2), "utf8");

  console.log(`✅ Input: ${raw.length}`);
  console.log(`✅ Output pulito: ${unique.length}`);
  console.log(`✅ Salvato in: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("❌ Errore cleanRiderSpots:", err);
  process.exit(1);
});