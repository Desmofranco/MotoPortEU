// =======================================================
// src/components/RouteMap.jsx
// Leaflet map: traccia polyline se c'è, altrimenti start->end
// =======================================================
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const icon = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function toLatLng(p) {
  // support: [lat,lng] or {lat,lng}
  if (!p) return null;
  if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
  if (typeof p === "object" && "lat" in p && "lng" in p) return [Number(p.lat), Number(p.lng)];
  return null;
}

function safePolyline(route) {
  const pl = route?.polyline;
  if (!Array.isArray(pl) || pl.length < 2) return null;
  const pts = pl.map(toLatLng).filter(Boolean);
  return pts.length >= 2 ? pts : null;
}

function fallbackLine(route) {
  const s = toLatLng(route?.start);
  const e = toLatLng(route?.end);
  if (!s || !e) return null;
  return [s, e];
}

function boundsFor(points) {
  try {
    return L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
  } catch {
    return null;
  }
}

export default function RouteMap({ route }) {
  const poly = safePolyline(route) || fallbackLine(route);
  if (!poly) {
    return (
      <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
        Per vedere la mappa serve <strong>polyline</strong> oppure <strong>start/end</strong> nel routes.json.
      </div>
    );
  }

  const b = boundsFor(poly);
  const center = poly[Math.floor(poly.length / 2)];
  const start = toLatLng(route?.start) || poly[0];
  const end = toLatLng(route?.end) || poly[poly.length - 1];

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: 360, width: "100%" }}
        whenCreated={(map) => {
          if (b) map.fitBounds(b, { padding: [20, 20] });
        }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Polyline positions={poly} pathOptions={{ weight: 5 }} />

        {start ? (
          <Marker position={start} icon={icon}>
            <Popup>
              <strong>Start</strong><br />
              {route?.start?.name || "Partenza"}
            </Popup>
          </Marker>
        ) : null}

        {end ? (
          <Marker position={end} icon={icon}>
            <Popup>
              <strong>End</strong><br />
              {route?.end?.name || "Arrivo"}
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}
