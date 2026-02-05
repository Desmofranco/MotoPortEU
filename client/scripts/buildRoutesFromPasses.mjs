import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.resolve(ROOT, "client/public/data");
const ROUTES_PATH = path.resolve(DATA_DIR, "routes.json");

// ===================== utils =====================
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}
function norm(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}
function slugify(s) {
  return norm(s)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
function pickLatLng(x) {
  const lat = x?.lat ?? x?.latitude ?? x?.coords?.lat ?? x?.location?.lat;
  const lng = x?.lng ?? x?.lon ?? x?.longitude ?? x?.coords?.lng ?? x?.location?.lng;
  if (lat == null || lng == null) return null;
  const a = Number(lat);
  const b = Number(lng);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return { lat: a, lng: b };
}
function asArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.passes)) return maybe.passes;
  if (Array.isArray(maybe?.items)) return maybe.items;
  if (Array.isArray(maybe?.data)) return maybe.data;
  if (Array.isArray(maybe?.tracks)) return maybe.tracks;
  return [];
}

function normalizeCountry(raw) {
  const s = norm(raw).toUpperCase();
  // prende il primo codice 2-lettere se esiste
  const m = s.match(/\b[A-Z]{2}\b/);
  if (m) return m[0];
  // fallback: primi 2 char
  return s.slice(0, 2) || "";
}

function looksLikePassItem(o) {
  if (!o || typeof o !== "object") return false;
  const c = pickLatLng(o);
  if (!c) return false;
  const name = o?.name || o?.title || o?.pass || o?.col || o?.saddle;
  return !!String(name || "").trim();
}

function scoreCandidateFile(filePath) {
  try {
    const raw = readJSON(filePath);
    const arr = asArray(raw);
    if (!arr.length) return 0;
    let ok = 0;
    const step = Math.max(1, Math.floor(arr.length / 800));
    for (let i = 0; i < arr.length; i += step) {
      if (looksLikePassItem(arr[i])) ok++;
    }
    const name = path.basename(filePath).toLowerCase();
    const bonus = /pass|col|saddle|mount|stelvio|alp|track/i.test(name) ? 50 : 0;
    return ok + bonus;
  } catch {
    return 0;
  }
}

function findBestPassSource() {
  if (!fs.existsSync(DATA_DIR)) return null;
  const all = fs.readdirSync(DATA_DIR).filter((n) => n.toLowerCase().endsWith(".json"));
  const candidates = all
    .map((n) => path.resolve(DATA_DIR, n))
    .filter((p) => path.basename(p).toLowerCase() !== "routes.json");

  let best = null;
  let bestScore = 0;

  for (const f of candidates) {
    const s = scoreCandidateFile(f);
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }

  return bestScore >= 10 ? best : null;
}

// ====== euristica ritmo ======
function inferPace({ type, curves, elevation, distanceKm, surface }) {
  const surf = String(surface || "").toLowerCase();

  if (type === "offroad" || /dirt|gravel|ster|unpaved|trail/.test(surf)) return "Avventura";

  const el = Number(elevation || 0) || 0;
  const cv = Number(curves || 0) || 0;
  const km = Number(distanceKm || 0) || 0;

  if (cv >= 9 || el >= 2200) return "Tecnico";
  if (cv >= 7) return "Misto";
  if (km >= 280) return "Touring";

  // default “passo” singolo (km spesso 0): resta Touring
  return km ? "Veloce" : "Touring";
}

// =============== pass → route =================
function passToRoute(p) {
  const nameRaw = p?.name || p?.title || p?.pass || p?.col || p?.saddle || "Passo";
  const name = `🏔 ${norm(nameRaw)}`;

  const countryRaw = (p?.country || p?.nation || p?.iso || "").toString();
  const country = normalizeCountry(countryRaw);

  const region = norm((p?.region || p?.area || p?.state || "").toString());

  const coords = pickLatLng(p);

  const latKey = coords ? coords.lat.toFixed(5) : "0";
  const lngKey = coords ? coords.lng.toFixed(5) : "0";

  const id =
    String(p?.id || "").trim() ||
    `pass-${slugify(nameRaw)}-${slugify(country || "xx")}-${slugify(region || "na")}-${latKey}-${lngKey}`;

  const elevation =
    p?.elevation ?? p?.ele ?? p?.altitude ?? p?.alt ?? p?.height ?? p?.meters ?? null;

  const curves = Number(p?.curvesScore || p?.curves || p?.twists || 0) || 0;
  const asphalt = Number(p?.asphaltScore || p?.asphalt || 0) || 0;

  const type = "touring";
  const distanceKm = Number(p?.distanceKm || p?.distance || 0) || 0;

  const pace = inferPace({
    type,
    curves,
    elevation,
    distanceKm,
    surface: p?.surface || p?.terrain,
  });

  const desc =
    p?.description ||
    p?.desc ||
    (elevation != null ? `Quota: ${Number(elevation)} m` : "") ||
    "";

  return {
    id,
    name,
    country,
    region,
    type,
    pace, // ✅ questo sblocca i filtri “Ritmo”
    distanceKm,
    durationMin: Number(p?.durationMin || p?.duration || 0) || 0,
    coords,
    line: Array.isArray(p?.line) ? p.line : undefined,
    curvesScore: curves || undefined,
    asphaltScore: asphalt || undefined,
    bestSeason: p?.bestSeason || p?.season || "Apr–Ott",
    description: desc,
    photo: p?.photo || p?.image || p?.cover || undefined,
    source: "passes",
    createdAt: new Date().toISOString(),
    _generated: true,
  };
}

function mergeRoutes(curated, imported) {
  const seen = new Set();
  const out = [];

  for (const x of curated) {
    const id = String(x?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }
  for (const x of imported) {
    const id = String(x?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(x);
  }
  return out;
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error("❌ DATA_DIR non trovata:", DATA_DIR);
    process.exit(1);
  }
  if (!fs.existsSync(ROUTES_PATH)) {
    console.error("❌ routes.json non trovato:", ROUTES_PATH);
    process.exit(1);
  }

  const source = findBestPassSource();
  if (!source) {
    console.error("❌ Non trovo un file Passes valido in:", DATA_DIR);
    process.exit(1);
  }

  const curatedRaw = readJSON(ROUTES_PATH);
  const curated = Array.isArray(curatedRaw) ? curatedRaw : asArray(curatedRaw);

  const srcRaw = readJSON(source);
  const srcArr = asArray(srcRaw);

  const imported = srcArr
    .filter(looksLikePassItem)
    .map(passToRoute)
    .filter((r) => r?.id && r?.coords);

  const merged = mergeRoutes(curated, imported);
  writeJSON(ROUTES_PATH, merged);

  console.log("✅ buildRoutesFromPasses OK");
  console.log("Sorgente:", path.basename(source));
  console.log("Curati (pre):", curated.length);
  console.log("Passi letti:", srcArr.length);
  console.log("Importati:", imported.length);
  console.log("Totale routes.json:", merged.length);
}

main();