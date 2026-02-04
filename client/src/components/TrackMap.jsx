// =======================================================
// src/components/TrackMap.jsx
// Leaflet map: marker singolo su track.coords
// =======================================================
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function toLatLng(coords) {
  if (!coords) return null;
  const lat = Number(coords.lat ?? coords.latitude);
  const lng = Number(coords.lng ?? coords.lon ?? coords.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

export default function TrackMap({ track }) {
  const pos = toLatLng(track?.coords);
  if (!pos) {
    return (
      <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
        Per vedere la mappa serve <strong>coords</strong> nel tracks.json (es. {"{lat,lng}"}).
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
      <MapContainer center={pos} zoom={12} style={{ height: 360, width: "100%" }} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <Marker position={pos} icon={icon}>
          <Popup>
            <strong>{track?.name || "Pista"}</strong>
            <br />
            {track?.region || ""}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
