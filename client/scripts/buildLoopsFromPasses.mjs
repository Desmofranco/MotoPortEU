import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.resolve(ROOT, "client/public/data");

const SOURCE_PATH = path.resolve(DATA_DIR, "passes.eu.seed.json");
const PREVIEW_PATH = path.resolve(DATA_DIR, "routes.generated.preview.json");

// ======================================================
// Tuning v4 touring fix
// ======================================================
const LOOP_MAX_NEARBY_KM = 72;
const LOOP_MAX_SIDE_KM = 88;
const TOURING_MIN_KM = 22;
const TOURING_MAX_KM = 82;
const MAX_LOOPS_PER_BASE = 3;
const MAX_TOURING_PER_BASE = 3;
const MAX_TOTAL_LOOPS = 180;

// ======================================================
// Utils
// ======================================================
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickLatLng(x) {
  const lat = x?.lat ?? x?.latitude ?? x?.coords?.lat ?? x?.location?.lat;
  const lng = x?.lng ?? x?.lon ?? x?.longitude ?? x?.coords?.lng ?? x?.location?.lng;

  if (lat == null || lng == null) return null;

  const a = Number(lat);
  const b = Number(lng);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;

  return { lat: a, lng: b };
}

function asArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.passes)) return maybe.passes;
  if (Array.isArray(maybe?.items)) return maybe.items;
  if (Array.isArray(maybe?.data)) return maybe.data;
  return [];
}

function normalizeCountry(raw) {
  const s = norm(raw).toUpperCase();
  const m = s.match(/\b[A-Z]{2}\b/);
  if (m) return m[0];
  return s.slice(0, 2) || "";
}

function lowerJoin(...parts) {
  return parts
    .flat()
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
}

function uniqueBy(arr, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function avg(nums) {
  const clean = nums.map(Number).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

// ======================================================
// Geo helpers
// ======================================================
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);

  const q = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  const c = 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
  return R * c;
}

function centroid(points) {
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, p) => {
      acc.lat += p.lat;
      acc.lng += p.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );
  return {
    lat: Number((sum.lat / points.length).toFixed(6)),
    lng: Number((sum.lng / points.length).toFixed(6)),
  };
}

function offsetPoint(point, dLat = 0, dLng = 0) {
  return {
    lat: Number((point.lat + dLat).toFixed(6)),
    lng: Number((point.lng + dLng).toFixed(6)),
  };
}

function buildMiniPassLine(coords, elevation = 0, curvesScore = 0) {
  const el = Number(elevation || 0) || 0;
  const cv = Number(curvesScore || 0) || 0;

  const spread =
    el >= 2400 || cv >= 9 ? 0.045 :
    el >= 1800 || cv >= 7 ? 0.035 :
    0.028;

  return [
    offsetPoint(coords, -spread * 0.55, -spread * 0.4),
    coords,
    offsetPoint(coords, spread * 0.55, spread * 0.4),
  ];
}

// ======================================================
// Filtri seed
// ======================================================
const PASS_WORDS = [
  "pass",
  "passo",
  "col",
  "joch",
  "puerto",
  "port",
  "forca",
  "forcella",
  "sella",
  "bergpass",
  "mountain pass",
  "colle",
  "passhöhe",
];

const BANNED_WORDS = [
  "cross",
  "motocross",
  "mx",
  "enduro",
  "hard enduro",
  "superenduro",
  "offroad",
  "off-road",
  "off road",
  "trial",
  "kart",
  "karting",
  "speedway",
  "dragstrip",
  "drag strip",
  "autodrome",
  "raceway",
  "racetrack",
  "race track",
  "circuit",
  "track",
  "pista",
  "trail park",
  "bike park",
  "dirt park",
  "pump track",
  "bmx",
];

const BANNED_SURFACES = [
  "dirt",
  "gravel",
  "mud",
  "sand",
  "earth",
  "unpaved",
  "ground",
  "trail",
];

function containsAny(text, words) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w));
}

function isClearlyBad(item) {
  const text = lowerJoin(
    item?.name,
    item?.title,
    item?.description,
    item?.desc,
    item?.type,
    item?.category,
    item?.kind,
    item?.discipline,
    item?.sport,
    item?.surface,
    item?.terrain,
    item?.tags,
    item?.classification
  );

  if (containsAny(text, BANNED_WORDS)) return true;
  if (containsAny(text, BANNED_SURFACES)) return true;

  return false;
}

function hasPassSignal(item) {
  const text = lowerJoin(
    item?.name,
    item?.title,
    item?.pass,
    item?.col,
    item?.saddle,
    item?.type,
    item?.category,
    item?.kind,
    item?.tags,
    item?.classification
  );

  const elevation =
    toNum(item?.elevation) ??
    toNum(item?.ele) ??
    toNum(item?.altitude) ??
    toNum(item?.alt) ??
    toNum(item?.meters) ??
    toNum(item?.height);

  const hasKeyword = containsAny(text, PASS_WORDS);
  const hasElevation = elevation != null && elevation >= 700;

  return hasKeyword || hasElevation;
}

function looksLikeValidPassItem(item) {
  if (!item || typeof item !== "object") return false;

  const coords = pickLatLng(item);
  if (!coords) return false;

  const name = norm(item?.name || item?.title || item?.pass || item?.col || item?.saddle);
  if (!name) return false;

  if (isClearlyBad(item)) return false;
  if (!hasPassSignal(item)) return false;

  return true;
}

// ======================================================
// Normalizzazione passo
// ======================================================
function inferBestSeason(elevation) {
  const e = Number(elevation || 0) || 0;
  if (e >= 2200) return "Giu–Set";
  if (e >= 1600) return "Mag–Ott";
  if (e >= 900) return "Apr–Ott";
  return "Mar–Nov";
}

function normalizePass(item) {
  const coords = pickLatLng(item);
  if (!coords) return null;

  const name = norm(item?.name || item?.title || item?.pass || item?.col || item?.saddle || "Passo");
  const country = normalizeCountry(item?.country || item?.nation || item?.iso || "");
  const region = norm(item?.region || item?.area || item?.state || "");
  const elevation =
    toNum(item?.elevation) ??
    toNum(item?.ele) ??
    toNum(item?.altitude) ??
    toNum(item?.alt) ??
    toNum(item?.meters) ??
    toNum(item?.height) ??
    null;

  const curvesScore =
    toNum(item?.curvesScore) ??
    toNum(item?.curves) ??
    toNum(item?.twists) ??
    0;

  const asphaltScore =
    toNum(item?.asphaltScore) ??
    toNum(item?.asphalt) ??
    7;

  return {
    id:
      String(item?.id || "").trim() ||
      `pass-${slugify(name)}-${slugify(country || "xx")}-${coords.lat.toFixed(5)}-${coords.lng.toFixed(5)}`,
    name,
    country,
    region,
    coords,
    elevation,
    curvesScore,
    asphaltScore,
    bestSeason: item?.bestSeason || item?.season || inferBestSeason(elevation),
    description: norm(item?.description || item?.desc || ""),
    photo: item?.photo || item?.image || item?.cover || undefined,
  };
}

// ======================================================
// Heuristics
// ======================================================
function inferPace({ type, curves, elevation, distanceKm }) {
  const cv = Number(curves || 0) || 0;
  const el = Number(elevation || 0) || 0;
  const km = Number(distanceKm || 0) || 0;

  if (type === "alpine_loop") {
    if (cv >= 9 || el >= 2400) return "Tecnico";
    if (cv >= 7 || km >= 180) return "Misto";
    return "Touring";
  }

  if (type === "mountain_pass") {
    if (cv >= 8 || el >= 2200) return "Tecnico";
    if (cv >= 6 || el >= 1500) return "Misto";
    return "Veloce";
  }

  if (km >= 220) return "Touring";
  if (cv >= 7 || el >= 1800) return "Misto";
  return "Veloce";
}

function estimateMountainPassDistanceKm(pass) {
  const el = Number(pass.elevation || 0) || 0;
  const cv = Number(pass.curvesScore || 0) || 0;

  if (el >= 2600 || cv >= 9) return 32;
  if (el >= 2200 || cv >= 8) return 26;
  if (el >= 1600 || cv >= 6) return 22;
  return 18;
}

function estimateMountainPassDurationMin(distanceKm, pass) {
  const cv = Number(pass.curvesScore || 0) || 0;
  const el = Number(pass.elevation || 0) || 0;

  let multiplier = 2.1;
  if (cv >= 8 || el >= 2200) multiplier = 2.4;
  if (cv >= 9 || el >= 2600) multiplier = 2.6;

  return Math.max(30, Math.round(distanceKm * multiplier));
}

function buildPassDescription(pass) {
  if (pass.description) return pass.description;

  const isHigh = Number(pass.elevation || 0) >= 2200;
  const isCurvy = Number(pass.curvesScore || 0) >= 8;
  const place = pass.region ? `in ${pass.region}` : "";

  if (isHigh && isCurvy) {
    return `Grande valico alpino ${place}, tecnico e panoramico, ideale per moto stradali e tappe di alta quota${pass.elevation ? `. Quota ${pass.elevation} m.` : "."}`;
  }

  if (isHigh) {
    return `Passo d’alta quota ${place}, perfetto per itinerari estivi tra panorami alpini e guida pulita${pass.elevation ? `. Quota ${pass.elevation} m.` : "."}`;
  }

  if (isCurvy) {
    return `Passo panoramico ${place}, con ottimo potenziale per una guida ricca di curve e ritmo${pass.elevation ? `. Quota ${pass.elevation} m.` : "."}`;
  }

  return `Passo panoramico ${place}, ideale per moto stradali e tappe di montagna${pass.elevation ? `. Quota ${pass.elevation} m.` : "."}`;
}

function buildLoopDescription(group) {
  const names = group.map((p) => p.name).join(" → ");
  const maxElevation = Math.max(...group.map((p) => Number(p.elevation || 0) || 0));

  return `Loop alpino stradale che collega ${names}, pensato per rider che cercano curve, panorami e continuità di guida${maxElevation ? `. Punto più alto: ${maxElevation} m.` : "."}`;
}

function buildTouringDescription(a, b) {
  const maxElevation = Math.max(Number(a.elevation || 0) || 0, Number(b.elevation || 0) || 0);
  return `Collegamento alpino breve tra ${a.name} e ${b.name}, ideale come tappa moto stradale compatta${maxElevation ? `. Tratto d’alta quota fino a ${maxElevation} m.` : "."}`;
}

// ======================================================
// Route builders
// ======================================================
function makeMountainPassRoute(pass) {
  const distanceKm = estimateMountainPassDistanceKm(pass);
  const durationMin = estimateMountainPassDurationMin(distanceKm, pass);

  return {
    id: `mp-${slugify(pass.name)}-${slugify(pass.country || "xx")}`,
    name: `🏔 ${pass.name}`,
    country: pass.country,
    region: pass.region,
    type: "mountain_pass",
    pace: inferPace({
      type: "mountain_pass",
      curves: pass.curvesScore,
      elevation: pass.elevation,
      distanceKm,
    }),
    distanceKm,
    durationMin,
    coords: pass.coords,
    line: buildMiniPassLine(pass.coords, pass.elevation, pass.curvesScore),
    curvesScore: pass.curvesScore || undefined,
    asphaltScore: pass.asphaltScore || undefined,
    elevation: pass.elevation ?? undefined,
    bestSeason: pass.bestSeason,
    description: buildPassDescription(pass),
    photo: pass.photo,
    source: "routes_engine_pro",
    createdAt: new Date().toISOString(),
    _generated: true,
    passRefs: [pass.id],
  };
}

function estimateLoopDistanceKm(group) {
  if (group.length < 2) return 0;

  let sum = 0;
  for (let i = 0; i < group.length - 1; i++) {
    sum += haversineKm(group[i].coords, group[i + 1].coords);
  }
  sum += haversineKm(group[group.length - 1].coords, group[0].coords);

  return Math.round(sum * 1.38);
}

function estimateTouringDistanceKm(a, b) {
  return Math.round(haversineKm(a.coords, b.coords) * 1.28);
}

function chooseLoopBaseName(group) {
  const highest = [...group].sort((a, b) => (b.elevation || 0) - (a.elevation || 0))[0];
  return highest?.name || group[0]?.name || "Alpi";
}

function makeAlpineLoop(group, scoreMeta = {}) {
  const center = centroid(group.map((p) => p.coords));
  const distanceKm = estimateLoopDistanceKm(group);
  const maxElevation = Math.max(...group.map((p) => Number(p.elevation || 0) || 0));
  const curves = Math.round(avg(group.map((p) => p.curvesScore || 0)));

  const countries = uniqueBy(
    group.map((p) => p.country).filter(Boolean),
    (x) => x
  );

  const regions = uniqueBy(
    group.map((p) => p.region).filter(Boolean),
    (x) => x
  );

  const loopName = chooseLoopBaseName(group);

  return {
    id: `loop-${group.map((p) => slugify(p.name)).sort().join("-")}`,
    name: `🏍️ Loop Alpino ${loopName}`,
    country: countries[0] || "",
    region: regions[0] || "",
    type: "alpine_loop",
    pace: inferPace({
      type: "alpine_loop",
      curves,
      elevation: maxElevation,
      distanceKm,
    }),
    distanceKm,
    durationMin: Math.max(95, Math.round(distanceKm * 1.7)),
    coords: center,
    line: [...group.map((p) => p.coords), group[0].coords],
    curvesScore: curves || undefined,
    asphaltScore: 8,
    elevation: maxElevation || undefined,
    bestSeason: inferBestSeason(maxElevation),
    description: buildLoopDescription(group),
    source: "routes_engine_pro",
    createdAt: new Date().toISOString(),
    _generated: true,
    passRefs: group.map((p) => p.id),
    _score: scoreMeta.totalScore ?? undefined,
  };
}

function makeTouringRoute(a, b) {
  const distanceKm = estimateTouringDistanceKm(a, b);
  const avgCurves = Math.round(((a.curvesScore || 0) + (b.curvesScore || 0)) / 2);
  const maxElevation = Math.max(Number(a.elevation || 0) || 0, Number(b.elevation || 0) || 0);
  const center = centroid([a.coords, b.coords]);

  return {
    id: `tour-${slugify(a.name)}-${slugify(b.name)}`,
    name: `🛣️ ${a.name} → ${b.name}`,
    country: a.country || b.country || "",
    region: a.region || b.region || "",
    type: "touring_route",
    pace: inferPace({
      type: "touring_route",
      curves: avgCurves,
      elevation: maxElevation,
      distanceKm,
    }),
    distanceKm,
    durationMin: Math.max(45, Math.round(distanceKm * 1.22)),
    coords: center,
    line: [a.coords, b.coords],
    curvesScore: avgCurves || undefined,
    asphaltScore: Math.round(((a.asphaltScore || 7) + (b.asphaltScore || 7)) / 2),
    elevation: maxElevation || undefined,
    bestSeason: inferBestSeason(maxElevation),
    description: buildTouringDescription(a, b),
    source: "routes_engine_pro",
    createdAt: new Date().toISOString(),
    _generated: true,
    passRefs: [a.id, b.id],
  };
}

// ======================================================
// Grouping logic
// ======================================================
function pairKey(a, b) {
  return [a.id, b.id].sort().join("::");
}

function groupKey(group) {
  return group
    .map((p) => p.id)
    .sort()
    .join("::");
}

function loopAreaKey(group) {
  const c = centroid(group.map((p) => p.coords));
  const lat = Math.round((c?.lat || 0) * 10) / 10;
  const lng = Math.round((c?.lng || 0) * 10) / 10;
  const country = group.map((p) => p.country).filter(Boolean).sort()[0] || "xx";
  return `${country}:${lat}:${lng}`;
}

function loopDiversityKey(group) {
  const topTwo = [...group]
    .sort((a, b) => (b.elevation || 0) - (a.elevation || 0))
    .slice(0, 2)
    .map((p) => slugify(p.name))
    .sort()
    .join("::");
  return `${group[0]?.country || "xx"}:${topTwo}`;
}

function findNearbyPasses(base, passes, maxKm) {
  return passes
    .filter((p) => p.id !== base.id)
    .map((p) => ({
      pass: p,
      km: haversineKm(base.coords, p.coords),
      dLat: Math.abs((base.coords?.lat || 0) - (p.coords?.lat || 0)),
      dLng: Math.abs((base.coords?.lng || 0) - (p.coords?.lng || 0)),
    }))
    .filter((x) => x.km <= maxKm)
    .sort((a, b) => a.km - b.km);
}

function scoreLoopGroup(base, a, b) {
  const d1 = haversineKm(base.coords, a.coords);
  const d2 = haversineKm(base.coords, b.coords);
  const d3 = haversineKm(a.coords, b.coords);

  const avgElevation = avg([base.elevation || 0, a.elevation || 0, b.elevation || 0]);
  const avgCurves = avg([base.curvesScore || 0, a.curvesScore || 0, b.curvesScore || 0]);
  const compactnessPenalty = Math.abs(d1 - d2) * 0.4 + Math.max(0, d3 - 60) * 0.45;
  const elevationBonus = avgElevation / 220;
  const curvesBonus = avgCurves * 2.6;
  const distanceBalanceBonus = Math.max(0, 24 - Math.abs(d1 - d2)) * 0.4;
  const sameRegionBonus =
    base.region && a.region && b.region && base.region === a.region && base.region === b.region
      ? 5
      : 0;

  const totalScore =
    elevationBonus +
    curvesBonus +
    distanceBalanceBonus +
    sameRegionBonus -
    compactnessPenalty;

  return {
    d1,
    d2,
    d3,
    avgElevation,
    avgCurves,
    totalScore,
  };
}

function buildLoops(passes) {
  const candidates = [];

  for (const base of passes) {
    const nearby = findNearbyPasses(base, passes, LOOP_MAX_NEARBY_KM).map((x) => x.pass);

    for (let i = 0; i < nearby.length; i++) {
      for (let j = i + 1; j < nearby.length; j++) {
        const a = nearby[i];
        const b = nearby[j];

        const sameCountry =
          [base.country, a.country, b.country].filter(Boolean).length >= 2 &&
          (base.country === a.country || base.country === b.country || a.country === b.country);

        if (!sameCountry) continue;

        const meta = scoreLoopGroup(base, a, b);

        if (meta.d1 > LOOP_MAX_NEARBY_KM) continue;
        if (meta.d2 > LOOP_MAX_NEARBY_KM) continue;
        if (meta.d3 > LOOP_MAX_SIDE_KM) continue;
        if (meta.avgElevation < 1650) continue;
        if (meta.avgCurves < 7) continue;
        if (meta.totalScore < 12) continue;

        const group = [base, a, b].sort((x, y) => x.name.localeCompare(y.name));
        candidates.push({
          group,
          baseId: base.id,
          score: meta.totalScore,
          areaKey: loopAreaKey(group),
          diversityKey: loopDiversityKey(group),
          exactKey: groupKey(group),
          route: makeAlpineLoop(group, meta),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  const usedExact = new Set();
  const usedDiversity = new Set();
  const areaCount = new Map();
  const baseCount = new Map();

  for (const item of candidates) {
    if (selected.length >= MAX_TOTAL_LOOPS) break;
    if (usedExact.has(item.exactKey)) continue;

    const currentBaseCount = baseCount.get(item.baseId) || 0;
    if (currentBaseCount >= MAX_LOOPS_PER_BASE) continue;

    const currentAreaCount = areaCount.get(item.areaKey) || 0;
    if (currentAreaCount >= 4) continue;

    if (usedDiversity.has(item.diversityKey)) continue;

    usedExact.add(item.exactKey);
    usedDiversity.add(item.diversityKey);
    areaCount.set(item.areaKey, currentAreaCount + 1);
    baseCount.set(item.baseId, currentBaseCount + 1);
    selected.push(item.route);
  }

  return selected.map((r) => {
    const copy = { ...r };
    delete copy._score;
    return copy;
  });
}

function buildTouringRoutes(passes) {
  const candidates = [];

  for (const base of passes) {
    const nearby = findNearbyPasses(base, passes, TOURING_MAX_KM);

    for (const item of nearby) {
      const pass = item.pass;
      const km = item.km;
      const dLat = item.dLat;
      const dLng = item.dLng;

      if (km < TOURING_MIN_KM || km > TOURING_MAX_KM) continue;

      const sameCountry = base.country && pass.country && base.country === pass.country;
      if (!sameCountry) continue;

      const sameRegion =
        base.region &&
        pass.region &&
        slugify(base.region) === slugify(pass.region);

      const geoClose = dLat <= 0.42 && dLng <= 0.62;

      if (!sameRegion && !geoClose) continue;

      const avgCurves = avg([base.curvesScore || 0, pass.curvesScore || 0]);
      const avgElevation = avg([base.elevation || 0, pass.elevation || 0]);
      const elevationGap = Math.abs((base.elevation || 0) - (pass.elevation || 0));

      if (avgCurves < 6.4) continue;
      if (avgElevation < 1450) continue;
      if (elevationGap > 900) continue;

      let score =
        avgCurves * 2.7 +
        avgElevation / 240 -
        Math.abs(km - 48) * 0.12;

      if (sameRegion) score += 5;
      if (geoClose) score += 3;
      if (km <= 65) score += 2;

      candidates.push({
        baseId: base.id,
        pairKey: pairKey(base, pass),
        score,
        route: makeTouringRoute(base, pass),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  const usedPairs = new Set();
  const baseCount = new Map();

  for (const item of candidates) {
    if (usedPairs.has(item.pairKey)) continue;

    const count = baseCount.get(item.baseId) || 0;
    if (count >= MAX_TOURING_PER_BASE) continue;

    usedPairs.add(item.pairKey);
    baseCount.set(item.baseId, count + 1);
    selected.push(item.route);
  }

  return selected;
}

// ======================================================
// Main
// ======================================================
function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    console.error("❌ File seed non trovato:", SOURCE_PATH);
    process.exit(1);
  }

  const raw = readJSON(SOURCE_PATH);
  const items = asArray(raw);

  const validPasses = items
    .filter(looksLikeValidPassItem)
    .map(normalizePass)
    .filter(Boolean);

  const mountainPasses = validPasses.map(makeMountainPassRoute);
  const loops = buildLoops(validPasses);
  const touringRoutes = buildTouringRoutes(validPasses);

  const preview = uniqueBy(
    [...mountainPasses, ...loops, ...touringRoutes],
    (r) => r.id
  );

  writeJSON(PREVIEW_PATH, preview);

  console.log("✅ buildLoopsFromPasses PRO v4 touring fix completato");
  console.log("Seed:", path.basename(SOURCE_PATH));
  console.log("Passi validi:", validPasses.length);
  console.log("Mountain pass:", mountainPasses.length);
  console.log("Alpine loop:", loops.length);
  console.log("Touring route:", touringRoutes.length);
  console.log("Totale preview:", preview.length);
  console.log("Preview scritta:", path.basename(PREVIEW_PATH));
  console.log("");
  console.log("ℹ️ routes.json NON è stato toccato.");
}

main();