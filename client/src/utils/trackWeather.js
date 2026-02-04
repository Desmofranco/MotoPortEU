// =======================================================
// src/utils/trackWeather.js
// Meteo per pista: 1 punto (track.coords)
// Env: VITE_OWM_KEY
// =======================================================
const OWM_KEY = import.meta.env.VITE_OWM_KEY;

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

async function fetchOWM(lat, lon, timeoutMs = 9000) {
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(OWM_KEY)}&units=metric`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, { signal: ctrl.signal });
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
  const cod = j.cod;
  if (cod === 200 || cod === "200") return true;
  if (j.main && j.weather && Array.isArray(j.weather)) return true;
  return false;
}

export async function getTrackWeatherSummary(track) {
  if (!OWM_KEY) return { ok: false, note: "Manca VITE_OWM_KEY (OpenWeather)." };

  const lat = Number(track?.coords?.lat ?? track?.coords?.latitude);
  const lng = Number(track?.coords?.lng ?? track?.coords?.lon ?? track?.coords?.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, note: "Mancano coords {lat,lng} per calcolare il meteo." };
  }

  const j = await fetchOWM(lat, lng);
  if (!okOWM(j)) return { ok: false, note: "Meteo non disponibile." };

  const temp = Number(j.main?.temp);
  const tmin = Number(j.main?.temp_min);
  const tmax = Number(j.main?.temp_max);
  const wind = Number(j.wind?.speed);

  return {
    ok: true,
    worst: normalizeMain(j.weather?.[0]?.main),
    temp: Number.isFinite(temp) ? Math.round(temp) : null,
    tempMin: Number.isFinite(tmin) ? Math.round(tmin) : null,
    tempMax: Number.isFinite(tmax) ? Math.round(tmax) : null,
    windKmh: Number.isFinite(wind) ? Math.round(wind * 3.6) : null,
    updatedAt: new Date().toISOString(),
  };
}
