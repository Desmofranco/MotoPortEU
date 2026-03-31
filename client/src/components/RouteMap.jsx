// =======================================================
// src/components/RouteMap.jsx
// Leaflet map robusta per itinerari Routes.jsx
// ✅ Supporta:
//    - route.polyline           -> [[lat,lng], ...]
//    - route.coords             -> [[lat,lng], ...]
//    - route.geometry.coordinates -> [[lng,lat], ...] GeoJSON
//    - route.start / route.end  -> {lat,lng} o array
//    - route.center / location  -> fallback singolo punto
// ✅ Auto start/end se mancano ma esiste una linea
// ✅ Google Maps directions con eventuali waypoint
// ✅ Fallback finale su singolo punto
// =======================================================
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

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

function toLatLngFromGeoJsonCoord(p) {
  if (!Array.isArray(p) || p.length < 2) return null;
  const lng = toNum(p[0]);
  const lat = toNum(p[1]);
  return lat !== null && lng !== null ? [lat, lng] : null;
}

function normalizePointArray(arr) {
  if (!Array.isArray(arr)) return null;
  const pts = arr.map(toLatLng).filter(Boolean);
  return pts.length >= 2 ? pts : null;
}

function normalizeGeoJsonLine(route) {
  const coords = route?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const pts = coords.map(toLatLngFromGeoJsonCoord).filter(Boolean);
  return pts.length >= 2 ? pts : null;
}

function safePolyline(route) {
  const pl = route?.polyline;
  if (!Array.isArray(pl) || pl.length < 2) return null;

  const pts = pl.map(toLatLng).filter(Boolean);
  return pts.length >= 2 ? pts : null;
}

function safeCoordsLine(route) {
  const coords = route?.coords;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const pts = coords.map(toLatLng).filter(Boolean);
  return pts.length >= 2 ? pts : null;
}

function fallbackLine(route) {
  const s = toLatLng(route?.start);
  const e = toLatLng(route?.end);
  if (!s || !e) return null;
  return [s, e];
}

function fallbackPoint(route) {
  const coords = route?.coords;

  if (Array.isArray(coords) && coords.length) {
    if (Array.isArray(coords[0])) {
      const p = toLatLng(coords[0]);
      if (p) return p;
    } else {
      const p = toLatLng(coords);
      if (p) return p;
    }
  }

  return (
    toLatLng(route?.center) ||
    toLatLng(route?.location) ||
    toLatLng(route?.start) ||
    toLatLng(route?.end) ||
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

function googleDirectionsUrl(start, end, waypoints = []) {
  if (!start || !end) return null;

  const origin = `${start[0]},${start[1]}`;
  const dest = `${end[0]},${end[1]}`;

  const mids = (Array.isArray(waypoints) ? waypoints : [])
    .map(toLatLng)
    .filter(Boolean)
    .slice(0, 8)
    .map((p) => `${p[0]},${p[1]}`);

  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(dest)}` +
    `&travelmode=driving` +
    (mids.length ? `&waypoints=${encodeURIComponent(mids.join("|"))}` : "")
  );
}

function googlePlaceUrl(point) {
  if (!point) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${point[0]},${point[1]}`
  )}`;
}

function MapAutoFit({ bounds, singlePoint }) {
  useEffect(() => {}, [bounds, singlePoint]);
  return null;
}

export default function RouteMap({ route }) {
  const poly =
    safePolyline(route) ||
    safeCoordsLine(route) ||
    normalizeGeoJsonLine(route) ||
    fallbackLine(route);

  const singlePoint = !poly ? fallbackPoint(route) : null;

  if (!poly && !singlePoint) {
    return (
      <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
        Per vedere la mappa serve <strong>polyline</strong>, <strong>coords</strong>,
        <strong> geometry.coordinates</strong> oppure <strong>start/end</strong> nel routes.json.
      </div>
    );
  }

  const start = poly ? toLatLng(route?.start) || poly[0] : singlePoint;
  const end = poly ? toLatLng(route?.end) || poly[poly.length - 1] : null;

  const waypoints = Array.isArray(route?.waypoints)
    ? route.waypoints.map(toLatLng).filter(Boolean)
    : [];

  const center = poly ? poly[Math.floor(poly.length / 2)] : singlePoint;
  const b = poly ? boundsFor(poly) : null;

  const gDirectionsUrl = poly && start && end ? googleDirectionsUrl(start, end, waypoints) : null;
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
          scrollWheelZoom
          whenReady={(ev) => {
            const map = ev?.target;
            if (!map) return;

            if (b) {
              map.fitBounds(b, { padding: [20, 20] });
            } else if (singlePoint) {
              map.setView(singlePoint, 12);
            }
          }}
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

          {poly && waypoints.length
            ? waypoints.map((wp, idx) => (
                <Marker key={`wp-${idx}-${wp[0]}-${wp[1]}`} position={wp} icon={icon}>
                  <Popup>
                    <strong>Tappa {idx + 1}</strong>
                    <br />
                    {route?.waypoints?.[idx]?.name || "Waypoint"}
                    <br />
                    <span style={{ opacity: 0.8, fontSize: 12 }}>
                      {wp[0].toFixed(5)}, {wp[1].toFixed(5)}
                    </span>
                  </Popup>
                </Marker>
              ))
            : null}
        </MapContainer>
      </div>
    </div>
  );
}