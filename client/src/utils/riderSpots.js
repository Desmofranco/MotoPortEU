// client/src/utils/riderSpots.js

export async function loadRiderSpots() {
  const res = await fetch("/data/rider-spots.cleaned.json");
  if (!res.ok) {
    throw new Error(`Impossibile caricare rider-spots.cleaned.json (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function toRad(v) {
  return (Number(v) * Math.PI) / 180;
}

export function distanceKm(aLat, aLng, bLat, bLng) {
  const lat1 = Number(aLat);
  const lng1 = Number(aLng);
  const lat2 = Number(bLat);
  const lng2 = Number(bLng);

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return Infinity;
  }

  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

export function findNearbyRiderSpots(spots, centerLat, centerLng, radiusKm = 120, limit = 15) {
  const lat = Number(centerLat);
  const lng = Number(centerLng);
  const radius = Number(radiusKm);

  if (!Array.isArray(spots) || !spots.length) return [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  if (!Number.isFinite(radius) || radius <= 0) return [];

  const results = spots
    .map((spot) => {
      const spotLat = Number(spot?.lat);
      const spotLng = Number(spot?.lng ?? spot?.lon);
      const dist = distanceKm(lat, lng, spotLat, spotLng);

      return {
        ...spot,
        lat: spotLat,
        lng: spotLng,
        distanceKm: dist,
      };
    })
    .filter((spot) => Number.isFinite(spot.distanceKm))
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return (b.riderScore || 0) - (a.riderScore || 0);
    });

  const filtered = results.filter((spot) => spot.distanceKm <= radius);

  return (filtered.length ? filtered : results).slice(0, limit);
}