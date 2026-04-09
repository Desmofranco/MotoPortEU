import fs from "fs/promises";
import path from "path";
import process from "process";
import {
  parseCliArgs,
  getScopeConfig,
  getScopeSuffix,
} from "./lib/routeScopes.js";

// =======================================================
// server/scripts/cleanRiderSpots.js
// MotoPortEU — Clean Rider Spots by Country / Scope (PRO)
// =======================================================

const args = parseCliArgs();
const country = String(args.country || "IT").toUpperCase();
const scope = args.scope ? String(args.scope) : null;

const scopeCfg = getScopeConfig({ country, scope });
const scopeSuffix = getScopeSuffix({ country, scope });

const SCOPED_LOCAL_INPUT_PATH = path.resolve(
  `client/public/data/rider-spots.seed.${scopeSuffix}.json`
);
const SCOPED_RAW_INPUT_PATH = path.resolve(
  `client/public/data/rider-spots.raw.${scopeSuffix}.json`
);
const SCOPED_GOOGLE_NAMED_INPUT_PATH = path.resolve(
  `client/public/data/rider-spots.cleaned.google.${scopeSuffix}.json`
);
const LEGACY_INPUT_PATH = path.resolve("client/public/data/rider-spots.json");
const OUT_PATH = path.resolve(
  `client/public/data/rider-spots.cleaned.${scopeSuffix}.json`
);
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

function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function norm(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeText(str = "") {
  return norm(str).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function textOf(spot) {
  return `${spot.name || ""} ${spot.address || ""} ${spot.region || ""} ${spot.regionHint || ""}`.toLowerCase();
}

function rawTypesOf(spot) {
  if (Array.isArray(spot.rawTypes)) return spot.rawTypes.map((t) => norm(t));
  if (Array.isArray(spot.types)) return spot.types.map((t) => norm(t));
  return [];
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

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}

function normalizeCountryCode(value = "") {
  return String(value || "").trim().toUpperCase();
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
  "grossglockner",
  "gerlos",
  "timmelsjoch",
  "katschberg",
  "nockalm",
  "galibier",
  "izoard",
  "lautaret",
  "bonette",
  "vars",
  "cayolle",
  "turini",
  "aubisque",
  "tourmalet",
  "aspin",
  "peyresourde",
  "portalet",
  "somport",
  "ordino",
  "envalira",
  "tatra",
  "durmitor",
  "velebit",
  "carpath",
  "carpazi",
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
  "geneva lake",
  "lac leman",
  "thun",
  "brienz",
  "lungern",
  "hallstatt",
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
// COUNTRY / SCOPE HELPERS
// -------------------------------------------------------

function inferCountry(address = "", region = "", explicitCountry = null) {
  if (explicitCountry) return normalizeCountryCode(explicitCountry);

  const text = `${address} ${region}`.toLowerCase();

  if (text.includes("italy") || text.includes("italia") || text.includes("it-")) return "IT";
  if (text.includes("switzerland") || text.includes("svizzera") || text.includes("suisse") || /\bch\b/.test(text)) return "CH";
  if (text.includes("austria") || text.includes("österreich") || text.includes("osterreich") || /\bat\b/.test(text)) return "AT";
  if (text.includes("france") || text.includes("francia") || text.includes("fr-")) return "FR";
  if (text.includes("germany") || text.includes("germania") || text.includes("de-")) return "DE";
  if (text.includes("spain") || text.includes("spagna") || text.includes("es-")) return "ES";
  if (text.includes("slovenia") || text.includes("si-")) return "SI";
  if (text.includes("croatia") || text.includes("croazia") || text.includes("hr-")) return "HR";
  if (text.includes("bosnia") || text.includes("ba-")) return "BA";
  if (text.includes("montenegro") || text.includes("me-")) return "ME";
  if (text.includes("albania") || text.includes("albania") || text.includes("al-")) return "AL";
  if (text.includes("romania") || text.includes("romania") || text.includes("ro-")) return "RO";
  if (text.includes("slovakia") || text.includes("slovacchia") || text.includes("sk-")) return "SK";
  if (text.includes("czech") || text.includes("cechia") || text.includes("cz-")) return "CZ";
  if (text.includes("poland") || text.includes("polonia") || text.includes("pl-")) return "PL";
  if (text.includes("norway") || text.includes("norvegia") || text.includes("no-")) return "NO";
  if (text.includes("united kingdom") || text.includes("scotland") || text.includes("uk-") || text.includes("gb-")) return "UK";

  return null;
}

function buildScopeMatchers(scopeCfg, countryCode) {
  const regionTerms = (scopeCfg?.regions || []).map((x) => normalizeText(x));
  const areaTerms = (scopeCfg?.areas || [])
    .map((x) => normalizeText(x.name))
    .filter(Boolean);

  const italyTermsCommon = [
    "italy", "italia",
    "valle d aosta", "valle d'aosta", "aosta valley", "aosta",
    "piemonte", "lombardia", "liguria", "trentino", "alto adige", "sudtirol",
    "veneto", "friuli venezia giulia", "emilia romagna", "toscana", "umbria",
    "marche", "lazio", "abruzzo", "molise", "campania", "basilicata", "puglia",
    "calabria", "sicilia", "sardegna",
    "dolomiti", "appennino", "monte bianco", "gran paradiso", "stelvio",
    "gavia", "mortirolo", "tonale", "spluga", "bernina", "mendola", "resia",
    "forra", "valvestino", "gardesana", "chianti", "val d orcia", "crete senesi",
    "gran sasso", "majella", "etna", "costiera amalfitana", "amalfitana",
    "gargano", "pollino", "sila", "aspromonte", "supramonte", "ogliastra",
    "barbagia", "nebrodi", "madonie", "lago di como", "lake como", "como",
    "bellagio", "menaggio", "varenna", "lecco", "lago maggiore", "lake maggiore",
    "maggiore", "stresa", "verbania", "arona", "lago di garda", "lake garda",
    "garda", "riva del garda", "limone sul garda", "malcesine", "gardone",
    "salò", "salo",
  ].map(normalizeText);

  const nwTerms = [
    "lago di como", "lake como", "como", "bellagio", "menaggio", "varenna", "lecco",
    "lago maggiore", "lake maggiore", "maggiore", "stresa", "verbania", "arona",
    "lago di garda", "lake garda", "garda", "riva del garda", "limone sul garda",
    "malcesine", "gardone", "salo", "salò", "bormio", "livigno", "tirano",
    "sestriere", "cuneo", "imperia", "savona", "genova", "la spezia", "canavese",
    "appennino ligure", "alpi marittime", "gran paradiso", "monte bianco", "aosta",
    "saint-vincent", "col de joux",
  ].map(normalizeText);

  const neTerms = [
    "sellaronda", "cortina", "pordoi", "giau", "falzarego", "gardena",
    "campolongo", "fedaia", "carnia", "lessinia", "monte baldo",
    "trentino laghi", "appennino tosco emiliano",
  ].map(normalizeText);

  const centerTerms = [
    "chianti", "crete senesi", "garfagnana", "apuane", "casentino",
    "val d orcia", "amiata", "umbria", "sibillini", "gran sasso",
    "majella", "terminillo",
  ].map(normalizeText);

  const southTerms = [
    "costiera amalfitana", "cilento", "irpinia", "sannio", "pollino",
    "dolomiti lucane", "gargano", "murge", "valle d itria", "sila", "aspromonte",
  ].map(normalizeText);

  const sicilyTerms = [
    "sicilia", "sicily", "etna", "nebrodi", "madonie", "palermo", "trapani",
    "ragusa", "val di noto", "messina", "peloritani",
  ].map(normalizeText);

  const sardiniaTerms = [
    "sardegna", "sardinia", "costa smeralda", "gallura", "supramonte",
    "ogliastra", "sulcis", "iglesiente", "alghero", "bosa", "barbagia",
  ].map(normalizeText);

  let extraCountryTerms = [];
  if (countryCode === "IT") {
    if (scope === "italy-nw") extraCountryTerms = nwTerms;
    else if (scope === "italy-ne") extraCountryTerms = neTerms;
    else if (scope === "italy-center") extraCountryTerms = centerTerms;
    else if (scope === "italy-south") extraCountryTerms = southTerms;
    else if (scope === "sicily") extraCountryTerms = sicilyTerms;
    else if (scope === "sardinia") extraCountryTerms = sardiniaTerms;
    else if (scope === "como") {
      extraCountryTerms = [
        "lago di como", "lake como", "como", "bellagio", "menaggio", "varenna", "lecco",
      ].map(normalizeText);
    } else if (scope === "maggiore") {
      extraCountryTerms = [
        "lago maggiore", "lake maggiore", "maggiore", "stresa", "verbania", "arona",
      ].map(normalizeText);
    } else if (scope === "garda") {
      extraCountryTerms = [
        "lago di garda", "lake garda", "garda", "riva del garda",
        "limone sul garda", "malcesine", "gardone", "salo", "salò",
      ].map(normalizeText);
    }
  }

  const foreignTerms = [
    "france", "francia", "switzerland", "svizzera", "austria", "osterreich",
    "österreich", "slovenia", "croatia", "croazia", "germany", "germania",
    "provence", "provenza", "haute savoie", "savoie", "nice", "menton", "eze",
    "chamonix mont blanc", "chamonix-mont-blanc", "trient", "orsieres", "evolene",
    "ollon", "morzine", "bonneval sur arc", "bonneval-sur-arc", "saint dalmas le selvage",
    "saint-dalmas-le-selvage", "saint etienne de tinee", "saint-etienne-de-tinee",
    "luceram", "gorbio", "peille", "uvernet fours", "uvernet-fours",
    "molines en queyras", "molines-en-queyras",
  ].map(normalizeText);

  return {
    regionTerms: [...new Set(regionTerms)],
    areaTerms: [...new Set(areaTerms)],
    italyTermsCommon: [...new Set(italyTermsCommon)],
    extraCountryTerms: [...new Set(extraCountryTerms)],
    foreignTerms: [...new Set(foreignTerms)],
  };
}

const scopeMatchers = buildScopeMatchers(scopeCfg, country);

// -------------------------------------------------------
// FILTERS
// -------------------------------------------------------

function isSpotAllowedForItalianScope(spot, matchers) {
  const blob = normalizeText([
    spot.name,
    spot.region,
    spot.regionHint,
    typeof spot.address === "string" ? spot.address : "",
    spot.address?.formattedAddress,
    spot.address?.country,
    spot.address?.countryCode,
    spot.scopeName,
    ...(spot.tags || []),
  ]
    .filter(Boolean)
    .join(" | "));

  const explicitCountry = normalizeCountryCode(spot.country || "");
  if (explicitCountry && explicitCountry !== "IT") return false;

  const inferred = inferCountry(
    typeof spot.address === "string" ? spot.address : "",
    `${spot.region || ""} ${spot.regionHint || ""}`,
    explicitCountry || null
  );

  if (inferred && inferred !== "IT") return false;

  const hasForeignSignal = matchers.foreignTerms.some((t) => blob.includes(t));
  if (hasForeignSignal) return false;

  const hasItalianSignal =
    matchers.italyTermsCommon.some((t) => blob.includes(t)) ||
    matchers.extraCountryTerms.some((t) => blob.includes(t)) ||
    matchers.regionTerms.some((t) => blob.includes(t)) ||
    matchers.areaTerms.some((t) => blob.includes(t));

  if (hasItalianSignal) return true;

  const lat = pickLat(spot);
  const lng = pickLng(spot);
  if (lat == null || lng == null) return false;

  const nearCoreArea = (scopeCfg?.areas || []).some((area) => {
    const dist = haversineKm(lat, lng, area.lat, area.lng);
    return dist <= Math.min(area.radius / 1000, isLakeScope ? 55 : 42);
  });

  return nearCoreArea;
}

function isMatchingCountry(spot, countryCode) {
  const explicit = normalizeCountryCode(spot.country || "");
  if (explicit && explicit === countryCode) return true;

  const text = normalizeText(
    `${spot.address || ""} ${spot.region || ""} ${spot.regionHint || ""} ${spot.scopeName || ""}`
  );

  if (countryCode === "IT") {
    return (
      text.includes("italy") ||
      text.includes("italia") ||
      text.includes("sicilia") ||
      text.includes("sardegna") ||
      text.includes("dolomiti") ||
      text.includes("liguria") ||
      text.includes("amalfitana") ||
      text.includes("garda") ||
      text.includes("como") ||
      text.includes("maggiore") ||
      text.includes("bellagio") ||
      text.includes("menaggio") ||
      text.includes("varenna") ||
      text.includes("lecco") ||
      text.includes("stelvio") ||
      text.includes("gavia") ||
      text.includes("spluga") ||
      text.includes("mortirolo") ||
      text.includes("tonale") ||
      text.includes("resia") ||
      text.includes("mendola") ||
      text.includes("piemonte") ||
      text.includes("lombardia") ||
      text.includes("valle d aosta") ||
      text.includes("aosta valley")
    );
  }

  const inferred = inferCountry(
    typeof spot.address === "string" ? spot.address : "",
    `${spot.region || ""} ${spot.regionHint || ""}`,
    explicit || null
  );

  return inferred === countryCode;
}

function withinScopeRadius(spot, areas) {
  if (!areas?.length) return true;
  const lat = pickLat(spot);
  const lng = pickLng(spot);
  if (lat == null || lng == null) return false;

  return areas.some((area) => {
    const dist = haversineKm(lat, lng, area.lat, area.lng);
    return dist <= area.radius / 1000 + (isLakeScope ? 28 : 18);
  });
}

function hasPassSignal(name = "", address = "", rawTypes = [], spot = {}) {
  const text = normalizeText(
    `${name} ${address} ${spot.region || ""} ${spot.regionHint || ""} ${(spot.tags || []).join(" ")}`
  );
  const types = rawTypes.map((t) => norm(t));

  const textSignals = [
    ...ICONIC_EURO_SIGNALS,
    "strada panoramica",
    "scenic road",
    "coastal road",
    "lake road",
    "mountain road",
    "twisty",
  ];

  const typeSignals = [
    "natural_feature",
    "point_of_interest",
    "tourist_attraction",
    "route",
    "road",
  ];

  const tagSignals = ["mountain", "scenic", "panoramic", "lake", "coast", "forest", "twisty", "fjord"];

  return (
    textSignals.some((k) => text.includes(k)) ||
    types.some((t) => typeSignals.includes(t)) ||
    (spot.tags || []).some((t) => tagSignals.includes(norm(t)))
  );
}

function hasBadWord(text = "") {
  const badWords = [
    "hotel",
    "restaurant",
    "ristorante",
    "bar",
    "cafe",
    "caffe",
    "parking",
    "parcheggio",
    "camping",
    "campeggio",
    "museum",
    "museo",
    "resort",
    "spa",
    "shop",
    "store",
    "fuel station",
    "benzinaio",
    "autogrill",
    "rental",
    "rent",
    "dealer",
    "concessionaria",
    "rifugio",
    "hut",
    "hostel",
    "bivouac",
    "supermarket",
    "market",
    "lodging",
    "beach club",
    "discoteca",
    "night club",
    "greenway",
    "ciclopedonale",
    "walk",
    "trail",
    "sentiero",
    "waterfall",
    "cascata",
    "grotta",
    "church",
    "chiesa",
    "madonna",
    "santuario",
  ];

  return badWords.some((w) => text.includes(w));
}

function hasBadRawType(rawTypes = []) {
  const badTypes = new Set([
    "restaurant",
    "austrian_restaurant",
    "italian_restaurant",
    "european_restaurant",
    "bar",
    "cafe",
    "coffee_shop",
    "hotel",
    "lodging",
    "hostel",
    "parking",
    "parking_lot",
    "campground",
    "camping_cabin",
    "museum",
    "store",
    "gas_station",
    "car_rental",
    "vehicle_dealer",
    "rv_park",
    "supermarket",
    "shopping_mall",
  ]);

  return rawTypes.map((t) => norm(t)).some((t) => badTypes.has(t));
}

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
  ]);

  if (exactWeak.has(text)) return true;

  const weakPatterns = [
    /^punto panoramico$/,
    /^punto panoramico .{0,20}$/,
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

function isTouristOnlySpot(spot) {
  const name = normalizeText(spot.name || "");
  const address = normalizeText(spot.address || "");
  const types = rawTypesOf(spot);

  if (!isLakeScope && isWeakGenericName(name)) return true;

  const weakSpotWords = [
    "viewpoint",
    "lookout",
    "belvedere",
    "terrazza panoramica",
    "vista panoramica",
    "panoramic spot",
    "lake viewpoint",
    "view point",
  ];

  const strongRoadWords = [
    ...ICONIC_EURO_SIGNALS,
    "strada",
    "road",
  ];

  const hasWeak = weakSpotWords.some((w) => name.includes(w) || address.includes(w));
  const hasStrong = strongRoadWords.some((w) => name.includes(w) || address.includes(w));

  if (!isLakeScope && hasWeak && !hasStrong) return true;

  if (
    !isLakeScope &&
    types.includes("tourist_attraction") &&
    !types.includes("route") &&
    !types.includes("road") &&
    !types.includes("natural_feature") &&
    !hasStrong
  ) {
    return true;
  }

  return false;
}

// -------------------------------------------------------
// NAME / TYPE / SCORE
// -------------------------------------------------------

function normalizeSpotName(name = "") {
  let n = String(name || "").trim();
  if (!n) return n;

  const normalizedRaw = normalizeText(n);

  const forcedNames = new Map([
    ["przelecz stelvio", "Passo dello Stelvio"],
    ["przelecz dello stelvio", "Passo dello Stelvio"],
    ["stelvio pass", "Passo dello Stelvio"],
    ["stilfser joch", "Passo dello Stelvio"],
    ["passo stelvio", "Passo dello Stelvio"],
    ["passo dello stelvio", "Passo dello Stelvio"],
  ]);

  if (forcedNames.has(normalizedRaw)) {
    return forcedNames.get(normalizedRaw);
  }

  if (/\bstelvio\b/i.test(n)) {
    return "Passo dello Stelvio";
  }

  return n;
}

function normalizeForeignPassName(name = "") {
  let out = normalizeSpotName(name);

  const replacements = [
    [/przełęcz/gi, "Passo"],
    [/przelecz/gi, "Passo"],
    [/passhöhe/gi, "Passo"],
    [/bergpas/gi, "Passo"],
  ];

  for (const [rx, rep] of replacements) {
    out = out.replace(rx, rep);
  }

  out = out.replace(/\s+/g, " ").trim();

  return normalizeSpotName(out);
}

function inferSpotType(spot) {
  const text = normalizeText(`${spot.name || ""} ${spot.address || ""}`);
  const tags = (spot.tags || []).map(norm);
  const types = rawTypesOf(spot);

  if (
    EURO_MOUNTAIN_SIGNALS.some((s) => text.includes(s)) ||
    tags.includes("mountain")
  ) {
    return "mountain_pass";
  }

  if (
    EURO_COASTAL_SIGNALS.some((s) => text.includes(s)) ||
    tags.includes("coast")
  ) {
    return "coastal_view";
  }

  if (
    EURO_LAKE_SIGNALS.some((s) => text.includes(s)) ||
    tags.includes("lake")
  ) {
    return "lake_view";
  }

  if (
    EURO_FOREST_SIGNALS.some((s) => text.includes(s)) ||
    tags.includes("forest")
  ) {
    return "forest_road";
  }

  if (
    text.includes("collina") ||
    text.includes("hill") ||
    tags.includes("hill")
  ) {
    return "hill_road";
  }

  if (
    types.includes("route") ||
    types.includes("road") ||
    text.includes("road") ||
    text.includes("strada") ||
    text.includes("panoramic") ||
    text.includes("scenic")
  ) {
    return "scenic_road";
  }

  return spot.type || "scenic_road";
}

function inferRideType(spot) {
  const type = inferSpotType(spot);
  const tags = (spot.tags || []).map(norm);

  if (type === "mountain_pass") return "mountain";
  if (type === "coastal_view") return "coastal";
  if (type === "lake_view") return "lake";
  if (type === "forest_road") return "forest";
  if (tags.includes("mountain")) return "mountain";
  if (tags.includes("lake")) return "lake";
  if (tags.includes("coast")) return "coastal";
  if (tags.includes("forest")) return "forest";
  if (tags.includes("fjord")) return "fjord";
  return "scenic";
}

function buildScore(spot) {
  const text = normalizeText(`${spot.name || ""} ${spot.address || ""}`);
  const rawTypes = rawTypesOf(spot);

  let score = 0;

  if (EURO_MOUNTAIN_SIGNALS.some((s) => text.includes(s))) score += 28;
  if (EURO_LAKE_SIGNALS.some((s) => text.includes(s))) score += 12;
  if (EURO_COASTAL_SIGNALS.some((s) => text.includes(s))) score += 12;
  if (EURO_FOREST_SIGNALS.some((s) => text.includes(s))) score += 8;

  if (text.includes("panoramic")) score += 8;
  if (text.includes("scenic")) score += 8;
  if (text.includes("strada")) score += 8;
  if (text.includes("road")) score += 8;

  if (!isLakeScope && isWeakGenericName(spot.name || "")) score -= 30;
  if (!isLakeScope && isTouristOnlySpot(spot)) score -= 25;

  const rating = Number(spot.rating || 0);
  const userRatingCount = Number(spot.userRatingCount || 0);

  if (rating >= 4.5) score += 10;
  if (rating >= 4.7) score += 5;
  if (userRatingCount >= 20) score += 5;
  if (userRatingCount >= 100) score += 10;
  if (userRatingCount >= 500) score += 10;

  if (rawTypes.includes("natural_feature")) score += 10;
  if (rawTypes.includes("tourist_attraction")) score += 2;
  if (rawTypes.includes("point_of_interest")) score += 2;
  if (rawTypes.includes("route")) score += 4;
  if (rawTypes.includes("road")) score += 4;

  const tags = (spot.tags || []).map(norm);
  if (tags.includes("mountain")) score += 10;
  if (tags.includes("coast")) score += 6;
  if (tags.includes("lake")) score += 10;
  if (tags.includes("forest")) score += 5;
  if (tags.includes("twisty")) score += 8;
  if (tags.includes("fjord")) score += 6;

  if (isLakeScope) score += 25;

  return Math.min(score, 100);
}

function canonicalNameKey(name = "") {
  return normalizeText(name)
    .replace(
      /\b(passo|pass|mountain|alp|alpine|joch|col|road|route|scenic|panoramic|viewpoint|lookout|belvedere|coastal|lake|forest|ride|punto|vista)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function dedupe(spots) {
  const out = [];

  for (const s of spots) {
    let merged = false;
    const sKey = canonicalNameKey(s.name);

    for (const ex of out) {
      const sameSourceId =
        s.sourceId &&
        ex.sourceId &&
        String(s.sourceId) === String(ex.sourceId);

      const sameGoogleId =
        s.googlePlaceId &&
        ex.googlePlaceId &&
        String(s.googlePlaceId) === String(ex.googlePlaceId);

      const close =
        haversineKm(Number(s.lat), Number(s.lng), Number(ex.lat), Number(ex.lng)) <=
        (isLakeScope ? 10 : 8);

      const sameName = sKey && sKey === canonicalNameKey(ex.name);

      if (sameSourceId || sameGoogleId || (sameName && close)) {
        if ((s.riderScore || 0) > (ex.riderScore || 0)) {
          ex.id = s.id || ex.id;
          ex.name = s.name || ex.name;
          ex.slug = s.slug || ex.slug;
          ex.type = s.type || ex.type;
          ex.rideType = s.rideType || ex.rideType;
          ex.country = s.country || ex.country;
          ex.scope = s.scope || ex.scope;
          ex.scopeName = s.scopeName || ex.scopeName;
          ex.lat = s.lat ?? ex.lat;
          ex.lng = s.lng ?? ex.lng;
          ex.region = s.region || ex.region;
          ex.regionHint = s.regionHint || ex.regionHint;
          ex.address = s.address || ex.address;
          ex.rating = s.rating ?? ex.rating;
          ex.userRatingCount = s.userRatingCount ?? ex.userRatingCount;
          ex.rawTypes = Array.from(new Set([...(ex.rawTypes || []), ...(s.rawTypes || [])]));
          ex.types = Array.from(new Set([...(ex.types || []), ...(s.types || [])]));
          ex.tags = Array.from(new Set([...(ex.tags || []), ...(s.tags || [])]));
          ex.riderScore = s.riderScore;
          ex.source = s.source || ex.source;
          ex.sourceId = s.sourceId || ex.sourceId;
          ex.googlePlaceId = s.googlePlaceId || ex.googlePlaceId;
        } else {
          ex.rawTypes = Array.from(new Set([...(ex.rawTypes || []), ...(s.rawTypes || [])]));
          ex.types = Array.from(new Set([...(ex.types || []), ...(s.types || [])]));
          ex.tags = Array.from(new Set([...(ex.tags || []), ...(s.tags || [])]));
        }

        ex.aliases = Array.from(new Set([...(ex.aliases || [ex.name]), s.name].filter(Boolean)));
        merged = true;
        break;
      }
    }

    if (!merged) {
      out.push({
        ...s,
        aliases: Array.from(new Set([...(s.aliases || []), s.name].filter(Boolean))),
      });
    }
  }

  return out;
}

// -------------------------------------------------------
// IO
// -------------------------------------------------------

async function tryReadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = safeJsonParse(raw, filePath);
    if (Array.isArray(parsed)) {
      console.log(`📥 Input trovato: ${filePath}`);
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function readInput() {
  const candidates = [
    SCOPED_LOCAL_INPUT_PATH,
    SCOPED_RAW_INPUT_PATH,
    SCOPED_GOOGLE_NAMED_INPUT_PATH,
    LEGACY_INPUT_PATH,
  ];

  for (const filePath of candidates) {
    const parsed = await tryReadJson(filePath);
    if (parsed) return parsed;
  }

  throw new Error(
    `Nessun file input trovato per ${scopeSuffix}. Cercati: ${candidates.join(" | ")}`
  );
}
// -------------------------------------------------------
// MAIN
// -------------------------------------------------------

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Clean Rider Spots PRO");
  console.log("====================================");
  console.log(`🌍 Country: ${scopeCfg.countryName} (${country})`);
  console.log(`🧭 Scope: ${scopeCfg.scopeName}`);
  console.log(`💾 Output: ${OUT_PATH}`);

  const raw = await readInput();

  const baseValid = Array.isArray(raw)
    ? raw
        .map((spot) => ({
          ...spot,
          lat: pickLat(spot),
          lng: pickLng(spot),
        }))
        .filter((spot) => spot && spot.name && spot.lat != null && spot.lng != null)
    : [];

  const countryFiltered = baseValid.filter((spot) => isMatchingCountry(spot, country));

  const scopeRadiusFiltered = countryFiltered.filter((spot) =>
    withinScopeRadius(spot, scopeCfg.areas)
  );

  const passSignalFiltered = scopeRadiusFiltered.filter((spot) => {
    if (isLakeScope) return true;
    return hasPassSignal(spot.name, spot.address, rawTypesOf(spot), spot);
  });

  const noBadWordFiltered = passSignalFiltered.filter((spot) => {
    if (isLakeScope) {
      const txt = textOf(spot);
      const hasRoadLakeSignal =
        /\blago\b|\blake\b|\bcomo\b|\bgarda\b|\bmaggiore\b|\bbellagio\b|\bmenaggio\b|\bvarenna\b|\blecco\b|\bstresa\b|\bverbania\b|\barona\b|\bstrada\b|\broad\b/.test(
          normalizeText(txt)
        );
      if (hasRoadLakeSignal) return true;
    }
    return !hasBadWord(textOf(spot));
  });

  const noBadTypeFiltered = noBadWordFiltered.filter((spot) => {
    if (isLakeScope) {
      const rawTypes = rawTypesOf(spot);
      const softAllowed = ["natural_feature", "tourist_attraction", "point_of_interest", "route", "road"];
      if (rawTypes.some((t) => softAllowed.includes(t))) return true;
    }
    return !hasBadRawType(rawTypesOf(spot));
  });

  const noTouristOnlyFiltered = noBadTypeFiltered.filter((spot) => !isTouristOnlySpot(spot));

  const scopeCountryStrictFiltered = noTouristOnlyFiltered.filter((spot) => {
    if (country === "IT") {
      return isSpotAllowedForItalianScope(spot, scopeMatchers);
    }
    return true;
  });

  const minScore = isLakeScope ? 20 : 24;

  const filtered = scopeCountryStrictFiltered
    .map((spot, index) => {
      const countryCode = inferCountry(
        typeof spot.address === "string" ? spot.address : "",
        spot.region || spot.regionHint,
        spot.country
      );
      const cleanedName = normalizeForeignPassName(spot.name || "");
      const type = inferSpotType({ ...spot, name: cleanedName });

      const normalized = {
        id:
          spot.id ||
          `spot-${scopeSuffix.toLowerCase()}-${slugify(cleanedName || `item-${index + 1}`)}`,
        sourceId: spot.sourceId || spot.googlePlaceId || spot.id || null,
        googlePlaceId: spot.googlePlaceId || null,
        name: cleanedName,
        slug: spot.slug || slugify(cleanedName),
        type,
        rideType: spot.rideType || inferRideType({ ...spot, name: cleanedName, type }),
        country: countryCode || country,
        scope: spot.scope || scope || "all",
        scopeName: spot.scopeName || scopeCfg.scopeName,
        lat: Number(spot.lat),
        lng: Number(spot.lng),
        region: spot.region || null,
        regionHint: spot.regionHint || null,
        address: spot.address || null,
        rating: toNum(spot.rating),
        userRatingCount: toNum(spot.userRatingCount),
        rawTypes: rawTypesOf(spot),
        types: Array.isArray(spot.types) ? spot.types : rawTypesOf(spot),
        source: spot.source || "google_places",
        tags: Array.from(
          new Set(
            [
              ...(spot.tags || []),
              "rider-spot",
              isLakeScope ? "lake-scope" : null,
              type === "mountain_pass" ? "mountain-pass" : null,
            ].filter(Boolean)
          )
        ),
        aliases: Array.from(
          new Set([...(spot.aliases || []), spot.name, cleanedName].filter(Boolean))
        ),
      };

      normalized.riderScore = buildScore(normalized);
      return normalized;
    })
    .filter((spot) => normalizeCountryCode(spot.country) === country)
    .filter((spot) => spot.riderScore >= minScore);

  const unique = dedupe(filtered).sort((a, b) => {
    if ((b.riderScore || 0) !== (a.riderScore || 0)) {
      return (b.riderScore || 0) - (a.riderScore || 0);
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "it");
  });

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(unique, null, 2), "utf8");

  console.log(`✅ Input: ${Array.isArray(raw) ? raw.length : 0}`);
  console.log(`✅ Base validi: ${baseValid.length}`);
  console.log(`✅ Dopo country: ${countryFiltered.length}`);
  console.log(`✅ Dopo radius scope: ${scopeRadiusFiltered.length}`);
  console.log(`✅ Dopo pass signal: ${passSignalFiltered.length}`);
  console.log(`✅ Dopo bad words/types/tourist: ${noTouristOnlyFiltered.length}`);
  if (country === "IT") {
    console.log(`✅ Dopo filtro IT scope-strict: ${scopeCountryStrictFiltered.length}`);
  }
  console.log(`✅ Output pulito PRO: ${unique.length}`);
  console.log(`📁 Salvato in: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("❌ Errore:", err);
  process.exit(1);
});