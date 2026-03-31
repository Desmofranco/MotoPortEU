// =======================================================
// server/scripts/generateEuropeanRoutes.js
// MotoPortEU — Routes Generator PRO by Country / Scope
// =======================================================

import path from "path";
import fs from "fs/promises";
import process from "process";
import {
  parseCliArgs,
  getScopeConfig,
  getScopeSuffix,
} from "./lib/routeScopes.js";

const args = parseCliArgs();
const country = String(args.country || "IT").toUpperCase();
const scope = args.scope ? String(args.scope) : null;

const scopeCfg = getScopeConfig({ country, scope });
const scopeSuffix = getScopeSuffix({ country, scope });

const SPOTS_FILE = path.resolve(
  `client/public/data/rider-spots.cleaned.${scopeSuffix}.json`
);
const OUT_FILE = path.resolve(
  `client/public/data/routes.generated.${scopeSuffix}.json`
);

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

const MIN_ROUTE_DISTANCE_KM = 45;
const MAX_ROUTE_DISTANCE_KM = 520;
const MAX_NEIGHBOR_KM = 115;

const MAX_SEEDS_PER_CLUSTER = 8;
const MAX_CANDIDATES_PER_CLUSTER = 24;
const MAX_FINAL_ROUTES = 2500;

const lakeScopes = new Set(["como", "garda", "maggiore"]);
const scopeLower = String(scope || "").toLowerCase();
const scopeNameLower = String(scopeCfg?.scopeName || "").toLowerCase();
const isLakeScope =
  lakeScopes.has(scopeLower) ||
  /\blago\b|\blake\b/.test(scopeNameLower) ||
  /\bcomo\b|\bgarda\b|\bmaggiore\b/.test(scopeNameLower);

// -------------------------------------------------------

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function roundCoord(n) {
  return Number(Number(n).toFixed(5));
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}

function averageLatLng(items) {
  if (!items.length) return { lat: 0, lng: 0 };
  const lat = items.reduce((s, x) => s + Number(x.lat || 0), 0) / items.length;
  const lng = items.reduce((s, x) => s + Number(x.lng || 0), 0) / items.length;
  return { lat, lng };
}

function normalizeText(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRegionHint(s) {
  return String(s || "")
    .replace(/^[A-Z]{2}-/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

// -------------------------------------------------------
// QUALITY FILTERS
// -------------------------------------------------------

function isWeakGenericName(name = "") {
  const text = normalizeText(name);

  const exactWeak = new Set([
    "punto panoramico",
    "panoramic view",
    "view point",
    "viewpoint",
    "vista del lago",
    "vista panoramica",
    "belvedere",
    "lookout",
    "panorama",
    "lake view",
    "panorama lake view",
    "fear lake",
    "vista del mare",
    "panoramic spot",
    "scenic view",
    "terrazza panoramica",
  ]);

  if (exactWeak.has(text)) return true;

  const weakPatterns = [
    /^punto panoramico$/,
    /^punto panoramico .{0,30}$/,
    /^panoramic view$/,
    /^panoramic viewpoint$/,
    /^view point on .+$/,
    /^lake .+ viewpoint$/,
    /^vista del lago$/,
    /^vista panoramica$/,
    /^terrazza panoramica$/,
    /^belvedere$/,
    /^lookout$/,
    /^panorama$/,
    /^scenic view$/,
    /^panoramic spot$/,
    /^punto panoramico vista sul lago.+$/,
  ];

  return weakPatterns.some((rx) => rx.test(text));
}

function isStrongRiderSpot(spot) {
  const text = normalizeText(`${spot.name || ""} ${spot.address || ""}`);
  const tags = Array.isArray(spot.tags) ? spot.tags.map(normalizeText) : [];
  const rawScore = Number(spot.riderScore || spot.score || 0);
  const rideType = String(spot.rideType || "");

  const strongSignals = [
    "passo",
    "stelvio",
    "gavia",
    "spluga",
    "bernina",
    "mendola",
    "tonale",
    "san marco",
    "forra",
    "valvestino",
    "gardesana",
    "monte baldo",
    "strada della forra",
    "lago di garda",
    "lago di como",
    "lago maggiore",
    "lake como",
    "lake garda",
    "lake maggiore",
    "como",
    "bellagio",
    "menaggio",
    "varenna",
    "lecco",
    "stresa",
    "verbania",
    "arona",
    "costiera",
    "twisty",
    "mountain pass",
    "joch",
    "col ",
  ];

  const hasStrongSignal =
    strongSignals.some((s) => text.includes(s)) ||
    tags.includes("mountain") ||
    tags.includes("twisty") ||
    tags.includes("lake") ||
    rideType === "mountain" ||
    rideType === "lake";

  if (isWeakGenericName(spot.name || "")) return false;
  if (rawScore >= 70) return true;
  if (rawScore >= 55 && hasStrongSignal) return true;
  if (rideType === "mountain" && rawScore >= 48) return true;
  if ((rideType === "lake" || rideType === "coastal") && rawScore >= 48 && hasStrongSignal) return true;

  return false;
}

function isAllowedNeighborSpot(spot) {
  const text = normalizeText(`${spot.name || ""} ${spot.address || ""}`);
  const rawScore = Number(spot.riderScore || spot.score || 0);

  if (isWeakGenericName(spot.name || "")) return false;
  if (text.includes("monaco")) return false;
  if (rawScore < (isLakeScope ? 24 : 38)) return false;

  return true;
}

function routeQualityScore(points, rideType, region) {
  let score = 0;
  const names = points.map((p) => normalizeText(p.name));
  const allText = names.join(" | ");

  const iconicSignals = [
    "stelvio",
    "gavia",
    "spluga",
    "bernina",
    "mendola",
    "tonale",
    "san marco",
    "forra",
    "valvestino",
    "gardesana",
    "monte baldo",
    "lago di garda",
    "lago di como",
    "lago maggiore",
    "como",
    "bellagio",
    "menaggio",
    "varenna",
    "lecco",
    "stresa",
    "verbania",
    "arona",
  ];

  for (const s of iconicSignals) {
    if (allText.includes(s)) score += 10;
  }

  if (rideType === "mountain") score += 12;
  if (rideType === "lake") score += 12;
  if (rideType === "coastal") score += 8;

  const uniqueNames = new Set(names);
  score += uniqueNames.size * 4;

  for (const p of points) {
    score += Math.min(Number(p.riderScore || p.score || 0), 100) / 8;
  }

  if (normalizeText(region).includes("lago di como")) {
    if (allText.includes("stelvio") || allText.includes("gavia") || allText.includes("spluga")) {
      score -= 20;
    }
    if (
      allText.includes("como") ||
      allText.includes("bellagio") ||
      allText.includes("menaggio") ||
      allText.includes("varenna") ||
      allText.includes("lecco")
    ) {
      score += 18;
    }
  }

  return score;
}

// -------------------------------------------------------
// REGION GUESS
// -------------------------------------------------------

function guessMacroRegion(spot) {
  const s = `${spot.regionHint || ""} ${spot.address || ""} ${spot.name || ""} ${spot.scopeName || ""}`.toLowerCase();

  if (s.includes("stelvio") || s.includes("gavia") || s.includes("spluga") || s.includes("bernina")) {
    return "Alpi Lombarde";
  }
  if (s.includes("garda") || s.includes("valvestino") || s.includes("forra") || s.includes("gardesana")) {
    return "Lago di Garda";
  }
  if (s.includes("como") || s.includes("bellagio") || s.includes("menaggio") || s.includes("varenna") || s.includes("lecco")) {
    return "Lago di Como";
  }
  if (s.includes("maggiore") || s.includes("stresa") || s.includes("verbania") || s.includes("arona")) {
    return "Lago Maggiore";
  }
  if (s.includes("liguria")) return "Liguria";
  if (s.includes("monte bianco") || s.includes("aosta")) return "Valle d'Aosta";
  if (s.includes("dolom")) return "Dolomiti";
  if (s.includes("alpi") || s.includes("alp")) return "Alpi";
  if (s.includes("appenn")) return "Appennino";
  if (s.includes("pyren")) return "Pirenei";
  if (s.includes("carp")) return "Carpazi";
  if (s.includes("highland")) return "Highlands";
  if (s.includes("fjord") || s.includes("fiordo")) return "Fiordi";
  if (s.includes("amalfi")) return "Costiera Amalfitana";
  if (s.includes("cote azur")) return "Costa Azzurra";
  if (s.includes("costa brava")) return "Costa Brava";
  if (s.includes("corsica")) return "Corsica";
  if (s.includes("tatra")) return "Tatra";
  if (s.includes("velebit")) return "Velebit";
  if (s.includes("foresta nera")) return "Foresta Nera";
  if (s.includes("vosges")) return "Vosgi";
  if (s.includes("sicilia")) return "Sicilia";
  if (s.includes("sardegna")) return "Sardegna";
  if (s.includes("etna")) return "Etna";
  if (s.includes("supramonte")) return "Supramonte";

  return normalizeRegionHint(spot.regionHint) || spot.scopeName || spot.country || "Europa";
}

function rideTypePriority(rideType) {
  const order = {
    mountain: 6,
    coastal: 5,
    lake: 4,
    scenic: 3,
    fjord: 3,
    forest: 2,
  };
  return order[rideType] || 1;
}

function byScoreThenName(a, b) {
  return (
    (b.score || b.riderScore || 0) - (a.score || a.riderScore || 0) ||
    rideTypePriority(b.rideType) - rideTypePriority(a.rideType) ||
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function buildClusterKey(spot) {
  const countryCode = spot.country || country || "XX";
  const scopeKey = spot.scope || scope || "all";
  const region = guessMacroRegion(spot);
  const rideType = spot.rideType || "scenic";
  return `${countryCode}__${scopeKey}__${region}__${rideType}`;
}

function buildRouteType() {
  return "touring";
}

function buildSurface(rideType) {
  return rideType === "forest" ? "mixed" : "asphalt";
}

function buildDifficulty(distanceKm, rideType, pointsCount) {
  let score = 0;
  if (distanceKm >= 280) score += 2;
  else if (distanceKm >= 160) score += 1;
  if (rideType === "mountain") score += 1;
  if (rideType === "fjord") score += 1;
  if (pointsCount >= 4) score += 1;
  if (score >= 3) return "hard";
  if (score >= 1) return "medium";
  return "easy";
}

function buildTags(rideType, region, countryCode, mode, spots, scopeName) {
  const base = ["rider", "generated"];
  const byType = {
    mountain: ["mountain", "passes", "twisty", "panoramic"],
    coastal: ["coast", "sea", "scenic", "panoramic"],
    lake: ["lake", "scenic", "panoramic"],
    scenic: ["scenic", "panoramic"],
    fjord: ["fjord", "sea", "panoramic"],
    forest: ["forest", "scenic"],
  };

  const spotTypes = Array.from(new Set((spots || []).map((s) => s.type).filter(Boolean)));

  return Array.from(
    new Set(
      [
        ...base,
        ...(countryCode === "IT" ? ["italy"] : ["europe"]),
        ...(byType[rideType] || []),
        mode,
        String(countryCode || "").toLowerCase(),
        slugify(region || ""),
        slugify(scopeName || ""),
        ...spotTypes.map((x) => slugify(x)),
      ].filter(Boolean)
    )
  );
}

function buildTitle(points, region, rideType) {
  const names = points.map((p) => p.name);
  const prefixByType = {
    mountain: "Giro Montagna",
    coastal: "Giro Costiero",
    lake: "Giro Lago",
    scenic: "Giro Panoramico",
    fjord: "Giro Fiordi",
    forest: "Giro Foreste",
  };
  const prefix = prefixByType[rideType] || "Itinerario Rider";

  if (names.length === 2) return `${prefix} ${region}: ${names[0]} → ${names[1]}`;
  return `${prefix} ${region}: ${names.slice(0, 4).join(" → ")}`;
}

// -------------------------------------------------------
// DESCRIPTION ENGINE
// -------------------------------------------------------

function uniqueNames(points = [], max = 4) {
  const out = [];
  const seen = new Set();

  for (const p of points || []) {
    const n = String(p?.name || "").trim();
    const k = normalizeText(n);
    if (!n || seen.has(k)) continue;
    seen.add(k);
    out.push(n);
    if (out.length >= max) break;
  }

  return out;
}

function formatKm(distanceKm) {
  const km = Number(distanceKm || 0);
  if (!Number.isFinite(km) || km <= 0) return "—";
  return `${Math.round(km)} km`;
}

function modePhrase(mode) {
  if (mode === "loop") return "in anello";
  if (mode === "point_to_point") return "lineare tra due punti forti";
  return "lineare e scorrevole";
}

function buildPointSentence(names) {
  const [a, b, c, d] = names;

  if (a && b && c && d) {
    return `Tocca ${a}, ${b}, ${c} e ${d}, costruendo un percorso con riferimenti chiari e ben leggibili anche in sella.`;
  }
  if (a && b && c) {
    return `Unisce ${a}, ${b} e ${c}, creando una sequenza coerente di punti rider e passaggi panoramici.`;
  }
  if (a && b) {
    return `Collega ${a} e ${b} con una linea credibile per una guida motociclistica vera, senza deviazioni inutili.`;
  }
  if (a) {
    return `Si sviluppa attorno a ${a}, usando la zona come riferimento principale del giro.`;
  }
  return `Si sviluppa su punti reali selezionati per dare continuità, senso geografico e piacere di guida.`;
}

function buildClosingSentence(rideType, distanceKm, mode, pointsCount) {
  const kmText = formatKm(distanceKm);
  const modeText = modePhrase(mode);

  if (rideType === "mountain") {
    return `Nel complesso è un itinerario ${modeText}, da circa ${kmText}, con quota, ritmo variabile e tratti capaci di premiare chi cerca curve, panorama e carattere.`;
  }

  if (rideType === "lake") {
    return `Nel complesso è un itinerario ${modeText}, da circa ${kmText}, ideale per chi vuole alternare guida, vista aperta e passaggi eleganti lungo laghi e salite vicine.`;
  }

  if (rideType === "coastal") {
    return `Nel complesso è un itinerario ${modeText}, da circa ${kmText}, pensato per chi ama l’orizzonte aperto, il ritmo touring e la bellezza delle strade di costa.`;
  }

  if (rideType === "forest") {
    return `Nel complesso è un itinerario ${modeText}, da circa ${kmText}, con atmosfera più raccolta, buon respiro visivo e una guida piacevole tra verde e curve pulite.`;
  }

  if (rideType === "fjord") {
    return `Nel complesso è un itinerario ${modeText}, da circa ${kmText}, con forte impatto paesaggistico e una progressione pensata per godersi acqua, rilievi e strada.`;
  }

  return `Nel complesso è un itinerario ${modeText}, da circa ${kmText}, con un equilibrio credibile tra guida, panorama e qualità generale del percorso.`;
}

function buildIntroSentence(region, rideType, countryCode) {
  const regionText = region || countryCode || "questa zona";

  if (rideType === "mountain") {
    return `Un itinerario di montagna rider-oriented nella zona ${regionText}, pensato per chi cerca strada vera, quota e passaggi dal profilo deciso.`;
  }

  if (rideType === "lake") {
    return `Un itinerario lago panoramico nella zona ${regionText}, costruito per valorizzare sponde, balconi naturali e collegamenti che hanno davvero senso in moto.`;
  }

  if (rideType === "coastal") {
    return `Un itinerario costiero nella zona ${regionText}, pensato per sfruttare al meglio mare, strada aperta e punti visivi ad alto impatto.`;
  }

  if (rideType === "forest") {
    return `Un itinerario immerso in una zona verde e rider-friendly, dove la qualità del percorso conta più del semplice trasferimento.`;
  }

  if (rideType === "fjord") {
    return `Un itinerario panoramico d’acqua e rilievi nella zona ${regionText}, costruito per dare continuità a una guida suggestiva e ben leggibile.`;
  }

  return `Un itinerario panoramico rider nella zona ${regionText}, costruito attorno a strade e punti che possono davvero generare un giro credibile.`;
}

function buildDescription(points, region, countryCode, rideType, mode, distanceKm) {
  const names = uniqueNames(points, 4);
  const intro = buildIntroSentence(region, rideType, countryCode);
  const middle = buildPointSentence(names);
  const closing = buildClosingSentence(rideType, distanceKm, mode, points?.length || 0);

  return `${intro} ${middle} ${closing}`;
}

async function getOsrmRoute(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OSRM ${res.status} ${res.statusText} ${txt.slice(0, 180)}`);
  }

  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error("Geometria OSRM vuota");
  }

  return {
    geometry: route.geometry,
    distanceKm: Math.round((route.distance || 0) / 100) / 10,
    durationMin: Math.round((route.duration || 0) / 60),
  };
}

function buildFallbackGeometry(points) {
  const coordsLngLat = points.map((p) => [roundCoord(p.lng), roundCoord(p.lat)]);
  let distanceKm = 0;

  for (let i = 1; i < points.length; i += 1) {
    distanceKm += haversineKm(
      Number(points[i - 1].lat),
      Number(points[i - 1].lng),
      Number(points[i].lat),
      Number(points[i].lng)
    );
  }

  const estimatedKm = Math.round(distanceKm * 1.22 * 10) / 10;
  const estimatedDurationMin = Math.max(35, Math.round((estimatedKm / 52) * 60));

  return {
    geometry: {
      type: "LineString",
      coordinates: coordsLngLat,
    },
    distanceKm: estimatedKm,
    durationMin: estimatedDurationMin,
    isFallback: true,
  };
}

function buildShapeFields(points, routeShape) {
  const start = points[0];
  const end = points[points.length - 1];
  const geometry = routeShape?.geometry?.coordinates?.length
    ? routeShape.geometry
    : {
        type: "LineString",
        coordinates: points.map((p) => [roundCoord(p.lng), roundCoord(p.lat)]),
      };

  const sampledCoordsLatLng = geometry.coordinates
    .map(([lng, lat], i, arr) => {
      if (i !== 0 && i !== arr.length - 1 && i % 3 !== 0) return null;
      return [roundCoord(lat), roundCoord(lng)];
    })
    .filter(Boolean);

  const polyline = sampledCoordsLatLng.map(([lat, lng]) => [lat, lng]);

  return {
    start: {
      name: start.name,
      lat: roundCoord(start.lat),
      lng: roundCoord(start.lng),
    },
    end: {
      name: end.name,
      lat: roundCoord(end.lat),
      lng: roundCoord(end.lng),
    },
    waypoints: points.slice(1, -1).map((p) => ({
      name: p.name,
      lat: roundCoord(p.lat),
      lng: roundCoord(p.lng),
      type: p.type || "scenic_road",
      rideType: p.rideType || "scenic",
    })),
    coords: sampledCoordsLatLng,
    polyline,
    geometry,
  };
}

function dedupePointList(points) {
  const seen = new Set();
  const out = [];
  for (const p of points) {
    const key = p.id || `${p.name}-${p.lat}-${p.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function chooseNeighbors(seed, list, max = 5) {
  return list
    .filter((p) => p.id !== seed.id)
    .filter(isAllowedNeighborSpot)
    .map((p) => ({
      ...p,
      _d: haversineKm(seed.lat, seed.lng, p.lat, p.lng),
    }))
    .filter((p) => p._d <= MAX_NEIGHBOR_KM)
    .sort((a, b) => a._d - b._d || byScoreThenName(a, b))
    .slice(0, max);
}

function buildCandidatesForCluster(cluster, rideType) {
  const usable = [...cluster].filter(isAllowedNeighborSpot).sort(byScoreThenName);
  const strongSeeds = usable.filter(isStrongRiderSpot);
  const seeds = (strongSeeds.length ? strongSeeds : usable).slice(0, MAX_SEEDS_PER_CLUSTER);
  const candidates = [];

  if (usable.length < 2) return candidates;

  for (const seed of seeds) {
    const n = chooseNeighbors(seed, usable, 5);

    for (const a of n.slice(0, 2)) {
      const pts = dedupePointList([seed, a]);
      if (pts.length >= 2) {
        candidates.push({
          mode: "point_to_point",
          rideType,
          points: pts,
          quality: routeQualityScore(pts, rideType, guessMacroRegion(seed)),
        });
      }
    }

    if (n.length >= 2) {
      const pts = dedupePointList([seed, n[0], n[1]]);
      candidates.push({
        mode: "linear",
        rideType,
        points: pts,
        quality: routeQualityScore(pts, rideType, guessMacroRegion(seed)),
      });
    }

    if (n.length >= 3) {
      const pts = dedupePointList([seed, n[0], n[1], n[2]]);
      candidates.push({
        mode: "linear",
        rideType,
        points: pts,
        quality: routeQualityScore(pts, rideType, guessMacroRegion(seed)),
      });

      if (rideType !== "coastal" && rideType !== "lake") {
        const loopPts = dedupePointList([seed, n[0], n[1], seed]);
        candidates.push({
          mode: "loop",
          rideType,
          points: loopPts,
          quality: routeQualityScore(loopPts, rideType, guessMacroRegion(seed)),
        });
      }
    }
  }

  return candidates
    .filter((c) => c.points.length >= 2)
    .sort((a, b) => (b.quality || 0) - (a.quality || 0))
    .slice(0, MAX_CANDIDATES_PER_CLUSTER);
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const out = [];

  for (const r of routes) {
    const ordered = (r.spots || []).map((s) => s.slug || s.name);
    const sorted = [...ordered].sort();

    const sigA = [
      r.country || "",
      r.scope || "",
      r.region || "",
      r.rideType || "",
      sorted.join(">"),
    ].join("|");

    const sigB = [
      r.country || "",
      r.scope || "",
      r.region || "",
      r.rideType || "",
      ordered.slice(0, 3).join(">"),
      Math.round(Number(r.distanceKm || 0)),
    ].join("|");

    if (seen.has(sigA) || seen.has(sigB)) continue;

    seen.add(sigA);
    seen.add(sigB);
    out.push(r);
  }

  return out;
}

function buildRouteId(routeCounter, countryCode, scopeKey, routeName) {
  return `route-${String(countryCode || "xx").toLowerCase()}-${String(scopeKey || "all").toLowerCase()}-${String(routeCounter).padStart(5, "0")}-${slugify(routeName).slice(0, 40)}`;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Generate Routes PRO");
  console.log("====================================");
  console.log(`🌍 Country: ${scopeCfg.countryName} (${country})`);
  console.log(`🧭 Scope: ${scopeCfg.scopeName}`);
  console.log(`📥 Spots: ${SPOTS_FILE}`);
  console.log(`💾 Output: ${OUT_FILE}`);

  const raw = JSON.parse(await fs.readFile(SPOTS_FILE, "utf8"));
  const spots = Array.isArray(raw)
    ? raw.filter((s) => toNum(s.lat) != null && toNum(s.lng) != null)
    : [];

  if (!spots.length) {
    console.error("❌ Nessun rider spot valido trovato");
    process.exit(1);
  }

  const filteredSpots = spots.filter(isAllowedNeighborSpot);

  const clusters = new Map();
  for (const spot of filteredSpots) {
    const key = buildClusterKey(spot);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(spot);
  }

  const routes = [];
  let routeCounter = 1;

  for (const [key, cluster] of clusters.entries()) {
    const [countryCode, scopeKey, region, rideType] = key.split("__");
    console.log(
      `\n🌍 Cluster ${region} (${countryCode}/${scopeKey}) [${rideType}] — ${cluster.length} spots`
    );

    const candidates = buildCandidatesForCluster(cluster, rideType);
    let produced = 0;

    for (const cand of candidates) {
      try {
        let routeShape;
        try {
          routeShape = await getOsrmRoute(cand.points);
        } catch (err) {
          routeShape = buildFallbackGeometry(cand.points);
          console.warn(
            `   ⚠️ fallback geometry: ${cand.points.map((p) => p.name).join(" → ").slice(0, 120)} | ${err.message}`
          );
        }

        if (routeShape.distanceKm < MIN_ROUTE_DISTANCE_KM) continue;
        if (routeShape.distanceKm > MAX_ROUTE_DISTANCE_KM) continue;

        const title = buildTitle(cand.points, region, rideType);
        const description = buildDescription(
          cand.points,
          region,
          countryCode,
          rideType,
          cand.mode,
          routeShape.distanceKm
        );
        const shape = buildShapeFields(cand.points, routeShape);
        const center = averageLatLng(cand.points);

        const routeId = buildRouteId(routeCounter, countryCode, scopeKey, title);

        routes.push({
          id: routeId,
          name: title,
          slug: slugify(`${title}-${routeId}`),
          type: buildRouteType(),
          rideType,
          mode: cand.mode,
          country: countryCode,
          scope: scopeKey,
          scopeName: scopeCfg.scopeName,
          region,
          source: routeShape.isFallback
            ? "generated_from_rider_spots_fallback_geometry"
            : "generated_from_rider_spots",
          distanceKm: routeShape.distanceKm,
          durationMin: routeShape.durationMin,
          difficulty: buildDifficulty(routeShape.distanceKm, rideType, cand.points.length),
          surface: buildSurface(rideType),
          tags: buildTags(
            rideType,
            region,
            countryCode,
            cand.mode,
            cand.points,
            scopeCfg.scopeName
          ),
          description,
          center: {
            lat: roundCoord(center.lat),
            lng: roundCoord(center.lng),
          },
          spots: cand.points.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            type: p.type || "scenic_road",
            rideType: p.rideType || "scenic",
            lat: roundCoord(p.lat),
            lng: roundCoord(p.lng),
            country: p.country || null,
            scope: p.scope || scopeKey,
            riderScore: p.riderScore || p.score || 0,
          })),
          ...shape,
        });

        routeCounter += 1;
        produced += 1;
      } catch (err) {
        console.warn(
          `   ⚠️ skip: ${cand.points.map((p) => p.name).join(" → ").slice(0, 120)} | ${err.message}`
        );
      }
    }

    console.log(`   ✅ generate cluster: ${produced}`);
  }

  const cleaned = dedupeRoutes(routes)
    .sort((a, b) => {
      return (
        (a.country || "").localeCompare(b.country || "") ||
        (a.scope || "").localeCompare(b.scope || "") ||
        (a.region || "").localeCompare(b.region || "") ||
        (a.rideType || "").localeCompare(b.rideType || "") ||
        a.name.localeCompare(b.name)
      );
    })
    .slice(0, MAX_FINAL_ROUTES);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(cleaned, null, 2), "utf8");

  const byRideType = cleaned.reduce((acc, item) => {
    acc[item.rideType] = (acc[item.rideType] || 0) + 1;
    return acc;
  }, {});

  console.log("\n------------------------------------");
  console.log(`Filtered spots:   ${filteredSpots.length}`);
  console.log(`Routes generated: ${routes.length}`);
  console.log(`Routes deduped:   ${cleaned.length}`);
  console.log("Distribuzione rideType:", byRideType);
  console.log(`Creato: ${OUT_FILE}`);
  console.log("------------------------------------");
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});