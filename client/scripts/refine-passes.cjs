const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "..", "public", "data", "rider-spots.cleaned.json");
const outputPath = path.join(__dirname, "..", "public", "data", "rider-spots.cleaned.json");
const backupPath = path.join(__dirname, "..", "public", "data", "rider-spots.backup.before-refine.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s\-'/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanName(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/^\s*[-–—,:;./]+/, "")
    .replace(/[-–—,:;./]+\s*$/, "")
    .trim();
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

function hasUsefulPassSignal(nameNorm) {
  const signals = [
    "pass",
    "passo",
    "col",
    "joch",
    "puerto",
    "port",
    "forcella",
    "sella",
    "colle",
    "bocca",
    "monte croce",
    "stalle",
    "stelvio",
    "giau",
    "pordoi",
    "gardena",
    "sella",
    "fedaia",
    "falzarego",
    "rolle",
    "tonale",
  ];
  return signals.some((x) => nameNorm.includes(x));
}

function isBadName(name) {
  const n = norm(name);
  if (!n) return true;
  if (n.length < 3) return true;
  if (/^\d+$/.test(n)) return true;
  if (/^(node|way|relation|unknown|null|n a|na)$/.test(n)) return true;
  if (/^[^a-zàèéìòù]*$/i.test(name)) return true;

  const badFragments = [
    "parking",
    "parcheggio",
    "hotel",
    "restaurant",
    "ristorante",
    "bar ",
    " fuel",
    "fuel ",
    "station",
    "benzinaio",
    "viewpoint",
    "belvedere",
    "museum",
    "museo",
    "camping",
    "shop",
    "supermarket",
    "market",
    "bus stop",
    "bus_station",
    "intersection",
    "junction",
    "roundabout",
    "rotonda",
    "tunnel",
    "bridge",
    "ponte",
    "lago",
    "lake",
    "beach",
    "spiaggia",
  ];

  if (badFragments.some((x) => n.includes(x.trim()))) return true;

  return false;
}

function qualityScore(item) {
  const n = norm(item.name);
  let score = 0;

  if (item.name) score += 2;
  if (item.lat != null && item.lon != null) score += 2;
  if (item.ele) score += 1;
  if (item.region) score += 1;
  if (item.category === "mountain_pass") score += 1;
  if (item.type === "pass") score += 1;
  if (hasUsefulPassSignal(n)) score += 3;
  if (n.length >= 5 && n.length <= 40) score += 1;

  return score;
}

function normalizeItem(item, i) {
  const lat = toNum(item.lat);
  const lon = toNum(item.lon);
  const name = cleanName(item.name);

  if (lat == null || lon == null) return null;
  if (!name) return null;
  if (isBadName(name)) return null;

  return {
    id: item.id || `pass-${i}`,
    name,
    lat,
    lon,
    ele: item.ele || null,
    region: item.region || item.country || null,
    type: "pass",
    category: "mountain_pass",
    source: item.source || "osm",
  };
}

const raw = readJson(inputPath);
writeJson(backupPath, raw);

const normalized = [];
let removedInvalid = 0;

for (let i = 0; i < raw.length; i++) {
  const item = normalizeItem(raw[i], i);
  if (!item) {
    removedInvalid++;
    continue;
  }
  normalized.push(item);
}

// 1) dedup forte su nome + coordinate arrotondate
const byKey = new Map();

for (const item of normalized) {
  const key = `${norm(item.name)}|${item.lat.toFixed(3)}|${item.lon.toFixed(3)}`;
  if (!byKey.has(key)) {
    byKey.set(key, item);
    continue;
  }

  const prev = byKey.get(key);
  if (qualityScore(item) > qualityScore(prev)) {
    byKey.set(key, item);
  }
}

const step1 = Array.from(byKey.values());

// 2) dedup geografico: stesso nome e troppo vicini
const sorted = [...step1].sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }));
const finalData = [];
let removedNearDupes = 0;

for (const item of sorted) {
  const existing = finalData.find((x) => {
    if (norm(x.name) !== norm(item.name)) return false;
    const dist = haversineKm(x.lat, x.lon, item.lat, item.lon);
    return dist < 1.2; // entro 1.2 km lo consideriamo doppione vicino
  });

  if (!existing) {
    finalData.push(item);
    continue;
  }

  if (qualityScore(item) > qualityScore(existing)) {
    const idx = finalData.indexOf(existing);
    finalData[idx] = item;
  }
  removedNearDupes++;
}

writeJson(outputPath, finalData);

console.log("✅ Refine completato");
console.log("Input:", raw.length);
console.log("Normalizzati:", normalized.length);
console.log("Scartati invalidi/sporchi:", removedInvalid);
console.log("Dopo dedup chiave:", step1.length);
console.log("Doppioni vicini rimossi:", removedNearDupes);
console.log("Finale:", finalData.length);
console.log("Backup:", backupPath);
console.log("Output:", outputPath);