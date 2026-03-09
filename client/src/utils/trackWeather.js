// =======================================================
// src/utils/trackWeather.js
// Meteo per pista / rotta / itinerario da coordinate
// Env: VITE_OWM_KEY
// Output:
// { ok, worst, description, temp, tempMin, tempMax, windKmh, humidity, updatedAt, ride, note? }
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

function buildRideInsight({ worst, windKmh, temp }) {
  const w = String(worst || "").toLowerCase();

  if (w.includes("temporale") || w.includes("neve")) {
    return {
      level: "danger",
      label: "Condizioni critiche",
      advice: "Meglio evitare il giro in moto.",
    };
  }

  if (w.includes("pioggia")) {
    return {
      level: "warn",
      label: "Fondo potenzialmente bagnato",
      advice: "Guida prudente, frenata dolce e attenzione alle curve.",
    };
  }

  if (w.includes("nebbia")) {
    return {
      level: "warn",
      label: "Visibilità ridotta",
      advice: "Attenzione nei tratti veloci e nei cambi di luce.",
    };
  }

  if (Number.isFinite(windKmh) && windKmh >= 50) {
    return {
      level: "warn",
      label: "Vento forte",
      advice: "Prudenza su passi, viadotti e uscite di curva.",
    };
  }

  if (Number.isFinite(temp) && temp <= 3) {
    return {
      level: "warn",
      label: "Freddo intenso",
      advice: "Possibile fondo freddo o umido nei tratti in ombra.",
    };
  }

  return {
    level: "ok",
    label: "Ottimo per la guida",
    advice: "Condizioni generalmente favorevoli per il giro.",
  };
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
  const lat = toNum(
    track?.coords?.lat ??
      track?.coords?.latitude ??
      track?.lat ??
      track?.latitude
  );

  const lng = toNum(
    track?.coords?.lng ??
      track?.coords?.lon ??
      track?.coords?.longitude ??
      track?.lng ??
      track?.lon ??
      track?.longitude
  );

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

  const tempRounded = Number.isFinite(temp) ? Math.round(temp) : null;
  const windKmh = Number.isFinite(wind) ? Math.round(wind * 3.6) : null;
  const worst = normalizeMain(j.weather?.[0]?.main || j.weather?.[0]?.description);

  return {
    ok: true,
    worst,
    description: String(j.weather?.[0]?.description || "").trim() || null,
    temp: tempRounded,
    tempMin: Number.isFinite(tmin) ? Math.round(tmin) : null,
    tempMax: Number.isFinite(tmax) ? Math.round(tmax) : null,
    windKmh,
    humidity: toNum(j.main?.humidity),
    updatedAt: new Date().toISOString(),
    ride: buildRideInsight({
      worst,
      windKmh,
      temp: tempRounded,
    }),
  };
}