import React, { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function lineKey(arr) {
  if (!arr || arr.length < 2) return "empty";
  const first = arr[0];
  const last = arr[arr.length - 1];
  return [
    arr.length,
    first?.[0]?.toFixed?.(5),
    first?.[1]?.toFixed?.(5),
    last?.[0]?.toFixed?.(5),
    last?.[1]?.toFixed?.(5),
  ].join("-");
}

function FitOrFollow({ center, zoom, followGps, gps, userInteractingRef }) {
  const map = useMap();
  const lastGpsRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    if (followGps && gps && !userInteractingRef.current) {
      const gpsKey = `${gps[0].toFixed(5)}-${gps[1].toFixed(5)}`;
      if (lastGpsRef.current === gpsKey) return;
      lastGpsRef.current = gpsKey;

      map.setView(gps, Math.max(map.getZoom(), 13), { animate: true });
      return;
    }
  }, [map, center, zoom, followGps, gps, userInteractingRef]);

  return null;
}

function FitLineBounds({ line, enabled, userInteractingRef, resetFitSignal }) {
  const map = useMap();
  const lastFitKeyRef = useRef("");

  useEffect(() => {
    if (!enabled) return;
    if (!map) return;
    if (!line || line.length < 2) return;
    if (userInteractingRef.current) return;

    const key = `${resetFitSignal}-${lineKey(line)}`;
    if (lastFitKeyRef.current === key) return;

    lastFitKeyRef.current = key;

    try {
      map.fitBounds(line, { padding: [30, 30] });
    } catch {
      // ignore
    }
  }, [map, enabled, line, userInteractingRef, resetFitSignal]);

  return null;
}

function UserInteractionWatcher({ userInteractingRef }) {
  useMapEvents({
    dragstart() {
      userInteractingRef.current = true;
    },
    zoomstart() {
      userInteractingRef.current = true;
    },
    movestart() {
      userInteractingRef.current = true;
    },
  });

  return null;
}

function ClickToAdd({ enabled, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      const { lat, lng } = e.latlng;
      onAddPoint?.([lat, lng]);
    },
  });
  return null;
}

function polyKey(prefix, arr) {
  if (!arr || arr.length < 2) return `${prefix}-empty`;
  const a = arr[0];
  const b = arr[arr.length - 1];
  return `${prefix}-${arr.length}-${a?.[0]?.toFixed?.(5)}-${a?.[1]?.toFixed?.(
    5
  )}-${b?.[0]?.toFixed?.(5)}-${b?.[1]?.toFixed?.(5)}`;
}

function createDivIcon(html, bg = "#111", color = "#fff") {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: ${bg};
        color: ${color};
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:900;
        font-size:12px;
        border:2px solid white;
        box-shadow:0 4px 12px rgba(0,0,0,0.22);
      ">
        ${html}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
}

const startIcon = createDivIcon("S", "#15803d");
const endIcon = createDivIcon("F", "#dc2626");
const poiIcon = createDivIcon("P", "#1d4ed8");
const gpsIcon = createDivIcon("📍", "#111827");
const radarA = createDivIcon("A", "#15803d");
const radarB = createDivIcon("B", "#65a30d");
const radarC = createDivIcon("C", "#ca8a04");
const radarD = createDivIcon("D", "#dc2626");

function getRadarIcon(score) {
  if (score === "A") return radarA;
  if (score === "B") return radarB;
  if (score === "C") return radarC;
  return radarD;
}

function getPointIcon(idx, total) {
  if (idx === 0) return startIcon;
  if (idx === total - 1) return endIcon;
  return createDivIcon(String(idx), "#0f172a");
}

export default function RouteBuilderMap({
  points = [],
  snappedLine = null,
  gps = null,
  gpsTrail = null,
  followGps = true,
  isAddingEnabled = true,
  onAddPoint,
  center = [45.4642, 9.19],
  zoom = 6,
  height = 520,
  fitOnChange = true,
  poiMarkers = [],
  radarMarkers = [],
}) {
  const line = useMemo(
    () => (snappedLine && snappedLine.length >= 2 ? snappedLine : points),
    [snappedLine, points]
  );

  const userInteractingRef = useRef(false);

  const resetFitSignal = useMemo(() => {
    return lineKey(line);
  }, [line]);

  useEffect(() => {
    userInteractingRef.current = false;
  }, [resetFitSignal]);

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.10)",
        position: "relative",
      }}
    >
      <MapContainer center={center} zoom={zoom} style={{ width: "100%", height: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <UserInteractionWatcher userInteractingRef={userInteractingRef} />

        <FitOrFollow
          center={center}
          zoom={zoom}
          followGps={followGps}
          gps={gps}
          userInteractingRef={userInteractingRef}
        />

        <FitLineBounds
          line={line}
          enabled={fitOnChange && !(followGps && gps)}
          userInteractingRef={userInteractingRef}
          resetFitSignal={resetFitSignal}
        />

        <ClickToAdd enabled={isAddingEnabled} onAddPoint={onAddPoint} />

        {line && line.length >= 2 ? (
          <Polyline key={polyKey("route", line)} positions={line} />
        ) : null}

        {gpsTrail && gpsTrail.length >= 2 ? (
          <Polyline key={polyKey("trail", gpsTrail)} positions={gpsTrail} />
        ) : null}

        {points.map((p, idx) => (
          <Marker
            key={`wp-${idx}-${p[0]}-${p[1]}`}
            position={p}
            icon={getPointIcon(idx, points.length)}
          >
            <Popup>
              <strong>
                {idx === 0 ? "Start" : idx === points.length - 1 ? "Arrivo" : `Tappa ${idx}`}
              </strong>
              <br />
              {p[0].toFixed(5)}, {p[1].toFixed(5)}
            </Popup>
          </Marker>
        ))}

        {poiMarkers.map((poi) => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lon]}
            icon={poiIcon}
          >
            <Popup>
              <strong>{poi.name}</strong>
              <br />
              {poi.categoryLabel}
              {poi.distanceKm != null ? (
                <>
                  <br />~ {poi.distanceKm.toFixed(1)} km
                </>
              ) : null}
              {poi.meta ? (
                <>
                  <br />{poi.meta}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}

        {radarMarkers.map((rp) => (
          <Marker
            key={`radar-${rp.idx}-${rp.point?.[0]}-${rp.point?.[1]}`}
            position={rp.point}
            icon={getRadarIcon(rp.analysis?.score)}
          >
            <Popup>
              <strong>Radar punto #{rp.idx + 1}</strong>
              <br />
              {rp.analysis?.score} — {rp.analysis?.label}
              {rp.weather ? (
                <>
                  <br />🌡 {Math.round(rp.weather.temp || 0)}°
                  <br />🌬 {Math.round(rp.weather.windKmh || 0)} km/h
                  <br />🌧 {rp.weather.rainMm || 0} mm
                  <br />{rp.weather.desc || ""}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}

        {gps ? <Marker position={gps} icon={gpsIcon} /> : null}
      </MapContainer>
    </div>
  );
}