// =======================================================
// src/utils/trackWeather.js
// Meteo per pista / rotta / itinerario da coordinate
// Env: VITE_OWM_KEY
// =======================================================

const OWM_KEY = (import.meta.env.VITE_OWM_KEY || "").trim();

function normalizeMain(m) {
  const s = String(m || "").toLowerCase();
  if (s.includes("thunder")) return "temporale";
  if (s.includes("snow")) return "neve";
  if (s.includes("rain") || s.includes("drizzle")) return "pioggia";
  if (s.includes("fog") || s.includes("mist") || s.includes("haze")) return "nebbia";
  if (s.includes("cloud")) return "nuvoloso";
  if (s.includes("clear")) return "sereno";
  return s || "variabile";
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function fetchOWM(lat, lon, timeoutMs = 9000) {
  if (!OWM_KEY) return null;

  const url =
    `https://api.openweathermap.org/data/2.5/weather` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&appid=${encodeURIComponent(OWM_KEY)}` +
    `&units=metric` +
    `&lang=it`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
    });

    if (!r.ok) {
      return {
        _httpError: true,
        status: r.status,
      };
    }

    const j = await r.json().catch(() => null);
    return j;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

function okOWM(j) {
  if (!j || typeof j !== "object") return false;
  if (j._httpError) return false;

  const cod = j.cod;
  if (cod === 200 || cod === "200") return true;

  return !!(j.main && Array.isArray(j.weather) && j.weather.length > 0);
}

export async function getTrackWeatherSummary(track) {
  const lat = toNum(track?.coords?.lat ?? track?.coords?.latitude);
  const lng = toNum(track?.coords?.lng ?? track?.coords?.lon ?? track?.coords?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      ok: false,
      note: "Meteo non disponibile.",
    };
  }

  if (!OWM_KEY) {
    return {
      ok: false,
      note: "Meteo non disponibile.",
    };
  }

  const j = await fetchOWM(lat, lng);

  if (!okOWM(j)) {
    return {
      ok: false,
      note: "Meteo non disponibile.",
    };
  }

  const temp = toNum(j.main?.temp);
  const tmin = toNum(j.main?.temp_min);
  const tmax = toNum(j.main?.temp_max);
  const wind = toNum(j.wind?.speed);

  return {
    ok: true,
    worst: normalizeMain(j.weather?.[0]?.main || j.weather?.[0]?.description),
    description: String(j.weather?.[0]?.description || "").trim() || null,
    temp: Number.isFinite(temp) ? Math.round(temp) : null,
    tempMin: Number.isFinite(tmin) ? Math.round(tmin) : null,
    tempMax: Number.isFinite(tmax) ? Math.round(tmax) : null,
    windKmh: Number.isFinite(wind) ? Math.round(wind * 3.6) : null,
    humidity: toNum(j.main?.humidity),
    updatedAt: new Date().toISOString(),
  };
}