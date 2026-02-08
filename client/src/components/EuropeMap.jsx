import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// Bounds Europa
const EUROPE_BOUNDS = [
  [34.5, -11.0],
  [72.5, 40.0],
];
const EUROPE_CENTER = [50.5, 10.0];

// Icona base Leaflet (placeholder)
const baseIcon = (color = "blue") =>
  new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: `marker-${color}`,
  });

const icons = {
  fuel: baseIcon("blue"),
  bar: baseIcon("green"),
  restaurant: baseIcon("red"),
  accessories: baseIcon("orange"),
  apparel: baseIcon("violet"),
  wp: baseIcon("black"),
};

const CATEGORY_LABELS = {
  bar: "Bar",
  restaurant: "Ristoranti",
  accessories: "Accessori",
  apparel: "Abbigliamento",
};

const STORAGE_KEY = "mpeu_planner_routes_v1";

function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function sumDistanceKm(points) {
  if (!points || points.length < 2) return 0;
  let tot = 0;
  for (let i = 1; i < points.length; i++) {
    tot += haversineKm(points[i - 1], points[i]);
  }
  return tot;
}

function ClickToAdd({ enabled, onAdd }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function EuropeMap() {
  const [fuelPoints, setFuelPoints] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [showFuel, setShowFuel] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(true);

  // Planner
  const [plannerOn, setPlannerOn] = useState(true);
  const [waypoints, setWaypoints] = useState([]);
  const [routeName, setRouteName] = useState("La mia rotta");

  // Mobile drawer
  const [isMobile, setIsMobile] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  // Filtri categoria fornitori
  const [catFilter, setCatFilter] = useState({
    bar: true,
    restaurant: true,
    accessories: true,
    apparel: true,
  });

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-close panel on mobile (start closed)
  useEffect(() => {
    if (isMobile) setPanelOpen(false);
    else setPanelOpen(true);
  }, [isMobile]);

  useEffect(() => {
    fetch("/data/fuel_points.json")
      .then((r) => r.json())
      .then((d) => setFuelPoints(Array.isArray(d) ? d : []))
      .catch(() => setFuelPoints([]));

    fetch("/data/suppliers.json")
      .then((r) => r.json())
      .then((d) => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => setSuppliers([]));

    // carica ultimo draft planner
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.draft?.waypoints?.length) setWaypoints(parsed.draft.waypoints);
        if (parsed?.draft?.routeName) setRouteName(parsed.draft.routeName);
      }
    } catch {
      // ignore
    }
  }, []);

  // salva draft ad ogni modifica (MVP)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : { saved: [], draft: null };
      const next = {
        ...parsed,
        draft: { routeName, waypoints, updatedAt: Date.now() },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, [routeName, waypoints]);

  // Conteggi fornitori per categoria
  const supplierCountsByCat = useMemo(() => {
    const counts = { bar: 0, restaurant: 0, accessories: 0, apparel: 0 };
    for (const s of suppliers) {
      if (counts[s.category] !== undefined) counts[s.category] += 1;
    }
    return counts;
  }, [suppliers]);

  // Lista filtrata fornitori
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => !!catFilter[s.category]);
  }, [suppliers, catFilter]);

  const counts = useMemo(
    () => ({
      fuel: fuelPoints.length,
      suppliersTotal: suppliers.length,
      suppliersVisible: filteredSuppliers.length,
      waypoints: waypoints.length,
    }),
    [fuelPoints, suppliers, filteredSuppliers, waypoints]
  );

  const setAllCats = (value) => {
    setCatFilter({
      bar: value,
      restaurant: value,
      accessories: value,
      apparel: value,
    });
  };

  const allCatsOn =
    catFilter.bar &&
    catFilter.restaurant &&
    catFilter.accessories &&
    catFilter.apparel;

  const allCatsOff =
    !catFilter.bar &&
    !catFilter.restaurant &&
    !catFilter.accessories &&
    !catFilter.apparel;

  const distanceKm = useMemo(() => sumDistanceKm(waypoints), [waypoints]);

  const addWaypoint = (p) => {
    setWaypoints((prev) => [...prev, p]);
  };

  const removeWaypoint = (idx) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveWaypoint = (idx, dir) => {
    setWaypoints((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const undo = () => {
    setWaypoints((prev) => (prev.length ? prev.slice(0, -1) : prev));
  };

  const clearRoute = () => {
    setWaypoints([]);
    setRouteName("La mia rotta");
  };

  const saveRoute = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : { saved: [], draft: null };

      const id = `my-${Date.now()}`;
      const item = {
        id,
        name: routeName?.trim() || "La mia rotta",
        waypoints,
        distanceKm: Math.round(distanceKm * 10) / 10,
        createdAt: Date.now(),
      };

      const next = {
        ...parsed,
        saved: [item, ...(Array.isArray(parsed.saved) ? parsed.saved : [])].slice(0, 50),
        draft: { routeName, waypoints, updatedAt: Date.now() },
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      alert("✅ Rotta salvata in locale!");
    } catch {
      alert("⚠️ Non riesco a salvare (localStorage).");
    }
  };

  // Styles drawer
  const panelStyle = {
    position: "absolute",
    top: 12,
    left: isMobile ? (panelOpen ? 12 : -340) : 12,
    transition: "left 0.25s ease",
    zIndex: 1000,
    background: "white",
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 12,
    minWidth: 260,
    maxWidth: 320,
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
  };

  return (
    <div style={{ height: "calc(100vh - 64px)", width: "100%" }}>
      <MapContainer
        center={EUROPE_CENTER}
        zoom={5}
        minZoom={4}
        maxZoom={18}
        maxBounds={EUROPE_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Click-to-add waypoint */}
        <ClickToAdd enabled={plannerOn} onAdd={addWaypoint} />

        {/* Mobile button */}
        {isMobile && (
          <button
            onClick={() => setPanelOpen(true)}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 1100,
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.2)",
              background: "white",
              fontSize: 12,
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
            }}
          >
            ☰ Planner
          </button>
        )}

        {/* Overlay */}
        {isMobile && panelOpen && (
          <div
            onClick={() => setPanelOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              zIndex: 999,
            }}
          />
        )}

        {/* Pannello layer + planner */}
        <div style={panelStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>Map</strong>
            <span style={{ marginLeft: "auto", opacity: 0.8 }}>
              WP: {counts.waypoints}
            </span>
          </div>

          {/* Close on mobile */}
          {isMobile && (
            <div style={{ marginTop: 8, display: "flex" }}>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Chiudi ✕
              </button>
            </div>
          )}

          {/* Planner */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>🧵 Planner</strong>
              <label style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={plannerOn}
                  onChange={(e) => setPlannerOn(e.target.checked)}
                />
                <span style={{ opacity: 0.9 }}>Crea rotta</span>
              </label>
            </div>

            <div style={{ marginTop: 8 }}>
              <input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Nome rotta"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  fontSize: 12,
                }}
              />
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={undo}
                disabled={!waypoints.length}
                style={{
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: waypoints.length ? "white" : "rgba(0,0,0,0.06)",
                  cursor: waypoints.length ? "pointer" : "not-allowed",
                }}
              >
                Undo
              </button>

              <button
                type="button"
                onClick={clearRoute}
                disabled={!waypoints.length && routeName === "La mia rotta"}
                style={{
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background:
                    waypoints.length || routeName !== "La mia rotta"
                      ? "white"
                      : "rgba(0,0,0,0.06)",
                  cursor:
                    waypoints.length || routeName !== "La mia rotta" ? "pointer" : "not-allowed",
                }}
              >
                Nuova
              </button>

              <button
                type="button"
                onClick={saveRoute}
                disabled={waypoints.length < 2}
                style={{
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: waypoints.length >= 2 ? "white" : "rgba(0,0,0,0.06)",
                  cursor: waypoints.length >= 2 ? "pointer" : "not-allowed",
                }}
              >
                Salva
              </button>
            </div>

            <div style={{ marginTop: 8, opacity: 0.85 }}>
              Distanza: <strong>{distanceKm.toFixed(1)} km</strong>
              <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                Tip: con “Crea rotta” ON, clicca sulla mappa per aggiungere punti.
              </div>
            </div>

            {/* Lista waypoints */}
            {waypoints.length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  maxHeight: isMobile ? 160 : 180,
                  overflow: "auto",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 10,
                  padding: 8,
                }}
              >
                <strong style={{ fontSize: 12 }}>Waypoints</strong>
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  {waypoints.map((p, idx) => (
                    <div
                      key={`${p.lat}-${p.lng}-${idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                        alignItems: "center",
                        padding: "6px 8px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.10)",
                      }}
                    >
                      <div style={{ fontSize: 11 }}>
                        <div style={{ fontWeight: 700 }}>WP {idx + 1}</div>
                        <div style={{ opacity: 0.75 }}>
                          {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => moveWaypoint(idx, -1)}
                          disabled={idx === 0}
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background: idx === 0 ? "rgba(0,0,0,0.06)" : "white",
                            cursor: idx === 0 ? "not-allowed" : "pointer",
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWaypoint(idx, 1)}
                          disabled={idx === waypoints.length - 1}
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background:
                              idx === waypoints.length - 1 ? "rgba(0,0,0,0.06)" : "white",
                            cursor:
                              idx === waypoints.length - 1 ? "not-allowed" : "pointer",
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWaypoint(idx)}
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.15)",
                            background: "white",
                            cursor: "pointer",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layer */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
            <strong>Layer</strong>

            <div style={{ marginTop: 6 }}>
              <label>
                <input
                  type="checkbox"
                  checked={showFuel}
                  onChange={(e) => setShowFuel(e.target.checked)}
                />{" "}
                ⛽ Benzinai ({counts.fuel})
              </label>
            </div>

            <div style={{ marginTop: 6 }}>
              <label>
                <input
                  type="checkbox"
                  checked={showSuppliers}
                  onChange={(e) => setShowSuppliers(e.target.checked)}
                />{" "}
                ⭐ Fornitori ({counts.suppliersVisible}/{counts.suppliersTotal})
              </label>
            </div>

            {/* Filtri categoria (solo se fornitori attivi) */}
            {showSuppliers && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid rgba(0,0,0,0.10)",
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong>Categorie</strong>
                  <button
                    type="button"
                    onClick={() => setAllCats(true)}
                    disabled={allCatsOn}
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: allCatsOn ? "rgba(0,0,0,0.06)" : "white",
                      cursor: allCatsOn ? "not-allowed" : "pointer",
                    }}
                  >
                    Tutte
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllCats(false)}
                    disabled={allCatsOff}
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: allCatsOff ? "rgba(0,0,0,0.06)" : "white",
                      cursor: allCatsOff ? "not-allowed" : "pointer",
                    }}
                  >
                    Nessuna
                  </button>
                </div>

                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {Object.keys(CATEGORY_LABELS).map((key) => (
                    <label
                      key={key}
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        type="checkbox"
                        checked={catFilter[key]}
                        onChange={(e) =>
                          setCatFilter((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                      />
                      <span>
                        {CATEGORY_LABELS[key]}{" "}
                        <span style={{ opacity: 0.7 }}>({supplierCountsByCat[key] || 0})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Route line */}
        {waypoints.length >= 2 && (
          <Polyline positions={waypoints.map((p) => [p.lat, p.lng])} />
        )}

        {/* Waypoint markers */}
        {waypoints.map((p, idx) => (
          <Marker key={`wp-${idx}-${p.lat}-${p.lng}`} position={[p.lat, p.lng]} icon={icons.wp}>
            <Popup>
              <strong>📍 WP {idx + 1}</strong>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Benzinai */}
        {showFuel &&
          fuelPoints.map((p) => (
            <Marker
              key={p.id || `${p.lat},${p.lng}`}
              position={[p.lat, p.lng]}
              icon={icons.fuel}
            >
              <Popup>
                <strong>⛽ {p.name}</strong>
                {p.brand && <div>Brand: {p.brand}</div>}
              </Popup>
            </Marker>
          ))}

        {/* Fornitori filtrati */}
        {showSuppliers &&
          filteredSuppliers.map((s) => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={icons[s.category] || icons.bar}>
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 700 }}>⭐ {s.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {s.city} · {CATEGORY_LABELS[s.category] || s.category}
                  </div>
                  {s.description && <p style={{ marginTop: 6 }}>{s.description}</p>}

                  <a
                    href={`/supplier/${s.id}`}
                    style={{
                      display: "inline-block",
                      marginTop: 8,
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.15)",
                      textDecoration: "none",
                      color: "inherit",
                      background: "white",
                      fontSize: 12,
                    }}
                  >
                    Apri scheda →
                  </a>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}