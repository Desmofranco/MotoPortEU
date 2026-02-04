// =======================================================
// src/utils/routeWeather.js
// Meteo sul tragitto: campiona N punti lungo polyline,
// fallback: start/end (array [lat,lng] o object {lat,lng})
// Env: VITE_OWM_KEY
// =======================================================
const OWM_KEY = import.meta.env.VITE_OWM_KEY;

function asLatLng(v) {
  // accetta [lat,lng] oppure {lat,lng}/{lat,lon}/{latitude,longitude}
  if (Array.isArray(v) && v.length >= 2) {
    const lat = Number(v[0]);
    const lng = Number(v[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  if (v && typeof v === "object") {
    const lat = Number(v.lat ?? v.latitude);
    const lng = Number(v.lng ?? v.lon ?? v.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  return null;
}

function pickSamplePoints(polyline = [], count = 7) {
  if (!Array.isArray(polyline) || polyline.length === 0) return [];
  const norm = polyline.map(asLatLng).filter(Boolean);
  if (norm.length === 0) return [];
  if (norm.length <= count) return norm;

  const idxs = [];
  const last = norm.length - 1;
  for (let i = 0; i < count; i++) idxs.push(Math.round((i / (count - 1)) * last));
  return Array.from(new Set(idxs)).map((i) => norm[i]);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sampleBetween(start, end, count = 7) {
  const s = asLatLng(start);
  const e = asLatLng(end);
  if (!s || !e) return [];
  const pts = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    pts.push([lerp(s[0], e[0], t), lerp(s[1], e[1], t)]);
  }
  return pts;
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

const order = ["sereno", "nuvoloso", "variabile", "nebbia", "pioggia", "neve", "temporale"];
const rank = (k) => Math.max(0, order.indexOf(k));

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
  // OpenWeather: successo = cod 200 (number o string)
  if (cod === 200 || cod === "200") return true;
  // fallback (alcune risposte possono non avere cod ma avere main/weather)
  if (j.main && j.weather && Array.isArray(j.weather)) return true;
  return false;
}

const avg = (a) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : null);

export async function getRouteWeatherSummary(route) {
  if (!OWM_KEY) return { ok: false, note: "Manca VITE_OWM_KEY (OpenWeather)." };

  // 1) punti: polyline > start/end (campionati)
  let pts = [];
  if (Array.isArray(route?.polyline) && route.polyline.length >= 2) {
    pts = pickSamplePoints(route.polyline, 7);
  } else if (route?.start && route?.end) {
    pts = sampleBetween(route.start, route.end, 7);
  }

  if (!pts.length) return { ok: false, note: "Mancano polyline o start/end per calcolare meteo." };

  // 2) fetch
  const res = await Promise.allSettled(
    pts.map(([lat, lon]) => fetchOWM(lat, lon, 9000))
  );

  const ok = res
    .filter((x) => x.status === "fulfilled" && okOWM(x.value))
    .map((x) => x.value);

  if (!ok.length) return { ok: false, note: "Meteo non disponibile." };

  const temps = ok.map((w) => Number(w.main?.temp)).filter(Number.isFinite);
  const winds = ok.map((w) => Number(w.wind?.speed)).filter(Number.isFinite);

  const kinds = ok.map((w) => normalizeMain(w.weather?.[0]?.main)).filter(Boolean);
  let worst = "variabile";
  for (const k of kinds) if (rank(k) > rank(worst)) worst = k;

  const tAvg = avg(temps);
  const wAvg = avg(winds);

  return {
    ok: true,
    points: ok.length,
    worst,
    temp: tAvg !== null ? Math.round(tAvg) : null,
    tempMin: temps.length ? Math.round(Math.min(...temps)) : null,
    tempMax: temps.length ? Math.round(Math.max(...temps)) : null,
    windAvgKmh: wAvg !== null ? Math.round(wAvg * 3.6) : null,
    windMaxKmh: winds.length ? Math.round(Math.max(...winds) * 3.6) : null,
    updatedAt: new Date().toISOString(),
  };
}
