// =======================================================
// src/pages/Map.jsx
// MotoPortEU — Navigatore Rider Evolution 🏁
// ✅ UI inline styles (no Tailwind)
// ✅ Autocomplete luoghi (Nominatim OSM) + ENTER per aggiungere
// ✅ Ricerca stabile (abort + debounce + ordered results + cache + retry)
// ✅ Rider Route Engine integrato (hook + scoring + cockpit)
// ✅ Snap su strada + build route via useRouteEngine
// ✅ Navigatore base (GPS follow + next waypoint + Google Maps nav)
// ✅ Timer corsa FIXATO: Start/Stop salva sessioni e tempo totale (solo con GPS ON)
// ✅ Export GPX
// ✅ GPS Live + Scia (trail) in tempo reale
// ✅ Inserimento manuale percorso (coordinate / link Google Maps) + preview + replace
// ✅ Rider Travel Panel PRO:
//    - distanza
//    - tempo stimato
//    - velocità media stimata
//    - velocità media reale
//    - profilo guida
//    - meteo rotta
//    - curve score + analisi curve
//    - complessità rotta
//    - soste consigliate
// ✅ Meteo lungo rotta (start / mid / end)
// ✅ Rider Radar multi-point con tratto critico
// ✅ Waypoint automatici lungo il percorso (fuel / food / hotel / workshop / viewpoint)
// ✅ Aggiunta POI alla rotta con un click
// ✅ Duplicazione itinerari + ricerca itinerari salvati
// ✅ Stats sessioni + ultimo utilizzo
// ✅ FIX: follow GPS separato dall'interazione manuale utente
// ✅ FIX: velocità media reale calcolata sulla distanza GPS tracciata
// =======================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import RouteBuilderMap from "../components/RouteBuilderMap";
import RiderModePanel from "../components/RiderModePanel";
import useRouteEngine from "../hooks/useRouteEngine";
import { loadLastRoute } from "../utils/routeStorage";

const STORAGE_KEY = "mp_routes_v4";
const OWM_KEY = import.meta.env.VITE_OWM_KEY || "";
const PASS_KEY = "mp_pass_active";
const uid = () => `rt-${Math.random().toString(16).slice(2)}-${Date.now()}`;

function loadRoutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveRoutes(routes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes || []));
}

function haversineKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function computeDistanceKm(points) {
  if (!points || points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += haversineKm(points[i - 1], points[i]);
  return sum;
}

function computeTrackedDistanceKm(track) {
  if (!Array.isArray(track) || track.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < track.length; i++) {
    sum += haversineKm(track[i - 1], track[i]);
  }
  return sum;
}

function estimateHoursByProfile(km, profile) {
  const speedMap = {
    relax: 58,
    touring: 72,
    sport: 88,
    rain: 52,
  };
  const avg = speedMap[profile] || 72;
  return km > 0 ? km / avg : 0;
}

function formatEta(hours) {
  if (!hours || hours <= 0) return "—";
  const totalMin = Math.round(hours * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh <= 0) return `${mm} min`;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

function formatDurationMinutes(totalMinutes) {
  const mins = Math.max(0, Math.round(Number(totalMinutes || 0)));
  if (!mins) return "—";
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  if (!hh) return `${mm} min`;
  if (!mm) return `${hh}h`;
  return `${hh}h ${String(mm).padStart(2, "0")}m`;
}

const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

function prettyDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toLatLngObjects(points = []) {
  return (points || []).map((p) => ({ lat: Number(p[0]), lng: Number(p[1]) }));
}

function toPointPairsFromEngineGeometry(geometry = []) {
  return (geometry || []).map((p) => [Number(p.lat), Number(p.lng)]);
}

function averageSpeedKmh(distanceKm, durationHours) {
  const d = Number(distanceKm || 0);
  const h = Number(durationHours || 0);
  if (!d || !h || h <= 0) return 0;
  return d / h;
}

function formatSpeed(kmh) {
  const v = Number(kmh || 0);
  if (!v || !Number.isFinite(v)) return "—";
  return `${Math.round(v)} km/h`;
}

function getStopAdvice(distanceKm, durationMin) {
  const km = Number(distanceKm || 0);
  const min = Number(durationMin || 0);

  const byKm = km >= 550 ? 4 : km >= 380 ? 3 : km >= 220 ? 2 : km >= 120 ? 1 : 0;
  const byTime = min >= 420 ? 4 : min >= 300 ? 3 : min >= 180 ? 2 : min >= 100 ? 1 : 0;
  const stops = Math.max(byKm, byTime);

  if (stops <= 0) {
    return {
      count: 0,
      label: "Tirata breve",
      note: "Nessuna sosta necessaria, solo pausa libera.",
    };
  }

  if (stops === 1) {
    return {
      count: 1,
      label: "Una sosta consigliata",
      note: "Pausa carburante o caffè a metà percorso.",
    };
  }

  return {
    count: stops,
    label: `${stops} soste consigliate`,
    note: "Meglio distribuire benzina, recupero e check rapido del meteo.",
  };
}

function getLegStats(points = []) {
  if (!Array.isArray(points) || points.length < 2) {
    return { count: 0, avgKm: 0, maxKm: 0 };
  }

  const legs = [];
  for (let i = 1; i < points.length; i++) {
    legs.push(haversineKm(points[i - 1], points[i]));
  }

  const sum = legs.reduce((a, b) => a + b, 0);
  return {
    count: legs.length,
    avgKm: legs.length ? sum / legs.length : 0,
    maxKm: legs.length ? Math.max(...legs) : 0,
  };
}

function analyzeCurves(line = []) {
  if (!Array.isArray(line) || line.length < 3) {
    return {
      totalTurns: 0,
      softTurns: 0,
      mediumTurns: 0,
      hardTurns: 0,
      score: 0,
      label: "Tracciato semplice",
      roadStyle: "Scorrevole",
      intensity: "Bassa",
    };
  }

  let softTurns = 0;
  let mediumTurns = 0;
  let hardTurns = 0;

  const normalize = (v) => {
    const len = Math.hypot(v.x, v.y);
    if (!len) return null;
    return { x: v.x / len, y: v.y / len };
  };

  for (let i = 1; i < line.length - 1; i++) {
    const a = line[i - 1];
    const b = line[i];
    const c = line[i + 1];

    const v1 = normalize({
      x: Number(b[1]) - Number(a[1]),
      y: Number(b[0]) - Number(a[0]),
    });

    const v2 = normalize({
      x: Number(c[1]) - Number(b[1]),
      y: Number(c[0]) - Number(b[0]),
    });

    if (!v1 || !v2) continue;

    const dot = clamp(v1.x * v2.x + v1.y * v2.y, -1, 1);
    const angleDeg = (Math.acos(dot) * 180) / Math.PI;

    if (angleDeg >= 18 && angleDeg < 35) softTurns += 1;
    else if (angleDeg >= 35 && angleDeg < 60) mediumTurns += 1;
    else if (angleDeg >= 60) hardTurns += 1;
  }

  const totalTurns = softTurns + mediumTurns + hardTurns;
  const weighted = softTurns * 1 + mediumTurns * 2.2 + hardTurns * 3.4;
  const rawScore = clamp(Math.round(weighted), 0, 100);

  let label = "Strada molto scorrevole";
  let roadStyle = "Scorrevole";
  let intensity = "Bassa";

  if (rawScore >= 75) {
    label = "Molto guidata";
    roadStyle = "Tecnica";
    intensity = "Alta";
  } else if (rawScore >= 45) {
    label = "Bella mista";
    roadStyle = "Mista";
    intensity = "Media";
  } else if (rawScore >= 20) {
    label = "Scorrevole con tratti guidati";
    roadStyle = "Scorrevole / mista";
    intensity = "Medio-bassa";
  }

  return {
    totalTurns,
    softTurns,
    mediumTurns,
    hardTurns,
    score: rawScore,
    label,
    roadStyle,
    intensity,
  };
}

function getComplexityBadge({ distanceKm, weatherSeverity, curveScore, pointsCount }) {
  let score = 0;

  if (distanceKm >= 350) score += 3;
  else if (distanceKm >= 180) score += 2;
  else if (distanceKm >= 80) score += 1;

  if (curveScore >= 75) score += 3;
  else if (curveScore >= 45) score += 2;
  else if (curveScore >= 20) score += 1;

  if ((weatherSeverity || 0) >= 4) score += 3;
  else if ((weatherSeverity || 0) >= 3) score += 2;
  else if ((weatherSeverity || 0) >= 2) score += 1;

  if ((pointsCount || 0) >= 8) score += 2;
  else if ((pointsCount || 0) >= 5) score += 1;

  if (score >= 8) {
    return { label: "Alta", color: "#dc2626" };
  }
  if (score >= 5) {
    return { label: "Media", color: "#ca8a04" };
  }
  return { label: "Bassa", color: "#15803d" };
}

// --- GPX ---
function toGpx(name, points) {
  const esc = (s) =>
    String(s || "").replace(/[<>&'"]/g, (c) => ({
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    }[c]));
  const now = new Date().toISOString();
  const seg = points.map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"></trkpt>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoPortEU" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(name)}</name>
    <time>${now}</time>
  </metadata>
  <trk>
    <name>${esc(name)}</name>
    <trkseg>
      ${seg}
    </trkseg>
  </trk>
</gpx>`;
}

function downloadTextFile(filename, content, mime = "application/octet-stream") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Autocomplete Nominatim ---
const _geoCache = new globalThis.Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatimSearch(q, { signal } = {}) {
  const key = String(q || "").trim().toLowerCase();
  if (key.length < 3) return [];
  if (_geoCache.has(key)) return _geoCache.get(key);

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `format=json&addressdetails=1&limit=10&dedupe=1&accept-language=it` +
    `&q=${encodeURIComponent(q)}`;

  const attempt = async () => {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (res.status === 429 || res.status === 503) throw new Error("RATE_LIMIT");
    if (!res.ok) throw new Error("NOMINATIM_ERROR");
    const data = await res.json();
    return (data || [])
      .map((x) => ({
        label: x.display_name,
        lat: Number(x.lat),
        lon: Number(x.lon),
        importance: Number(x.importance || 0),
      }))
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 8);
  };

  let out = [];
  try {
    out = await attempt();
  } catch (e) {
    if (e?.name === "AbortError") return [];
    await sleep(250);
    try {
      out = await attempt();
    } catch (e2) {
      if (e2?.name === "AbortError") return [];
      await sleep(450);
      out = await attempt().catch(() => []);
    }
  }

  _geoCache.set(key, out);
  return out;
}

// --- Navigator helper ---
function nearestNextWaypointIndex(gps, points, currentIdx) {
  if (!gps || !points?.length) return 0;
  const start = Math.max(0, currentIdx || 0);

  let bestIdx = start;
  let best = Infinity;

  for (let i = start; i < points.length; i++) {
    const d = haversineKm(gps, points[i]);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }

  if (best < 0.12 && bestIdx < points.length - 1) return bestIdx + 1;
  return bestIdx;
}

function buildGoogleMapsNavUrl(gps, points) {
  if (!points || points.length < 2) return null;

  const origin = gps ? `${gps[0]},${gps[1]}` : `${points[0][0]},${points[0][1]}`;
  const destination = `${points[points.length - 1][0]},${points[points.length - 1][1]}`;

  const mid = points
    .slice(1, -1)
    .slice(0, 8)
    .map((p) => `${p[0]},${p[1]}`);

  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&travelmode=driving` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (mid.length ? `&waypoints=${encodeURIComponent(mid.join("|"))}` : "")
  );
}

// --- Manual route parse ---
function parseCoordsFromText(text) {
  const out = [];
  const t = String(text || "").trim();
  if (!t) return out;

  const atMatches = [...t.matchAll(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g)];
  for (const m of atMatches) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    ) {
      out.push([lat, lon]);
    }
  }

  const normalized = t.replace(/;/g, "\n");
  const lines = normalized
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  for (const line of lines) {
    const nums = line.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) continue;

    const lat = Number(nums[0]);
    const lon = Number(nums[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push([lat, lon]);
  }

  const seen = new Set();
  const dedup = [];
  for (const [lat, lon] of out) {
    const k = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push([lat, lon]);
  }
  return dedup;
}

// --- Weather helpers ---
async function fetchPointWeather(point) {
  if (!OWM_KEY || !point) return null;
  const [lat, lon] = point;
  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&appid=${encodeURIComponent(OWM_KEY)}` +
    `&units=metric&lang=it`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temp: Number(data?.main?.temp),
      feelsLike: Number(data?.main?.feels_like),
      windKmh: Number(data?.wind?.speed || 0) * 3.6,
      humidity: Number(data?.main?.humidity || 0),
      rainMm: Number(data?.rain?.["1h"] || data?.rain?.["3h"] || 0),
      clouds: Number(data?.clouds?.all || 0),
      desc: data?.weather?.[0]?.description || "",
      city: data?.name || "",
    };
  } catch {
    return null;
  }
}

function analyzeRiderWeather(wx) {
  if (!wx) {
    return {
      score: "—",
      label: "Meteo non disponibile",
      color: "#6b7280",
      warnings: [],
      severity: 0,
    };
  }

  const warnings = [];
  let pointsVal = 100;

  if (wx.rainMm >= 0.2) {
    warnings.push("Possibile strada bagnata");
    pointsVal -= 24;
  }
  if (wx.rainMm >= 1) {
    warnings.push("Pioggia concreta");
    pointsVal -= 18;
  }
  if (wx.windKmh >= 30) {
    warnings.push("Vento laterale forte");
    pointsVal -= 22;
  }
  if (wx.windKmh >= 45) {
    warnings.push("Vento molto forte");
    pointsVal -= 20;
  }
  if (wx.temp <= 4) {
    warnings.push("Freddo intenso");
    pointsVal -= 16;
  }
  if (wx.temp >= 32) {
    warnings.push("Caldo elevato");
    pointsVal -= 14;
  }
  if (wx.clouds >= 90 && wx.rainMm > 0) {
    warnings.push("Visibilità peggiore");
    pointsVal -= 8;
  }

  if (pointsVal >= 85) {
    return { score: "A", label: "Ottimo per guidare", color: "#15803d", warnings, severity: 1 };
  }
  if (pointsVal >= 68) {
    return { score: "B", label: "Buono con attenzione", color: "#65a30d", warnings, severity: 2 };
  }
  if (pointsVal >= 48) {
    return { score: "C", label: "Attenzione rider", color: "#ca8a04", warnings, severity: 3 };
  }
  return { score: "D", label: "Condizioni sfavorevoli", color: "#dc2626", warnings, severity: 4 };
}

function getRouteWeatherSamples(points, snappedLine) {
  const base = snappedLine?.length >= 3 ? snappedLine : points;
  if (!base || base.length < 2) return { start: null, mid: null, end: null };

  const start = base[0];
  const mid = base[Math.floor(base.length / 2)];
  const end = base[base.length - 1];

  return { start, mid, end };
}

function sampleLine(line, desiredCount = 7) {
  if (!Array.isArray(line) || line.length < 2) return [];
  const count = clamp(desiredCount, 3, 9);
  if (line.length <= count) return [...line];

  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i * (line.length - 1)) / (count - 1));
    out.push(line[idx]);
  }
  return out;
}

// --- POI helpers ---
const POI_CATEGORIES = [
  { key: "fuel", label: "⛽ Carburante", tags: [{ key: "amenity", value: "fuel" }] },
  {
    key: "food",
    label: "☕ Ristoro",
    tags: [
      { key: "amenity", value: "cafe" },
      { key: "amenity", value: "restaurant" },
      { key: "amenity", value: "fast_food" },
    ],
  },
  { key: "hotel", label: "🏨 Hotel", tags: [{ key: "tourism", value: "hotel" }] },
  {
    key: "workshop",
    label: "🔧 Officina",
    tags: [
      { key: "shop", value: "motorcycle" },
      { key: "shop", value: "car_repair" },
      { key: "amenity", value: "vehicle_inspection" },
    ],
  },
  {
    key: "viewpoint",
    label: "🏔 Panorama",
    tags: [
      { key: "tourism", value: "viewpoint" },
      { key: "natural", value: "peak" },
    ],
  },
];

function dedupePois(arr) {
  const seen = new Set();
  const out = [];
  for (const item of arr || []) {
    const lat = Number(item?.lat);
    const lon = Number(item?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = `${lat.toFixed(5)}-${lon.toFixed(5)}-${String(item?.name || "")
      .trim()
      .toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function overpassSearchNearby(point, categoryKey, radius = 3500) {
  const cat = POI_CATEGORIES.find((x) => x.key === categoryKey);
  if (!cat || !point) return [];

  const [lat, lon] = point;
  const tagParts = cat.tags
    .map(
      (t) => `
      node["${t.key}"="${t.value}"](around:${radius},${lat},${lon});
      way["${t.key}"="${t.value}"](around:${radius},${lat},${lon});
      relation["${t.key}"="${t.value}"](around:${radius},${lat},${lon});
    `
    )
    .join("\n");

  const query = `
    [out:json][timeout:18];
    (
      ${tagParts}
    );
    out center tags 20;
  `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: query,
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data?.elements || [])
      .map((el) => {
        const latVal = Number(el?.lat ?? el?.center?.lat);
        const lonVal = Number(el?.lon ?? el?.center?.lon);
        const name = el?.tags?.name || cat.label.replace(/^[^\s]+\s/, "");
        return {
          id: `${categoryKey}-${el.type}-${el.id}`,
          name,
          lat: latVal,
          lon: lonVal,
          categoryKey,
          categoryLabel: cat.label,
          distanceKm: haversineKm(point, [latVal, lonVal]),
          meta:
            el?.tags?.brand ||
            el?.tags?.operator ||
            el?.tags?.cuisine ||
            el?.tags?.tourism ||
            "",
        };
      })
      .filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
  } catch {
    return [];
  }
}

// --- Styles ---
const S = {
  page: { width: "100%", padding: "16px 12px" },
  container: { maxWidth: 1320, margin: "0 auto" },
  headerRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  title: { fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 },
  subtitle: { margin: "6px 0 0", opacity: 0.78, fontSize: 14, lineHeight: 1.35 },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 },
  gridLg: { display: "grid", gridTemplateColumns: "430px 1fr", gap: 14, marginTop: 14 },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.72)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
    padding: 14,
    backdropFilter: "blur(4px)",
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  btn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(29,78,216,0.18)",
    background: "rgba(29,78,216,0.08)",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 8px 20px rgba(29,78,216,0.08)",
  },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.60)",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(220,38,38,0.30)",
    background: "rgba(220,38,38,0.08)",
    cursor: "pointer",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    background: "white",
    fontSize: 14,
    color: "#111",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    background: "white",
    fontSize: 14,
    minHeight: 96,
    resize: "vertical",
    color: "#111",
  },
  small: { fontSize: 13, opacity: 0.78 },
  pill: {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.65)",
    fontWeight: 800,
    fontSize: 13,
  },
  stat: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.56)",
    minWidth: 120,
    flex: "1 1 120px",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "white",
    boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
    zIndex: 20,
  },
  ddItem: {
    padding: "10px 12px",
    cursor: "pointer",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    fontSize: 13,
    lineHeight: 1.25,
    color: "#111",
  },
};

const TRAIL_MIN_STEP_M = 12;
const TRAIL_MAX_PTS = 2500;
const kmToM = (km) => km * 1000;

export default function Map() {
  const initialRoutes = useMemo(() => loadRoutes(), []);
  const [routes, setRoutes] = useState(initialRoutes);
  const [activeId, setActiveId] = useState(() => initialRoutes?.[0]?.id || "");
  const [points, setPoints] = useState([]);
  const [snappedLine, setSnappedLine] = useState(null);
  const [routeMeta, setRouteMeta] = useState({ distanceKm: 0, durationMin: 0, steps: [] });
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [savedFilter, setSavedFilter] = useState("");
  const [rideProfile, setRideProfile] = useState("touring");

  const [manualText, setManualText] = useState("");
  const [manualErr, setManualErr] = useState("");
  const [manualReplace, setManualReplace] = useState(true);
  const manualPreview = useMemo(() => parseCoordsFromText(manualText), [manualText]);

  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);
  const lastQueryRef = useRef("");
  const abortRef = useRef(null);

  const [snapEnabled, setSnapEnabled] = useState(true);

  const [gps, setGps] = useState(null);
  const [gpsOn, setGpsOn] = useState(false);
  const [followGps, setFollowGps] = useState(true);
  const [navOn, setNavOn] = useState(false);
  const [nextIdx, setNextIdx] = useState(0);

  const [gpsTrail, setGpsTrail] = useState([]);
  const lastTrailPointRef = useRef(null);

  const [runOn, setRunOn] = useState(false);
  const [runStartMs, setRunStartMs] = useState(null);
  const [runElapsedSec, setRunElapsedSec] = useState(0);
  const tickRef = useRef(null);
  const runStartMsRef = useRef(null);
  const runElapsedSecRef = useRef(0);

  const [runTrack, setRunTrack] = useState([]);
  const lastRunTrackRef = useRef(null);

  const [weatherLoading, setWeatherLoading] = useState(false);
  const [routeWeather, setRouteWeather] = useState({ start: null, mid: null, end: null });

  const [radarLoading, setRadarLoading] = useState(false);
  const [radarPoints, setRadarPoints] = useState([]);

  const [poiCategory, setPoiCategory] = useState("fuel");
  const [poiRadius, setPoiRadius] = useState(3500);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiResults, setPoiResults] = useState([]);

  const {
    route: engineRoute,
    weather: engineWeather,
    score: engineScore,
    loading: engineLoading,
    snapping: engineSnapping,
    error: engineError,
    buildRoute: buildRiderRoute,
    reset: resetEngine,
  } = useRouteEngine();

  const activeRoute = useMemo(
    () => routes.find((r) => r.id === activeId) || null,
    [routes, activeId]
  );

  const baseLine = useMemo(() => {
    if (snapEnabled && snappedLine?.length >= 2) return snappedLine;
    return points;
  }, [points, snappedLine, snapEnabled]);

  const distanceKm = useMemo(() => {
    if (snapEnabled && routeMeta?.distanceKm > 0 && snappedLine?.length >= 2) return routeMeta.distanceKm;
    return computeDistanceKm(baseLine);
  }, [baseLine, routeMeta, snappedLine, snapEnabled]);

  const estimatedHours = useMemo(
    () => estimateHoursByProfile(distanceKm, rideProfile),
    [distanceKm, rideProfile]
  );

  const etaText = formatEta(estimatedHours);

  const estimatedDurationMin = useMemo(() => {
    if (routeMeta.durationMin > 0) return Number(routeMeta.durationMin);
    return Math.round(estimatedHours * 60);
  }, [routeMeta.durationMin, estimatedHours]);

  const estimatedAvgSpeed = useMemo(() => {
    if (routeMeta.durationMin > 0) {
      return averageSpeedKmh(distanceKm, routeMeta.durationMin / 60);
    }
    return averageSpeedKmh(distanceKm, estimatedHours);
  }, [distanceKm, routeMeta.durationMin, estimatedHours]);

  const currentStepInstruction = useMemo(() => {
    if (!routeMeta?.steps?.length) return null;
    return routeMeta.steps[0] || null;
  }, [routeMeta]);

  const nextInfo = useMemo(() => {
    if (!navOn || !gps || !points?.length) return null;
    const idx = Math.min(nextIdx, points.length - 1);
    const wp = points[idx];
    const km = haversineKm(gps, wp);
    return { idx, km, wp };
  }, [navOn, gps, points, nextIdx]);

  const weatherAssessments = useMemo(
    () => ({
      start: analyzeRiderWeather(routeWeather.start),
      mid: analyzeRiderWeather(routeWeather.mid),
      end: analyzeRiderWeather(routeWeather.end),
    }),
    [routeWeather]
  );

  const overallWeather = useMemo(() => {
    const labels = [weatherAssessments.start, weatherAssessments.mid, weatherAssessments.end].filter(Boolean);
    let worst = labels[0] || {
      score: "—",
      label: "Meteo non disponibile",
      color: "#6b7280",
      warnings: [],
      severity: 0,
    };
    for (const item of labels) {
      if ((item.severity || 0) > (worst.severity || 0)) worst = item;
    }
    return worst;
  }, [weatherAssessments]);

  const weatherWarningList = useMemo(() => {
    const all = [
      ...(weatherAssessments.start?.warnings || []),
      ...(weatherAssessments.mid?.warnings || []),
      ...(weatherAssessments.end?.warnings || []),
    ];
    return [...new Set(all)];
  }, [weatherAssessments]);

  const samples = useMemo(() => getRouteWeatherSamples(points, snappedLine), [points, snappedLine]);

  const routeStats = useMemo(() => {
    const total = activeRoute?.totalTimeSec || 0;
    const sessions = activeRoute?.sessions || [];
    const avg = sessions.length ? Math.round(total / sessions.length) : 0;
    return {
      sessionCount: sessions.length,
      totalTimeSec: total,
      avgSessionSec: avg,
      lastRunAt: activeRoute?.lastRunAt || null,
    };
  }, [activeRoute]);

  const realAvgSpeed = useMemo(() => {
    const sessions = activeRoute?.sessions || [];
    if (!sessions.length) return 0;

    const normalizedSessions = sessions
      .map((s) => {
        const durationSec = Number(s?.durationSec || 0);
        const explicitDistance = Number(s?.distanceKm || 0);
        const trackDistance =
          !explicitDistance && Array.isArray(s?.track)
            ? computeTrackedDistanceKm(s.track)
            : explicitDistance;

        return {
          durationSec,
          distanceKm: trackDistance,
        };
      })
      .filter((s) => s.durationSec > 0 && s.distanceKm > 0);

    if (!normalizedSessions.length) return 0;

    const totalDistanceKm = normalizedSessions.reduce((sum, s) => sum + s.distanceKm, 0);
    const totalDurationHours =
      normalizedSessions.reduce((sum, s) => sum + s.durationSec, 0) / 3600;

    return averageSpeedKmh(totalDistanceKm, totalDurationHours);
  }, [activeRoute]);

  const filteredRoutes = useMemo(() => {
    const f = String(savedFilter || "").trim().toLowerCase();
    if (!f) return routes;
    return routes.filter((r) => {
      const txt = `${r.name || ""} ${r.note || ""}`.toLowerCase();
      return txt.includes(f);
    });
  }, [routes, savedFilter]);

  const radarWorst = useMemo(() => {
    if (!radarPoints.length) return null;
    return [...radarPoints].sort((a, b) => (b.analysis?.severity || 0) - (a.analysis?.severity || 0))[0];
  }, [radarPoints]);

  const curveAnalysis = useMemo(() => analyzeCurves(baseLine), [baseLine]);

  const stopAdvice = useMemo(
    () => getStopAdvice(distanceKm, estimatedDurationMin),
    [distanceKm, estimatedDurationMin]
  );

  const legStats = useMemo(() => getLegStats(points), [points]);

  const routeComplexity = useMemo(
    () =>
      getComplexityBadge({
        distanceKm,
        weatherSeverity: overallWeather?.severity || 0,
        curveScore: curveAnalysis?.score || 0,
        pointsCount: points?.length || 0,
      }),
    [distanceKm, overallWeather, curveAnalysis, points]
  );

  useEffect(() => saveRoutes(routes), [routes]);

  useEffect(() => {
    const saved = loadLastRoute();
    if (!saved?.route || activeId) return;

    const routeObj = saved.route;
    const restoredLine = Array.isArray(routeObj?.geometry)
      ? routeObj.geometry.map((p) => [Number(p.lat), Number(p.lng)])
      : null;

    if (restoredLine?.length >= 2) {
      setSnappedLine(restoredLine);
      setRouteMeta({
        distanceKm: Number(routeObj.distanceKm || 0),
        durationMin: Number(routeObj.durationMin || 0),
        steps:
          routeObj?.legs?.[0]?.steps?.map((s) => ({
            distanceKm: Number((s.distanceMeters || 0) / 1000),
            durationMin: Number((s.durationSeconds || 0) / 60),
            name: s.name || "",
            instruction:
              s?.maneuver?.modifier
                ? `${s.maneuver.type || "Procedi"} ${s.maneuver.modifier || ""}`.trim()
                : s?.maneuver?.type || "Procedi",
          })) || [],
      });
      setSnapEnabled(true);
    }
  }, [activeId]);

  useEffect(() => {
    if (!activeRoute) return;
    setPoints(activeRoute.points || []);
    setSnappedLine(activeRoute.snappedLine || null);
    setRouteMeta({
      distanceKm: Number(activeRoute.osrmDistanceKm || 0),
      durationMin: Number(activeRoute.osrmDurationMin || 0),
      steps: Array.isArray(activeRoute.osrmSteps) ? activeRoute.osrmSteps : [],
    });
    setName(activeRoute.name || "");
    setNote(activeRoute.note || "");
    setSnapEnabled(activeRoute.snapEnabled ?? true);
    setRideProfile(activeRoute.rideProfile || "touring");

    setNavOn(false);
    setNextIdx(0);

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setRunOn(false);
    setRunElapsedSec(0);
    setRunStartMs(null);
    runStartMsRef.current = null;
    runElapsedSecRef.current = 0;

    setRunTrack([]);
    lastRunTrackRef.current = null;
    resetEngine();
  }, [activeId, activeRoute, resetEngine]);

  useEffect(() => {
    const query = (q || "").trim();

    if (abortRef.current) abortRef.current.abort();
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (query.length < 3) {
      setSuggestions([]);
      setSearchOpen(false);
      setSearchLoading(false);
      lastQueryRef.current = "";
      return;
    }

    setSearchOpen(true);
    setSearchLoading(true);
    lastQueryRef.current = query;

    const controller = new AbortController();
    abortRef.current = controller;

    searchTimer.current = setTimeout(async () => {
      try {
        const res = await nominatimSearch(query, { signal: controller.signal });
        if (lastQueryRef.current !== query) return;
        setSuggestions(res);
      } catch {
        if (lastQueryRef.current !== query) return;
        setSuggestions([]);
      } finally {
        if (lastQueryRef.current === query) setSearchLoading(false);
      }
    }, 220);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      controller.abort();
    };
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!OWM_KEY) {
        setRouteWeather({ start: null, mid: null, end: null });
        return;
      }
      if (!points || points.length < 2) {
        setRouteWeather({ start: null, mid: null, end: null });
        return;
      }

      setWeatherLoading(true);
      try {
        const [startWx, midWx, endWx] = await Promise.all([
          fetchPointWeather(samples.start),
          fetchPointWeather(samples.mid),
          fetchPointWeather(samples.end),
        ]);

        if (!cancelled) {
          setRouteWeather({
            start: startWx,
            mid: midWx,
            end: endWx,
          });
        }
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [samples.start, samples.mid, samples.end, points]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!OWM_KEY || !baseLine || baseLine.length < 2) {
        setRadarPoints([]);
        return;
      }

      const desiredCount = distanceKm > 350 ? 9 : distanceKm > 160 ? 7 : 5;
      const pts = sampleLine(baseLine, desiredCount);
      if (!pts.length) {
        setRadarPoints([]);
        return;
      }

      setRadarLoading(true);
      try {
        const results = await Promise.all(
          pts.map(async (p, idx) => {
            const weather = await fetchPointWeather(p);
            return {
              idx,
              point: p,
              weather,
              analysis: analyzeRiderWeather(weather),
            };
          })
        );

        if (!cancelled) setRadarPoints(results);
      } finally {
        if (!cancelled) setRadarLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [baseLine, distanceKm]);

  const addFromSearch = (s) => {
    setPoints((prev) => [...prev, [s.lat, s.lon]]);
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    resetEngine();
    setQ("");
    setSuggestions([]);
    setSearchOpen(false);
    setSearchLoading(false);
    lastQueryRef.current = "";
  };

  const addTypedPlace = async () => {
    const query = String(q || "").trim();
    if (query.length < 3) return;
    if (searchLoading) return;

    if (suggestions && suggestions.length) {
      addFromSearch(suggestions[0]);
      return;
    }

    setSearchLoading(true);
    try {
      const controller = new AbortController();
      const res = await nominatimSearch(query, { signal: controller.signal });
      if (!res.length) {
        alert("Nessun risultato. Prova: 'Città, Italia' (es: 'Como, Italia').");
        return;
      }
      addFromSearch(res[0]);
    } catch {
      alert("Ricerca occupata (OSM). Riprova tra 1 secondo.");
    } finally {
      setSearchLoading(false);
    }
  };

  const importManualPoints = () => {
    setManualErr("");
    const pts = parseCoordsFromText(manualText);
    if (!pts.length) {
      setManualErr(
        "Nessun punto valido trovato. Esempio: 45.4642, 9.1900 oppure link Google Maps con @lat,lng."
      );
      return;
    }
    setPoints((prev) => (manualReplace ? pts : [...prev, ...pts]));
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    resetEngine();
    setManualText("");
  };

  const clearManual = () => {
    setManualText("");
    setManualErr("");
  };

  const reversePoints = () => {
    setPoints((prev) => [...(prev || [])].reverse());
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    setNextIdx(0);
    resetEngine();
  };

  const removePointAt = (idx) => {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    setNextIdx(0);
    resetEngine();
  };

  useEffect(() => {
    if (!gpsOn) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }

      setGps(null);
      setFollowGps(true);
      setNavOn(false);

      setRunOn(false);
      setRunElapsedSec(0);
      setRunStartMs(null);
      runStartMsRef.current = null;
      runElapsedSecRef.current = 0;

      setGpsTrail([]);
      lastTrailPointRef.current = null;

      setRunTrack([]);
      lastRunTrackRef.current = null;
      return;
    }

    setFollowGps(true);

    if (!("geolocation" in navigator)) {
      alert("GPS non disponibile su questo dispositivo/browser.");
      setGpsOn(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        setGps(p);
      },
      () => {
        alert("Impossibile ottenere GPS. Consenti la posizione al browser.");
        setGpsOn(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [gpsOn]);

  useEffect(() => {
    if (!gpsOn || !gps) return;

    setGpsTrail((prev) => {
      const last = lastTrailPointRef.current;
      if (!last) {
        lastTrailPointRef.current = gps;
        return [gps];
      }
      const movedM = kmToM(haversineKm(last, gps));
      if (movedM < TRAIL_MIN_STEP_M) return prev;

      const next = [...prev, gps];
      lastTrailPointRef.current = gps;
      if (next.length > TRAIL_MAX_PTS) return next.slice(next.length - TRAIL_MAX_PTS);
      return next;
    });

    if (runOn) {
      setRunTrack((prev) => {
        const last = lastRunTrackRef.current;
        if (!last) {
          lastRunTrackRef.current = gps;
          return [gps];
        }
        const movedM = kmToM(haversineKm(last, gps));
        if (movedM < TRAIL_MIN_STEP_M) return prev;

        const next = [...prev, gps];
        lastRunTrackRef.current = gps;
        if (next.length > TRAIL_MAX_PTS) return next.slice(next.length - TRAIL_MAX_PTS);
        return next;
      });
    }
  }, [gps, gpsOn, runOn]);

  useEffect(() => {
    if (!navOn || !gps || !points?.length) return;
    const idx = nearestNextWaypointIndex(gps, points, nextIdx);
    setNextIdx(idx);
  }, [navOn, gps, points, nextIdx]);

  useEffect(() => {
    if (!runOn) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    if (!runStartMsRef.current) {
      const now = Date.now();
      runStartMsRef.current = now;
      setRunStartMs(now);
    }

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    const updateElapsed = () => {
      const start = runStartMsRef.current || Date.now();
      const sec = Math.max(0, Math.floor((Date.now() - start) / 1000));
      runElapsedSecRef.current = sec;
      setRunElapsedSec(sec);
    };

    updateElapsed();
    tickRef.current = setInterval(updateElapsed, 1000);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [runOn]);

  const undo = () => {
    setPoints((prev) => prev.slice(0, -1));
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    resetEngine();
  };

  const clear = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    setPoints([]);
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    setNavOn(false);
    setNextIdx(0);

    setRunOn(false);
    setRunElapsedSec(0);
    setRunStartMs(null);
    runStartMsRef.current = null;
    runElapsedSecRef.current = 0;

    setRunTrack([]);
    lastRunTrackRef.current = null;
    setPoiResults([]);
    setRadarPoints([]);
    resetEngine();
  };

  const resetTrail = () => {
    setGpsTrail(gps ? [gps] : []);
    lastTrailPointRef.current = gps || null;
  };

  const centerOnMe = () => {
    if (!gpsOn) return alert("Attiva prima il GPS.");
    if (!gps) return alert("Aspetta il fix GPS.");
    setFollowGps(true);
  };

  const newRoute = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    setActiveId("");
    setName("");
    setNote("");
    setRideProfile("touring");
    setPoints([]);
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    setNavOn(false);
    setNextIdx(0);

    setRunOn(false);
    setRunElapsedSec(0);
    setRunStartMs(null);
    runStartMsRef.current = null;
    runElapsedSecRef.current = 0;

    setRunTrack([]);
    lastRunTrackRef.current = null;
    setPoiResults([]);
    resetEngine();
  };

  const saveCurrent = () => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return alert("Dai un nome all’itinerario.");
    if (!points || points.length < 2) return alert("Aggiungi almeno 2 punti.");

    const id = activeId || uid();
    const existing = routes.find((r) => r.id === id);

    const payload = {
      id,
      name: cleanName,
      note: String(note || "").trim(),
      points,
      snappedLine: snappedLine && snappedLine.length >= 2 ? snappedLine : null,
      updatedAt: new Date().toISOString(),
      distanceKm: Math.round(distanceKm * 10) / 10,
      snapEnabled,
      rideProfile,
      totalTimeSec: existing?.totalTimeSec || 0,
      sessions: existing?.sessions || [],
      lastRunAt: existing?.lastRunAt || null,
      osrmDistanceKm: routeMeta?.distanceKm || 0,
      osrmDurationMin: routeMeta?.durationMin || 0,
      osrmSteps: routeMeta?.steps || [],
      riderScore: engineScore?.riderScore || 0,
      riderProfile: engineScore?.profile || rideProfile,
      riderHighlights: engineScore?.highlights || [],
    };

    setRoutes((prev) => {
      const exists = prev.some((r) => r.id === payload.id);
      return exists ? prev.map((r) => (r.id === payload.id ? payload : r)) : [payload, ...prev];
    });

    setActiveId(id);
  };

  const stopAndSaveRun = () => {
    if (!runOn) return;

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      setRunOn(false);
      alert("Dai un nome all’itinerario prima di salvare il tempo.");
      return;
    }
    if (!points || points.length < 2) {
      setRunOn(false);
      alert("Serve un itinerario con almeno 2 punti.");
      return;
    }

    const endMs = Date.now();
    const startMs = runStartMsRef.current ?? runStartMs ?? endMs;
    const durSec =
      runElapsedSecRef.current > 0
        ? runElapsedSecRef.current
        : Math.max(1, Math.floor((endMs - startMs) / 1000));

    const id = activeId || uid();

    setRoutes((prev) => {
      const existing = prev.find((r) => r.id === id);
      const prevSessions = existing?.sessions || [];
      const prevTotal = existing?.totalTimeSec || 0;

      const effectiveRunTrack = runTrack && runTrack.length >= 2 ? runTrack : null;
      const trackedDistanceKm = computeTrackedDistanceKm(effectiveRunTrack || []);

      const session = {
        startedAt: new Date(startMs).toISOString(),
        endedAt: new Date(endMs).toISOString(),
        durationSec: durSec,
        distanceKm: trackedDistanceKm,
        track: effectiveRunTrack,
      };

      const payload = {
        id,
        name: cleanName,
        note: String(note || "").trim(),
        points,
        snappedLine: snappedLine && snappedLine.length >= 2 ? snappedLine : null,
        updatedAt: new Date().toISOString(),
        distanceKm: Math.round(distanceKm * 10) / 10,
        snapEnabled,
        rideProfile,
        totalTimeSec: prevTotal + durSec,
        sessions: [session, ...prevSessions].slice(0, 50),
        lastRunAt: new Date().toISOString(),
        osrmDistanceKm: routeMeta?.distanceKm || 0,
        osrmDurationMin: routeMeta?.durationMin || 0,
        osrmSteps: routeMeta?.steps || [],
        riderScore: engineScore?.riderScore || existing?.riderScore || 0,
        riderProfile: engineScore?.profile || existing?.riderProfile || rideProfile,
        riderHighlights: engineScore?.highlights || existing?.riderHighlights || [],
      };

      const exists = prev.some((r) => r.id === id);
      return exists ? prev.map((r) => (r.id === id ? payload : r)) : [payload, ...prev];
    });

    setActiveId(id);
    setRunOn(false);
    setRunElapsedSec(durSec);
    setRunStartMs(null);
    runStartMsRef.current = null;
    runElapsedSecRef.current = durSec;
    setRunTrack([]);
    lastRunTrackRef.current = null;
  };

  const deleteRoute = () => {
    if (!activeRoute) return;
    if (!confirm(`Eliminare "${activeRoute.name}"?`)) return;
    setRoutes((prev) => prev.filter((r) => r.id !== activeRoute.id));
    newRoute();
  };

  const duplicateRoute = () => {
    if (!activeRoute) return;
    const payload = {
      ...activeRoute,
      id: uid(),
      name: `${activeRoute.name} (copy)`,
      updatedAt: new Date().toISOString(),
    };
    setRoutes((prev) => [payload, ...prev]);
    setActiveId(payload.id);
  };

  const doSnap = async () => {
    if (!points || points.length < 2) {
      return alert("Aggiungi almeno 2 punti.");
    }

    try {
      const routeInput = toLatLngObjects(points);

      const built = await buildRiderRoute(routeInput, {
        meta: {
          source: "Map.jsx",
          rideProfile,
        },
      });

      const builtRoute = built?.route;
      const line = toPointPairsFromEngineGeometry(builtRoute?.geometry || []);
      const firstLeg = builtRoute?.legs?.[0];

      const steps =
        (firstLeg?.steps || []).map((s) => ({
          distanceKm: Number((s.distanceMeters || 0) / 1000),
          durationMin: Number((s.durationSeconds || 0) / 60),
          name: s.name || "",
          instruction:
            s?.maneuver?.modifier
              ? `${s.maneuver.type || "Procedi"} ${s.maneuver.modifier || ""}`.trim()
              : s?.maneuver?.type || "Procedi",
        })) || [];

      if (!line?.length) {
        alert("Snap non riuscito. Riprova.");
        return;
      }

      setSnappedLine(line);
      setRouteMeta({
        distanceKm: Number(builtRoute?.distanceKm || 0),
        durationMin: Number(builtRoute?.durationMin || 0),
        steps: steps.slice(0, 8),
      });
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Snap Rider Engine error:", err);
        alert(err?.message || "Snap non disponibile ora. Riprova tra poco.");
      }
    }
  };

  const exportGpx = () => {
    const base = snapEnabled && snappedLine?.length >= 2 ? snappedLine : points;
    if (!base || base.length < 2) return alert("Nessun percorso da esportare.");
    const gpx = toGpx(name || "MotoPortEU Route", base);
    downloadTextFile(
      `${(name || "motoport_route").replace(/\s+/g, "_")}.gpx`,
      gpx,
      "application/gpx+xml"
    );
  };

  const openGoogleNav = () => {
    const url = buildGoogleMapsNavUrl(gps, points);
    if (!url) return alert("Serve un itinerario con almeno 2 punti.");
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    if (isMobile) window.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  const startRun = () => {
    if (runOn) return;
    if (!gpsOn) return alert("Per avviare il timer devi attivare GPS ON.");
    if (!gps) return alert("Aspetta il fix GPS (posizione non ancora disponibile).");
    if (points.length < 2) return alert("Crea prima un percorso (min 2 punti).");

    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    const now = Date.now();
    runStartMsRef.current = now;
    runElapsedSecRef.current = 0;

    setRunStartMs(now);
    setRunElapsedSec(0);
    setRunTrack(gps ? [gps] : []);
    lastRunTrackRef.current = gps || null;

    setRunOn(true);
  };

  const loadPois = async () => {
    if (!baseLine || baseLine.length < 2) {
      alert("Crea prima un percorso.");
      return;
    }

    const poiSampleCount = distanceKm > 220 ? 5 : 3;
    const samplePoints = sampleLine(baseLine, poiSampleCount);

    setPoiLoading(true);
    try {
      const results = await Promise.all(
        samplePoints.map((p) => overpassSearchNearby(p, poiCategory, poiRadius))
      );

      const merged = dedupePois(results.flat())
        .sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999))
        .slice(0, 20);

      setPoiResults(merged);
    } finally {
      setPoiLoading(false);
    }
  };

  const addPoiToRoute = (poi) => {
    if (!poi) return;
    setPoints((prev) => [...prev, [poi.lat, poi.lon]]);
    setSnappedLine(null);
    setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
    resetEngine();
    if (!String(name || "").trim()) {
      setName(`Route + ${poi.name}`);
    }
  };

  const mapCenter = useMemo(() => {
    if (gps) return gps;
    if (points?.length) return points[0];
    return [45.4642, 9.19];
  }, [gps, points]);

  const mapZoom = useMemo(() => {
    if (gps) return 13;
    if (points?.length) return 9;
    return 6;
  }, [gps, points]);

  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const onResize = () => setIsLg(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadRoute = (id) => setActiveId(id);

  const PointBadge = ({ idx }) => {
    if (idx === 0) return <span style={S.pill}>🏁 Start</span>;
    if (idx === points.length - 1) return <span style={S.pill}>📍 Arrivo</span>;
    return <span style={S.pill}>🛑 Tappa {idx}</span>;
  };

  const WeatherCard = ({ title, wx, analysis }) => (
    <div style={{ ...S.stat, minWidth: 0 }}>
      <div style={{ fontWeight: 900, fontSize: 13 }}>{title}</div>
      {!wx ? (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.72 }}>
          {OWM_KEY ? "Meteo non disponibile" : "Imposta VITE_OWM_KEY"}
        </div>
      ) : (
        <>
          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900 }}>
            {Number.isFinite(wx.temp) ? `${Math.round(wx.temp)}°` : "—"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{wx.desc || "—"}</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            🌬 {Math.round(wx.windKmh || 0)} km/h • 🌧 {wx.rainMm || 0} mm
          </div>
          <div style={{ marginTop: 8, fontWeight: 900, color: analysis?.color || "#111" }}>
            {analysis?.score || "—"} — {analysis?.label || "—"}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.container}>
        <style>{`
          input::placeholder, textarea::placeholder { color: rgba(0,0,0,0.55); }
          select {
            width: 100%;
            padding: 10px 12px;
            border-radius: 14px;
            border: 1px solid rgba(0,0,0,0.14);
            outline: none;
            background: white;
            font-size: 14px;
            color: #111;
          }
        `}</style>

        <div style={S.headerRow}>
          <div>
            <h1 style={S.title}>Navigatore Rider Evolution 🏁</h1>
            <p style={S.subtitle}>
              Rider Route Engine, GPS live, Rider Radar meteo e waypoint automatici lungo la rotta.
            </p>
          </div>

          <div style={S.row}>
            <button style={S.btnGhost} onClick={() => setSnapEnabled((v) => !v)}>
              {snapEnabled ? "🛣️ Snap ON" : "🧩 Snap OFF"}
            </button>

            <button
              style={S.btnGhost}
              onClick={() => {
                setGpsOn((v) => !v);
              }}
            >
              {gpsOn ? "📍 GPS ON" : "📍 GPS OFF"}
            </button>

            <button
              style={S.btnGhost}
              onClick={() => setFollowGps((v) => !v)}
              disabled={!gpsOn}
            >
              {followGps ? "🧭 Follow ON" : "🧭 Follow OFF"}
            </button>

            <button
              style={S.btnPrimary}
              onClick={centerOnMe}
              disabled={!gpsOn || !gps}
            >
              🎯 Centra su di me
            </button>

            <button
              style={S.btnPrimary}
              onClick={() => setNavOn((v) => !v)}
              disabled={!gpsOn || points.length < 2}
            >
              {navOn ? "🧭 Navigatore ON" : "🧭 Navigatore OFF"}
            </button>
          </div>
        </div>

        <div style={isLg ? S.gridLg : S.grid}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>🔎 Cerca luogo</div>

              <div style={{ position: "relative" }}>
                <input
                  style={S.input}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTypedPlace();
                    }
                  }}
                  placeholder="Es: Milano, Como, Passo Stelvio..."
                />

                {searchOpen && suggestions.length > 0 && (
                  <div style={S.dropdown}>
                    {suggestions.map((s, i) => (
                      <div
                        key={`${s.lat}-${s.lon}-${i}`}
                        style={S.ddItem}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addFromSearch(s)}
                        title="Aggiungi punto"
                      >
                        <b>➕</b> {s.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {searchOpen && searchLoading && (
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>⏳ Cerco...</div>
              )}

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={S.btnGhost} onClick={undo} disabled={!points.length}>
                  ↩️ Undo
                </button>
                <button style={S.btnGhost} onClick={clear} disabled={!points.length}>
                  🧹 Clear
                </button>
                <button
                  style={S.btnGhost}
                  onClick={addTypedPlace}
                  disabled={(q || "").trim().length < 3 || searchLoading}
                >
                  ➕ Aggiungi scritto
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={S.pill}>📍 Punti: {points.length}</span>
                <span style={S.pill}>📏 Km: {distanceKm.toFixed(1)}</span>
                <span style={S.pill}>
                  ⏱ Tempo: {routeMeta.durationMin > 0 ? `${Math.round(routeMeta.durationMin)} min` : etaText}
                </span>
                {snapEnabled && snappedLine?.length ? (
                  <span style={S.pill}>🛣️ Snapped</span>
                ) : (
                  <span style={S.pill}>📌 Manual</span>
                )}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={S.pill}>🟦 Scia: {gpsTrail.length}</span>
                <span style={S.pill}>
                  {gpsOn ? "📍 GPS attivo" : "📍 GPS spento"} • {followGps ? "🧭 Follow attivo" : "🖐️ Mappa libera"}
                </span>
                <button style={S.btnGhost} onClick={resetTrail} disabled={!gpsOn}>
                  🧽 Reset scia
                </button>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>✍️ Inserimento manuale percorso</div>

              <div style={{ ...S.small, marginBottom: 8 }}>
                Incolla coordinate tipo <b>45.4642, 9.1900</b> oppure un link Google Maps con <b>@lat,lng</b>.
              </div>

              <textarea
                style={S.textarea}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={`Esempio:\n45.4642, 9.1900\n46.0678, 11.1210\n\nOppure incolla un link Google Maps...`}
              />

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                <span style={S.pill}>✅ Trovati: {manualPreview.length}</span>

                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, opacity: 0.85 }}>
                  <input
                    type="checkbox"
                    checked={manualReplace}
                    onChange={(e) => setManualReplace(e.target.checked)}
                  />
                  Sostituisci percorso
                </label>

                <button
                  style={S.btnGhost}
                  onClick={() => setManualText("45.4642, 9.1900\n46.0678, 11.1210")}
                >
                  ✨ Esempio
                </button>
              </div>

              {manualErr ? (
                <div
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 14,
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.20)",
                    fontSize: 13,
                  }}
                >
                  ⚠️ {manualErr}
                </div>
              ) : null}

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={S.btn} onClick={importManualPoints} disabled={!manualText.trim()}>
                  ➕ Importa punti
                </button>
                <button style={S.btnGhost} onClick={clearManual} disabled={!manualText.trim()}>
                  🧹 Svuota
                </button>
                <button style={S.btnGhost} onClick={reversePoints} disabled={points.length < 2}>
                  ⇄ Inverti percorso
                </button>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>🧾 Itinerario</div>
                <button style={S.btnGhost} onClick={newRoute}>
                  ➕ Nuovo
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ ...S.small, fontWeight: 800 }}>Nome</div>
                <input
                  style={S.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Es: Stelvio + Gavia"
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ ...S.small, fontWeight: 800 }}>Profilo guida</div>
                <select value={rideProfile} onChange={(e) => setRideProfile(e.target.value)}>
                  <option value="relax">Relax</option>
                  <option value="touring">Touring</option>
                  <option value="sport">Sport</option>
                  <option value="rain">Pioggia / prudenza</option>
                </select>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ ...S.small, fontWeight: 800 }}>Note</div>
                <textarea
                  style={S.textarea}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Soste, benzina, orari, velox..."
                />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={S.btn} onClick={saveCurrent}>
                  💾 Salva
                </button>
                <button style={S.btnGhost} onClick={duplicateRoute} disabled={!activeRoute}>
                  📑 Duplica
                </button>
                <button style={S.btnDanger} onClick={deleteRoute} disabled={!activeRoute}>
                  🗑️ Elimina
                </button>
                <button
                  style={S.btnGhost}
                  onClick={doSnap}
                  disabled={engineLoading || engineSnapping || points.length < 2}
                >
                  {engineLoading || engineSnapping ? "🧠 Analisi rider..." : "🧠 Analizza con Rider Engine"}
                </button>
                <button style={S.btnGhost} onClick={openGoogleNav} disabled={points.length < 2}>
                  🧭 Apri navigazione
                </button>
                <button style={S.btnGhost} onClick={exportGpx} disabled={points.length < 2}>
                  🧾 Export GPX
                </button>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button style={S.btnPrimary} onClick={startRun} disabled={runOn}>
                  ⏱️ Start (GPS)
                </button>
                <button style={S.btnGhost} onClick={stopAndSaveRun} disabled={!runOn}>
                  ✅ Stop & Salva
                </button>
                <span style={S.pill}>⏱️ {fmtTime(runElapsedSec)}</span>
                {activeRoute?.totalTimeSec ? <span style={S.pill}>Totale: {fmtTime(activeRoute.totalTimeSec)}</span> : null}
                {runOn ? <span style={S.pill}>🏁 Run pts: {runTrack.length}</span> : null}
              </div>

              {engineError ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 14,
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(220,38,38,0.20)",
                    fontSize: 13,
                  }}
                >
                  ⚠️ {engineError}
                </div>
              ) : null}
            </div>

            <RiderModePanel
              route={engineRoute || (snappedLine?.length >= 2 ? { distanceKm, durationMin: routeMeta.durationMin } : null)}
              weather={engineWeather || { summary: overallWeather.label }}
              score={
                engineScore || {
                  riderScore: activeRoute?.riderScore || 0,
                  profile: activeRoute?.riderProfile || rideProfile,
                  highlights: activeRoute?.riderHighlights || [],
                }
              }
              loading={engineLoading || engineSnapping}
            />

            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>🧠 Rider Travel Panel</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Distanza</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {distanceKm.toFixed(1)} km
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Tempo stimato</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {formatDurationMinutes(estimatedDurationMin)}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Velocità media stimata</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {formatSpeed(estimatedAvgSpeed)}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Velocità media reale</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {routeStats.sessionCount > 0 ? formatSpeed(realAvgSpeed) : "—"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                    {routeStats.sessionCount > 0 ? `su ${routeStats.sessionCount} sessioni` : "nessuna sessione salvata"}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Profilo</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22, textTransform: "capitalize" }}>
                    {engineScore?.profile || rideProfile}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Meteo rotta</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 20, color: overallWeather.color }}>
                    {overallWeather.score} — {overallWeather.label}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Curve score</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {curveAnalysis.score}/100
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                    {curveAnalysis.label}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Stile strada</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {curveAnalysis.roadStyle}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                    Intensità: {curveAnalysis.intensity}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Curve rilevate</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {curveAnalysis.totalTurns}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                    Soft {curveAnalysis.softTurns} • Medie {curveAnalysis.mediumTurns} • Hard {curveAnalysis.hardTurns}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Complessità rotta</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontWeight: 900,
                      fontSize: 22,
                      color: routeComplexity.color,
                    }}
                  >
                    {routeComplexity.label}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Soste consigliate</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {stopAdvice.count}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                    {stopAdvice.label}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Tratte</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {legStats.count}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                    Media {legStats.avgKm ? `${legStats.avgKm.toFixed(1)} km` : "—"}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Tratta più lunga</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {legStats.maxKm ? `${legStats.maxKm.toFixed(1)} km` : "—"}
                  </div>
                </div>

                <div style={S.stat}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Rider score</div>
                  <div style={{ marginTop: 4, fontWeight: 900, fontSize: 22 }}>
                    {engineScore?.riderScore || activeRoute?.riderScore || 0}/100
                  </div>
                </div>
              </div>

              {(engineScore?.highlights?.length || activeRoute?.riderHighlights?.length) ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(15,23,42,0.04)",
                    border: "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>✨ Highlights rider</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(engineScore?.highlights || activeRoute?.riderHighlights || []).slice(0, 6).map((h, idx) => (
                      <span key={`${h}-${idx}`} style={S.pill}>
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {navOn && nextInfo && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(29,78,216,0.08)",
                    border: "1px solid rgba(29,78,216,0.18)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>🧭 Navigatore</div>
                  <div style={{ marginTop: 6, fontSize: 14 }}>
                    Prossimo waypoint: <b>#{nextInfo.idx + 1}</b> — distanza{" "}
                    <b>{(nextInfo.km * 1000).toFixed(0)} m</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {nextInfo.wp[0].toFixed(5)}, {nextInfo.wp[1].toFixed(5)}
                  </div>
                  {currentStepInstruction ? (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      Prossima manovra: <b>{currentStepInstruction.instruction || "Procedi"}</b>
                      {currentStepInstruction.name ? ` su ${currentStepInstruction.name}` : ""}
                    </div>
                  ) : null}
                </div>
              )}

              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(22,163,74,0.06)",
                  border: "1px solid rgba(22,163,74,0.14)",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 900 }}>🛞 Lettura rapida rotta</div>
                <div style={{ marginTop: 6, opacity: 0.82 }}>
                  {stopAdvice.note} • Strada: <b>{curveAnalysis.roadStyle}</b> • Complessità:{" "}
                  <b style={{ color: routeComplexity.color }}>{routeComplexity.label}</b>
                </div>
              </div>

              {weatherWarningList.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(202,138,4,0.08)",
                    border: "1px solid rgba(202,138,4,0.20)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>⚠️ Warning rider</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {weatherWarningList.map((w) => (
                      <span key={w} style={S.pill}>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>🌤 Meteo lungo rotta</div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <WeatherCard title="🏁 Start" wx={routeWeather.start} analysis={weatherAssessments.start} />
                <WeatherCard title="🛣 Mid" wx={routeWeather.mid} analysis={weatherAssessments.mid} />
                <WeatherCard title="📍 End" wx={routeWeather.end} analysis={weatherAssessments.end} />
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.72 }}>
                {weatherLoading
                  ? "Aggiornamento meteo in corso..."
                  : OWM_KEY
                  ? "Valutazione rider calcolata su partenza, metà rotta e arrivo."
                  : "Per attivare il meteo imposta VITE_OWM_KEY su Render/Vite."}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>📡 Rider Radar</div>

              {radarWorst ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${(radarWorst.analysis?.color || "#999")}33`,
                    background: `${radarWorst.analysis?.color || "#999"}11`,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Tratto più critico: punto #{radarWorst.idx + 1}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: radarWorst.analysis?.color || "#111" }}>
                    {radarWorst.analysis?.score} — {radarWorst.analysis?.label}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
                    {radarWorst.weather?.desc || "—"} • 🌬 {Math.round(radarWorst.weather?.windKmh || 0)} km/h •
                    🌧 {radarWorst.weather?.rainMm || 0} mm
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {radarLoading ? (
                  <div style={{ fontSize: 13, opacity: 0.72 }}>Analisi radar in corso...</div>
                ) : radarPoints.length ? (
                  radarPoints.map((rp) => (
                    <div
                      key={`radar-${rp.idx}-${rp.point?.[0]}-${rp.point?.[1]}`}
                      style={{
                        padding: 10,
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "rgba(255,255,255,0.56)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900 }}>Punto #{rp.idx + 1}</div>
                        <div style={{ fontWeight: 900, color: rp.analysis?.color || "#111" }}>
                          {rp.analysis?.score} — {rp.analysis?.label}
                        </div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                        {rp.weather?.desc || "—"} • 🌡 {Math.round(rp.weather?.temp || 0)}° • 🌬{" "}
                        {Math.round(rp.weather?.windKmh || 0)} km/h • 🌧 {rp.weather?.rainMm || 0} mm
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.72 }}>
                    Crea una rotta per vedere il radar meteo multi-point.
                  </div>
                )}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>⛽ Waypoint automatici</div>

              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <div style={{ ...S.small, fontWeight: 800 }}>Categoria</div>
                  <select value={poiCategory} onChange={(e) => setPoiCategory(e.target.value)}>
                    {POI_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ ...S.small, fontWeight: 800 }}>Raggio</div>
                  <select value={String(poiRadius)} onChange={(e) => setPoiRadius(Number(e.target.value))}>
                    <option value="2000">2 km</option>
                    <option value="3500">3.5 km</option>
                    <option value="5000">5 km</option>
                    <option value="8000">8 km</option>
                  </select>
                </div>

                <button style={S.btnPrimary} onClick={loadPois} disabled={poiLoading || points.length < 2}>
                  {poiLoading ? "Cerco waypoint..." : "🔎 Cerca waypoint lungo rotta"}
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {poiResults.length ? (
                  poiResults.map((poi) => (
                    <div
                      key={poi.id}
                      style={{
                        padding: 10,
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "rgba(255,255,255,0.56)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{poi.name}</div>
                          <div style={{ fontSize: 12, opacity: 0.72 }}>
                            {poi.categoryLabel} • ~ {poi.distanceKm?.toFixed?.(1) || "—"} km
                            {poi.meta ? ` • ${poi.meta}` : ""}
                          </div>
                        </div>
                        <button style={S.btnGhost} onClick={() => addPoiToRoute(poi)}>
                          ➕ Aggiungi alla rotta
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, opacity: 0.72 }}>Nessun waypoint caricato.</div>
                )}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>📍 Punti itinerario</div>

              {points.length === 0 ? (
                <div style={{ fontSize: 14, opacity: 0.72 }}>Nessun punto inserito.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {points.map((p, idx) => (
                    <div
                      key={`${p[0]}-${p[1]}-${idx}`}
                      style={{
                        padding: 10,
                        borderRadius: 14,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: "rgba(255,255,255,0.56)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <PointBadge idx={idx} />
                          <span style={{ fontSize: 13 }}>
                            {p[0].toFixed(5)}, {p[1].toFixed(5)}
                          </span>
                        </div>
                        <button style={S.btnDanger} onClick={() => removePointAt(idx)}>
                          ✖
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>📦 Salvati</div>
                <span style={S.pill}>{routes.length}</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <input
                  style={S.input}
                  value={savedFilter}
                  onChange={(e) => setSavedFilter(e.target.value)}
                  placeholder="Cerca tra gli itinerari salvati..."
                />
              </div>

              {filteredRoutes.length === 0 ? (
                <div style={{ marginTop: 8, opacity: 0.78, fontSize: 14 }}>Nessun itinerario trovato.</div>
              ) : (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {filteredRoutes.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => loadRoute(r.id)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 16,
                        border: "1px solid rgba(0,0,0,0.10)",
                        background: r.id === activeId ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.65)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900 }}>{r.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{(r.distanceKm ?? 0).toFixed(1)} km</div>
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>
                        {(r.points?.length || 0)} punti •{" "}
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "-"}
                        {typeof r.totalTimeSec === "number" && r.totalTimeSec > 0
                          ? ` • ⏱️ ${fmtTime(r.totalTimeSec)}`
                          : ""}
                      </div>

                      {r.note ? (
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.72,
                            marginTop: 4,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {r.note}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...S.card, opacity: 0.92 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>📊 Stats percorso attivo</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={S.pill}>Sessioni: {routeStats.sessionCount}</span>
                <span style={S.pill}>Tempo totale: {fmtTime(routeStats.totalTimeSec)}</span>
                <span style={S.pill}>Media sessione: {fmtTime(routeStats.avgSessionSec)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.72 }}>
                Ultimo utilizzo: {prettyDate(routeStats.lastRunAt)}
              </div>
            </div>

            <div style={{ ...S.card, opacity: 0.9 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>ℹ️ Nota tecnica</div>
              <div style={{ fontSize: 13, opacity: 0.78 }}>
                Il Rider Route Engine costruisce la rotta reale e calcola il profilo rider. Il meteo avanzato One Call 3.0 sarà il prossimo step.
              </div>
              <div style={{ fontSize: 13, opacity: 0.78, marginTop: 8 }}>
                Per test veloci GPX: <code>{`localStorage["${PASS_KEY}"]="true"`}</code>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RouteBuilderMap
              points={points}
              snappedLine={snapEnabled ? snappedLine : null}
              gps={gps}
              gpsTrail={gpsOn ? gpsTrail : null}
              followGps={followGps}
              isAddingEnabled={true}
              onAddPoint={(p) => {
                setPoints((prev) => [...prev, p]);
                setSnappedLine(null);
                setRouteMeta({ distanceKm: 0, durationMin: 0, steps: [] });
                resetEngine();
              }}
              onUserMapInteract={() => {
                if (gpsOn && followGps) setFollowGps(false);
              }}
              center={mapCenter}
              zoom={mapZoom}
              height={isLg ? 780 : 540}
              fitOnChange={!gpsOn || !followGps}
              poiMarkers={poiResults}
              radarMarkers={radarPoints}
            />

            <div style={{ ...S.card, padding: 12, fontSize: 13, opacity: 0.84 }}>
              <b>Tip:</b> scrivi una città e premi <b>Invio</b>. Usa <b>Rider Engine</b> per calcolare rotta reale, score e highlights.
              <br />
              <b>Rider Evolution:</b> cockpit rider + scoring + waypoint automatici + Rider Radar mostrati anche sulla mappa.
              <br />
              <b>Follow GPS:</b> se muovi la mappa a mano, il follow si disattiva. Usa <b>🎯 Centra su di me</b> per riattivarlo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}