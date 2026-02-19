// =======================================================
// src/components/RouteBuilderMap.jsx
// MotoPortEU — Route Builder WOW
// ✅ Click add points + markers
// ✅ Snapped route polyline (OSRM)
// ✅ Live GPS marker + follow mode
// ✅ Fit bounds helper
// =======================================================

import React, { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Leaflet CSS + icon fix for Vite
import "leaflet/dist/leaflet.css";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: shadow,
});

// Custom small dot icon for GPS
const gpsIcon = new L.DivIcon({
  className: "",
  html: `
    <div style="
      width:14px;height:14px;border-radius:999px;
      background: #1d4ed8;
      border: 2px solid white;
      box-shadow: 0 8px 20px rgba(0,0,0,.25);
    "></div>
  `,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitTo({ points, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    if (!map) return;
    if (!points || points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 12), { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [50, 50], animate: true });
  }, [map, points, enabled]);
  return null;
}

function ClickToAdd({ onAddPoint, isEnabled }) {
  useMapEvents({
    click(e) {
      if (!isEnabled) return;
      const { lat, lng } = e.latlng;
      onAddPoint([lat, lng]);
    },
  });
  return null;
}

function FollowGps({ gps, follow }) {
  const map = useMap();
  const lastRef = useRef(null);

  useEffect(() => {
    if (!follow) return;
    if (!map) return;
    if (!gps) return;

    const key = `${gps[0].toFixed(5)}|${gps[1].toFixed(5)}`;
    if (lastRef.current === key) return;
    lastRef.current = key;

    map.setView(gps, Math.max(map.getZoom(), 14), { animate: true });
  }, [gps, follow, map]);

  return null;
}

export default function RouteBuilderMap({
  points,
  snappedLine, // array of [lat,lng] (optional)
  gps, // [lat,lng] (optional)
  followGps = false,
  onAddPoint,
  isAddingEnabled = true,
  center = [45.4642, 9.19],
  zoom = 6,
  height = 520,
  fitOnChange = true,
}) {
  const line = useMemo(() => {
    if (snappedLine && snappedLine.length >= 2) return snappedLine;
    return points || [];
  }, [snappedLine, points]);

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 14px 40px rgba(0,0,0,0.22)",
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.6)",
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ClickToAdd onAddPoint={onAddPoint} isEnabled={isAddingEnabled} />
        <FitTo points={line.length ? line : points} enabled={fitOnChange} />

        {/* Waypoints markers */}
        {points?.map((p, idx) => (
          <Marker key={`pt-${idx}-${p[0].toFixed(5)}-${p[1].toFixed(5)}`} position={p} />
        ))}

        {/* Route line (snapped preferred) */}
        {line.length >= 2 && <Polyline positions={line} />}

        {/* GPS marker */}
        {gps && <Marker position={gps} icon={gpsIcon} />}

        <FollowGps gps={gps} follow={followGps} />
      </MapContainer>
    </div>
  );
}