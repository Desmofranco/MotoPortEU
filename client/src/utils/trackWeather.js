// =======================================================
// src/utils/trackWeather.js
// OpenWeather One Call 3.0
// Meteo per pista / itinerario / rotta da coordinate
// Env richiesto: VITE_OWM_KEY
// =======================================================

const OWM_KEY = (import.meta.env.VITE_OWM_KEY || "").trim();

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

function pickCoords(track) {
  const lat = toNum(track?.coords?.lat ?? track?.coords?.latitude);
  const lng = toNum(track?.coords?.lng ?? track?.coords?.lon ?? track?.coords?.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
}

async function fetchOneCall(lat, lon, timeoutMs = 10000) {
  if (!OWM_KEY) {
    return { ok: false, reason: "missing_key" };
  }

  const url =
    `https://api.openweathermap.org/data/3.0/onecall` +
    `?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}` +
    `&appid=${encodeURIComponent(OWM_KEY)}` +
    `&units=metric` +
    `&lang=it` +
    `&exclude=minutely,alerts`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
    });

    const text = await res.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      return {
        ok: false,
        reason: "http_error",
        status: res.status,
        body: json || text || null,
      };
    }

    if (!json || typeof json !== "object") {
      return { ok: false, reason: "bad_json" };
    }

    if (!json.current) {
      return { ok: false, reason: "missing_current", body: json };
    }

    return { ok: true, data: json };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "network_error" };
  } finally {
    clearTimeout(to);
  }
}

export async function getTrackWeatherSummary(track) {
  const coords = pickCoords(track);

  if (!coords) {
    return {
      ok: false,
      note: "Meteo non disponibile.",
    };
  }

  const result = await fetchOneCall(coords.lat, coords.lng);

  if (!result.ok) {
    return {
      ok: false,
      note: "Meteo non disponibile.",
      debugReason: result.reason || null,
      debugStatus: result.status || null,
      debugBody: result.body || null,
    };
  }

  const current = result.data.current || {};
  const daily0 = Array.isArray(result.data.daily) ? result.data.daily[0] : null;
  const hourly0 = Array.isArray(result.data.hourly) ? result.data.hourly[0] : null;
  const weather0 = current.weather?.[0] || hourly0?.weather?.[0] || daily0?.weather?.[0] || null;

  const temp = toNum(current.temp);
  const feels = toNum(current.feels_like);
  const wind = toNum(current.wind_speed);
  const humidity = toNum(current.humidity);
  const pop = toNum(hourly0?.pop ?? daily0?.pop);

  const tempMin = toNum(daily0?.temp?.min);
  const tempMax = toNum(daily0?.temp?.max);

  return {
    ok: true,
    worst: normalizeMain(weather0?.main || weather0?.description),
    description: String(weather0?.description || "").trim() || null,
    temp: Number.isFinite(temp) ? Math.round(temp) : null,
    feelsLike: Number.isFinite(feels) ? Math.round(feels) : null,
    tempMin: Number.isFinite(tempMin) ? Math.round(tempMin) : null,
    tempMax: Number.isFinite(tempMax) ? Math.round(tempMax) : null,
    windKmh: Number.isFinite(wind) ? Math.round(wind * 3.6) : null,
    humidity: Number.isFinite(humidity) ? humidity : null,
    popPct: Number.isFinite(pop) ? Math.round(pop * 100) : null,
    updatedAt: new Date().toISOString(),
  };
}