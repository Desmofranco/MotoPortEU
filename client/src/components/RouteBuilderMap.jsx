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

const FOLLOW_MIN_MOVE_METERS = 18;
const FOLLOW_THROTTLE_MS = 1400;
const FOLLOW_MIN_ZOOM = 14;
const FIT_PADDING = [34, 34];
const USER_RELEASE_MS = 1800;

function isValidPoint(p) {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    Number.isFinite(Number(p[0])) &&
    Number.isFinite(Number(p[1]))
  );
}

function cleanLine(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isValidPoint).map((p) => [Number(p[0]), Number(p[1])]);
}

function lineKey(arr) {
  const line = cleanLine(arr);
  if (line.length < 2) return "empty";
  const first = line[0];
  const last = line[line.length - 1];
  return [
    line.length,
    first[0].toFixed(5),
    first[1].toFixed(5),
    last[0].toFixed(5),
    last[1].toFixed(5),
  ].join("-");
}

function polyKey(prefix, arr) {
  return `${prefix}-${lineKey(arr)}`;
}

function haversineMeters(a, b) {
  if (!isValidPoint(a) || !isValidPoint(b)) return 0;

  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(Number(b[0]) - Number(a[0]));
  const dLon = toRad(Number(b[1]) - Number(a[1]));
  const lat1 = toRad(Number(a[0]));
  const lat2 = toRad(Number(b[0]));

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

function createDivIcon(html, bg = "#111", color = "#fff", size = 28) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:999px;
        background:${bg};
        color:${color};
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:900;
        font-size:${size <= 20 ? 10 : 12}px;
        border:2px solid white;
        box-shadow:0 4px 12px rgba(0,0,0,0.22);
      ">
        ${html}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -12],
  });
}

function createGpsPulseIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        position:relative;
        width:28px;
        height:28px;
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <div style="
          position:absolute;
          inset:-10px;
          border-radius:999px;
          background:rgba(59,130,246,0.16);
          border:2px solid rgba(59,130,246,0.24);
        "></div>
        <div style="
          position:absolute;
          width:24px;
          height:24px;
          border-radius:999px;
          background:#0f172a;
          border:3px solid white;
          box-shadow:0 0 0 6px rgba(59,130,246,0.18), 0 6px 16px rgba(0,0,0,0.26);
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          font-size:11px;
          font-weight:900;
        ">📍</div>
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
const gpsIcon = createGpsPulseIcon();

const radarA = createDivIcon("A", "#15803d");
const radarB = createDivIcon("B", "#65a30d");
const radarC = createDivIcon("C", "#ca8a04");
const radarD = createDivIcon("D", "#dc2626");

const waypointIconCache = new Map();

function getRadarIcon(score) {
  if (score === "A") return radarA;
  if (score === "B") return radarB;
  if (score === "C") return radarC;
  return radarD;
}

function getWaypointIcon(idx, total) {
  if (idx === 0) return startIcon;
  if (idx === total - 1) return endIcon;

  const key = `wp-${idx}`;
  if (!waypointIconCache.has(key)) {
    waypointIconCache.set(key, createDivIcon(String(idx), "#0f172a"));
  }
  return waypointIconCache.get(key);
}

function UserInteractionWatcher({
  userInteractingRef,
  followGps,
  onUserMapInteract,
}) {
  const releaseTimerRef = useRef(null);

  const markUserBusy = (shouldDisableFollow = false) => {
    userInteractingRef.current = true;

    if (shouldDisableFollow && followGps) {
      onUserMapInteract?.();
    }

    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
    }

    releaseTimerRef.current = setTimeout(() => {
      userInteractingRef.current = false;
    }, USER_RELEASE_MS);
  };

  useMapEvents({
    dragstart(e) {
      markUserBusy(Boolean(e?.originalEvent));
    },
    drag() {
      markUserBusy(false);
    },
    dragend() {
      markUserBusy(false);
    },
    zoomstart(e) {
      markUserBusy(Boolean(e?.originalEvent));
    },
    zoomend() {
      markUserBusy(false);
    },
    mousedown(e) {
      markUserBusy(Boolean(e?.originalEvent));
    },
    touchstart(e) {
      markUserBusy(Boolean(e?.originalEvent));
    },
    wheel(e) {
      markUserBusy(Boolean(e?.originalEvent));
    },
  });

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  return null;
}

function FitOrFollow({ followGps, gps, userInteractingRef }) {
  const map = useMap();
  const lastAppliedGpsRef = useRef(null);
  const lastFollowAtRef = useRef(0);
  const firstLockDoneRef = useRef(false);

  useEffect(() => {
    if (!map || !followGps || !isValidPoint(gps)) return;
    if (userInteractingRef.current) return;

    const now = Date.now();
    const currentGps = [Number(gps[0]), Number(gps[1])];
    const lastGps = lastAppliedGpsRef.current;
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom || FOLLOW_MIN_ZOOM, FOLLOW_MIN_ZOOM);

    if (!firstLockDoneRef.current) {
      firstLockDoneRef.current = true;
      lastAppliedGpsRef.current = currentGps;
      lastFollowAtRef.current = now;

      try {
        map.setView(currentGps, targetZoom, { animate: false });
      } catch {
        // ignore
      }
      return;
    }

    const movedMeters = haversineMeters(lastGps, currentGps);
    if (movedMeters < FOLLOW_MIN_MOVE_METERS) return;

    const elapsed = now - lastFollowAtRef.current;
    if (elapsed < FOLLOW_THROTTLE_MS) return;

    lastAppliedGpsRef.current = currentGps;
    lastFollowAtRef.current = now;

    try {
      if (movedMeters < 180) {
        map.panTo(currentGps, {
          animate: true,
          duration: 0.8,
          easeLinearity: 0.25,
        });
      } else {
        map.setView(currentGps, targetZoom, { animate: true });
      }
    } catch {
      // ignore
    }
  }, [map, followGps, gps, userInteractingRef]);

  useEffect(() => {
    if (!followGps) {
      lastAppliedGpsRef.current = null;
      lastFollowAtRef.current = 0;
      firstLockDoneRef.current = false;
    }
  }, [followGps]);

  return null;
}

function FitLineBounds({ line, enabled, userInteractingRef, fitSignal }) {
  const map = useMap();
  const lastFitKeyRef = useRef("");

  useEffect(() => {
    if (!enabled || !map) return;

    const safeLine = cleanLine(line);
    if (safeLine.length < 2) return;
    if (userInteractingRef.current) return;

    const key = fitSignal || lineKey(safeLine);
    if (lastFitKeyRef.current === key) return;

    lastFitKeyRef.current = key;

    try {
      map.fitBounds(safeLine, {
        padding: FIT_PADDING,
        animate: true,
        duration: 0.6,
      });
    } catch {
      // ignore
    }
  }, [map, enabled, line, userInteractingRef, fitSignal]);

  return null;
}

function ClickToAdd({ enabled, onAddPoint, userInteractingRef }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      if (userInteractingRef.current) return;

      const { lat, lng } = e.latlng || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      onAddPoint?.([lat, lng]);
    },
  });

  return null;
}

export default function RouteBuilderMap({
  points = [],
  snappedLine = null,
  gps = null,
  gpsTrail = null,
  followGps = true,
  isAddingEnabled = true,
  onAddPoint,
  onUserMapInteract,
  center = [45.4642, 9.19],
  zoom = 6,
  height = 520,
  fitOnChange = true,
  poiMarkers = [],
  radarMarkers = [],
}) {
  const safePoints = useMemo(() => cleanLine(points), [points]);
  const safeSnappedLine = useMemo(() => cleanLine(snappedLine), [snappedLine]);
  const safeGpsTrail = useMemo(() => cleanLine(gpsTrail), [gpsTrail]);

  const safeGps = useMemo(() => {
    if (!isValidPoint(gps)) return null;
    return [Number(gps[0]), Number(gps[1])];
  }, [gps]);

  const safeCenter = useMemo(() => {
    if (!isValidPoint(center)) return [45.4642, 9.19];
    return [Number(center[0]), Number(center[1])];
  }, [center]);

  const line = useMemo(() => {
    return safeSnappedLine.length >= 2 ? safeSnappedLine : safePoints;
  }, [safeSnappedLine, safePoints]);

  const routeFitSignal = useMemo(() => lineKey(line), [line]);

  const userInteractingRef = useRef(false);

  useEffect(() => {
    if (followGps) {
      userInteractingRef.current = false;
    }
  }, [followGps]);

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.10)",
        position: "relative",
        background: "#dbeafe",
      }}
    >
      <MapContainer
        center={safeCenter}
        zoom={zoom}
        preferCanvas={true}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <UserInteractionWatcher
          userInteractingRef={userInteractingRef}
          followGps={followGps}
          onUserMapInteract={onUserMapInteract}
        />

        <FitOrFollow
          followGps={followGps}
          gps={safeGps}
          userInteractingRef={userInteractingRef}
        />

        <FitLineBounds
          line={line}
          enabled={fitOnChange && !(followGps && safeGps)}
          userInteractingRef={userInteractingRef}
          fitSignal={routeFitSignal}
        />

        <ClickToAdd
          enabled={isAddingEnabled}
          onAddPoint={onAddPoint}
          userInteractingRef={userInteractingRef}
        />

        {line.length >= 2 ? (
          <>
            <Polyline
              key={polyKey("route-shadow", line)}
              positions={line}
              pathOptions={{
                color: "#0f172a",
                weight: 10,
                opacity: 0.18,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              key={polyKey("route", line)}
              positions={line}
              pathOptions={{
                color: "#111827",
                weight: 5,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        ) : null}

        {safeGpsTrail.length >= 2 ? (
          <>
            <Polyline
              key={polyKey("trail-shadow", safeGpsTrail)}
              positions={safeGpsTrail}
              pathOptions={{
                color: "#38bdf8",
                weight: 12,
                opacity: 0.16,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              key={polyKey("trail", safeGpsTrail)}
              positions={safeGpsTrail}
              pathOptions={{
                color: "#0ea5e9",
                weight: 5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </>
        ) : null}

        {safePoints.map((p, idx) => (
          <Marker
            key={`wp-${idx}-${p[0]}-${p[1]}`}
            position={p}
            icon={getWaypointIcon(idx, safePoints.length)}
          >
            <Popup>
              <strong>
                {idx === 0
                  ? "Start"
                  : idx === safePoints.length - 1
                  ? "Arrivo"
                  : `Tappa ${idx}`}
              </strong>
              <br />
              {p[0].toFixed(5)}, {p[1].toFixed(5)}
            </Popup>
          </Marker>
        ))}

        {poiMarkers.map((poi) => {
          if (!poi || !Number.isFinite(Number(poi.lat)) || !Number.isFinite(Number(poi.lon))) {
            return null;
          }

          return (
            <Marker
              key={poi.id || `${poi.lat}-${poi.lon}-${poi.name || "poi"}`}
              position={[Number(poi.lat), Number(poi.lon)]}
              icon={poiIcon}
            >
              <Popup>
                <strong>{poi.name || "Punto interessante"}</strong>
                <br />
                {poi.categoryLabel || "POI"}
                {poi.distanceKm != null ? (
                  <>
                    <br />~ {Number(poi.distanceKm).toFixed(1)} km
                  </>
                ) : null}
                {poi.meta ? (
                  <>
                    <br />
                    {poi.meta}
                  </>
                ) : null}
              </Popup>
            </Marker>
          );
        })}

        {radarMarkers.map((rp) => {
          if (!rp || !isValidPoint(rp.point)) return null;

          return (
            <Marker
              key={`radar-${rp.idx}-${rp.point[0]}-${rp.point[1]}`}
              position={[Number(rp.point[0]), Number(rp.point[1])]}
              icon={getRadarIcon(rp.analysis?.score)}
            >
              <Popup>
                <strong>Radar punto #{Number(rp.idx || 0) + 1}</strong>
                <br />
                {rp.analysis?.score || "?"} — {rp.analysis?.label || "Analisi"}
                {rp.weather ? (
                  <>
                    <br />🌡 {Math.round(rp.weather.temp || 0)}°
                    <br />🌬 {Math.round(rp.weather.windKmh || 0)} km/h
                    <br />🌧 {rp.weather.rainMm || 0} mm
                    <br />
                    {rp.weather.desc || ""}
                  </>
                ) : null}
              </Popup>
            </Marker>
          );
        })}

        {safeGps ? (
          <Marker position={safeGps} icon={gpsIcon}>
            <Popup>
              <strong>Posizione attuale</strong>
              <br />
              {safeGps[0].toFixed(5)}, {safeGps[1].toFixed(5)}
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}