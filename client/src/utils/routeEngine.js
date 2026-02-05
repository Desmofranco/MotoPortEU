// client/src/utils/routeEngine.js
// C-lite routing:
// - ROAD: OSRM demo (no key) -> ok per click-on-demand (non spam)
// - OFFROAD: OpenRouteService se hai VITE_ORS_KEY; altrimenti fallback OSRM

const OSRM = "https://router.project-osrm.org";
const ORS = "https://api.openrouteservice.org";

function toLonLat({ lat, lng }) {
  return `${lng},${lat}`;
}

function flattenCoords(geojson) {
  // GeoJSON from OSRM/ORS -> LineString coords [lon,lat]
  const coords = geojson?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) return [];
  return coords.map(([lon, lat]) => ({ lat, lng: lon }));
}

export async function routeRoad(points) {
  // OSRM route/v1/driving/{lon,lat;lon,lat...}
  const coords = points.map(toLonLat).join(";");
  const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`OSRM HTTP ${r.status}`);
  const data = await r.json();

  const geo = data?.routes?.[0]?.geometry;
  if (!geo) throw new Error("OSRM: geometry mancante");

  return {
    ok: true,
    provider: "osrm",
    distanceKm: (data.routes[0].distance || 0) / 1000,
    durationMin: (data.routes[0].duration || 0) / 60,
    line: geo.coordinates.map(([lon, lat]) => ({ lat, lng: lon })),
  };
}

export async function routeOffroad(points) {
  const key = import.meta.env.VITE_ORS_KEY;

  // Se non hai key, fallback (meglio che bloccare)
  if (!key) {
    const road = await routeRoad(points);
    return { ...road, provider: "osrm-fallback", note: "Off-road: manca VITE_ORS_KEY, uso OSRM road." };
  }

  // ORS Directions v2 in GeoJSON: /v2/directions/{profile}/geojson
  // Profilo "cycling-mountain" = più adatto a sterrati/MTB (offroad-ish).
  const profile = "cycling-mountain";
  const body = {
    coordinates: points.map((p) => [p.lng, p.lat]),
  };

  const url = `${ORS}/v2/directions/${profile}/geojson`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": key,
      "Content-Type": "application/json",
      "Accept": "application/geo+json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`ORS HTTP ${r.status}`);

  const geo = await r.json();
  const line = flattenCoords(geo);
  if (!line.length) throw new Error("ORS: geometry vuota");

  // ORS summary
  const summary = geo?.features?.[0]?.properties?.summary || {};
  return {
    ok: true,
    provider: "ors",
    distanceKm: (summary.distance || 0) / 1000,
    durationMin: (summary.duration || 0) / 60,
    line,
  };
}

// Link rapido Google Maps (dir) per debug/UX
export function googleDirHref(points) {
  const parts = points.map((p) => `${p.lat},${p.lng}`);
  return `https://www.google.com/maps/dir/${parts.join("/")}`;
}
