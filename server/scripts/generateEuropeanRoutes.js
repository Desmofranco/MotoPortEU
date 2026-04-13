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
// BASIC UTILS
// -------------------------------------------------------

function safeJsonParse(raw, label = "json") {
  try {
    return JSON.parse(String(raw).replace(/^\uFEFF/, "").trim());
  } catch (err) {
    throw new Error(`Errore parsing ${label}: ${err.message}`);
  }
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
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

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickLat(spot) {
  return (
    toNum(spot?.lat) ??
    toNum(spot?.latitude) ??
    toNum(spot?.coords?.lat) ??
    toNum(spot?.center?.lat)
  );
}

function pickLng(spot) {
  return (
    toNum(spot?.lng) ??
    toNum(spot?.lon) ??
    toNum(spot?.longitude) ??
    toNum(spot?.coords?.lng) ??
    toNum(spot?.coords?.lon) ??
    toNum(spot?.center?.lng) ??
    toNum(spot?.center?.lon)
  );
}

function normalizeCountryCode(value = "") {
  return String(value || "").trim().toUpperCase();
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
  const lat =
    items.reduce((s, x) => s + Number(pickLat(x) || 0), 0) / items.length;
  const lng =
    items.reduce((s, x) => s + Number(pickLng(x) || 0), 0) / items.length;
  return { lat, lng };
}

function getRawScore(spot) {
  return Number(spot?.riderScore || spot?.score || 0);
}

function getSpotText(spot) {
  return normalizeText(
    [
      spot?.name,
      spot?.address,
      spot?.region,
      spot?.regionHint,
      spot?.scopeName,
      ...(Array.isArray(spot?.tags) ? spot.tags : []),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getRideType(spot) {
  return String(spot?.rideType || "scenic").toLowerCase();
}

function getSpotType(spot) {
  return String(spot?.type || "").toLowerCase();
}

// -------------------------------------------------------
// EUROPEAN SIGNALS
// -------------------------------------------------------

const EURO_MOUNTAIN_SIGNALS = [
  "passo",
  "pass",
  "mountain pass",
  "alp pass",
  "alpine pass",
  "col ",
  "col de",
  "col du",
  "puerto",
  "puerto de",
  "port de",
  "joch",
  "jochpass",
  "passhohe",
  "passhöhe",
  "bergpas",
  "berg pass",
  "transfagarasan",
  "transalpina",
  "furka",
  "grimsel",
  "susten",
  "nufenen",
  "gottardo",
  "gotthard",
  "oberalp",
  "fluela",
  "fluela",
  "san bernardino",
  "simplon",
  "great st bernard",
  "gran san bernardo",
  "stelvio",
  "gavia",
  "mortirolo",
  "spluga",
  "bernina",
  "mendola",
  "tonale",
  "pordoi",
  "giau",
  "falzarego",
  "gardena",
  "campolongo",
  "fedaia",
  "sella",
  "croce dominii",
  "cereda",
  "rolle",
  "manghen",
  "furka pass",
  "grimsel pass",
  "susten pass",
  "albulapass",
  "julier",
  "julierpass",
  "umbrail",
  "splugen",
  "maloja",
  "reschen",
  "passo resia",
  "grossglockner",
  "gerlos",
  "timmelsjoch",
  "katschberg",
  "nockalm",
  "col d izoard",
  "col du galibier",
  "col du lautaret",
  "col de la bonette",
  "col de vars",
  "col de la cayolle",
  "col de turini",
  "col d allos",
  "aubisque",
  "tourmalet",
  "aspin",
  "peyresourde",
  "portalet",
  "somport",
  "ordino",
  "envalira",
  "transalp",
  "tatra",
  "tatra",
  "durmitor",
  "velebit",
  "carpazi",
  "carpath",
];

const EURO_LAKE_SIGNALS = [
  "lake",
  "lago",
  "lac",
  "see",
  "como",
  "garda",
  "maggiore",
  "leman",
  "leman",
  "geneva lake",
  "lac leman",
  "thun",
  "brienz",
  "lungern",
  "hallstatt",
  "worthersee",
  "worthersee",
  "bled",
  "bohinj",
];

const EURO_COASTAL_SIGNALS = [
  "coast",
  "coastal",
  "costiera",
  "sea",
  "mare",
  "costa",
  "riviera",
  "fjord",
  "fiordo",
  "adriatic",
  "mediterranean",
  "cote d azur",
  "costa brava",
  "amalfi",
  "liguria",
  "corniche",
  "baska",
  "makarska",
  "dalmatia",
];

const EURO_FOREST_SIGNALS = [
  "forest",
  "foresta",
  "bosco",
  "black forest",
  "foresta nera",
  "bohemian forest",
  "bavarian forest",
  "woodland",
  "highland",
  "highlands",
];

const ICONIC_EURO_SIGNALS = [
  ...EURO_MOUNTAIN_SIGNALS,
  ...EURO_LAKE_SIGNALS,
  ...EURO_COASTAL_SIGNALS,
  ...EURO_FOREST_SIGNALS,
];

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
    "panoramic viewpoint",
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

function isStrongSignalText(text = "") {
  return ICONIC_EURO_SIGNALS.some((s) => text.includes(s));
}

function isStrongRiderSpot(spot) {
  const text = getSpotText(spot);
  const tags = Array.isArray(spot.tags) ? spot.tags.map(normalizeText) : [];
  const rawScore = getRawScore(spot);
  const rideType = getRideType(spot);
  const type = getSpotType(spot);

  const hasStrongSignal =
    isStrongSignalText(text) ||
    tags.includes("mountain") ||
    tags.includes("twisty") ||
    tags.includes("lake") ||
    tags.includes("coast") ||
    tags.includes("forest") ||
    type === "mountain_pass" ||
    rideType === "mountain" ||
    rideType === "lake" ||
    rideType === "coastal";

  if (isWeakGenericName(spot.name || "")) return false;

  if (rawScore >= 70) return true;
  if (rawScore >= 55 && hasStrongSignal) return true;
  if (rideType === "mountain" && rawScore >= 42) return true;
  if (rideType === "lake" && rawScore >= 38) return true;
  if (rideType === "coastal" && rawScore >= 38) return true;
  if (rideType === "scenic" && rawScore >= 46 && hasStrongSignal) return true;
  if (type === "mountain_pass" && rawScore >= 36) return true;
  if (hasStrongSignal && rawScore >= 34) return true;

  return false;
}

function isAllowedNeighborSpot(spot) {
  const text = getSpotText(spot);
  const rawScore = getRawScore(spot);
  const rideType = getRideType(spot);
  const type = getSpotType(spot);
  const spotCountry = normalizeCountryCode(spot.country);
  const source = String(spot.source || "");

  if (isWeakGenericName(spot.name || "")) return false;
  if (text.includes("monaco")) return false;

  // ✅ Per la pipeline locale, i seed del paese corrente sono validi di default
  if (
    spotCountry === country &&
    (source === "local_scope_manual_seed" || source === "local_scope_seed")
  ) {
    return ["mountain", "scenic", "lake", "coastal", "forest", "fjord"].includes(
      rideType
    );
  }

  const minScore = isLakeScope ? 20 : 28;

  if (
    rawScore >= minScore &&
    ["mountain", "scenic", "lake", "coastal", "forest", "fjord"].includes(
      rideType
    )
  ) {
    return true;
  }

  if (type === "mountain_pass" && rawScore >= 24) return true;
  if (isStrongSignalText(text) && rawScore >= 24) return true;

  return false;
}
function routeQualityScore(points, rideType, region) {
  let score = 0;
  const names = points.map((p) => normalizeText(p.name));
  const allText = names.join(" | ");
  const regionText = normalizeText(region);

  for (const s of ICONIC_EURO_SIGNALS) {
    if (allText.includes(s)) score += 8;
  }

  if (rideType === "mountain") score += 14;
  if (rideType === "lake") score += 12;
  if (rideType === "coastal") score += 10;
  if (rideType === "fjord") score += 10;

  const uniqueNames = new Set(names);
  score += uniqueNames.size * 4;

  for (const p of points) {
    score += Math.min(getRawScore(p), 100) / 8;
  }

  if (regionText.includes("lago di como") || regionText.includes("lake como")) {
    if (
      allText.includes("stelvio") ||
      allText.includes("gavia") ||
      allText.includes("spluga")
    ) {
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

  if (
    regionText.includes("svizzera ovest") ||
    regionText.includes("switzerland west")
  ) {
    if (
      allText.includes("leman") ||
      allText.includes("geneva") ||
      allText.includes("thun") ||
      allText.includes("brienz") ||
      allText.includes("susten") ||
      allText.includes("grimsel") ||
      allText.includes("furka")
    ) {
      score += 10;
    }
  }

  return score;
}

// -------------------------------------------------------
// REGION GUESS — EUROPEAN
// -------------------------------------------------------

function guessMacroRegion(spot) {
  const s = `${spot.regionHint || ""} ${spot.address || ""} ${spot.name || ""} ${spot.scopeName || ""}`.toLowerCase();

  // Italia
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
  if (s.includes("appenn")) return "Appennino";
  if (s.includes("amalfi")) return "Costiera Amalfitana";
  if (s.includes("sicilia")) return "Sicilia";
  if (s.includes("sardegna")) return "Sardegna";
  if (s.includes("etna")) return "Etna";
  if (s.includes("supramonte")) return "Supramonte";

  // Svizzera
  if (s.includes("furka") || s.includes("grimsel") || s.includes("susten")) {
    return "Alpi Svizzere Centrali";
  }
  if (s.includes("nufenen") || s.includes("gottardo") || s.includes("gotthard") || s.includes("oberalp")) {
    return "Passi Svizzeri";
  }
  if (s.includes("thun") || s.includes("brienz") || s.includes("interlaken") || s.includes("jungfrau")) {
    return "Laghi Bernesi";
  }
  if (s.includes("leman") || s.includes("geneva") || s.includes("lavaux") || s.includes("lausanne")) {
    return "Lemano e Lavaux";
  }
  if (s.includes("neuchatel") || s.includes("jura")) {
    return "Giura Svizzero";
  }
  if (s.includes("fluela") || s.includes("davos") || s.includes("albula") || s.includes("julier")) {
    return "Grigioni";
  }
  if (s.includes("ticino") || s.includes("lugano") || s.includes("locarno") || s.includes("san bernardino")) {
    return "Ticino";
  }

  // Austria
  if (s.includes("grossglockner") || s.includes("gerlos") || s.includes("timmelsjoch")) {
    return "Alpi Austriache";
  }
  if (s.includes("tirol") || s.includes("tyrol")) return "Tirolo";
  if (s.includes("salzburg")) return "Salisburghese";
  if (s.includes("karnten") || s.includes("carinthia")) return "Carinzia";

  // Francia
  if (s.includes("galibier") || s.includes("izoard") || s.includes("lautaret")) {
    return "Alpi Francesi";
  }
  if (s.includes("bonette") || s.includes("vars") || s.includes("cayolle") || s.includes("turini")) {
    return "Alpi del Sud";
  }
  if (s.includes("pyren") || s.includes("tourmalet") || s.includes("aubisque") || s.includes("aspin")) {
    return "Pirenei";
  }
  if (s.includes("cote azur") || s.includes("nice") || s.includes("menton") || s.includes("corniche")) {
    return "Costa Azzurra";
  }
  if (s.includes("corsica")) return "Corsica";
  if (s.includes("vosges")) return "Vosgi";

  // Germania
  if (s.includes("black forest") || s.includes("foresta nera")) return "Foresta Nera";
  if (s.includes("bavaria") || s.includes("bayern")) return "Baviera Alpina";

  // Spagna / Andorra
  if (s.includes("costa brava")) return "Costa Brava";
  if (s.includes("sierra nevada")) return "Sierra Nevada";
  if (s.includes("picos")) return "Picos de Europa";
  if (s.includes("pyren")) return "Pirenei";
  if (s.includes("andorra") || s.includes("envalira") || s.includes("ordino")) return "Pirenei Andorrani";

  // Balcani
  if (s.includes("velebit")) return "Velebit";
  if (s.includes("durmitor")) return "Durmitor";
  if (s.includes("dinar")) return "Alpi Dinariche";
  if (s.includes("alban")) return "Alpi Albanesi";

  // Carpazi
  if (s.includes("transfagarasan") || s.includes("transalpina")) return "Carpazi Rumeni";
  if (s.includes("carpath") || s.includes("carpazi")) return "Carpazi";
  if (s.includes("tatra")) return "Tatra";

  // Nord Europa
  if (s.includes("fjord") || s.includes("fiordo") || s.includes("trollstigen")) return "Fiordi Norvegesi";
  if (s.includes("highland")) return "Highlands";
  if (s.includes("north coast")) return "Costa Nord";

  if (s.includes("alpi") || s.includes("alp")) return "Alpi";
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
    rideTypePriority(getRideType(b)) - rideTypePriority(getRideType(a)) ||
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function buildClusterKey(spot) {
  const countryCode = normalizeCountryCode(spot.country || country || "XX");
  const scopeKey = spot.scope || scope || "all";
  const region = guessMacroRegion(spot);
  const rideType = getRideType(spot) || "scenic";
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

function buildClosingSentence(rideType, distanceKm, mode) {
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
  const closing = buildClosingSentence(rideType, distanceKm, mode);

  return `${intro} ${middle} ${closing}`;
}

// -------------------------------------------------------
// ROUTING
// -------------------------------------------------------

async function getOsrmRoute(points) {
  const coords = points.map((p) => `${pickLng(p)},${pickLat(p)}`).join(";");
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
  const coordsLngLat = points.map((p) => [
    roundCoord(pickLng(p)),
    roundCoord(pickLat(p)),
  ]);
  let distanceKm = 0;

  for (let i = 1; i < points.length; i += 1) {
    distanceKm += haversineKm(
      Number(pickLat(points[i - 1])),
      Number(pickLng(points[i - 1])),
      Number(pickLat(points[i])),
      Number(pickLng(points[i]))
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
        coordinates: points.map((p) => [roundCoord(pickLng(p)), roundCoord(pickLat(p))]),
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
      lat: roundCoord(pickLat(start)),
      lng: roundCoord(pickLng(start)),
    },
    end: {
      name: end.name,
      lat: roundCoord(pickLat(end)),
      lng: roundCoord(pickLng(end)),
    },
    waypoints: points.slice(1, -1).map((p) => ({
      name: p.name,
      lat: roundCoord(pickLat(p)),
      lng: roundCoord(pickLng(p)),
      type: p.type || "scenic_road",
      rideType: getRideType(p),
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
    const key = p.id || `${p.name}-${pickLat(p)}-${pickLng(p)}`;
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
      _d: haversineKm(pickLat(seed), pickLng(seed), pickLat(p), pickLng(p)),
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

function summarizeCounts(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

// -------------------------------------------------------
// MAIN
// -------------------------------------------------------

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Generate Routes PRO");
  console.log("====================================");
  console.log(`🌍 Country: ${scopeCfg.countryName} (${country})`);
  console.log(`🧭 Scope: ${scopeCfg.scopeName}`);
  console.log(`📥 Spots: ${SPOTS_FILE}`);
  console.log(`💾 Output: ${OUT_FILE}`);

  const rawText = await fs.readFile(SPOTS_FILE, "utf8");
  const raw = safeJsonParse(rawText, SPOTS_FILE);

  const rawArray = Array.isArray(raw) ? raw : [];
  const spots = rawArray
    .map((s) => {
      const lat = pickLat(s);
      const lng = pickLng(s);
      return {
        ...s,
        lat,
        lng,
        country: normalizeCountryCode(s.country || country),
        rideType: getRideType(s),
        type: s.type || "scenic_road",
        riderScore: getRawScore(s),
      };
    })
    .filter((s) => s && s.name && toNum(s.lat) != null && toNum(s.lng) != null);

  console.log(`📊 Raw items:        ${rawArray.length}`);
  console.log(`📊 Valid lat/lng:    ${spots.length}`);
  console.log("📊 Country dist:", summarizeCounts(spots, (s) => s.country));
  console.log("📊 RideType dist:", summarizeCounts(spots, (s) => s.rideType));

  if (!spots.length) {
    console.error("❌ Nessun rider spot valido trovato");
    process.exit(1);
  }

  const sameCountrySpots = spots.filter(
    (s) => normalizeCountryCode(s.country) === country
  );

  console.log(`📊 Same country:     ${sameCountrySpots.length}`);

  const basePool = sameCountrySpots.length ? sameCountrySpots : spots;
  const filteredSpots = basePool.filter(isAllowedNeighborSpot);

  console.log(`📊 Neighbor allowed: ${filteredSpots.length}`);
  console.log(
    "📊 Allowed by rideType:",
    summarizeCounts(filteredSpots, (s) => s.rideType)
  );

  if (!filteredSpots.length) {
    console.error("❌ Nessun rider spot utilizzabile dopo i filtri");
    process.exit(1);
  }

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
            rideType: getRideType(p),
            lat: roundCoord(pickLat(p)),
            lng: roundCoord(pickLng(p)),
            country: p.country || null,
            scope: p.scope || scopeKey,
            riderScore: getRawScore(p),
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