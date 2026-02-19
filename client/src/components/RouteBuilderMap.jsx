// =======================================================
// src/components/RouteBuilderMap.jsx
// MotoPortEU — Route Builder V1
// - Click sulla mappa: aggiunge punti
// - Marker + Polyline
// - Undo / Clear
// - Fit bounds automatico (quando ci sono punti)
// =======================================================

import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Fix icone Leaflet (spesso risultano "rotte" con Vite)
// Se nel tuo progetto sono già fixate altrove, non succede nulla.
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

function FitToPoints({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (!points || points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 11), { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [40, 40], animate: true });
  }, [map, points]);

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

export default function RouteBuilderMap({
  points,
  onAddPoint,
  onMapReady,
  isAddingEnabled = true,
  center = [45.4642, 9.19], // Milano
  zoom = 6,
  height = "62vh",
}) {
  const polyline = useMemo(() => (points?.length ? points : []), [points]);

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
      }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        whenReady={(ctx) => {
          try {
            onMapReady?.(ctx?.target);
          } catch {
            // ignore
          }
        }}
      >
        <TileLayer
          // OSM standard
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ClickToAdd onAddPoint={onAddPoint} isEnabled={isAddingEnabled} />
        <FitToPoints points={points} />

        {points?.map((p, idx) => (
          <Marker key={`pt-${idx}-${p[0].toFixed(5)}-${p[1].toFixed(5)}`} position={p} />
        ))}

        {polyline.length >= 2 && <Polyline positions={polyline} />}
      </MapContainer>
    </div>
  );
}