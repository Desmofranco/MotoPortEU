// =======================================================
// src/components/RouteMap.jsx
// Leaflet map: traccia polyline se c'è, altrimenti start->end
// ✅ Supporta: [lat,lng], {lat,lng}, {lat,lon}, {latitude,longitude}
// ✅ Auto start/end se mancano ma esiste polyline
// ✅ Link Google Maps directions
// =======================================================
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toLatLng(p) {
  // support:
  // - [lat,lng]
  // - {lat,lng}
  // - {lat,lon}
  // - {latitude,longitude}
  if (!p) return null;

  if (Array.isArray(p) && p.length >= 2) {
    const lat = toNum(p[0]);
    const lng = toNum(p[1]);
    return lat !== null && lng !== null ? [lat, lng] : null;
  }

  if (typeof p === "object") {
    const lat = toNum(p.lat ?? p.latitude);
    const lng = toNum(p.lng ?? p.lon ?? p.longitude);
    return lat !== null && lng !== null ? [lat, lng] : null;
  }

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

function googleDirectionsUrl(start, end) {
  if (!start || !end) return null;
  const origin = `${start[0]},${start[1]}`;
  const dest = `${end[0]},${end[1]}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
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

  // start/end: usa route.start/end se validi, altrimenti usa polyline[0] e polyline[last]
  const start = toLatLng(route?.start) || poly[0];
  const end = toLatLng(route?.end) || poly[poly.length - 1];

  const gUrl = googleDirectionsUrl(start, end);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {gUrl ? (
        <a
          href={gUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            width: "fit-content",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontSize: 13,
            textDecoration: "none",
          }}
        >
          📍 Apri in Google Maps (directions)
        </a>
      ) : null}

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
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <Polyline positions={poly} pathOptions={{ weight: 5 }} />

          {start ? (
            <Marker position={start} icon={icon}>
              <Popup>
                <strong>Start</strong>
                <br />
                {route?.start?.name || "Partenza"}
                <br />
                <span style={{ opacity: 0.8, fontSize: 12 }}>
                  {start[0].toFixed(5)}, {start[1].toFixed(5)}
                </span>
              </Popup>
            </Marker>
          ) : null}

          {end ? (
            <Marker position={end} icon={icon}>
              <Popup>
                <strong>End</strong>
                <br />
                {route?.end?.name || "Arrivo"}
                <br />
                <span style={{ opacity: 0.8, fontSize: 12 }}>
                  {end[0].toFixed(5)}, {end[1].toFixed(5)}
                </span>
              </Popup>
            </Marker>
          ) : null}
        </MapContainer>
      </div>
    </div>
  );
}
