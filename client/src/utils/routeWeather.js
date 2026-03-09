// =======================================================
// src/utils/routeWeather.js
// Meteo per Itinerari (Routes)
// Output coerente con UI Routes.jsx:
// { ok, worst, temp, tempMin, tempMax, windKmh, updatedAt, ride, note? }
// Usa OpenWeather: VITE_OWM_KEY
// =======================================================

const KEY = (import.meta.env.VITE_OWM_KEY || "").trim();

const kph = (mps) => (mps == null ? null : Math.round(Number(mps) * 3.6));
const norm = (s) => String(s || "").toLowerCase();

const pickPoint = (route) => {
  if (Array.isArray(route?.start) && route.start.length === 2) return route.start;
  if (Array.isArray(route?.end) && route.end.length === 2) return route.end;
  return null;
};

const worstLabel = (w) => {
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

function buildRideInsight({ worst, windKmh, temp }) {
  const w = String(worst || "").toLowerCase();

  if (w.includes("temporale") || w.includes("neve")) {
    return {
      level: "danger",
      label: "Condizioni critiche",
      advice: "Meglio evitare il giro in moto.",
    };
  }

  if (w.includes("pioggia") || w.includes("pioviggine")) {
    return {
      level: "warn",
      label: "Fondo potenzialmente bagnato",
      advice: "Guida prudente, occhio a pieghe, frenata e tornanti.",
    };
  }

  if (w.includes("nebbia")) {
    return {
      level: "warn",
      label: "Visibilità ridotta",
      advice: "Attenzione nei tratti esposti e nei cambi di luce.",
    };
  }

  if (Number.isFinite(windKmh) && windKmh >= 50) {
    return {
      level: "warn",
      label: "Vento forte",
      advice: "Prudenza su passi, viadotti e uscite di galleria.",
    };
  }

  if (Number.isFinite(temp) && temp <= 3) {
    return {
      level: "warn",
      label: "Freddo intenso",
      advice: "Possibile asfalto freddo o umido soprattutto in ombra.",
    };
  }

  return {
    level: "ok",
    label: "Ottimo per la guida",
    advice: "Condizioni generalmente favorevoli per il touring.",
  };
}

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
      `&units=metric` +
      `&lang=it`;

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
    const updatedAt = data?.dt
      ? new Date(Number(data.dt) * 1000).toISOString()
      : new Date().toISOString();

    return {
      ok: true,
      worst,
      temp,
      tempMin,
      tempMax,
      windKmh,
      updatedAt,
      ride: buildRideInsight({
        worst,
        windKmh,
        temp,
      }),
    };
  } catch (e) {
    return { ok: false, note: e?.message || "Errore meteo." };
  }
}