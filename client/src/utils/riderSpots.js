// =======================================================
// client/src/utils/riderSpots.js
// MotoPortEU — Rider Spots Engine FIXED
// ✅ fetch stabile
// ✅ cache locale (no reload infinito)
// ✅ distanza corretta
// ✅ filtro intelligente (no "vuoto sempre")
// =======================================================

let _cache = null;

// --- LOAD DATA (con cache) ---
export async function loadRiderSpots() {
  if (_cache) return _cache;

  try {
    const res = await fetch("/data/rider-spots.cleaned.json");
    if (!res.ok) {
      throw new Error(`Errore fetch rider spots (${res.status})`);
    }

    const data = await res.json();
    _cache = Array.isArray(data) ? data : [];

    return _cache;
  } catch (err) {
    console.error("RiderSpots load error:", err);
    return [];
  }
}

// --- DISTANZA ---
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

// --- CORE FUNCTION ---
// 🔥 QUESTA È QUELLA USATA DA MAP.JSX
export function getNearbyRiderSpots(center, radiusKm = 120, limit = 15) {
  if (!_cache || !_cache.length) return [];

  const lat = Number(center?.[0]);
  const lng = Number(center?.[1]);
  const radius = Number(radiusKm);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  const results = _cache
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
    .filter((s) => Number.isFinite(s.distanceKm))
    .sort((a, b) => {
      // distanza prima
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;

      // poi qualità rider
      return (b.riderScore || 0) - (a.riderScore || 0);
    });

  // 🔥 FIX CRITICO: fallback se filtro troppo stretto
  const filtered = results.filter((s) => s.distanceKm <= radius);

  if (filtered.length > 0) {
    return filtered.slice(0, limit);
  }

  // 👉 fallback: mostra comunque i più vicini (evita "nessuno trovato")
  return results.slice(0, limit);
}