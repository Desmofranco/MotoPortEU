import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Bounding box Europa (SW, NE)
const EUROPE_BOUNDS = [
  [34.5, -11.0],
  [72.5, 40.0],
];

const EUROPE_CENTER = [50.5, 10.0];

// Icona marker semplice (fix classico per Leaflet con bundler)
const fuelIcon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function EuropeMap() {
  const [fuelPoints, setFuelPoints] = useState([]);
  const [loadingFuel, setLoadingFuel] = useState(true);

  useEffect(() => {
    const loadFuel = async () => {
      try {
        setLoadingFuel(true);
        const res = await fetch("/data/fuel_points.json");
        if (!res.ok) throw new Error(`fuel_points.json not found (${res.status})`);
        const data = await res.json();
        setFuelPoints(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("⛽ Fuel load error:", err);
        setFuelPoints([]);
      } finally {
        setLoadingFuel(false);
      }
    };

    loadFuel();
  }, []);

  const fuelCount = useMemo(() => fuelPoints.length, [fuelPoints]);

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
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Badge semplice in alto a sinistra */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            background: "white",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            fontSize: 12,
          }}
        >
          <div><strong>Europa</strong></div>
          <div>⛽ Benzinai: {loadingFuel ? "..." : fuelCount}</div>
        </div>

        {/* Marker benzinai */}
        {fuelPoints.map((p) => (
          <Marker
            key={p.id || `${p.lat},${p.lng}`}
            position={[p.lat, p.lng]}
            icon={fuelIcon}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 700 }}>⛽ {p.name || "Benzinaio"}</div>
                {p.brand && <div>Brand: {p.brand}</div>}
                <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
                  {Number(p.lat).toFixed(4)}, {Number(p.lng).toFixed(4)}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
