// =======================================================
// src/components/RouteMap.jsx
// Leaflet map: polyline se c'è, altrimenti start->end,
// fallback finale su coords singolo punto
// ✅ Supporta: [lat,lng], {lat,lng}, {lat,lon}, {latitude,longitude}
// ✅ Auto start/end se mancano ma esiste polyline
// ✅ Fallback su route.coords / center / location
// ✅ Link Google Maps directions se esistono start/end
// ✅ Link Google Maps place se esiste solo un punto
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

function fallbackPoint(route) {
  return (
    toLatLng(route?.coords) ||
    toLatLng(route?.center) ||
    toLatLng(route?.location) ||
    null
  );
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

function googlePlaceUrl(point) {
  if (!point) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${point[0]},${point[1]}`
  )}`;
}

export default function RouteMap({ route }) {
  const poly = safePolyline(route) || fallbackLine(route);
  const singlePoint = !poly ? fallbackPoint(route) : null;

  if (!poly && !singlePoint) {
    return (
      <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
        Per vedere la mappa serve <strong>polyline</strong>, <strong>start/end</strong> oppure almeno{" "}
        <strong>coords</strong> nel routes.json.
      </div>
    );
  }

  const start = poly ? toLatLng(route?.start) || poly[0] : singlePoint;
  const end = poly ? toLatLng(route?.end) || poly[poly.length - 1] : null;

  const center = poly ? poly[Math.floor(poly.length / 2)] : singlePoint;
  const b = poly ? boundsFor(poly) : null;

  const gDirectionsUrl = poly && start && end ? googleDirectionsUrl(start, end) : null;
  const gPlaceUrl = !poly && singlePoint ? googlePlaceUrl(singlePoint) : null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {gDirectionsUrl ? (
        <a
          href={gDirectionsUrl}
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

      {gPlaceUrl ? (
        <a
          href={gPlaceUrl}
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
          📍 Apri punto in Google Maps
        </a>
      ) : null}

      <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
        <MapContainer
          center={center}
          zoom={poly ? 10 : 12}
          style={{ height: 360, width: "100%" }}
          whenCreated={(map) => {
            if (b) {
              map.fitBounds(b, { padding: [20, 20] });
            } else if (singlePoint) {
              map.setView(singlePoint, 12);
            }
          }}
          scrollWheelZoom
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {poly ? (
            <Polyline positions={poly} pathOptions={{ weight: 5 }} />
          ) : null}

          {start ? (
            <Marker position={start} icon={icon}>
              <Popup>
                <strong>{poly ? "Start" : route?.name || "Punto itinerario"}</strong>
                <br />
                {poly ? route?.start?.name || "Partenza" : route?.country || "Itinerario"}
                <br />
                <span style={{ opacity: 0.8, fontSize: 12 }}>
                  {start[0].toFixed(5)}, {start[1].toFixed(5)}
                </span>
              </Popup>
            </Marker>
          ) : null}

          {poly && end ? (
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