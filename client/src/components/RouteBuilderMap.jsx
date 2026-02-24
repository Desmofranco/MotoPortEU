// =======================================================
// src/components/RouteBuilderMap.jsx
// Leaflet wrapper: Route Builder + GPS + Trail
// ✅ click per aggiungere punti
// ✅ disegna snappedLine / points
// ✅ marker GPS
// ✅ gpsTrail polyline (scia live)
// ✅ FIX: fitBounds su linea + key su polylines per forzare update
// =======================================================

import React, { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix icone default (Vite + Leaflet)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitOrFollow({ center, zoom, fitOnChange, followGps, gps }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // follow GPS (soft)
    if (followGps && gps) {
      map.setView(gps, Math.max(map.getZoom(), 13), { animate: true });
      return;
    }

    // fallback view
    if (fitOnChange && center && zoom) {
      map.setView(center, zoom, { animate: true });
    }
  }, [map, center, zoom, fitOnChange, followGps, gps]);

  return null;
}

function FitLineBounds({ line, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;
    if (!map) return;
    if (!line || line.length < 2) return;

    try {
      map.fitBounds(line, { padding: [30, 30] });
    } catch {
      // ignore
    }
  }, [map, enabled, line]);

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
}) {
  const line = useMemo(
    () => (snappedLine && snappedLine.length >= 2 ? snappedLine : points),
    [snappedLine, points]
  );

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

        {/* follow GPS or set initial view */}
        <FitOrFollow
          center={center}
          zoom={zoom}
          fitOnChange={fitOnChange}
          followGps={followGps}
          gps={gps}
        />

        {/* auto-fit when route changes (works also after save/load) */}
        <FitLineBounds line={line} enabled={fitOnChange && !(followGps && gps)} />

        {/* add points by click */}
        <ClickToAdd enabled={isAddingEnabled} onAddPoint={onAddPoint} />

        {/* Route line */}
        {line && line.length >= 2 ? (
          <Polyline key={polyKey("route", line)} positions={line} />
        ) : null}

        {/* GPS Trail (scia live) */}
        {gpsTrail && gpsTrail.length >= 2 ? (
          <Polyline key={polyKey("trail", gpsTrail)} positions={gpsTrail} />
        ) : null}

        {/* GPS marker */}
        {gps ? <Marker position={gps} /> : null}
      </MapContainer>
    </div>
  );
}