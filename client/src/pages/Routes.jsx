// =======================================================
// client/src/pages/Routes.jsx
// Itinerari Touring
// UI: split-view su desktop (lista + dettaglio)
// Mobile: lista -> dettaglio (full screen) con back
//
// DATI LIVE SPLIT:
// ✅ Prima prova /data/routes-index.json
// ✅ Poi carica /data/routes/IT.json, FR.json, ecc.
// ✅ Fallback sicuro su /data/routes.json
//
// OPTIMIZATION PACK:
// ✅ Loading skeleton
// ✅ Meteo + Google Maps
// ✅ FIX mobile: no aperture accidentali durante scroll
// ✅ Ricerca intelligente
// ✅ Filtri: Paese / Regione / Categoria
// ✅ Categorie commerciali: Montagna / Laghi / Mare
// ✅ Render limitato iniziale
// ✅ Pulsante "Carica altri"
// ✅ Ricerca con debounce
// ✅ Fetch con cache più favorevole su mobile
//
// RIDER PANEL INLINE REALE:
// ✅ Un solo pannello automatico nel dettaglio itinerario
// ✅ Dati coerenti con “Analizza con Rider”
// ✅ Payload arricchito verso Map.jsx
// ✅ Hero pulita: distanza, categoria, profilo rider
// ✅ Rimossi doppioni visivi
//
// GPX:
// ✅ Export GPX integrato
// =======================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import RouteMap from "../components/RouteMap";
import { getRouteWeatherSummary } from "../utils/routeWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

const TAP_MOVE_THRESHOLD = 12;

const MOBILE_INITIAL_COUNT = 24;
const DESKTOP_INITIAL_COUNT = 48;
const LOAD_MORE_STEP_MOBILE = 24;
const LOAD_MORE_STEP_DESKTOP = 48;

function isMobileNow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
}

function getInitialVisibleCount() {
  return isMobileNow() ? MOBILE_INITIAL_COUNT : DESKTOP_INITIAL_COUNT;
}

function getLoadMoreStep() {
  return isMobileNow() ? LOAD_MORE_STEP_MOBILE : LOAD_MORE_STEP_DESKTOP;
}

function useDebouncedValue(value, delay = 220) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

async function fetchJsonSafe(url, fallback = null) {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

function normalizeCountryCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function extractCountriesFromIndex(indexData) {
  if (!indexData) return [];

  if (Array.isArray(indexData)) {
    return indexData
      .map((x) => {
        if (typeof x === "string") return normalizeCountryCode(x);
        return normalizeCountryCode(x?.country || x?.code || x?.id);
      })
      .filter(Boolean);
  }

  if (Array.isArray(indexData.countries)) {
    return indexData.countries
      .map((x) => {
        if (typeof x === "string") return normalizeCountryCode(x);
        return normalizeCountryCode(x?.country || x?.code || x?.id);
      })
      .filter(Boolean);
  }

  if (Array.isArray(indexData.files)) {
    return indexData.files
      .map((x) => {
        if (typeof x === "string") {
          return normalizeCountryCode(
            x.replace("/data/routes/", "").replace("routes/", "").replace(".json", "")
          );
        }
        return normalizeCountryCode(x?.country || x?.code || x?.id);
      })
      .filter(Boolean);
  }

  return [];
}

function asRoutesArray(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.routes)) return data.routes;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;

  if (data && typeof data === "object" && data.id && data.name) {
    return [data];
  }

  return [];
}

async function loadRoutesDataset() {
  const indexData = await fetchJsonSafe("/data/routes-index.json", null);

  const indexRoutes = asRoutesArray(indexData);
  if (indexRoutes.length) {
    return indexRoutes;
  }

  const countries = Array.from(new Set(extractCountriesFromIndex(indexData)));

  if (countries.length) {
    const chunks = await Promise.all(
      countries.map(async (code) => {
        const data = await fetchJsonSafe(`/data/routes/${code}.json`, []);
        return asRoutesArray(data);
      })
    );

    const splitRoutes = chunks.flat();

    if (splitRoutes.length) {
      return splitRoutes;
    }
  }

  const legacy = await fetchJsonSafe("/data/routes.json", []);
  return asRoutesArray(legacy);
}

function openGoogleMapsSmart(url) {
  if (!url) return;
  if (isMobileNow()) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pairFrom(a, b) {
  const lat = toNum(a);
  const lon = toNum(b);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

function latLonStr(p) {
  if (!p || p.length < 2) return null;
  const lat = Number(p[0]);
  const lon = Number(p[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat},${lon}`;
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function safeFileName(value = "motoporteu-itinerario") {
  return String(value || "motoporteu-itinerario")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pointFromObject(obj) {
  if (!obj) return null;
  return pairFrom(
    obj?.lat ?? obj?.latitude,
    obj?.lng ?? obj?.lon ?? obj?.longitude
  );
}

function extractRouteCoords(route) {
  const out = [];

  const pushPoint = (p) => {
    let pair = null;

    if (Array.isArray(p) && p.length >= 2) {
      pair = pairFrom(p[0], p[1]);
    } else if (p && typeof p === "object") {
      pair = pointFromObject(p);
    }

    if (!pair) return;

    const last = out[out.length - 1];
    if (
      last &&
      Number(last[0]).toFixed(5) === Number(pair[0]).toFixed(5) &&
      Number(last[1]).toFixed(5) === Number(pair[1]).toFixed(5)
    ) {
      return;
    }

    out.push(pair);
  };

  if (Array.isArray(route?.coords)) {
    route.coords.forEach(pushPoint);
  }

  if (out.length < 2 && Array.isArray(route?.geometry)) {
    route.geometry.forEach(pushPoint);
  }

  if (out.length < 2 && Array.isArray(route?.waypoints)) {
    route.waypoints.forEach(pushPoint);
  }

  if (out.length < 2 && Array.isArray(route?.spots)) {
    route.spots.forEach(pushPoint);
  }

  if (out.length < 2) {
    pushPoint(route?.start);
    pushPoint(route?.center);
    pushPoint(route?.end);
  }

  return out;
}

function getGpxRoutePoints(route) {
  const coords = extractRouteCoords(route);

  if (coords.length >= 2) {
    return coords.map((p, index) => ({
      lat: Number(p[0]),
      lon: Number(p[1]),
      name:
        index === 0
          ? route?.start?.name || "Start"
          : index === coords.length - 1
          ? route?.end?.name || "Arrivo"
          : "",
    }));
  }

  const points = [];

  const push = (p, fallbackName = "") => {
    const pair = Array.isArray(p) ? pairFrom(p[0], p[1]) : pointFromObject(p);
    if (!pair) return;

    const last = points[points.length - 1];
    if (
      last &&
      Number(last.lat).toFixed(5) === Number(pair[0]).toFixed(5) &&
      Number(last.lon).toFixed(5) === Number(pair[1]).toFixed(5)
    ) {
      return;
    }

    points.push({
      lat: Number(pair[0]),
      lon: Number(pair[1]),
      name: p?.name || fallbackName || "",
    });
  };

  push(route?.start, "Start");

  if (Array.isArray(route?.waypoints)) {
    route.waypoints.forEach((w) => push(w, w?.name || "Waypoint"));
  }

  if (Array.isArray(route?.spots)) {
    route.spots.forEach((s) => push(s, s?.name || "Punto"));
  }

  push(route?.end, "Arrivo");

  return points;
}

function exportRouteToGpx(route) {
  const points = getGpxRoutePoints(route);

  if (!points.length) {
    alert("Questo itinerario non contiene coordinate esportabili in GPX.");
    return;
  }

  if (points.length < 2) {
    alert("Servono almeno due punti per esportare un GPX valido.");
    return;
  }

  const routeName = route?.name || "MotoPortEU Itinerario";

  const trkpts = points
    .map((p) => {
      const name = p.name ? `<name>${escapeXml(p.name)}</name>` : "";
      return `      <trkpt lat="${Number(p.lat)}" lon="${Number(p.lon)}">${name}</trkpt>`;
    })
    .join("\n");

  const rtepts = points
    .map((p) => {
      const name = p.name ? `<name>${escapeXml(p.name)}</name>` : "";
      return `    <rtept lat="${Number(p.lat)}" lon="${Number(p.lon)}">${name}</rtept>`;
    })
    .join("\n");

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoPortEU" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(routeName)}</name>
  </metadata>
  <rte>
    <name>${escapeXml(routeName)}</name>
${rtepts}
  </rte>
  <trk>
    <name>${escapeXml(routeName)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;

  const blob = new Blob([gpx], {
    type: "application/gpx+xml;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `${safeFileName(routeName)}.gpx`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function buildNavigateUrl(destination, travelmode = "driving") {
  if (!destination) return null;
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${encodeURIComponent(travelmode)}` +
    `&dir_action=navigate`
  );
}

function buildRouteKey(r) {
  const id = String(r?.id || "").trim();
  if (id) return `id:${id}`;

  const name = String(r?.name || "").trim().toLowerCase();

  const sp = pointFromObject(r?.start);
  const ep = pointFromObject(r?.end);

  const s = sp ? `${Number(sp[0]).toFixed(5)},${Number(sp[1]).toFixed(5)}` : "";
  const e = ep ? `${Number(ep[0]).toFixed(5)},${Number(ep[1]).toFixed(5)}` : "";

  return `n:${name}|${s}|${e}`;
}

function normalizeRoute(route) {
  return {
    ...route,
    country: normalizeCountryCode(route?.country || route?.countryCode || route?.countryName),
    aliases: Array.isArray(route?.aliases) ? route.aliases : [],
    tags: Array.isArray(route?.tags) ? route.tags : [],
    searchTags: Array.isArray(route?.searchTags) ? route.searchTags : [],
    waypoints: Array.isArray(route?.waypoints) ? route.waypoints : [],
    spots: Array.isArray(route?.spots) ? route.spots : [],
    coords: Array.isArray(route?.coords) ? route.coords : [],
    hero: Boolean(route?.hero),
    distanceKm: toNum(route?.distanceKm),
    durationMin: toNum(route?.durationMin),
    rating: toNum(route?.rating),
    curvesScore: toNum(route?.curvesScore),
    asphaltScore: toNum(route?.asphaltScore),
  };
}

function routeSearchBlob(route) {
  const parts = [
    route?.name,
    route?.region,
    route?.country,
    route?.countryName,
    route?.description,
    route?.bestSeason,
    route?.pace,
    route?.rideType,
    route?.routeFamily,
    route?.mode,
    route?.surface,
    route?.difficulty,
    route?.searchText,
    ...(route?.aliases || []),
    ...(route?.tags || []),
    ...(route?.searchTags || []),
    ...(route?.waypoints || []).map((w) => w?.name),
    ...(route?.spots || []).map((s) => s?.name),
    route?.start?.name,
    route?.end?.name,
  ].filter(Boolean);

  return normalizeText(parts.join(" "));
}

function pickRoutePoint(route) {
  {
    const p = pointFromObject(route?.start);
    if (p) return p;
  }

  {
    const p = pointFromObject(route?.end);
    if (p) return p;
  }

  {
    const p = pointFromObject(route?.center);
    if (p) return p;
  }

  if (Array.isArray(route?.center) && route.center.length >= 2) {
    const p = pairFrom(route.center[0], route.center[1]);
    if (p) return p;
  }

  if (Array.isArray(route?.coords) && route.coords.length) {
    const c0 = route.coords[0];
    if (Array.isArray(c0) && c0.length >= 2) {
      const p = pairFrom(c0[0], c0[1]);
      if (p) return p;
    }
  }

  if (Array.isArray(route?.waypoints) && route.waypoints.length) {
    for (const w of route.waypoints) {
      const p = pointFromObject(w);
      if (p) return p;
    }
  }

  return null;
}

function normalizeCategory(route) {
  const family = normalizeText(route?.routeFamily || route?.rideType);

  if (family === "mountain") return "mountain";
  if (family === "lake") return "lake";
  if (family === "coastal") return "coastal";

  const tags = Array.isArray(route?.searchTags)
    ? route.searchTags.map((x) => normalizeText(x))
    : [];

  if (tags.includes("montagna")) return "mountain";
  if (tags.includes("lago") || tags.includes("laghi")) return "lake";
  if (tags.includes("mare")) return "coastal";

  const blob = routeSearchBlob(route);

  if (
    blob.includes("lago") ||
    blob.includes("lake") ||
    blob.includes("garda") ||
    blob.includes("como") ||
    blob.includes("maggiore") ||
    blob.includes("iseo") ||
    blob.includes("trasimeno") ||
    blob.includes("ledro") ||
    blob.includes("orta")
  ) {
    return "lake";
  }

  if (
    blob.includes("coast") ||
    blob.includes("costiera") ||
    blob.includes("mare") ||
    blob.includes("riviera") ||
    blob.includes("amalfi") ||
    blob.includes("salento") ||
    blob.includes("liguria") ||
    blob.includes("sardegna") ||
    blob.includes("sicilia") ||
    blob.includes("adriatic") ||
    blob.includes("tirreno") ||
    blob.includes("ionio") ||
    blob.includes("conero")
  ) {
    return "coastal";
  }

  return "mountain";
}

function categoryLabel(category) {
  if (category === "mountain") return "Montagna";
  if (category === "lake") return "Laghi";
  if (category === "coastal") return "Mare";
  return "Tutte";
}

function countryLabel(code) {
  const map = {
    IT: "Italia",
    FR: "Francia",
    CH: "Svizzera",
    AT: "Austria",
    DE: "Germania",
    ES: "Spagna",
    PT: "Portogallo",
    SI: "Slovenia",
    HR: "Croazia",
    BA: "Bosnia",
    ME: "Montenegro",
    AL: "Albania",
    RO: "Romania",
    SK: "Slovacchia",
    CZ: "Cechia",
    PL: "Polonia",
    NO: "Norvegia",
    SE: "Svezia",
    UK: "Regno Unito",
    IE: "Irlanda",
    GB: "Regno Unito",
    BE: "Belgio",
    NL: "Olanda",
    LU: "Lussemburgo",
    BG: "Bulgaria",
    RS: "Serbia",
    GR: "Grecia",
    MK: "Macedonia del Nord",
    XK: "Kosovo",
    LI: "Liechtenstein",
    FI: "Finlandia",
    IS: "Islanda",
    HU: "Ungheria",
    DK: "Danimarca",
  };
  return map[code] || code;
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function computeDistanceKm(a, b) {
  if (!a || !b) return 0;

  const lat1 = toNum(a[0]);
  const lon1 = toNum(a[1]);
  const lat2 = toNum(b[0]);
  const lon2 = toNum(b[1]);

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return 0;
  }

  const R = 6371;
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) *
      Math.cos(degToRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function bearingDeg(a, b) {
  if (!a || !b) return null;

  const lat1 = degToRad(Number(a[0]));
  const lat2 = degToRad(Number(b[0]));
  const dLon = degToRad(Number(b[1]) - Number(a[1]));

  if (![lat1, lat2, dLon].every(Number.isFinite)) return null;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a, b) {
  if (a == null || b == null) return 0;
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function getRouteDistanceKm(route) {
  const declared = toNum(route?.distanceKm);
  if (declared && declared > 0) return declared;

  const coords = extractRouteCoords(route);
  if (coords.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    total += computeDistanceKm(coords[i - 1], coords[i]);
  }

  return total;
}

function analyzeCurves(route) {
  const coords = extractRouteCoords(route);
  const rawDeclaredScore = toNum(route?.curvesScore);
  const declaredScore =
    rawDeclaredScore != null && rawDeclaredScore > 0 ? rawDeclaredScore : null;

  if (coords.length < 3) {
    const estimated =
      declaredScore != null
        ? Math.max(0, Math.min(100, declaredScore))
        : normalizeCategory(route) === "mountain"
        ? 72
        : normalizeCategory(route) === "coastal"
        ? 48
        : 42;

    return {
      available: false,
      points: coords.length,
      curves: null,
      technicalTurns: null,
      directionChanges: null,
      curveDensity: null,
      score: Math.round(estimated),
      label:
        estimated >= 75
          ? "Molto guidato"
          : estimated >= 55
          ? "Guidato"
          : estimated >= 35
          ? "Scorrevole"
          : "Facile",
    };
  }

  let curves = 0;
  let technicalTurns = 0;
  let directionChanges = 0;
  let lastBearing = bearingDeg(coords[0], coords[1]);

  for (let i = 2; i < coords.length; i += 1) {
    const b = bearingDeg(coords[i - 1], coords[i]);
    const diff = angleDiff(lastBearing, b);

    if (diff >= 12) directionChanges += 1;
    if (diff >= 22) curves += 1;
    if (diff >= 45) technicalTurns += 1;

    lastBearing = b;
  }

  const distanceKm = Math.max(1, getRouteDistanceKm(route));
  const curveDensity = curves / distanceKm;
  const technicalDensity = technicalTurns / distanceKm;

  let score = Math.round(
    Math.min(
      100,
      curveDensity * 42 + technicalDensity * 65 + Math.min(coords.length, 80) * 0.18
    )
  );

  if (declaredScore != null) {
    score = Math.round(score * 0.65 + declaredScore * 0.35);
  }

  const label =
    score >= 78
      ? "Molto guidato"
      : score >= 58
      ? "Guidato"
      : score >= 38
      ? "Scorrevole"
      : "Facile";

  return {
    available: true,
    points: coords.length,
    curves,
    technicalTurns,
    directionChanges,
    curveDensity,
    score,
    label,
  };
}
function buildRiderAnalysis(route) {
  const category = normalizeCategory(route);
  const distanceKm = getRouteDistanceKm(route);
  const curves = analyzeCurves(route);
  const asphaltScore = toNum(route?.asphaltScore);
  const difficultyText = normalizeText(route?.difficulty);
  const blob = routeSearchBlob(route);

  let complexityScore = 0;

  complexityScore += Math.min(38, curves.score * 0.38);

  if (distanceKm >= 250) complexityScore += 28;
  else if (distanceKm >= 180) complexityScore += 22;
  else if (distanceKm >= 120) complexityScore += 16;
  else if (distanceKm >= 70) complexityScore += 10;
  else complexityScore += 5;

  if (category === "mountain") complexityScore += 18;
  if (category === "coastal") complexityScore += 8;
  if (category === "lake") complexityScore += 6;

  if (
    difficultyText.includes("hard") ||
    difficultyText.includes("difficile") ||
    difficultyText.includes("expert") ||
    difficultyText.includes("avanz")
  ) {
    complexityScore += 16;
  } else if (
    difficultyText.includes("medium") ||
    difficultyText.includes("intermedio") ||
    difficultyText.includes("medio")
  ) {
    complexityScore += 9;
  }

  if (
    blob.includes("passo") ||
    blob.includes("pass") ||
    blob.includes("alps") ||
    blob.includes("alp") ||
    blob.includes("dolom") ||
    blob.includes("mountain")
  ) {
    complexityScore += 8;
  }

  if (asphaltScore != null && asphaltScore < 55) complexityScore += 8;

  complexityScore = Math.max(1, Math.min(100, Math.round(complexityScore)));

  let complexity = "Easy";
  let tone = "green";
  let icon = "🟢";

  if (complexityScore >= 78) {
    complexity = "Expert";
    tone = "red";
    icon = "🔴";
  } else if (complexityScore >= 58) {
    complexity = "Sport";
    tone = "orange";
    icon = "🟠";
  } else if (complexityScore >= 38) {
    complexity = "Touring";
    tone = "blue";
    icon = "🔵";
  }

  let diagnosis = "";

  if (complexity === "Expert") {
    diagnosis =
      "Percorso impegnativo: tante curve, ritmo fisico e possibile alternanza di tratti tecnici.";
  } else if (complexity === "Sport") {
    diagnosis =
      "Percorso molto interessante per chi ama guidare: curve presenti e buon ritmo.";
  } else if (complexity === "Touring") {
    diagnosis =
      "Percorso equilibrato: adatto al turismo in moto, con guida piacevole.";
  } else {
    diagnosis =
      "Percorso facile e scorrevole: ideale per una gita rilassata.";
  }

  return {
    distanceKm,
    curves,
    complexity,
    complexityScore,
    tone,
    icon,
    diagnosis,
  };
}

function clampScore(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function buildAutoRiderEngine(route, analysis) {
  const category = normalizeCategory(route);
  const blob = routeSearchBlob(route);
  const distanceKm = Number(analysis?.distanceKm || getRouteDistanceKm(route) || 0);
  const curvesScore = Number(analysis?.curves?.score || 0);
  const asphaltScore = toNum(route?.asphaltScore);
  const complexityScore = Number(analysis?.complexityScore || 0);

  const hasMountainWords =
    blob.includes("passo") ||
    blob.includes("alps") ||
    blob.includes("dolom") ||
    blob.includes("montagna");

  const hasCoastWords =
    category === "coastal" ||
    blob.includes("costiera") ||
    blob.includes("mare");

  const hasLakeWords =
    category === "lake" ||
    blob.includes("lago");

  let sportScore = 0;
  sportScore += curvesScore * 0.45;
  sportScore += complexityScore * 0.35;
  sportScore += category === "mountain" ? 12 : 0;
  sportScore += hasMountainWords ? 8 : 0;
  sportScore += asphaltScore != null && asphaltScore >= 70 ? 5 : 0;

  let touringScore = 0;
  touringScore += distanceKm >= 80 && distanceKm <= 230 ? 24 : 12;
  touringScore += complexityScore >= 35 && complexityScore <= 72 ? 24 : 10;
  touringScore += curvesScore >= 35 && curvesScore <= 78 ? 20 : 8;
  touringScore += hasLakeWords || hasCoastWords ? 12 : 6;

  let scenicScore = 0;
  scenicScore += hasCoastWords ? 28 : 0;
  scenicScore += hasLakeWords ? 24 : 0;
  scenicScore += category === "mountain" ? 14 : 0;

  sportScore = clampScore(sportScore);
  touringScore = clampScore(touringScore);
  scenicScore = clampScore(scenicScore);

  const profileScores = [
    { key: "sport", label: "Sport Rider", score: sportScore, icon: "⚡" },
    { key: "touring", label: "Touring Rider", score: touringScore, icon: "🏍️" },
    { key: "scenic", label: "Scenic Rider", score: scenicScore, icon: "🌄" },
  ].sort((a, b) => b.score - a.score);

  const mainProfile = profileScores[0];

  let advice =
    "Mantieni un ritmo progressivo: primi km per leggere strada e grip.";

  if (mainProfile.key === "sport") {
    advice =
      "Guida rotonda e pulita: questo giro premia precisione più che velocità.";
  } else if (mainProfile.key === "touring") {
    advice =
      "Perfetto con ritmo costante: ideale per una guida fluida e sostenibile.";
  } else if (mainProfile.key === "scenic") {
    advice =
      "Goditi il panorama e mantieni una guida rilassata.";
  }

  return {
    profileScores,
    mainProfile,
    advice,
  };
}

function buildInlineRiderTravelPanel(route, analysis) {
  const engine = buildAutoRiderEngine(route, analysis);
  const distanceKm = Number(analysis?.distanceKm || getRouteDistanceKm(route) || 0);
  const curves = analysis?.curves || analyzeCurves(route);

  const avgSpeed =
    engine.mainProfile.key === "sport"
      ? 62
      : engine.mainProfile.key === "scenic"
      ? 58
      : 60;

  const durationMin =
    distanceKm > 0 ? Math.round((distanceKm / avgSpeed) * 60) : 0;

  return {
    engine,
    distanceKm,
    durationMin,
    avgSpeed,
    profile: engine.mainProfile.label.replace(" Rider", ""),
    curveScore: curves.score,
    totalTurns: curves.curves ?? Math.round(curves.score * 2.4),
    technicalTurns: curves.technicalTurns ?? 0,
    directionChanges: curves.directionChanges ?? 0,
    complexityLabel:
      analysis.complexityScore >= 78
        ? "Alta"
        : analysis.complexityScore >= 50
        ? "Media"
        : "Bassa",
    complexityColor:
      analysis.complexityScore >= 78
        ? "#dc2626"
        : analysis.complexityScore >= 50
        ? "#ca8a04"
        : "#15803d",
  };
}

function sendRouteToRiderMap(route) {
  try {
    const analysis = buildRiderAnalysis(route);
    const autoRiderEngine = buildAutoRiderEngine(route, analysis);
    const riderPanel = buildInlineRiderTravelPanel(route, analysis);

    const payload = {
      source: "routes",
      action: "analyze_with_rider_engine",
      createdAt: new Date().toISOString(),
      route: {
        ...route,
        coords: extractRouteCoords(route),
        distanceKm: analysis.distanceKm,
        category: normalizeCategory(route),
        riderAnalysis: analysis,
        autoRiderEngine,
        riderPanel,
      },
    };

    localStorage.setItem(
      "motoporteu:riderRouteToAnalyze",
      JSON.stringify(payload)
    );
    localStorage.setItem(
      "motoporteu:navigatorImport",
      JSON.stringify(payload)
    );
    localStorage.setItem(
      "motoporteu:selectedRouteForMap",
      JSON.stringify(payload.route)
    );
  } catch (e) {
    console.warn("Impossibile preparare Rider Engine", e);
  }

  window.location.href = "/map?from=routes&analyze=rider";
}

function formatRouteKm(km) {
  const n = Number(km || 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n)} km`;
}

function formatRouteDuration(min) {
  const n = Math.max(0, Math.round(Number(min || 0)));
  if (!n) return "—";

  const h = Math.floor(n / 60);
  const m = n % 60;

  if (!h) return `${m} min`;
  if (!m) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
function isMechanicalDescription(text = "") {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return true;

  return (
    t.includes("generato da rider spots reali") ||
    t.includes("scope ") ||
    t.includes("modalità ") ||
    t.includes("modalita ") ||
    t.includes("focus su guida motociclistica")
  );
}

function getRoutePointNames(route, max = 4) {
  const out = [];
  const seen = new Set();

  const pool = [
    ...(Array.isArray(route?.spots) ? route.spots : []),
    ...(Array.isArray(route?.waypoints) ? route.waypoints : []),
  ];

  for (const p of pool) {
    const name = String(p?.name || "").trim();
    const key = normalizeText(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= max) break;
  }

  if (!out.length) {
    if (route?.start?.name) out.push(route.start.name);
    if (
      route?.end?.name &&
      normalizeText(route.end.name) !== normalizeText(route.start?.name || "")
    ) {
      out.push(route.end.name);
    }
  }

  return out;
}

function buildPrettyRouteDescription(route) {
  const region = route?.region || "questa zona";
  const rideType = normalizeCategory(route);
  const km = formatRouteKm(getRouteDistanceKm(route));
  const names = getRoutePointNames(route, 4);

  const a = names[0] || null;
  const b = names[1] || null;
  const c = names[2] || null;
  const d = names[3] || null;

  const pointsSentence =
    a && b && c && d
      ? `Tocca ${a}, ${b}, ${c} e ${d}, costruendo una progressione credibile e piacevole da seguire anche in sella.`
      : a && b && c
      ? `Unisce ${a}, ${b} e ${c}, mantenendo una linea coerente tra guida, paesaggio e ritmo.`
      : a && b
      ? `Collega ${a} e ${b} con un percorso che ha senso da vivere in moto.`
      : a
      ? `Si sviluppa attorno a ${a}, usandolo come riferimento principale del giro.`
      : `Si sviluppa su una sequenza di punti reali selezionati per dare continuità e piacere di guida.`;

  if (rideType === "mountain") {
    return `Un itinerario di montagna rider-oriented nella zona ${region}, pensato per chi cerca quota, curve e carattere. ${pointsSentence} Nel complesso è un giro da circa ${km}, con ritmo variabile e una guida che sa farsi ricordare.`;
  }

  if (rideType === "lake") {
    return `Un itinerario lago panoramico nella zona ${region}, costruito per valorizzare sponde, salite e collegamenti interessanti in moto. ${pointsSentence} Nel complesso è un giro da circa ${km}, ideale per alternare guida pulita e vista aperta.`;
  }

  if (rideType === "coastal") {
    return `Un itinerario costiero nella zona ${region}, pensato per sfruttare mare, strada aperta e passaggi dal forte impatto visivo. ${pointsSentence} Nel complesso è un giro da circa ${km}, scorrevole ma non banale.`;
  }

  return `Un itinerario panoramico rider nella zona ${region}, costruito attorno a strade e punti che possono generare un giro credibile. ${pointsSentence} Nel complesso è un percorso da circa ${km}, con buon equilibrio tra guida, paesaggio e viaggio.`;
}

function complexityBadgeStyle(tone, dark = false) {
  if (dark) return pill("dark");

  const colors = {
    green: {
      background: "rgba(0,140,80,0.10)",
      border: "1px solid rgba(0,140,80,0.20)",
    },
    blue: {
      background: "rgba(0,100,220,0.10)",
      border: "1px solid rgba(0,100,220,0.20)",
    },
    orange: {
      background: "rgba(255,150,0,0.14)",
      border: "1px solid rgba(255,150,0,0.25)",
    },
    red: {
      background: "rgba(255,0,0,0.10)",
      border: "1px solid rgba(255,0,0,0.20)",
    },
  };

  return {
    ...pill("light"),
    ...(colors[tone] || colors.blue),
    fontWeight: 900,
  };
}

function SkeletonLoading() {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 900 }}>Carico itinerari…</div>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <div style={skeletonLine("70%")} />
        <div style={skeletonLine("55%")} />
        <div style={skeletonLine("80%")} />
      </div>
    </div>
  );
}

function skeletonLine(width) {
  return {
    height: 12,
    background: "rgba(0,0,0,0.08)",
    borderRadius: 8,
    width,
  };
}

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [category, setCategory] = useState("ALL");

  const [activeKey, setActiveKey] = useState(null);
  const [selected, setSelected] = useState(null);

  const [mobileView, setMobileView] = useState("list");
  const [visibleCount, setVisibleCount] = useState(getInitialVisibleCount());

  const debouncedQ = useDebouncedValue(q, 220);
  const isMobile = isMobileNow();
  const showDetailMobile = isMobile && mobileView === "detail" && selected;

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr("");

      try {
        const data = await loadRoutesDataset();
        const arr = Array.isArray(data) ? data.map(normalizeRoute) : [];

        const seen = new Set();
        const dedup = [];

        for (const r of arr) {
          const key = buildRouteKey(r);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          dedup.push(r);
        }

        if (!alive) return;

        setRoutes(dedup);

        const first = dedup[0] || null;
        const firstKey = first ? buildRouteKey(first) : null;

        setActiveKey((prev) => prev || firstKey);
        setSelected((prev) => prev || first);
        setMobileView("list");
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Errore caricamento itinerari");
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  const countries = useMemo(() => {
    const set = new Set(
      routes
        .map((r) => normalizeCountryCode(r.country || r.countryName))
        .filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort()];
  }, [routes]);

  const regions = useMemo(() => {
    const set = new Set();

    routes.forEach((r) => {
      const rc = normalizeCountryCode(r.country || r.countryName);
      if (country !== "ALL" && rc !== country) return;

      const rg = String(r.region || "").trim();
      if (rg) set.add(rg);
    });

    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b, "it"))];
  }, [routes, country]);

  useEffect(() => {
    setRegion("ALL");
  }, [country]);

  const filtered = useMemo(() => {
    const query = normalizeText(debouncedQ.trim());
    let out = [...routes];

    if (country !== "ALL") {
      out = out.filter((r) => normalizeCountryCode(r.country || r.countryName) === country);
    }

    if (region !== "ALL") {
      out = out.filter((r) => String(r.region || "").trim() === region);
    }

    if (category !== "ALL") {
      out = out.filter((r) => normalizeCategory(r) === category);
    }

    if (query) {
      const queryTokens = query
        .split(" ")
        .map((x) => normalizeText(x))
        .filter((x) => x.length >= 2);

      out = out.filter((r) => {
        const blob = routeSearchBlob(r);
        if (blob.includes(query)) return true;
        return queryTokens.every((token) => blob.includes(token));
      });
    }

    out.sort((a, b) => {
      const ca = normalizeCategory(a);
      const cb = normalizeCategory(b);

      if (category === "ALL" && ca !== cb) {
        const order = { mountain: 1, lake: 2, coastal: 3 };
        return (order[ca] || 99) - (order[cb] || 99);
      }

      const ra = String(a.region || "");
      const rb = String(b.region || "");
      if (ra !== rb) return ra.localeCompare(rb, "it");

      return Number(getRouteDistanceKm(b) || 0) - Number(getRouteDistanceKm(a) || 0);
    });

    return out;
  }, [routes, debouncedQ, country, region, category]);

  useEffect(() => {
    setVisibleCount(getInitialVisibleCount());
  }, [country, region, category, debouncedQ]);

  const visibleRoutes = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMoreRoutes = visibleCount < filtered.length;

  const loadMoreRoutes = () => {
    setVisibleCount((prev) => Math.min(prev + getLoadMoreStep(), filtered.length));
  };

  useEffect(() => {
    if (!filtered.length) {
      setActiveKey(null);
      setSelected(null);
      return;
    }

    const exists = filtered.some((r) => buildRouteKey(r) === activeKey);

    if (!exists) {
      const first = filtered[0];
      setActiveKey(buildRouteKey(first));
      setSelected(first);
      if (isMobileNow()) setMobileView("list");
    }
  }, [filtered, activeKey]);

  const active = useMemo(() => {
    if (!filtered.length && !routes.length) return null;

    const source = filtered.length ? filtered : routes;

    if (activeKey) {
      const found = source.find((r) => buildRouteKey(r) === activeKey);
      if (found) return found;
    }

    return source[0] || null;
  }, [routes, filtered, activeKey]);

  const selectRoute = (r) => {
    const key = buildRouteKey(r);
    setActiveKey(key);
    setSelected(r);

    if (isMobileNow()) {
      setMobileView("detail");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="routes-root" style={{ padding: 12, maxWidth: 1250, margin: "0 auto" }}>
      {!showDetailMobile && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "baseline",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.5 }}>
                Itinerari 📍
              </h1>
              <div className="routes-subtitle" style={{ opacity: 0.75, marginTop: 6 }}>
                Touring emozionale: mappa, meteo e Auto Rider Engine.
              </div>
            </div>

            <input
              className="routes-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca: Stelvio, Garda, Amalfi, Dolomiti…"
              style={{
                width: "min(520px, 100%)",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              padding: 12,
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Paese</span>
              <select value={country} onChange={(e) => setCountry(e.target.value)} style={selectStyle()}>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "Tutti" : countryLabel(c)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Regione</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)} style={selectStyle()}>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r === "ALL" ? "Tutte" : r}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Categoria</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle()}>
                <option value="ALL">Tutte</option>
                <option value="mountain">Montagna</option>
                <option value="lake">Laghi</option>
                <option value="coastal">Mare</option>
              </select>
            </label>
          </div>
        </>
      )}

      {loading ? (
        <SkeletonLoading />
      ) : err ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: "rgba(255,0,0,0.08)" }}>
          {err}
        </div>
      ) : showDetailMobile ? (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(10px)",
              borderBottom: "1px solid rgba(0,0,0,0.10)",
              padding: 10,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMobileView("list");
                window.scrollTo({ top: 0, behavior: "auto" });
              }}
              style={backButtonStyle()}
            >
              ← Indietro
            </button>

            <div
              style={{
                fontWeight: 950,
                fontSize: 15,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selected?.name}
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.10)",
              background: "white",
            }}
          >
            <RouteDetail route={selected} />
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }} className="routes-split">
          <div className="routes-list">
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              Itinerari trovati: <strong>{filtered.length}</strong>
              {filtered.length !== visibleRoutes.length ? (
                <>
                  {" "}· mostrati: <strong>{visibleRoutes.length}</strong>
                </>
              ) : null}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {visibleRoutes.map((r) => {
                const key = buildRouteKey(r);
                return (
                  <RouteCard
                    key={key}
                    route={r}
                    active={key === activeKey}
                    onSelect={() => selectRoute(r)}
                  />
                );
              })}
            </div>

            {hasMoreRoutes ? (
              <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                <button type="button" onClick={loadMoreRoutes} style={loadMoreButtonStyle()}>
                  Carica altri ({filtered.length - visibleRoutes.length} rimasti)
                </button>
              </div>
            ) : null}
          </div>

          <div className="routes-detail">
            <div
              style={{
                borderRadius: 22,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.12)",
                background: "white",
              }}
            >
              {!active ? <div style={{ padding: 14 }}>Seleziona un itinerario.</div> : <RouteDetail route={active} />}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 1024px){
          .routes-split{
            display: grid;
            grid-template-columns: 420px 1fr;
            gap: 14px;
            align-items: start;
          }
          .routes-list{
            position: sticky;
            top: 10px;
            height: calc(100dvh - 20px);
            overflow: auto;
            padding-right: 6px;
          }
        }

        @media (max-width: 1023px){
          .routes-split{ display: grid; grid-template-columns: 1fr; gap: 12px; }
          .routes-detail{ display:none; }
        }

        @media (max-width: 767px){
          .routes-root h1{ font-size: 22px !important; line-height: 1.05 !important; margin-bottom: 4px !important; }
          .routes-subtitle{ display:none !important; }
          .routes-search{ padding: 8px 10px !important; border-radius: 12px !important; }
        }
      `}</style>
    </div>
  );
}

function RouteCard({ route, active, onSelect }) {
  const photo = route.photo || FALLBACK_PHOTO;
  const category = normalizeCategory(route);
  const analysis = buildRiderAnalysis(route);
  const autoEngine = buildAutoRiderEngine(route, analysis);

  const touchRef = useRef({ startX: 0, startY: 0, moved: false });

  const handleClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onSelect?.();
  };

  const handleTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchRef.current = { startX: t.clientX, startY: t.clientY, moved: false };
  };

  const handleTouchMove = (e) => {
    const t = e.touches?.[0];
    if (!t) return;

    const dx = Math.abs(t.clientX - touchRef.current.startX);
    const dy = Math.abs(t.clientY - touchRef.current.startY);

    if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) {
      touchRef.current.moved = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchRef.current.moved) return;
    handleClick(e);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? handleClick(e) : null)}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        width: "100%",
        border: active ? "2px solid rgba(0,0,0,0.30)" : "1px solid rgba(0,0,0,0.10)",
        background: "white",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "pan-y",
        userSelect: "none",
      }}
    >
      <div className="route-card-mobile" style={{ display: "none", padding: 6, gap: 10, alignItems: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.05)", flex: "0 0 auto" }}>
          <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        </div>

        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
            <div style={{ fontWeight: 950, fontSize: 14, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {route.country ? `${route.country} ` : ""}
              {route.name}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, whiteSpace: "nowrap" }}>
              {formatRouteKm(analysis.distanceKm)}
            </div>
          </div>

          <div style={{ marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 11, opacity: 0.82 }}>
            <span>{route.region || "—"}</span>
            <span>·</span>
            <span>{categoryLabel(category)}</span>
            <span>·</span>
            <span>{autoEngine.mainProfile.icon} {autoEngine.mainProfile.label}</span>
          </div>
        </div>
      </div>

      <div className="route-card-desktop" style={{ display: "block" }}>
        <div style={{ height: 130, backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, lineHeight: 1.15 }}>
              {route.country ? `${route.country} ` : ""}
              {route.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
              {formatRouteKm(analysis.distanceKm)}
            </div>
          </div>

          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pill("light")}>{categoryLabel(category)}</span>
            <span style={complexityBadgeStyle(analysis.tone)}>
              {analysis.icon} {analysis.complexity}
            </span>
            <span style={pill("light")}>
              {autoEngine.mainProfile.icon} {autoEngine.mainProfile.label}
            </span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>{route.region || "—"}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px){
          .route-card-mobile{ display:flex !important; }
          .route-card-desktop{ display:none !important; }
        }
      `}</style>
    </div>
  );
}

function RouteDetail({ route }) {
  const photo = route.photo || FALLBACK_PHOTO;
  const navPoint = pickRoutePoint(route);
  const startNavUrl = navPoint ? buildNavigateUrl(latLonStr(navPoint), "driving") : null;

  const category = normalizeCategory(route);
  const analysis = buildRiderAnalysis(route);
  const autoEngine = buildAutoRiderEngine(route, analysis);

  const [wx, setWx] = useState(null);
  const [wxBusy, setWxBusy] = useState(false);

  const routeKey = buildRouteKey(route);
  const rawDescription = String(route?.description || "").trim();
  const displayDescription = isMechanicalDescription(rawDescription)
    ? buildPrettyRouteDescription(route)
    : rawDescription || "Descrizione non disponibile.";

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setWxBusy(true);
        const res = await getRouteWeatherSummary(route);
        if (!alive) return;
        setWx(res);
      } catch (e) {
        if (!alive) return;
        setWx({ ok: false, note: e?.message || "Meteo non disponibile." });
      } finally {
        if (alive) setWxBusy(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [routeKey, route]);

  return (
    <>
      <div
        style={{
          position: "relative",
          height: 240,
          backgroundImage: `url(${photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.76))",
          }}
        />

        <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, color: "white" }}>
          <div style={{ fontSize: 12, opacity: 0.92 }}>
            {route.country || "—"} · {route.region || "—"}
          </div>

          <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1.05 }}>
            {route.name}
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill("dark")}>📏 {formatRouteKm(analysis.distanceKm)}</span>
            <span style={pill("dark")}>🏍️ {categoryLabel(category)}</span>
            <span style={pill("dark")}>
              {autoEngine.mainProfile.icon} {autoEngine.mainProfile.label}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => openGoogleMapsSmart(startNavUrl)}
            disabled={!startNavUrl}
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontSize: 13,
              cursor: startNavUrl ? "pointer" : "not-allowed",
              fontWeight: 900,
              opacity: startNavUrl ? 1 : 0.55,
            }}
          >
            🧭 Avvia verso START
          </button>

          <button
            type="button"
            onClick={() => exportRouteToGpx(route)}
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            📤 Esporta GPX
          </button>

          <button
            type="button"
            onClick={() => sendRouteToRiderMap(route)}
            style={{
              display: "inline-block",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "linear-gradient(135deg, #111827, #374151)",
              color: "white",
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 950,
              boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
            }}
          >
            🧠 Analizza con Rider
          </button>
        </div>

        <InlineRiderTravelPanel route={route} analysis={analysis} />

        <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <strong>📌 Descrizione</strong>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9, lineHeight: 1.4 }}>
            {displayDescription}
          </div>
        </div>

        {Array.isArray(route?.aliases) && route.aliases.length ? (
          <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
            <strong>🏷️ Nomi collegati</strong>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {route.aliases.slice(0, 12).map((a) => (
                <span key={a} style={pill("light")}>{a}</span>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <strong>🗺️ Mappa</strong>
          <div style={{ marginTop: 10 }}>
            <RouteMap route={route} />
          </div>
        </div>

        <WeatherPanel wx={wx} wxBusy={wxBusy} />

        {!navPoint ? (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
            Nota: questo itinerario non ha coordinate start/end complete nel dataset.
          </div>
        ) : null}
      </div>
    </>
  );
}

function InlineRiderTravelPanel({ route, analysis }) {
  const panel = buildInlineRiderTravelPanel(route, analysis);

  const boxStyle = {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(0,0,0,0.08)",
    minHeight: 86,
  };

  const labelStyle = {
    fontSize: 13,
    opacity: 0.65,
    marginBottom: 7,
  };

  const valueStyle = {
    fontSize: 24,
    fontWeight: 950,
    lineHeight: 1.05,
    color: "#111827",
  };

  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 24,
        background: "linear-gradient(180deg, rgba(248,250,252,0.98), rgba(255,255,255,0.94))",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 18px 45px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontSize: 22, fontWeight: 950, color: "#111827" }}>
          🧠 Rider Travel Panel
        </div>
        <span style={pill("light")}>
          {panel.engine.mainProfile.icon} {panel.engine.mainProfile.label}
        </span>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.76, lineHeight: 1.4 }}>
        {analysis.diagnosis}
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <div style={boxStyle}>
          <div style={labelStyle}>Distanza</div>
          <div style={valueStyle}>{panel.distanceKm.toFixed(1)} km</div>
        </div>

        <div style={boxStyle}>
          <div style={labelStyle}>Tempo stimato</div>
          <div style={valueStyle}>{formatRouteDuration(panel.durationMin)}</div>
        </div>

        <div style={boxStyle}>
          <div style={labelStyle}>Media stimata</div>
          <div style={valueStyle}>{panel.avgSpeed} km/h</div>
        </div>

        <div style={boxStyle}>
          <div style={labelStyle}>Profilo</div>
          <div style={valueStyle}>{panel.profile}</div>
        </div>

        <div style={boxStyle}>
          <div style={labelStyle}>Curve score</div>
          <div style={valueStyle}>{panel.curveScore}/100</div>
        </div>

        <div style={boxStyle}>
          <div style={labelStyle}>Curve rilevate</div>
          <div style={valueStyle}>{panel.totalTurns}</div>
          <div style={{ fontSize: 13, opacity: 0.68, marginTop: 6 }}>
            Cambi direzione {panel.directionChanges} · Tecniche {panel.technicalTurns}
          </div>
        </div>

        <div style={boxStyle}>
          <div style={labelStyle}>Complessità</div>
          <div style={{ ...valueStyle, color: panel.complexityColor }}>
            {panel.complexityLabel}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 16,
          background: "rgba(22,163,74,0.06)",
          border: "1px solid rgba(22,163,74,0.14)",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        <strong>🛞 Lettura rapida rotta</strong>
        <div style={{ marginTop: 5, opacity: 0.84 }}>
          {panel.engine.advice} · Complessità:{" "}
          <strong style={{ color: panel.complexityColor }}>{panel.complexityLabel}</strong>
        </div>
      </div>
    </div>
  );
}

function WeatherPanel({ wx, wxBusy }) {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
      <strong>🌤 Meteo</strong>

      {wxBusy ? (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
          Carico meteo…
        </div>
      ) : !wx || !wx.ok ? (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
          {wx?.note || "Meteo non disponibile."}
        </div>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pill("light")}>
              Condizione: <strong>{wx.worst}</strong>
            </span>

            {wx.temp != null ? (
              <span style={pill("light")}>
                🌡 {wx.temp}°{" "}
                {wx.tempMin != null && wx.tempMax != null
                  ? `(min ${wx.tempMin}° / max ${wx.tempMax}°)`
                  : ""}
              </span>
            ) : null}

            {wx.windKmh != null ? (
              <span style={pill("light")}>💨 vento {wx.windKmh} km/h</span>
            ) : null}
          </div>

          {wx.ride ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background:
                  wx.ride.level === "danger"
                    ? "rgba(255,0,0,0.08)"
                    : wx.ride.level === "warn"
                    ? "rgba(255,180,0,0.12)"
                    : "rgba(0,140,80,0.10)",
                border:
                  wx.ride.level === "danger"
                    ? "1px solid rgba(255,0,0,0.16)"
                    : wx.ride.level === "warn"
                    ? "1px solid rgba(255,180,0,0.22)"
                    : "1px solid rgba(0,140,80,0.18)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13 }}>🏍 {wx.ride.label}</div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                {wx.ride.advice}
              </div>
            </div>
          ) : null}

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Aggiornato: {String(wx.updatedAt || "").slice(0, 16).replace("T", " ")}
          </div>
        </div>
      )}
    </div>
  );
}

function selectStyle() {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
  };
}

function backButtonStyle() {
  return {
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
  };
}

function loadMoreButtonStyle() {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
  };
}

function pill(kind) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  if (kind === "dark") {
    return {
      ...base,
      border: "1px solid rgba(255,255,255,0.20)",
      background: "rgba(0,0,0,0.38)",
      color: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      textShadow: "0 1px 2px rgba(0,0,0,0.35)",
    };
  }

  return {
    ...base,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.86)",
    color: "rgba(10,10,10,0.92)",
    backdropFilter: "blur(6px)",
  };
}