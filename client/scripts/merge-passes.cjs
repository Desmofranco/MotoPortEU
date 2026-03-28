const fs = require("fs");
const path = require("path");

const existingPath = path.join(__dirname, "..", "public", "data", "rider-spots.cleaned.json");
const generatedPath = path.join(__dirname, "..", "public", "data", "passes.generated.json");
const outputPath = path.join(__dirname, "..", "public", "data", "rider-spots.cleaned.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function makeKey(item) {
  const name = norm(item.name);
  const lat = toNum(item.lat);
  const lon = toNum(item.lon);

  const latKey = lat != null ? lat.toFixed(3) : "x";
  const lonKey = lon != null ? lon.toFixed(3) : "x";

  return `${name}|${latKey}|${lonKey}`;
}

function normalizeSpot(item, index = 0) {
  const lat = toNum(item.lat);
  const lon = toNum(item.lon);

  if (lat == null || lon == null) return null;
  if (!item.name) return null;

  return {
    id: item.id || `pass-${index}-${Date.now()}`,
    name: String(item.name).trim(),
    lat,
    lon,
    ele: item.ele || null,
    region: item.region || item.country || null,
    type: item.type || "pass",
    category: item.category || "mountain_pass",
    source: item.source || "merged",
  };
}

const existing = readJson(existingPath);
const generated = readJson(generatedPath);

const mergedRaw = [...existing, ...generated];
const map = new Map();

for (let i = 0; i < mergedRaw.length; i++) {
  const item = normalizeSpot(mergedRaw[i], i);
  if (!item) continue;

  const key = makeKey(item);

  if (!map.has(key)) {
    map.set(key, item);
    continue;
  }

  const prev = map.get(key);

  const prevScore =
    (prev.source ? 1 : 0) +
    (prev.ele ? 1 : 0) +
    (prev.region ? 1 : 0);

  const currScore =
    (item.source ? 1 : 0) +
    (item.ele ? 1 : 0) +
    (item.region ? 1 : 0);

  if (currScore > prevScore) {
    map.set(key, item);
  }
}

const finalData = Array.from(map.values()).sort((a, b) =>
  a.name.localeCompare(b.name, "it", { sensitivity: "base" })
);

fs.writeFileSync(outputPath, JSON.stringify(finalData, null, 2), "utf8");

console.log("✅ Merge completato");
console.log("Existing:", existing.length);
console.log("Generated:", generated.length);
console.log("Final:", finalData.length);
console.log("Output:", outputPath);