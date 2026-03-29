// =======================================================
// client/scripts/generate-routes-engine-pro.cjs
// MotoPortEU — Routes Engine PRO (COUNTRY FROM COORDS)
// =======================================================

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "client", "public", "data");

const INPUT_PASSES = path.join(DATA_DIR, "passes.generated.json");
const OUTPUT_ROUTES = path.join(DATA_DIR, "routes.generated.json");
const OUTPUT_REVIEW = path.join(DATA_DIR, "routes.generated.review.json");

const OSRM_BASE_URL =
  (process.env.VITE_OSRM_URL || "https://router.project-osrm.org").replace(/\/+$/, "");

const DEFAULT_COUNTRIES = ["DE", "ES", "PT", "CZ", "NO", "GB", "SE", "PL"];
const TARGET_COUNTRIES = (process.env.ROUTE_COUNTRIES || DEFAULT_COUNTRIES.join(","))
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

const MAX_PER_COUNTRY = Number(process.env.ROUTE_MAX_PER_COUNTRY || 80);

const MIN_STRAIGHT_GAP_KM = 18;
const MAX_STRAIGHT_GAP_KM = 95;
const MIN_ROUTE_KM = 25;
const MAX_ROUTE_KM = 150;
const MIN_DURATION_MIN = 20;
const MAX_DURATION_MIN = 190;
const MAX_NEIGHBORS = 8;

const BAD_NAME_RE =
  /\b(enduro|motocross|mx|offroad|off-road|dirt|trail\s?park|kart|karting|raceway|autodrome|speedway|circuit|trackday|pista|crossodromo|scharte|joch|törl|tor\b|querung|kopf|horn|spitze|grat)\b/i;

const GOOD_NAME_RE =
  /\b(pass|passo|col|puerto|giogo|sattel)\b/i;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa =
    s1 * s1 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

function midpoint(a, b) {
  return {
    lat: Number(((a.lat + b.lat) / 2).toFixed(5)),
    lng: Number(((a.lng + b.lng) / 2).toFixed(5)),
  };
}

function inBox(lat, lng, box) {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

// bounding box larghe ma utili per i paesi target
function inferCountry(lat, lon) {
  const boxes = [
    { code: "PT", minLat: 36.8, maxLat: 42.3, minLng: -9.7, maxLng: -6.0 },
    { code: "ES", minLat: 36.0, maxLat: 43.9, minLng: -9.6, maxLng: 3.5 },
    { code: "GB", minLat: 49.8, maxLat: 59.5, minLng: -8.8, maxLng: 1.9 },
    { code: "NO", minLat: 57.5, maxLat: 71.5, minLng: 4.0, maxLng: 31.5 },
    { code: "SE", minLat: 55.0, maxLat: 69.5, minLng: 11.0, maxLng: 24.5 },
    { code: "PL", minLat: 49.0, maxLat: 54.9, minLng: 14.0, maxLng: 24.5 },
    { code: "CZ", minLat: 48.5, maxLat: 51.2, minLng: 12.0, maxLng: 18.9 },
    { code: "DE", minLat: 47.0, maxLat: 55.2, minLng: 5.5, maxLng: 15.8 },
  ];

  for (const box of boxes) {
    if (inBox(lat, lon, box)) return box.code;
  }
  return "";
}

function normalizePass(raw) {
  const name = String(raw?.name || "").trim();
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lon);
  const elev = Number(raw?.ele || raw?.elevation || 0) || 0;
  const region = String(raw?.region || "").trim();
  const type = String(raw?.type || "").trim().toLowerCase();

  if (!name) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (BAD_NAME_RE.test(name)) return null;
  if (type && type !== "pass") return null;
  if (!GOOD_NAME_RE.test(name)) return null;
  const country = inferCountry(lat, lng);
  if (!country) return null;

  return {
    id: String(raw.id || `pass-${slugify(name)}-${lat.toFixed(5)}-${lng.toFixed(5)}`),
    name,
    country,
    region,
    elev,
    coords: { lat, lng },
  };
}

function dedupePasses(items) {
  const seen = new Set();
  const out = [];
  for (const p of items) {
    const key = [
      p.country,
      slugify(p.name),
      p.coords.lat.toFixed(4),
      p.coords.lng.toFixed(4),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function scorePass(p) {
  let score = 0;
  if (GOOD_NAME_RE.test(p.name)) score += 2;
  if (p.region) score += 1;
  if (p.elev >= 2200) score += 5;
  else if (p.elev >= 1800) score += 4;
  else if (p.elev >= 1400) score += 3;
  else if (p.elev >= 1000) score += 2;
  else if (p.elev >= 600) score += 1;
  return score;
}

function groupByCountry(passes) {
  const out = new Map();
  for (const p of passes) {
    if (!out.has(p.country)) out.set(p.country, []);
    out.get(p.country).push(p);
  }
  return out;
}

function pickNeighbors(pass, list) {
  return list
    .filter((x) => x.id !== pass.id)
    .map((x) => ({
      pass: x,
      gapKm: haversineKm(pass.coords, x.coords),
      score: scorePass(x),
    }))
    .filter((x) => x.gapKm >= MIN_STRAIGHT_GAP_KM && x.gapKm <= MAX_STRAIGHT_GAP_KM)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.gapKm - b.gapKm;
    })
    .slice(0, MAX_NEIGHBORS);
}

async function buildOsrmRoute(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/${coords}` +
    `?overview=full&geometries=geojson&steps=false&annotations=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

  const data = await res.json();
  if (data.code !== "Ok" || !Array.isArray(data.routes) || !data.routes.length) {
    throw new Error(`OSRM invalid response: ${data.code || "unknown"}`);
  }

  const best = data.routes[0];
  const line = (best.geometry?.coordinates || []).map(([lng, lat]) => ({ lat, lng }));

  return {
    distanceKm: Number((Number(best.distance || 0) / 1000).toFixed(1)),
    durationMin: Math.round(Number(best.duration || 0) / 60),
    line,
  };
}

function routeLooksValid(a, b, route) {
  if (!route || !Array.isArray(route.line) || route.line.length < 2) return false;
  if (!Number.isFinite(route.distanceKm) || !Number.isFinite(route.durationMin)) return false;

  if (route.distanceKm < MIN_ROUTE_KM) return false;
  if (route.distanceKm > MAX_ROUTE_KM) return false;
  if (route.durationMin < MIN_DURATION_MIN) return false;
  if (route.durationMin > MAX_DURATION_MIN) return false;

  const straight = haversineKm(a.coords, b.coords);
  if (straight < MIN_STRAIGHT_GAP_KM || straight > MAX_STRAIGHT_GAP_KM) return false;

  const ratio = route.distanceKm / Math.max(straight, 1);
  if (ratio < 1.05 || ratio > 3.8) return false;

  return true;
}

function estimateCurvesScore(distanceKm, elevA, elevB, straightGapKm) {
  let score = 5;
  const elevAvg = (Number(elevA || 0) + Number(elevB || 0)) / 2;

  if (elevAvg >= 1800) score += 2;
  else if (elevAvg >= 1300) score += 1;

  if (straightGapKm <= 30) score += 2;
  else if (straightGapKm <= 45) score += 1;

  if (distanceKm >= 85) score -= 1;

  return Math.max(4, Math.min(9, Math.round(score)));
}

function estimateAsphaltScore(country, elevAvg) {
  let score = 7;
  if (["DE", "NO", "SE", "GB"].includes(country)) score += 1;
  if (elevAvg >= 2100) score -= 1;
  return Math.max(5, Math.min(9, score));
}

function estimateBestSeason(country, elevAvg) {
  if (elevAvg >= 1800) return "Giu–Set";
  if (elevAvg >= 1200) return "Mag–Ott";
  if (["NO", "SE"].includes(country)) return "Giu–Set";
  if (["ES", "PT"].includes(country)) return "Mar–Nov";
  return "Apr–Ott";
}

function estimatePace(curvesScore, distanceKm) {
  if (curvesScore >= 8) return "Sport";
  if (distanceKm <= 55) return "Misto";
  return "Touring";
}

function buildRegion(a, b, country) {
  const ra = String(a.region || "").trim();
  const rb = String(b.region || "").trim();
  if (ra && rb && ra !== rb) return `${ra} / ${rb}`;
  if (ra) return ra;
  if (rb) return rb;
  return COUNTRY_LABELS[country] || country;
}

function buildDescription(route) {
  const niceName = route.name.replace(/^🛣️\s*/, "");
  const curves =
    route.curvesScore >= 8
      ? "molto guidato"
      : route.curvesScore >= 7
      ? "ricco di curve"
      : "scorrevole ma piacevole";

  const style =
    route.pace === "Sport"
      ? "perfetto per una guida più brillante"
      : route.pace === "Misto"
      ? "ideale per un ritmo dinamico ma godibile"
      : "perfetto per una guida panoramica e rilassata";

  return `${niceName} è un itinerario rider-friendly nella zona ${route.region}. Un collegamento ${curves}, adatto alla moto stradale, con sviluppo di circa ${route.distanceKm} km e quota massima intorno a ${route.elevation} m. L’asfalto stimato è buono e la tratta si presta bene a chi cerca una tappa europea autentica, ${style}. Periodo consigliato: ${route.bestSeason}.`;
}

function buildRouteRecord(a, b, route) {
  const straight = haversineKm(a.coords, b.coords);
  const elev = Math.max(Number(a.elev || 0), Number(b.elev || 0));
  const elevAvg = (Number(a.elev || 0) + Number(b.elev || 0)) / 2;
  const curvesScore = estimateCurvesScore(route.distanceKm, a.elev, b.elev, straight);
  const asphaltScore = estimateAsphaltScore(a.country, elevAvg);
  const region = buildRegion(a, b, a.country);
  const pace = estimatePace(curvesScore, route.distanceKm);

  const record = {
    id: `tour-${slugify(a.name)}-${slugify(b.name)}-${a.country.toLowerCase()}`,
    name: `🛣️ ${a.name} → ${b.name}`,
    country: a.country,
    region,
    type: "touring_route",
    pace,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    coords: midpoint(a.coords, b.coords),
    line: route.line,
    curvesScore,
    asphaltScore,
    elevation: elev,
    bestSeason: estimateBestSeason(a.country, elevAvg),
    description: "",
    source: "routes_engine_pro",
    createdAt: new Date().toISOString(),
    _generated: true,
    passRefs: [a.id, b.id],
  };

  record.description = buildDescription(record);
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

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Routes Engine PRO");
  console.log("====================================");
  console.log("Paesi target:", TARGET_COUNTRIES.join(", "));
  console.log("Max per paese:", MAX_PER_COUNTRY);
  console.log("OSRM:", OSRM_BASE_URL);
  console.log("");

  if (!fs.existsSync(INPUT_PASSES)) {
    throw new Error(`File non trovato: ${INPUT_PASSES}`);
  }

  const rawJson = readJson(INPUT_PASSES);
  const rawArray = Array.isArray(rawJson) ? rawJson : [];

  console.log("Record grezzi caricati:", rawArray.length);

  const normalized = rawArray.map(normalizePass).filter(Boolean);
  console.log("Passi normalizzati validi:", normalized.length);

  const filtered = dedupePasses(
    normalized.filter((p) => TARGET_COUNTRIES.includes(p.country))
  );
  console.log("Passi disponibili filtrati:", filtered.length);

  const byCountry = groupByCountry(filtered);
  const generated = [];
  const review = [];

  for (const country of TARGET_COUNTRIES) {
    const list = (byCountry.get(country) || [])
      .slice()
      .sort((a, b) => {
        const sa = scorePass(a);
        const sb = scorePass(b);
        if (sb !== sa) return sb - sa;
        return (b.elev || 0) - (a.elev || 0);
      });

    if (!list.length) {
      console.log(`- ${country}: nessun passo utile`);
      continue;
    }

    console.log(`\n→ ${country}... passi candidati: ${list.length}`);

    const countryRoutes = [];
    const seenPair = new Set();

    outer:
    for (const passA of list) {
      const neighbors = pickNeighbors(passA, list);

      for (const n of neighbors) {
        const passB = n.pass;
        const pairKey = [passA.id, passB.id].sort().join("|");
        if (seenPair.has(pairKey)) continue;
        seenPair.add(pairKey);

        try {
          const route = await buildOsrmRoute([passA.coords, passB.coords]);

          if (!routeLooksValid(passA, passB, route)) {
            review.push({
              reason: "filtered_candidate",
              country,
              passA: { id: passA.id, name: passA.name },
              passB: { id: passB.id, name: passB.name },
              distanceKm: route.distanceKm,
              durationMin: route.durationMin,
            });
            continue;
          }

          const rec = buildRouteRecord(passA, passB, route);
          countryRoutes.push(rec);
          console.log(`   + ${rec.name} [${rec.distanceKm} km]`);

          if (countryRoutes.length >= MAX_PER_COUNTRY) break outer;

          await sleep(120);
        } catch (err) {
          review.push({
            reason: "osrm_error",
            country,
            passA: { id: passA.id, name: passA.name },
            passB: { id: passB.id, name: passB.name },
            error: err.message || String(err),
          });
        }
      }
    }

    const cleanCountry = dedupeRoutes(countryRoutes);
    generated.push(...cleanCountry);
    console.log(`   ${country}: generate ${cleanCountry.length}`);
  }

  const finalRoutes = dedupeRoutes(generated).sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country);
    if ((b.curvesScore || 0) !== (a.curvesScore || 0)) {
      return (b.curvesScore || 0) - (a.curvesScore || 0);
    }
    return (b.distanceKm || 0) - (a.distanceKm || 0);
  });

  writeJson(OUTPUT_ROUTES, finalRoutes);
  writeJson(OUTPUT_REVIEW, review);

  const countryCount = {};
  for (const r of finalRoutes) {
    countryCount[r.country] = (countryCount[r.country] || 0) + 1;
  }

  console.log("\n====================================");
  console.log("Completato");
  console.log("====================================");
  console.log("Routes generate:", finalRoutes.length);
  console.log("Review:", review.length);
  console.log("Distribuzione paesi:", countryCount);
  console.log("Creato:", OUTPUT_ROUTES);
  console.log("Creato:", OUTPUT_REVIEW);
}

main().catch((err) => {
  console.error("\n❌ Errore:", err.message || err);
  process.exit(1);
});