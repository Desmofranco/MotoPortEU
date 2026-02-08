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

const EUROPE_CENTER = [50.5, 10.0];

// Icona
const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
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

function ClickToSet({ onSet }) {
  useMapEvents({
    click(e) {
      onSet({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function EuropeMap() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);

  // GPS posizione utente
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setStart({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setStart({ lat: EUROPE_CENTER[0], lng: EUROPE_CENTER[1] });
      }
    );
  }, []);

  const distance = useMemo(() => {
    if (!start || !end) return 0;
    return haversineKm(start, end);
  }, [start, end]);

  return (
    <div style={{ height: "calc(100vh - 64px)", width: "100%" }}>
      <MapContainer
        center={
          start ? [start.lat, start.lng] : EUROPE_CENTER
        }
        zoom={6}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickToSet onSet={setEnd} />

        {/* Start marker */}
        {start && (
          <Marker position={[start.lat, start.lng]} icon={icon}>
            <Popup>📍 Partenza (mia posizione)</Popup>
          </Marker>
        )}

        {/* End marker */}
        {end && (
          <Marker position={[end.lat, end.lng]} icon={icon}>
            <Popup>🏁 Arrivo</Popup>
          </Marker>
        )}

        {/* Route line */}
        {start && end && (
          <Polyline
            positions={[
              [start.lat, start.lng],
              [end.lat, end.lng],
            ]}
          />
        )}

        {/* Top info bar */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 1000,
            background: "white",
            padding: "10px 12px",
            borderRadius: 14,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            fontSize: 14,
          }}
        >
          {!end && <strong>👉 Tocca la mappa per scegliere l’arrivo</strong>}
          {start && end && (
            <strong>
              🏍️ Distanza stimata: {distance.toFixed(1)} km
            </strong>
          )}
        </div>
      </MapContainer>
    </div>
  );
}