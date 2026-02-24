// =======================================================
// src/utils/routeWeather.js
// Meteo per Itinerari (Routes)
// Output coerente con UI Routes.jsx:
// { ok, worst, temp, tempMin, tempMax, windKmh, updatedAt, note? }
// Usa OpenWeather: VITE_OWM_KEY
// =======================================================

const KEY = import.meta.env.VITE_OWM_KEY;

const kph = (mps) => (mps == null ? null : Math.round(Number(mps) * 3.6));

const pickPoint = (route) => {
  // prefer start, fallback end
  if (Array.isArray(route?.start) && route.start.length === 2) return route.start;
  if (Array.isArray(route?.end) && route.end.length === 2) return route.end;
  return null;
};

const norm = (s) => String(s || "").toLowerCase();

const worstLabel = (w) => {
  // Traduzione semplice IT (puoi espandere quando vuoi)
  const x = norm(w);
  if (!x) return "—";
  if (x.includes("clear")) return "sereno";
  if (x.includes("cloud")) return "nuvoloso";
  if (x.includes("rain")) return "pioggia";
  if (x.includes("drizzle")) return "pioviggine";
  if (x.includes("thunder")) return "temporale";
  if (x.includes("snow")) return "neve";
  if (x.includes("mist") || x.includes("fog") || x.includes("haze")) return "nebbia";
  return x;
};

export async function getRouteWeatherSummary(route) {
  try {
    if (!KEY) {
      return { ok: false, note: "Chiave OpenWeather mancante (VITE_OWM_KEY)." };
    }

    const p = pickPoint(route);
    if (!p) return { ok: false, note: "Coordinate itinerario mancanti." };

    const [lat, lon] = p;

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&appid=${encodeURIComponent(KEY)}` +
      `&units=metric`;

    const res = await fetch(url);
    if (!res.ok) return { ok: false, note: "Meteo non disponibile." };

    const data = await res.json();

    const main = data?.main || {};
    const wind = data?.wind || {};
    const weather0 = Array.isArray(data?.weather) ? data.weather[0] : null;

    const temp = main?.temp != null ? Math.round(Number(main.temp)) : null;
    const tempMin = main?.temp_min != null ? Math.round(Number(main.temp_min)) : null;
    const tempMax = main?.temp_max != null ? Math.round(Number(main.temp_max)) : null;

    const windKmh = kph(wind?.speed);

    const raw = weather0?.main || weather0?.description || "";
    const worst = worstLabel(raw);

    // OpenWeather: dt è unix seconds
    const updatedAt = data?.dt ? new Date(Number(data.dt) * 1000).toISOString() : new Date().toISOString();

    return {
      ok: true,
      worst,
      temp,
      tempMin,
      tempMax,
      windKmh,
      updatedAt,
    };
  } catch (e) {
    return { ok: false, note: e?.message || "Errore meteo." };
  }
}