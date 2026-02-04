// =======================================================
// src/utils/routeWeather.js
// Meteo sul tragitto: campiona N punti lungo polyline, fallback start/end
// Env: VITE_OWM_KEY
// =======================================================
const OWM_KEY = import.meta.env.VITE_OWM_KEY;

function pickSamplePoints(polyline = [], count = 7) {
  if (!Array.isArray(polyline) || polyline.length === 0) return [];
  if (polyline.length <= count) return polyline;

  const idxs = [];
  const last = polyline.length - 1;
  for (let i = 0; i < count; i++) idxs.push(Math.round((i / (count - 1)) * last));
  return Array.from(new Set(idxs)).map((i) => polyline[i]);
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

const rank = (k) => ["sereno","nuvoloso","variabile","nebbia","pioggia","neve","temporale"].indexOf(k);

export async function getRouteWeatherSummary(route) {
  if (!OWM_KEY) return { ok: false, note: "Manca VITE_OWM_KEY (OpenWeather)." };

  // punti: polyline > start/end
  let pts = [];
  if (Array.isArray(route?.polyline) && route.polyline.length >= 2) {
    pts = pickSamplePoints(route.polyline, 7);
  } else if (route?.start?.lat && route?.end?.lat) {
    pts = [
      [route.start.lat, route.start.lng],
      [route.end.lat, route.end.lng],
    ];
  }

  if (pts.length === 0) return { ok: false, note: "Mancano polyline o start/end per calcolare meteo." };

  const calls = pts.map(([lat, lon]) =>
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OWM_KEY}&units=metric`)
      .then((r) => r.json())
  );

  const res = await Promise.allSettled(calls);
  const ok = res
    .filter((x) => x.status === "fulfilled" && x.value && !x.value.cod)
    .map((x) => x.value);

  if (!ok.length) return { ok: false, note: "Meteo non disponibile." };

  const temps = ok.map((w) => Number(w.main?.temp)).filter(Number.isFinite);
  const winds = ok.map((w) => Number(w.wind?.speed)).filter(Number.isFinite);

  const kinds = ok.map((w) => normalizeMain(w.weather?.[0]?.main)).filter(Boolean);
  let worst = "variabile";
  for (const k of kinds) if (rank(k) > rank(worst)) worst = k;

  const avg = (a) => a.reduce((s, n) => s + n, 0) / a.length;

  return {
    ok: true,
    points: ok.length,
    worst,
    temp: temps.length ? Math.round(avg(temps)) : null,
    tempMin: temps.length ? Math.round(Math.min(...temps)) : null,
    tempMax: temps.length ? Math.round(Math.max(...temps)) : null,
    windAvgKmh: winds.length ? Math.round(avg(winds) * 3.6) : null,
    windMaxKmh: winds.length ? Math.round(Math.max(...winds) * 3.6) : null,
    updatedAt: new Date().toISOString(),
  };
}
