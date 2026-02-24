// =======================================================
// src/pages/Map.jsx
// MotoPortEU — Rotta Libera 🏁 + GPS Live + Scia + Timer
// ✅ UI inline styles (no Tailwind)
// ✅ Autocomplete luoghi (Nominatim OSM) + ENTER per aggiungere
// ✅ FIX: ricerca veloce e stabile (abort + debounce + ordered results + cache + retry)
// ✅ Snap su strada (OSRM public router)
// ✅ Navigatore base (GPS follow + next waypoint + Google Maps nav)
// ✅ Timer corsa: Start/Stop salva sessioni e tempo totale (solo con GPS ON)
// ✅ Export GPX (Premium gate via localStorage)
// ✅ GPS Live + Scia (trail) in tempo reale
// ✅ FIX: input visibili in tema scuro + fitOnChange intelligente
// ✅ NEW: Inserimento manuale percorso (coordinate / link Google Maps) + preview + replace
// =======================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import RouteBuilderMap from "../components/RouteBuilderMap";

const STORAGE_KEY = "mp_routes_v2";
const PASS_KEY = "mp_pass_active"; // "true" => premium (per ora)

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

const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

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

// --- Autocomplete Nominatim (cache + retry + abort) ---
const _geoCache = new globalThis.Map(); // ✅ avoid shadowing with component name
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

// --- Snap OSRM route ---
async function osrmSnap(points) {
  if (!points || points.length < 2) return null;

  const maxPts = 25;
  const pts =
    points.length > maxPts
      ? points.filter((_, i) => i % Math.ceil(points.length / maxPts) === 0)
      : points;

  const coords = pts.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("OSRM error");
  const data = await res.json();
  const geom = data?.routes?.[0]?.geometry;
  const line = geom?.coordinates;
  if (!line || !line.length) return null;
  return line.map(([lon, lat]) => [lat, lon]);
}

// --- Navigator helper: next waypoint ---
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

  // Google su mobile è molto più affidabile con "navigate"
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

  // Waypoints (max 8)
  const mid = points
    .slice(1, -1)
    .slice(0, 8)
    .map((p) => `${p[0]},${p[1]}`);

  if (isMobile) {
    // ✅ Mobile: usa /maps/dir/ (si apre l’app e parte la navigazione quasi sempre)
    // format: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...
    const base =
      `https://www.google.com/maps/dir/?api=1` +
      `&travelmode=driving` +
      `&origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      (mid.length ? `&waypoints=${encodeURIComponent(mid.join("|"))}` : "");

    return base;
  }

  // ✅ Desktop: la stessa cosa va benissimo
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&travelmode=driving` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (mid.length ? `&waypoints=${encodeURIComponent(mid.join("|"))}` : "")
  );
}
// --- Manual route parse (coords / Google Maps URL) ---
function parseCoordsFromText(text) {
  const out = [];
  const t = String(text || "").trim();
  if (!t) return out;

  // 1) Google Maps @lat,lng
  const atMatches = [...t.matchAll(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g)];
  for (const m of atMatches) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      out.push([lat, lon]);
    }
  }

  // normalize separators: allow ";" to mean new line
  const normalized = t.replace(/;/g, "\n");

  // 2) Lines "lat,lng" or "lat lng" -> first two numbers found
  const lines = normalized.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const line of lines) {
    const nums = line.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 2) continue;

    const lat = Number(nums[0]);
    const lon = Number(nums[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    out.push([lat, lon]);
  }

  // dedup
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

// --- Styles (no Tailwind needed) ---
const S = {
  page: { width: "100%", padding: "16px 12px" },
  container: { maxWidth: 1180, margin: "0 auto" },
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
  gridLg: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, marginTop: 14 },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.72)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
    padding: 14,
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

// --- Trail helpers ---
const TRAIL_MIN_STEP_M = 12;
const TRAIL_MAX_PTS = 2500;
const kmToM = (km) => km * 1000;

export default function Map() {
  const [routes, setRoutes] = useState(() => loadRoutes());
  const [activeId, setActiveId] = useState(() => routes?.[0]?.id || "");
  const [points, setPoints] = useState([]);
  const [snappedLine, setSnappedLine] = useState(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  // Manual insert
  const [manualText, setManualText] = useState("");
  const [manualErr, setManualErr] = useState("");
  const [manualReplace, setManualReplace] = useState(true);
  const manualPreview = useMemo(() => parseCoordsFromText(manualText), [manualText]);

  // Autocomplete
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);
  const lastQueryRef = useRef("");
  const abortRef = useRef(null);

  // Snap
  const [snapping, setSnapping] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // GPS + Navigator
  const [gps, setGps] = useState(null);
  const [gpsOn, setGpsOn] = useState(false);
  const [followGps, setFollowGps] = useState(true);
  const [navOn, setNavOn] = useState(false);
  const [nextIdx, setNextIdx] = useState(0);

  // GPS Trail
  const [gpsTrail, setGpsTrail] = useState([]);
  const lastTrailPointRef = useRef(null);

  // Timer
  const [runOn, setRunOn] = useState(false);
  const [runStartMs, setRunStartMs] = useState(null);
  const [runElapsedSec, setRunElapsedSec] = useState(0);
  const tickRef = useRef(null);

  // Run track
  const [runTrack, setRunTrack] = useState([]);
  const lastRunTrackRef = useRef(null);

  const isPremium = useMemo(() => localStorage.getItem(PASS_KEY) === "true", []);

  const activeRoute = useMemo(
    () => routes.find((r) => r.id === activeId) || null,
    [routes, activeId]
  );

  const distanceKm = useMemo(() => {
    const base = snapEnabled && snappedLine?.length >= 2 ? snappedLine : points;
    return computeDistanceKm(base);
  }, [points, snappedLine, snapEnabled]);

  useEffect(() => saveRoutes(routes), [routes]);

  // Load selected route
  useEffect(() => {
    if (!activeRoute) return;
    setPoints(activeRoute.points || []);
    setSnappedLine(activeRoute.snappedLine || null);
    setName(activeRoute.name || "");
    setNote(activeRoute.note || "");
    setSnapEnabled(activeRoute.snapEnabled ?? true);

    setNavOn(false);
    setNextIdx(0);
    setRunOn(false);
    setRunElapsedSec(0);
    setRunStartMs(null);
    setRunTrack([]);
    lastRunTrackRef.current = null;
  }, [activeId]); // eslint-disable-line

  // Autocomplete debounce (abort-safe + ordered results)
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
        if (lastQueryRef.current !== query) return; // avoid out-of-order
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

  const addFromSearch = (s) => {
    setPoints((prev) => [...prev, [s.lat, s.lon]]);
    setSnappedLine(null);
    setQ("");
    setSuggestions([]);
    setSearchOpen(false);
    setSearchLoading(false);
    lastQueryRef.current = "";
  };

  // aggiungi anche se non clicchi la dropdown (usa prima suggestions)
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

  // Manual insert actions
  const importManualPoints = () => {
    setManualErr("");
    const pts = parseCoordsFromText(manualText);
    if (!pts.length) {
      setManualErr("Nessun punto valido trovato. Esempio: 45.4642, 9.1900 (o link Google Maps con @lat,lng).");
      return;
    }
    setPoints((prev) => (manualReplace ? pts : [...prev, ...pts]));
    setSnappedLine(null);
    setManualText("");
  };

  const clearManual = () => {
    setManualText("");
    setManualErr("");
  };

  const reversePoints = () => {
    setPoints((prev) => [...(prev || [])].reverse());
    setSnappedLine(null);
    setNextIdx(0);
  };

  // GPS watch
  useEffect(() => {
    if (!gpsOn) {
      setGps(null);
      setNavOn(false);
      setRunOn(false);

      setGpsTrail([]);
      lastTrailPointRef.current = null;

      setRunTrack([]);
      lastRunTrackRef.current = null;
      return;
    }

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
      (err) => {
        console.warn(err);
        alert("Impossibile ottenere GPS. Consenti la posizione al browser.");
        setGpsOn(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [gpsOn]);

  // Trail update when gps changes
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

  // Navigator: next waypoint
  useEffect(() => {
    if (!navOn) return;
    if (!gps) return;
    if (!points?.length) return;
    const idx = nearestNextWaypointIndex(gps, points, nextIdx);
    setNextIdx(idx);
  }, [navOn, gps, points]); // eslint-disable-line

  // Timer tick
  useEffect(() => {
    if (!runOn) {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
      return;
    }

    const start = Date.now();
    setRunStartMs(start);
    setRunElapsedSec(0);

    setRunTrack(gps ? [gps] : []);
    lastRunTrackRef.current = gps || null;

    tickRef.current = setInterval(() => {
      setRunElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [runOn]); // eslint-disable-line

  const undo = () => {
    setPoints((prev) => prev.slice(0, -1));
    setSnappedLine(null);
  };

  const clear = () => {
    setPoints([]);
    setSnappedLine(null);
    setNavOn(false);
    setNextIdx(0);
    setRunOn(false);
    setRunElapsedSec(0);
    setRunStartMs(null);
    setRunTrack([]);
    lastRunTrackRef.current = null;
  };

  const resetTrail = () => {
    setGpsTrail(gps ? [gps] : []);
    lastTrailPointRef.current = gps || null;
  };

  const newRoute = () => {
    setActiveId("");
    setName("");
    setNote("");
    setPoints([]);
    setSnappedLine(null);
    setNavOn(false);
    setNextIdx(0);
    setRunOn(false);
    setRunElapsedSec(0);
    setRunStartMs(null);
    setRunTrack([]);
    lastRunTrackRef.current = null;
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
      totalTimeSec: existing?.totalTimeSec || 0,
      sessions: existing?.sessions || [],
      lastRunAt: existing?.lastRunAt || null,
    };

    setRoutes((prev) => {
      const exists = prev.some((r) => r.id === payload.id);
      return exists ? prev.map((r) => (r.id === payload.id ? payload : r)) : [payload, ...prev];
    });

    setActiveId(id);
  };

  const stopAndSaveRun = () => {
    if (!runOn) return;

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      alert("Dai un nome all’itinerario prima di salvare il tempo.");
      setRunOn(false);
      return;
    }
    if (!points || points.length < 2) {
      alert("Serve un itinerario con almeno 2 punti.");
      setRunOn(false);
      return;
    }

    const endMs = Date.now();
    const startMs = runStartMs ?? endMs - runElapsedSec * 1000;
    const durSec = Math.max(1, Math.floor((endMs - startMs) / 1000));

    const id = activeId || uid();

    setRoutes((prev) => {
      const existing = prev.find((r) => r.id === id);
      const prevSessions = existing?.sessions || [];
      const prevTotal = existing?.totalTimeSec || 0;

      const session = {
        startedAt: new Date(startMs).toISOString(),
        endedAt: new Date(endMs).toISOString(),
        durationSec: durSec,
        track: runTrack && runTrack.length >= 2 ? runTrack : null,
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
        totalTimeSec: prevTotal + durSec,
        sessions: [session, ...prevSessions].slice(0, 50),
        lastRunAt: new Date().toISOString(),
      };

      const exists = prev.some((r) => r.id === id);
      return exists ? prev.map((r) => (r.id === id ? payload : r)) : [payload, ...prev];
    });

    setActiveId(id);
    setRunOn(false);
    setRunTrack([]);
    lastRunTrackRef.current = null;
  };

  const deleteRoute = () => {
    if (!activeRoute) return;
    if (!confirm(`Eliminare "${activeRoute.name}"?`)) return;
    setRoutes((prev) => prev.filter((r) => r.id !== activeRoute.id));
    newRoute();
  };

  const doSnap = async () => {
    if (!points || points.length < 2) return alert("Aggiungi almeno 2 punti.");
    setSnapping(true);
    try {
      const line = await osrmSnap(points);
      if (!line) alert("Snap non riuscito. Riprova.");
      else setSnappedLine(line);
    } catch (e) {
      console.warn(e);
      alert("Snap non disponibile ora (OSRM). Riprova tra poco.");
    } finally {
      setSnapping(false);
    }
  };

  const exportGpx = () => {
    if (!isPremium) {
      alert("Export GPX è Premium (per ora).");
      return;
    }
    const base = snapEnabled && snappedLine?.length >= 2 ? snappedLine : points;
    if (!base || base.length < 2) return alert("Nessun percorso da esportare.");
    const gpx = toGpx(name || "MotoPortEU Route", base);
    downloadTextFile(`${(name || "motoport_route").replace(/\s+/g, "_")}.gpx`, gpx, "application/gpx+xml");
  };

  const openGoogleNav = () => {
    const url = buildGoogleMapsNavUrl(gps, points);
    if (!url) return alert("Serve un itinerario con almeno 2 punti.");
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
if (isMobile) window.location.href = url;
else window.open(url, "_blank", "noopener,noreferrer");
  };

  const startRun = () => {
    if (!gpsOn) return alert("Per avviare il timer devi attivare GPS ON.");
    if (!gps) return alert("Aspetta il fix GPS (posizione non ancora disponibile).");
    if (points.length < 2) return alert("Crea prima un percorso (min 2 punti).");
    setRunOn(true);
  };

  const nextInfo = useMemo(() => {
    if (!navOn || !gps || !points?.length) return null;
    const idx = Math.min(nextIdx, points.length - 1);
    const wp = points[idx];
    const km = haversineKm(gps, wp);
    return { idx, km, wp };
  }, [navOn, gps, points, nextIdx]);

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

  return (
    <div style={S.page}>
      <div style={S.container}>
        <style>{`
          input::placeholder, textarea::placeholder { color: rgba(0,0,0,0.55); }
        `}</style>

        <div style={S.headerRow}>
          <div>
            <h1 style={S.title}>Rotta Libera 🏁</h1>
            <p style={S.subtitle}>
              Cerca, snappa su strada, naviga e salva tempo. Timer avviabile solo con GPS ON. <b>NEW:</b> Scia GPS Live + inserimento manuale.
            </p>
          </div>

          <div style={S.row}>
            <button style={S.btnGhost} onClick={() => setSnapEnabled((v) => !v)} title="Mostra/usa snap">
              {snapEnabled ? "🛣️ Snap ON" : "🧩 Snap OFF"}
            </button>

            <button style={S.btnGhost} onClick={() => setGpsOn((v) => !v)} title="GPS live">
              {gpsOn ? "📍 GPS ON" : "📍 GPS OFF"}
            </button>

            <button
              style={S.btnGhost}
              onClick={() => setFollowGps((v) => !v)}
              disabled={!gpsOn}
              title="Segui la tua posizione"
            >
              {followGps ? "🧭 Follow ON" : "🧭 Follow OFF"}
            </button>

            <button
              style={S.btn}
              onClick={() => setNavOn((v) => !v)}
              disabled={!gpsOn || points.length < 2}
              title="Modalità navigatore (next waypoint)"
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
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                  ⏳ Cerco...
                </div>
              )}

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={S.btnGhost} onClick={undo} disabled={!points.length}>
                  ↩️ Undo
                </button>
                <button style={S.btnGhost} onClick={clear} disabled={!points.length}>
                  🧹 Clear
                </button>
                <button style={S.btnGhost} onClick={addTypedPlace} disabled={(q || "").trim().length < 3 || searchLoading}>
                  ➕ Aggiungi scritto
                </button>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={S.pill}>📍 Punti: {points.length}</span>
                <span style={S.pill}>📏 Km: {distanceKm.toFixed(1)}</span>
                {snapEnabled && snappedLine?.length ? <span style={S.pill}>🛣️ Snapped</span> : <span style={S.pill}>📌 Manual</span>}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={S.pill}>🟦 Scia: {gpsTrail.length}</span>
                <button style={S.btnGhost} onClick={resetTrail} disabled={!gpsOn}>
                  🧽 Reset scia
                </button>
              </div>
            </div>

            {/* Manual route insert */}
            <div style={S.card}>
              <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>✍️ Inserimento manuale percorso</div>

              <div style={{ ...S.small, marginBottom: 8 }}>
                Incolla coordinate (una per riga) tipo <b>45.4642, 9.1900</b> oppure un link Google Maps con <b>@lat,lng</b>.
                <br />
                Supporta anche una riga con <b>;</b> (es: <b>45.46,9.19;46.06,11.12</b>).
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
                  Sostituisci percorso (consigliato)
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
                <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es: Stelvio + Gavia" />
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ ...S.small, fontWeight: 800 }}>Note</div>
                <textarea style={S.textarea} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Soste, benzina, orari, velox..." />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={S.btn} onClick={saveCurrent}>
                  💾 Salva
                </button>
                <button style={S.btnDanger} onClick={() => (activeRoute ? deleteRoute() : null)} disabled={!activeRoute}>
                  🗑️ Elimina
                </button>

                <button style={S.btnGhost} onClick={doSnap} disabled={snapping || points.length < 2}>
                  {snapping ? "🛣️ Snap..." : "🛣️ Snap su strada"}
                </button>

                <button style={S.btnGhost} onClick={openGoogleNav} disabled={points.length < 2}>
                  🧭 Apri navigazione
                </button>

                <button style={S.btnGhost} onClick={exportGpx} disabled={points.length < 2}>
                  🧾 Export GPX {isPremium ? "" : "(Premium)"}
                </button>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <button style={S.btn} onClick={startRun} disabled={runOn}>
                  ⏱️ Start (GPS)
                </button>
                <button style={S.btnGhost} onClick={stopAndSaveRun} disabled={!runOn}>
                  ✅ Stop & Salva
                </button>
                <span style={S.pill}>⏱️ {fmtTime(runElapsedSec)}</span>
                {activeRoute?.totalTimeSec ? <span style={S.pill}>Totale: {fmtTime(activeRoute.totalTimeSec)}</span> : null}
                {runOn ? <span style={S.pill}>🏁 Run pts: {runTrack.length}</span> : null}
              </div>

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
                    Prossimo waypoint: <b>#{nextInfo.idx + 1}</b> — distanza <b>{(nextInfo.km * 1000).toFixed(0)} m</b>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    {nextInfo.wp[0].toFixed(5)}, {nextInfo.wp[1].toFixed(5)}
                  </div>
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>📦 Salvati</div>
                <span style={S.pill}>{routes.length}</span>
              </div>

              {routes.length === 0 ? (
                <div style={{ marginTop: 8, opacity: 0.78, fontSize: 14 }}>Nessun itinerario salvato. Creane uno sulla mappa 👇</div>
              ) : (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {routes.map((r) => (
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
                        {(r.points?.length || 0)} punti • {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "-"}
                        {typeof r.totalTimeSec === "number" && r.totalTimeSec > 0 ? ` • ⏱️ ${fmtTime(r.totalTimeSec)}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ ...S.card, opacity: 0.9 }}>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>🔐 Premium (temporaneo)</div>
              <div style={{ fontSize: 13, opacity: 0.78 }}>
                Per testare GPX ora: imposta <code>localStorage["{PASS_KEY}"]="true"</code>.
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
              }}
              center={mapCenter}
              zoom={mapZoom}
              height={isLg ? 720 : 520}
              fitOnChange={!gpsOn || !followGps}
            />

            <div style={{ ...S.card, padding: 12, fontSize: 13, opacity: 0.82 }}>
              <b>Tip:</b> scrivi una città e premi <b>Invio</b>. <br />
              <b>Manual:</b> incolla coordinate o un link Google Maps con <b>@lat,lng</b> e premi <b>Importa punti</b>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}