// client/scripts/importTracksEuropeOSM.mjs
// Import massivo piste/circuiti Europa da OSM (Overpass) PER PAESE -> formato MotoPortEU
// Output: client/public/data/tracks.eu.json
//
// Avvio:  node scripts/importTracksEuropeOSM.mjs
// (da /client)

import fs from "fs";
import crypto from "crypto";

const OVERPASS = "https://overpass-api.de/api/interpreter";

// Lista “Europa larga” (aggiungi/togli quando vuoi)
const EURO_ISO2 = [
  "IT","FR","DE","ES","PT","GB","IE","NL","BE","LU","CH","AT","PL","CZ","SK","HU",
  "SI","HR","BA","RS","ME","AL","MK","GR","BG","RO","MD","UA","BY","LT","LV","EE",
  "FI","SE","NO","DK","IS","TR","CY","MT","AD","MC","SM","LI",
];

// Anti 429: spacing + retry
const COUNTRY_SPACING_MS = Number(process.env.OVERPASS_SPACING_MS || 700); // pausa tra paesi
const RETRY_TRIES = Number(process.env.OVERPASS_RETRY_TRIES || 6);         // tentativi su 429
const RETRY_BASE_MS = Number(process.env.OVERPASS_RETRY_BASE_MS || 1500);  // backoff base

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}
function norm(s) {
  return String(s || "").trim().replace(/\s+/g, " ").replace(/[’‘]/g, "'");
}
function round6(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 1e6) / 1e6;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function inferType(tags = {}) {
  const name = norm(tags.name).toLowerCase();
  const sport = norm(tags.sport).toLowerCase();
  const motorsport = norm(tags.motorsport).toLowerCase();

  if (
    sport.includes("motocross") ||
    motorsport.includes("motocross") ||
    name.includes("motocross") ||
    name.includes("mx ")
  ) return "cross";

  if (
    name.includes("enduro") ||
    motorsport.includes("enduro") ||
    sport.includes("enduro") ||
    name.includes("offroad") ||
    name.includes("adventure park")
  ) return "enduro";

  return "supersport";
}

function inferSurface(tags = {}) {
  const s = norm(tags.surface).toLowerCase();
  const tracktype = norm(tags.tracktype).toLowerCase();

  if (s.includes("asphalt") || s.includes("paved") || s.includes("concrete")) return "asphalt";
  if (s.includes("dirt") || s.includes("sand") || s.includes("gravel") || s.includes("mud")) return "dirt";
  if (["grade1","grade2","grade3","grade4","grade5"].includes(tracktype)) return "dirt";
  if (norm(tags.highway).toLowerCase() === "raceway") return "asphalt";
  return "mixed";
}

function makeId(name, lat, lng) {
  const key = `${name}|${lat}|${lng}`.toLowerCase();
  return `trk-${sha1(key).slice(0, 8)}`;
}

async function overpassWithRetry(query, tries = RETRY_TRIES) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
    });

    // Rate limit
    if (res.status === 429) {
      const wait = RETRY_BASE_MS * (i + 1);
      console.log(`   ⏳ 429 rate-limit, attendo ${wait}ms e riprovo (${i + 1}/${tries})...`);
      await sleep(wait);
      continue;
    }

    // Altri errori
    if (!res.ok) {
      throw new Error(`Overpass HTTP ${res.status}`);
    }

    return res.json();
  }

  throw new Error("Overpass HTTP 429 (retry esauriti)");
}

function toMotoPortEU(el, forcedCountry) {
  const tags = el.tags || {};
  const name = norm(tags.name);
  if (!name) return null;

  const lat = round6(el.lat ?? el.center?.lat);
  const lng = round6(el.lon ?? el.center?.lon);
  if (lat == null || lng == null) return null;

  const type = inferType(tags);
  const surface = inferSurface(tags);

  // rating/skill default sensati
  const difficulty = type === "supersport" ? 7 : 7;
  const speed = type === "supersport" ? 8 : 6;
  const technique = type === "supersport" ? 7 : 8;

  return {
    id: makeId(name, lat, lng),
    name,
    country: forcedCountry, // ✅ paese imposto dal ciclo
    region: "",
    type,                  // supersport | cross | enduro
    surface,               // asphalt | dirt | mixed
    lengthKm: undefined,
    difficulty,
    speed,
    technique,
    rating: undefined,
    bestSeason: "",
    coords: { lat, lng },
    photo: "",
    description: "Import OSM (da verificare).",
    _osm: {
      osmType: el.type,
      osmId: el.id,
      sport: tags.sport,
      motorsport: tags.motorsport,
      website: tags.website,
    },
  };
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const t of list) {
    const key = `${t.name}|${t.coords.lat}|${t.coords.lng}|${t.country}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

async function fetchCountry(iso2) {
  const q = `
[out:json][timeout:180];
area["ISO3166-1"="${iso2}"][admin_level=2]->.a;
(
  way["highway"="raceway"](area.a);
  relation["highway"="raceway"](area.a);

  way["leisure"="track"]["sport"~"motor|motocross|karting"](area.a);
  relation["leisure"="track"]["sport"~"motor|motocross|karting"](area.a);

  node["sport"="motocross"](area.a);
  way["sport"="motocross"](area.a);
  relation["sport"="motocross"](area.a);

  node["motorsport"](area.a);
  way["motorsport"](area.a);
  relation["motorsport"](area.a);
);
out center tags;
`;

  // spacing tra paesi per non far arrabbiare Overpass
  await sleep(COUNTRY_SPACING_MS);

  const json = await overpassWithRetry(q);

  const items = (json.elements || [])
    .map((el) => toMotoPortEU(el, iso2))
    .filter(Boolean);

  return items;
}

async function main() {
  console.log("📡 Download Overpass (Europa) per paese…");
  console.log(`⚙ spacing=${COUNTRY_SPACING_MS}ms | retry=${RETRY_TRIES} | base=${RETRY_BASE_MS}ms`);

  let all = [];
  let ok = 0;
  let skipped = 0;

  for (const iso2 of EURO_ISO2) {
    try {
      console.log(`→ ${iso2}…`);
      const arr = await fetchCountry(iso2);
      console.log(`   ${iso2}: ${arr.length}`);
      all = all.concat(arr);
      ok++;
    } catch (e) {
      console.log(`   ⚠️ ${iso2} saltato (${e.message})`);
      skipped++;
    }
  }

  const tracks = dedupe(all).sort((a, b) =>
    `${a.country}|${a.name}`.localeCompare(`${b.country}|${b.name}`)
  );

  const outPath = "public/data/tracks.eu.json";
  fs.writeFileSync(outPath, JSON.stringify(tracks, null, 2), "utf-8");

  console.log(`✅ OK: salvati ${tracks.length} circuiti/piste in ${outPath}`);
  console.log(`📊 Paesi ok: ${ok} | saltati: ${skipped}`);
}

main().catch((e) => {
  console.error("❌ ERRORE:", e.message);
  process.exit(1);
});
