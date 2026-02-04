import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Bounds Europa
const EUROPE_BOUNDS = [
  [34.5, -11.0],
  [72.5, 40.0],
];
const EUROPE_CENTER = [50.5, 10.0];

// Icona base Leaflet (fuel)
const baseIcon = (color = "blue") =>
  new L.Icon({
    iconUrl: `https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png`,
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: `marker-${color}`,
  });

// Icone fornitori (stesso marker, colore logico via CSS class)
const icons = {
  fuel: baseIcon("blue"),
  bar: baseIcon("green"),
  restaurant: baseIcon("red"),
  accessories: baseIcon("orange"),
  apparel: baseIcon("violet"),
};

export default function EuropeMap() {
  const [fuelPoints, setFuelPoints] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showFuel, setShowFuel] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(true);

  useEffect(() => {
    fetch("/data/fuel_points.json")
      .then((r) => r.json())
      .then(setFuelPoints)
      .catch(() => setFuelPoints([]));

    fetch("/data/suppliers.json")
      .then((r) => r.json())
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, []);

  const counts = useMemo(
    () => ({
      fuel: fuelPoints.length,
      suppliers: suppliers.length,
    }),
    [fuelPoints, suppliers]
  );

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

        {/* Pannello layer */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            background: "white",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            fontSize: 12,
            minWidth: 190,
          }}
        >
          <strong>Layer</strong>
          <div>
            <label>
              <input
                type="checkbox"
                checked={showFuel}
                onChange={(e) => setShowFuel(e.target.checked)}
              />{" "}
              ⛽ Benzinai ({counts.fuel})
            </label>
          </div>
          <div>
            <label>
              <input
                type="checkbox"
                checked={showSuppliers}
                onChange={(e) => setShowSuppliers(e.target.checked)}
              />{" "}
              ⭐ Fornitori ({counts.suppliers})
            </label>
          </div>
        </div>

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

        {/* Fornitori */}
        {showSuppliers &&
          suppliers.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={icons[s.category] || icons.bar}
            >
              <Popup>
                <div style={{ minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>
                    ⭐ {s.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {s.city} · {s.category}
                  </div>
                  {s.description && (
                    <p style={{ marginTop: 6 }}>{s.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
