// =======================================================
// client/scripts/promote-routes-final-to-live.cjs
// MotoPortEU — Promote routes.final.json to live format
//
// Input:
//   client/public/data/_archive/routes.final.json
//
// Output:
//   client/public/data/routes.promoted.json
//   client/public/data/routes.promoted.review.json
//
// Uso:
//   node client/scripts/promote-routes-final-to-live.cjs
//
// Facoltativo:
//   set PROMOTE_COUNTRIES=DE,ES,PT,CZ,NO,GB,SE,PL
//   set PROMOTE_MAX_PER_COUNTRY=120
//   node client/scripts/promote-routes-final-to-live.cjs
// =======================================================

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "client", "public", "data");
const ARCHIVE_DIR = path.join(DATA_DIR, "_archive");

const INPUT_FILE = path.join(ARCHIVE_DIR, "routes.final.json");
const OUTPUT_FILE = path.join(DATA_DIR, "routes.promoted.json");
const OUTPUT_REVIEW = path.join(DATA_DIR, "routes.promoted.review.json");

const DEFAULT_COUNTRIES = ["DE", "ES", "PT", "CZ", "NO", "GB", "SE", "PL"];
const TARGET_COUNTRIES = (process.env.PROMOTE_COUNTRIES || DEFAULT_COUNTRIES.join(","))
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const MAX_PER_COUNTRY = Number(process.env.PROMOTE_MAX_PER_COUNTRY || 120);

// filtri qualità
const BAD_NAME_RE =
  /\b(enduro|motocross|mx|offroad|off-road|dirt|trail|kart|karting|raceway|autodrome|speedway|circuit|trackday|crossodromo|pista|test track)\b/i;

const BAD_DESC_RE =
  /\b(enduro|motocross|mx|offroad|off-road|dirt|trail|kart|karting|raceway|autodrome|speedway|circuit|trackday|crossodromo|pista)\b/i;

const GOOD_NAME_RE =
  /\b(pass|passo|col|puerto|sattel|panorama|mountain|berg|höhe|hohe|road|route|tour|scenic)\b/i;

const COUNTRY_LABELS = {
  DE: "Germania",
  ES: "Spagna",
  PT: "Portogallo",
  CZ: "Repubblica Ceca",
  NO: "Norvegia",
  GB: "Regno Unito",
  SE: "Svezia",
  PL: "Polonia",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function num(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function midpoint(a, b) {
  return {
    lat: Number(((a.lat + b.lat) / 2).toFixed(5)),
    lng: Number(((a.lng + b.lng) / 2).toFixed(5)),
  };
}

function normalizeCountry(raw) {
  const c = String(raw.country || raw.countryCode || "").trim().toUpperCase();
  return c === "UK" ? "GB" : c;
}

function extractEndpoints(raw) {
  // formato archivio tipico:
  // start: [lat,lng]
  // end:   [lat,lng]

  const s = Array.isArray(raw.start) ? raw.start : null;
  const e = Array.isArray(raw.end) ? raw.end : null;

  if (s && e && s.length >= 2 && e.length >= 2) {
    const sLat = num(s[0]);
    const sLng = num(s[1]);
    const eLat = num(e[0]);
    const eLng = num(e[1]);

    if (
      Number.isFinite(sLat) &&
      Number.isFinite(sLng) &&
      Number.isFinite(eLat) &&
      Number.isFinite(eLng)
    ) {
      return {
        start: { lat: sLat, lng: sLng },
        end: { lat: eLat, lng: eLng },
      };
    }
  }

  return null;
}

function buildLineFromEndpoints(start, end) {
  return [
    { lat: start.lat, lng: start.lng },
    { lat: end.lat, lng: end.lng },
  ];
}

function normalizePace(rawPace, curvesScore, distanceKm) {
  const p = String(rawPace || "").trim().toLowerCase();

  if (p === "sport" || p === "sportivo") return "Sport";
  if (p === "misto" || p === "mixed") return "Misto";
  if (p === "touring" || p === "tour") return "Touring";

  if (curvesScore >= 8) return "Sport";
  if (distanceKm <= 55) return "Misto";
  return "Touring";
}

function normalizeSeason(rawSeason, country, elevation) {
  const s = String(rawSeason || "").trim();
  if (s) {
    return s
      .replace(/May/gi, "Mag")
      .replace(/Jun/gi, "Giu")
      .replace(/Jul/gi, "Lug")
      .replace(/Aug/gi, "Ago")
      .replace(/Sep/gi, "Set")
      .replace(/Oct/gi, "Ott")
      .replace(/Apr/gi, "Apr")
      .replace(/Mar/gi, "Mar");
  }

  if (elevation >= 1800) return "Giu–Set";
  if (elevation >= 1200) return "Mag–Ott";
  if (["NO", "SE"].includes(country)) return "Giu–Set";
  if (["ES", "PT"].includes(country)) return "Mar–Nov";
  return "Apr–Ott";
}

function normalizeDescription(raw, promoted) {
  const d = String(raw.description || "").trim();
  if (d && !BAD_DESC_RE.test(d)) {
    return d;
  }

  const style =
    promoted.pace === "Sport"
      ? "perfetto per una guida più brillante"
      : promoted.pace === "Misto"
      ? "ideale per un ritmo dinamico ma godibile"
      : "perfetto per una guida panoramica e rilassata";

  const curves =
    promoted.curvesScore >= 8
      ? "molto guidato"
      : promoted.curvesScore >= 7
      ? "ricco di curve"
      : "scorrevole ma piacevole";

  return `${promoted.name.replace(/^🛣️\s*/, "")} è un itinerario rider-friendly nella zona ${promoted.region}. Un collegamento ${curves}, adatto alla moto stradale, con sviluppo di circa ${promoted.distanceKm} km. L’asfalto stimato è buono e la tratta si presta bene a chi cerca una tappa europea autentica, ${style}. Periodo consigliato: ${promoted.bestSeason}.`;
}

function seemsGoodCandidate(raw) {
  const name = String(raw.name || "").trim();
  const desc = String(raw.description || "").trim();
  const country = normalizeCountry(raw);
  const distanceKm = num(raw.distanceKm, 0);
  const curvesScore = num(raw.curvesScore, null);
  const asphaltScore = num(raw.asphaltScore, null);
  const endpoints = extractEndpoints(raw);

  if (!name) return { ok: false, reason: "missing_name" };
  if (!country) return { ok: false, reason: "missing_country" };
  if (!TARGET_COUNTRIES.includes(country)) return { ok: false, reason: "country_not_target" };
  if (!endpoints) return { ok: false, reason: "missing_endpoints" };

  if (BAD_NAME_RE.test(name)) return { ok: false, reason: "bad_name" };
  if (desc && BAD_DESC_RE.test(desc)) return { ok: false, reason: "bad_description" };

  if (distanceKm < 20 || distanceKm > 220) {
    return { ok: false, reason: "distance_out_of_range" };
  }

  if (curvesScore != null && (curvesScore < 4 || curvesScore > 10)) {
    return { ok: false, reason: "invalid_curves_score" };
  }

  if (asphaltScore != null && asphaltScore < 5) {
    return { ok: false, reason: "low_asphalt_score" };
  }

  // se il nome non è molto forte, chiediamo un po' più di struttura
  const isStrongName = GOOD_NAME_RE.test(name);
  if (!isStrongName && distanceKm < 30) {
    return { ok: false, reason: "weak_name_short_route" };
  }

  return { ok: true, reason: "ok" };
}

function convertRecord(raw) {
  const country = normalizeCountry(raw);
  const region = String(raw.region || COUNTRY_LABELS[country] || country).trim();
  const distanceKm = num(raw.distanceKm, 0);
  const curvesScore = clamp(num(raw.curvesScore, 6), 4, 9);
  const asphaltScore = clamp(num(raw.asphaltScore, 7), 5, 9);
  const elevation = Math.max(
    0,
    Math.round(num(raw.elevation, 0) || num(raw.elev, 0) || 0)
  );

  const endpoints = extractEndpoints(raw);
  const coords = midpoint(endpoints.start, endpoints.end);
  const line = buildLineFromEndpoints(endpoints.start, endpoints.end);

  const record = {
    id: `tour-${slugify(raw.name)}-${country.toLowerCase()}`,
    name: `🛣️ ${String(raw.name || "").trim()}`,
    country,
    region,
    type: "touring_route",
    pace: normalizePace(raw.pace, curvesScore, distanceKm),
    distanceKm,
    durationMin: Math.max(25, Math.round((distanceKm / 58) * 60)),
    coords,
    line,
    curvesScore,
    asphaltScore,
    elevation,
    bestSeason: normalizeSeason(raw.bestSeason, country, elevation),
    description: "",
    source: "routes_engine_pro",
    createdAt: new Date().toISOString(),
    _generated: true,
    passRefs: [],
  };

  record.description = normalizeDescription(raw, record);
  return record;
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const out = [];

  for (const r of routes) {
    const key = [
      r.country,
      slugify(r.name),
      Number(r.distanceKm || 0).toFixed(1),
      Number(r.coords?.lat || 0).toFixed(3),
      Number(r.coords?.lng || 0).toFixed(3),
    ].join("|");

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }

  return out;
}

function groupByCountry(items) {
  const map = new Map();
  for (const item of items) {
    const c = item.country;
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(item);
  }
  return map;
}

function qualityScore(raw) {
  let score = 0;

  const distanceKm = num(raw.distanceKm, 0);
  const curvesScore = num(raw.curvesScore, 0);
  const asphaltScore = num(raw.asphaltScore, 0);
  const elevation = num(raw.elevation, 0) || num(raw.elev, 0) || 0;
  const name = String(raw.name || "");
  const desc = String(raw.description || "");
  const region = String(raw.region || "");

  if (GOOD_NAME_RE.test(name)) score += 3;
  if (region) score += 1;
  if (desc && desc.length > 80) score += 2;
  if (distanceKm >= 35 && distanceKm <= 140) score += 2;
  if (curvesScore >= 7) score += 2;
  if (asphaltScore >= 7) score += 1;
  if (elevation >= 900) score += 1;
  if (elevation >= 1500) score += 1;

  return score;
}

function main() {
  console.log("====================================");
  console.log("MotoPortEU — Promote Routes Final");
  console.log("====================================");
  console.log("Paesi target:", TARGET_COUNTRIES.join(", "));
  console.log("Max per paese:", MAX_PER_COUNTRY);
  console.log("");

  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`File non trovato: ${INPUT_FILE}`);
  }

  const raw = readJson(INPUT_FILE);
  const arr = Array.isArray(raw) ? raw : [];

  console.log("Record archivio caricati:", arr.length);

  const accepted = [];
  const review = [];

  for (const item of arr) {
    const check = seemsGoodCandidate(item);
    if (!check.ok) {
      review.push({
        reason: check.reason,
        country: normalizeCountry(item),
        id: item.id || "",
        name: item.name || "",
      });
      continue;
    }

    accepted.push(item);
  }

  console.log("Record candidati dopo filtro:", accepted.length);

  const grouped = groupByCountry(
    accepted.map((x) => ({
      ...x,
      country: normalizeCountry(x),
      _score: qualityScore(x),
    }))
  );

  const promoted = [];

  for (const country of TARGET_COUNTRIES) {
    const list = (grouped.get(country) || [])
      .slice()
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        if ((b.curvesScore || 0) !== (a.curvesScore || 0)) {
          return (b.curvesScore || 0) - (a.curvesScore || 0);
        }
        return (b.distanceKm || 0) - (a.distanceKm || 0);
      });

    if (!list.length) {
      console.log(`- ${country}: nessun record promosso`);
      continue;
    }

    const picked = list.slice(0, MAX_PER_COUNTRY).map(convertRecord);
    promoted.push(...picked);

    console.log(`- ${country}: ${picked.length} promossi`);
  }

  const finalRoutes = dedupeRoutes(promoted).sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country);
    if ((b.curvesScore || 0) !== (a.curvesScore || 0)) {
      return (b.curvesScore || 0) - (a.curvesScore || 0);
    }
    return (b.distanceKm || 0) - (a.distanceKm || 0);
  });

  writeJson(OUTPUT_FILE, finalRoutes);
  writeJson(OUTPUT_REVIEW, review);

  const stats = {};
  for (const r of finalRoutes) {
    stats[r.country] = (stats[r.country] || 0) + 1;
  }

  console.log("");
  console.log("====================================");
  console.log("Completato");
  console.log("====================================");
  console.log("Routes promote:", finalRoutes.length);
  console.log("Review:", review.length);
  console.log("Distribuzione paesi:", stats);
  console.log("Creato:", OUTPUT_FILE);
  console.log("Creato:", OUTPUT_REVIEW);
}

try {
  main();
} catch (err) {
  console.error("\n❌ Errore:", err.message || err);
  process.exit(1);
}