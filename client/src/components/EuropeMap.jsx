import { MapContainer, TileLayer } from "react-leaflet";

// Bounding box Europa (west, south, east, north)
const EUROPE_BOUNDS = [
  [34.5, -11.0], // SW: sud (Marocco escluso) / ovest Portogallo
  [72.5, 40.0],  // NE: nord Scandinavia / est (fino area Mar Nero)
];

// Centro “comodo” per Europa
const EUROPE_CENTER = [50.5, 10.0];

export default function EuropeMap() {
  return (
    <div style={{ height: "calc(100vh - 64px)", width: "100%" }}>
      <MapContainer
        center={EUROPE_CENTER}
        zoom={5}
        minZoom={4}
        maxZoom={18}
        maxBounds={EUROPE_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>
    </div>
  );
}
