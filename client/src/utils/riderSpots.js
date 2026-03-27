export async function loadRiderSpots() {
  const res = await fetch("/data/rider-spots.cleaned.json");
  if (!res.ok) {
    throw new Error(`Impossibile caricare rider-spots.cleaned.json (${res.status})`);
  }
  return res.json();
}

function toRad(v) {
  return (v * Math.PI) / 180;
}

export function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) *
      Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

export function findNearbyRiderSpots(spots, lat, lng, radiusKm = 120, limit = 12) {
  if (!Array.isArray(spots)) return [];

  return spots
    .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
    .map((s) => ({
      ...s,
      distanceKm: distanceKm(lat, lng, Number(s.lat), Number(s.lng)),
    }))
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => {
      if ((b.riderScore || 0) !== (a.riderScore || 0)) {
        return (b.riderScore || 0) - (a.riderScore || 0);
      }
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, limit);
}