// src/components/EuropeMap.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { useLocation } from "react-router-dom";

import { getRouteWeatherSummary } from "../utils/routeWeather";

const EUROPE_CENTER = [50.5, 10.0];
const STORAGE_KEY = "mpeu_planner_saved_routes_v1";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function totalDistanceKm(points) {
  if (!points || points.length < 2) return 0;
  let tot = 0;
  for (let i = 1; i < points.length; i++) tot += haversineKm(points[i - 1], points[i]);
  return tot;
}

function buildGoogleMapsDirUrl({ start, end, stops }) {
  const enc = (p) => `${p.lat},${p.lng}`;
  const origin = enc(start);
  const destination = enc(end);
  const waypoints = (stops || []).map(enc).join("|");

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  if (waypoints) url.searchParams.set("waypoints", waypoints);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function readSavedRoutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.saved) ? parsed.saved : [];
  } catch {
    return [];
  }
}

function findRouteById(routeId) {
  if (!routeId) return null;
  const all = readSavedRoutes();
  return all.find((r) => String(r?.id) === String(routeId)) || null;
}

function FitBounds({ points }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (!map) return;
    if (!Array.isArray(points) || points.length < 2) return;

    const latlngs = points.map((p) => [p.lat, p.lng]);
    const bounds = L.latLngBounds(latlngs);
    // padding per topbar
    map.fitBounds(bounds, { padding: [40, 140] });
  }, [map, points]);
  return null;
}

function ClickToSet({ enabled, onClickPoint }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onClickPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function EuropeMap() {
  const { search } = useLocation();
  const qs = useMemo(() => new URLSearchParams(search), [search]);
  const routeId = qs.get("routeId");

  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [stops, setStops] = useState([]);

  const [addStopsMode, setAddStopsMode] = useState(false);
  const [showStopsPanel, setShowStopsPanel] = useState(false);

  const [routeName, setRouteName] = useState("La mia rotta");

  // ETA semplice
  const [pace, setPace] = useState("touring"); // touring | mountain | fast
  const avgSpeed = useMemo(() => {
    if (pace === "mountain") return 45;
    if (pace === "fast") return 85;
    return 65;
  }, [pace]);

  // Meteo rotta (Open-Meteo util)
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState(null);
  const [weatherNote, setWeatherNote] = useState("");

  // evita che la geolocalizzazione sovrascriva un percorso caricato
  const loadedFromRouteRef = useRef(false);

  // 1) Se arrivo da Storico con routeId: carica percorso salvato
  useEffect(() => {
    if (!routeId) return;

    const r = findRouteById(routeId);
    if (!r || !Array.isArray(r.points) || r.points.length < 2) return;

    // points: [start, ...stops, end]
    const pts = r.points;
    const s = pts[0];
    const e = pts[pts.length - 1];
    const mid = pts.slice(1, -1);

    if (s?.lat && s?.lng) setStart({ lat: Number(s.lat), lng: Number(s.lng) });
    if (e?.lat && e?.lng) setEnd({ lat: Number(e.lat), lng: Number(e.lng) });
    setStops(
      mid
        .filter((p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
        .map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }))
    );

    setRouteName(String(r.name || "La mia rotta"));
    if (r.pace) setPace(String(r.pace));
    setAddStopsMode(false);
    setShowStopsPanel(true);

    // reset meteo (lo ricalcoli a comando)
    setWeatherSummary(null);
    setWeatherNote("");

    loadedFromRouteRef.current = true;
  }, [routeId]);

  // 2) Geolocalizzazione: solo se NON abbiamo appena caricato un percorso
  useEffect(() => {
    if (loadedFromRouteRef.current) return;

    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setStart({ lat: EUROPE_CENTER[0], lng: EUROPE_CENTER[1] }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const routePoints = useMemo(() => {
    const pts = [];
    if (start) pts.push(start);
    if (stops.length) pts.push(...stops);
    if (end) pts.push(end);
    return pts;
  }, [start, stops, end]);

  const canRoute = !!(start && end);
  const distanceKm = useMemo(() => totalDistanceKm(routePoints), [routePoints]);

  const estHours = useMemo(() => {
    if (!distanceKm || !avgSpeed) return 0;
    return distanceKm / avgSpeed;
  }, [distanceKm, avgSpeed]);

  const estTimeLabel = useMemo(() => {
    if (!estHours || estHours <= 0) return "";
    const h = Math.floor(estHours);
    const m = Math.round((estHours - h) * 60);
    if (h <= 0) return `${m} min`;
    if (m <= 0) return `${h} h`;
    return `${h} h ${m} min`;
  }, [estHours]);

  const setPointFromMapTap = (p) => {
    // primo tap = arrivo
    if (!end) {
      setEnd(p);
      setAddStopsMode(true);
      return;
    }
    if (addStopsMode) {
      setStops((prev) => [...prev, p]);
      return;
    }
    setEnd(p);
  };

  const undoLast = () => {
    if (stops.length) return setStops((prev) => prev.slice(0, -1));
    if (end) {
      setEnd(null);
      setAddStopsMode(false);
      setWeatherSummary(null);
      setWeatherNote("");
    }
  };

  const clearAll = () => {
    setEnd(null);
    setStops([]);
    setAddStopsMode(false);
    setShowStopsPanel(false);
    setWeatherSummary(null);
    setWeatherNote("");
    setRouteName("La mia rotta");
    loadedFromRouteRef.current = false;
  };

  const removeStop = (idx) => setStops((prev) => prev.filter((_, i) => i !== idx));

  const moveStop = (idx, dir) => {
    setStops((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const startNavigation = () => {
    if (!canRoute) return;
    const url = buildGoogleMapsDirUrl({ start, end, stops });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const saveRoute = () => {
    if (!canRoute) return;

    const item = {
      id: `mpeu-${Date.now()}`,
      name: (routeName || "La mia rotta").trim(),
      points: routePoints,
      distanceKm: Math.round(distanceKm * 10) / 10,
      pace,
      estTime: estTimeLabel,
      createdAt: Date.now(),
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : { saved: [] };
      const saved = Array.isArray(parsed?.saved) ? parsed.saved : [];
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...parsed, saved: [item, ...saved].slice(0, 100) })
      );
      alert("✅ Percorso salvato!");
    } catch {
      alert("⚠️ Non riesco a salvare (localStorage).");
    }
  };

  const fetchWeather = async () => {
    if (!canRoute) return;

    setWeatherLoading(true);
    setWeatherSummary(null);
    setWeatherNote("");

    try {
      // ✅ la tua utility ora vuole array punti [{lat,lng}, ...]
      const summary = await getRouteWeatherSummary(routePoints, { maxSamples: 8 });
      setWeatherSummary(summary);
    } catch {
      setWeatherNote("Meteo non disponibile.");
      setWeatherSummary(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const topBarStyle = {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 1000,
    background: "white",
    padding: "10px 12px",
    borderRadius: 14,
    boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
    fontSize: 13,
    display: "grid",
    gap: 8,
  };

  const btn = (primary = false) => ({
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.18)",
    background: primary ? "rgba(0,0,0,0.90)" : "white",
    color: primary ? "white" : "inherit",
    cursor: "pointer",
    fontSize: 12,
  });

  const chip = {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "white",
    fontSize: 12,
  };

  return (
    <div style={{ height: "calc(100vh - 64px)", width: "100%" }}>
      <MapContainer
        center={start ? [start.lat, start.lng] : EUROPE_CENTER}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickToSet enabled={!!start} onClickPoint={setPointFromMapTap} />
        {routePoints.length >= 2 && <FitBounds points={routePoints} />}

        {start && (
          <Marker position={[start.lat, start.lng]} icon={icon}>
            <Popup>📍 Partenza (mia posizione)</Popup>
          </Marker>
        )}

        {stops.map((p, idx) => (
          <Marker
            key={`stop-${idx}-${p.lat}-${p.lng}`}
            position={[p.lat, p.lng]}
            icon={icon}
          >
            <Popup>🟡 Tappa {idx + 1}</Popup>
          </Marker>
        ))}

        {end && (
          <Marker position={[end.lat, end.lng]} icon={icon}>
            <Popup>🏁 Arrivo</Popup>
          </Marker>
        )}

        {routePoints.length >= 2 && (
          <Polyline positions={routePoints.map((p) => [p.lat, p.lng])} />
        )}

        {/* TOP BAR */}
        <div style={topBarStyle}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <strong style={{ fontSize: 14 }}>Planner</strong>

            <span style={{ marginLeft: "auto", opacity: 0.8 }}>
              {canRoute ? (
                <>
                  <span style={chip}>🏍️ {distanceKm.toFixed(1)} km</span>{" "}
                  <span style={chip}>⏱️ {estTimeLabel}</span>
                </>
              ) : (
                <span style={chip}>👉 Tocca la mappa per scegliere l’arrivo</span>
              )}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Nome percorso"
              style={{
                flex: "1 1 180px",
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                fontSize: 12,
                minWidth: 160,
              }}
            />

            <select
              value={pace}
              onChange={(e) => setPace(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                fontSize: 12,
              }}
            >
              <option value="touring">Touring (≈65 km/h)</option>
              <option value="mountain">Montagna (≈45 km/h)</option>
              <option value="fast">Scorrevole (≈85 km/h)</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setAddStopsMode((v) => !v)}
              disabled={!end}
              style={{ ...btn(!addStopsMode), opacity: end ? 1 : 0.5 }}
            >
              {addStopsMode ? "🟡 Aggiungi tappe: ON" : "🟡 Aggiungi tappe: OFF"}
            </button>

            <button type="button" onClick={undoLast} style={btn(false)} disabled={!end && !stops.length}>
              Undo
            </button>

            <button
              type="button"
              onClick={() => setShowStopsPanel((v) => !v)}
              style={btn(false)}
              disabled={!end}
            >
              Tappe ({stops.length})
            </button>

            <button type="button" onClick={clearAll} style={btn(false)} disabled={!end && !stops.length}>
              Nuova
            </button>

            <button type="button" onClick={startNavigation} style={btn(true)} disabled={!canRoute}>
              Avvia navigazione
            </button>

            <button type="button" onClick={saveRoute} style={btn(false)} disabled={!canRoute}>
              Salva
            </button>

            <button
              type="button"
              onClick={fetchWeather}
              style={btn(false)}
              disabled={!canRoute || weatherLoading}
            >
              {weatherLoading ? "Meteo..." : "Meteo rotta"}
            </button>
          </div>

          {/* STOPS PANEL */}
          {showStopsPanel && end && (
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.10)", paddingTop: 10, display: "grid", gap: 8 }}>
              <div style={{ opacity: 0.8, fontSize: 12 }}>
                Tip: con “Aggiungi tappe: ON” puoi toccare la mappa per inserire tappe intermedie.
              </div>

              {stops.length === 0 ? (
                <div style={{ opacity: 0.8, fontSize: 12 }}>Nessuna tappa ancora.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {stops.map((p, idx) => (
                    <div
                      key={`stoprow-${idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                        alignItems: "center",
                        padding: "8px 10px",
                        border: "1px solid rgba(0,0,0,0.10)",
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ fontSize: 12 }}>
                        <strong>Tappa {idx + 1}</strong>
                        <div style={{ opacity: 0.7, fontSize: 11 }}>
                          {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" onClick={() => moveStop(idx, -1)} disabled={idx === 0} style={btn(false)}>
                          ↑
                        </button>
                        <button type="button" onClick={() => moveStop(idx, 1)} disabled={idx === stops.length - 1} style={btn(false)}>
                          ↓
                        </button>
                        <button type="button" onClick={() => removeStop(idx)} style={btn(false)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* WEATHER */}
          {(weatherSummary || weatherNote) && (
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.10)", paddingTop: 10 }}>
              {weatherNote ? (
                <div style={{ opacity: 0.85, fontSize: 12 }}>⚠️ {weatherNote}</div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={chip}>☁️ {weatherSummary.summary}</span>
                  {(weatherSummary.minTemp != null && weatherSummary.maxTemp != null) && (
                    <span style={chip}>🌡️ {weatherSummary.minTemp}–{weatherSummary.maxTemp}°C</span>
                  )}
                  {weatherSummary.windMax != null && <span style={chip}>💨 {weatherSummary.windMax} km/h</span>}
                  {weatherSummary.samples != null && <span style={chip}>📍 {weatherSummary.samples} punti</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </MapContainer>
    </div>
  );
}