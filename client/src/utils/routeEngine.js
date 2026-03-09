// src/utils/routeEngine.js
// MotoPortEU — Rider Route Engine Core
// OSRM public router + normalizzazione output

const OSRM_BASE_URL =
  import.meta.env.VITE_OSRM_URL || "https://router.project-osrm.org";

function ensureLngLat(point) {
  if (!point) return null;

  // supporta vari formati comuni
  if (Array.isArray(point) && point.length >= 2) {
    const [a, b] = point;
    return [Number(a), Number(b)];
  }

  if (typeof point === "object") {
    if (
      Number.isFinite(point.lng) &&
      Number.isFinite(point.lat)
    ) {
      return [Number(point.lng), Number(point.lat)];
    }

    if (
      Number.isFinite(point.lon) &&
      Number.isFinite(point.lat)
    ) {
      return [Number(point.lon), Number(point.lat)];
    }

    if (
      Number.isFinite(point.longitude) &&
      Number.isFinite(point.latitude)
    ) {
      return [Number(point.longitude), Number(point.latitude)];
    }
  }

  return null;
}

function toCoordString(points) {
  return points.map(([lng, lat]) => `${lng},${lat}`).join(";");
}

function decodeOsrmGeometry(route) {
  if (!route?.geometry?.coordinates) return [];
  return route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}

function buildBounds(latlngs) {
  if (!latlngs?.length) return null;

  let minLat = latlngs[0].lat;
  let maxLat = latlngs[0].lat;
  let minLng = latlngs[0].lng;
  let maxLng = latlngs[0].lng;

  for (const p of latlngs) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

function segmentizeRoute(latlngs, step = 12) {
  if (!latlngs?.length) return [];

  const segments = [];
  for (let i = 0; i < latlngs.length - 1; i += step) {
    const start = latlngs[i];
    const end = latlngs[Math.min(i + step, latlngs.length - 1)];
    segments.push({
      id: `seg_${i}`,
      start,
      end,
      indexStart: i,
      indexEnd: Math.min(i + step, latlngs.length - 1),
    });
  }

  return segments;
}

function normalizeLegs(legs = []) {
  return legs.map((leg, index) => ({
    index,
    distanceMeters: leg.distance ?? 0,
    durationSeconds: leg.duration ?? 0,
    steps: (leg.steps || []).map((step, sIndex) => ({
      index: sIndex,
      distanceMeters: step.distance ?? 0,
      durationSeconds: step.duration ?? 0,
      name: step.name || "",
      mode: step.mode || "",
      maneuver: {
        type: step.maneuver?.type || "",
        modifier: step.maneuver?.modifier || "",
        location: Array.isArray(step.maneuver?.location)
          ? {
              lng: step.maneuver.location[0],
              lat: step.maneuver.location[1],
            }
          : null,
      },
    })),
  }));
}

export function formatKm(meters = 0) {
  return Number((meters / 1000).toFixed(1));
}

export function formatMin(seconds = 0) {
  return Math.round(seconds / 60);
}

export async function snapToRoad(point, signal) {
  const coord = ensureLngLat(point);
  if (!coord) throw new Error("Punto non valido per snapToRoad");

  const [lng, lat] = coord;
  const url =
    `${OSRM_BASE_URL}/nearest/v1/driving/${lng},${lat}` +
    `?number=1`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Errore rete su snapToRoad");

  const data = await res.json();
  if (data.code !== "Ok" || !data.waypoints?.length) {
    throw new Error("Snap OSRM non riuscito");
  }

  const location = data.waypoints[0]?.location;
  if (!location) throw new Error("Nessuna location da OSRM");

  return { lng: location[0], lat: location[1] };
}

export async function buildRoute(points, options = {}) {
  const { signal, annotations = false, steps = true, overview = "full" } = options;

  const clean = points
    .map(ensureLngLat)
    .filter(Boolean);

  if (clean.length < 2) {
    throw new Error("Servono almeno 2 punti per creare una rotta");
  }

  const coords = toCoordString(clean);

  const url =
    `${OSRM_BASE_URL}/route/v1/driving/${coords}` +
    `?overview=${overview}` +
    `&geometries=geojson` +
    `&steps=${steps ? "true" : "false"}` +
    `&annotations=${annotations ? "true" : "false"}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Errore rete durante buildRoute");

  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("OSRM non ha restituito una rotta valida");
  }

  const best = data.routes[0];
  const geometry = decodeOsrmGeometry(best);
  const legs = normalizeLegs(best.legs || []);
  const bounds = buildBounds(geometry);
  const segments = segmentizeRoute(geometry, 12);

  return {
    raw: data,
    distanceMeters: best.distance ?? 0,
    durationSeconds: best.duration ?? 0,
    distanceKm: formatKm(best.distance ?? 0),
    durationMin: formatMin(best.duration ?? 0),
    geometry,
    legs,
    bounds,
    segments,
    waypoints: (data.waypoints || []).map((wp, index) => ({
      index,
      name: wp.name || "",
      lng: wp.location?.[0],
      lat: wp.location?.[1],
    })),
  };
}

export async function estimateMatrix(points, options = {}) {
  const { signal } = options;

  const clean = points.map(ensureLngLat).filter(Boolean);
  if (clean.length < 2) {
    throw new Error("Servono almeno 2 punti per estimateMatrix");
  }

  const coords = toCoordString(clean);
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coords}` +
    `?annotations=duration,distance`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Errore rete durante estimateMatrix");

  const data = await res.json();
  if (data.code !== "Ok") {
    throw new Error("OSRM table non valida");
  }

  return {
    durations: data.durations || [],
    distances: data.distances || [],
  };
}