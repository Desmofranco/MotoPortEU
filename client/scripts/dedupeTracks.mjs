// client/scripts/dedupeTracks.mjs
// Dedup intelligente piste OSM

import fs from "fs";

const IN = "public/data/tracks.eu.json";
const OUT = "public/data/tracks.eu.clean.json";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function close(a, b) {
  return Math.abs(a - b) < 0.002; // ~200m tolleranza
}

function keyName(t) {
  return norm(t.name);
}

function sameTrack(a, b) {
  if (keyName(a) !== keyName(b)) return false;
  if (!a.coords || !b.coords) return false;
  return close(a.coords.lat, b.coords.lat) &&
         close(a.coords.lng, b.coords.lng);
}

const raw = JSON.parse(fs.readFileSync(IN, "utf-8"));

const clean = [];

for (const t of raw) {
  const dup = clean.find(x => sameTrack(x, t));
  if (!dup) {
    clean.push(t);
  }
}

fs.writeFileSync(OUT, JSON.stringify(clean, null, 2));

console.log("Input:", raw.length);
console.log("Clean:", clean.length);
console.log("Removed:", raw.length - clean.length);
console.log("Saved ->", OUT);
