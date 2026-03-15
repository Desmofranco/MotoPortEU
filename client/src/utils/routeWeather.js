// =======================================================
// src/utils/routeWeather.js
// Meteo per Itinerari (Routes)
// Output coerente con UI Routes.jsx:
// { ok, worst, temp, tempMin, tempMax, windKmh, updatedAt, ride, note? }
// Usa OpenWeather: VITE_OWM_KEY
// ✅ Fallback coordinate avanzato per itinerari incompleti / OSM / GeoJSON
// ✅ Ride insight adattivo: touring / sport / enduro / off-road
// =======================================================

const KEY = (import.meta.env.VITE_OWM_KEY || "").trim();

const kph = (mps) => (mps == null ? null : Math.round(Number(mps) * 3.6));
const norm = (s) => String(s || "").toLowerCase();

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pairFrom = (a, b) => {
  const lat = toNum(a);
  const lon = toNum(b);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
};

const pickPoint = (route) => {
  // 1) start / end classici
  if (Array.isArray(route?.start) && route.start.length >= 2) {
    const p = pairFrom(route.start[0], route.start[1]);
    if (p) return p;
  }

  if (Array.isArray(route?.end) && route.end.length >= 2) {
    const p = pairFrom(route.end[0], route.end[1]);
    if (p) return p;
  }

  // 2) center come array [lat, lon]
  if (Array.isArray(route?.center) && route.center.length >= 2) {
    const p = pairFrom(route.center[0], route.center[1]);
    if (p) return p;
  }

  // 3) center object
  {
    const p = pairFrom(
      route?.center?.lat ?? route?.center?.latitude,
      route?.center?.lon ?? route?.center?.lng ?? route?.center?.longitude
    );
    if (p) return p;
  }

  // 4) coords object
  {
    const p = pairFrom(
      route?.coords?.lat ?? route?.coords?.latitude,
      route?.coords?.lon ?? route?.coords?.lng ?? route?.coords?.longitude
    );
    if (p) return p;
  }

  // 5) lat/lon diretti
  {
    const p = pairFrom(
      route?.lat ?? route?.latitude,
      route?.lon ?? route?.lng ?? route?.longitude
    );
    if (p) return p;
  }

  // 6) waypoint iniziale
  if (Array.isArray(route?.waypoints) && route.waypoints.length) {
    const w0 = route.waypoints[0];

    if (Array.isArray(w0) && w0.length >= 2) {
      const p = pairFrom(w0[0], w0[1]);
      if (p) return p;
    }

    {
      const p = pairFrom(
        w0?.lat ?? w0?.latitude,
        w0?.lon ?? w0?.lng ?? w0?.longitude
      );
      if (p) return p;
    }
  }

  // 7) geometry.coordinates GeoJSON [lon, lat]
  if (
    Array.isArray(route?.geometry?.coordinates) &&
    route.geometry.coordinates.length
  ) {
    const c0 = route.geometry.coordinates[0];

    // LineString -> [lon, lat]
    if (Array.isArray(c0) && c0.length >= 2 && !Array.isArray(c0[0])) {
      const p = pairFrom(c0[1], c0[0]);
      if (p) return p;
    }

    // MultiLineString -> [[lon, lat], ...]
    if (Array.isArray(c0) && Array.isArray(c0[0]) && c0[0].length >= 2) {
      const p = pairFrom(c0[0][1], c0[0][0]);
      if (p) return p;
    }
  }

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

function normalizeRouteMode(route) {
  const rawType = norm(route?.type);
  const rawCategory = norm(route?.category);
  const rawStyle = norm(route?.style);
  const rawPace = norm(route?.pace);
  const rawSurface = norm(route?.surface);
  const rawName = norm(route?.name);
  const rawRegion = norm(route?.region);

  const curves = Number(route?.curvesScore || 0);
  const asphalt = Number(route?.asphaltScore || 0);

  const blob = [
    rawType,
    rawCategory,
    rawStyle,
    rawPace,
    rawSurface,
    rawName,
    rawRegion,
  ]
    .filter(Boolean)
    .join(" ");

  const hasAny = (arr) => arr.some((k) => blob.includes(k));

  // ---------------------------------------------------
  // CROSS / OFFROAD
  // ---------------------------------------------------
  if (
    hasAny([
      "offroad",
      "off-road",
      "cross",
      "motocross",
      "autocross",
      "autokros",
      "autokrosova",
      "autokrosová",
      "mx",
      "dirt",
      "dirt track",
      "trail",
      "sterrato",
      "ghiaia",
      "gravel",
      "mud",
      "fango",
      "sand",
      "sabbia",
      "terrain",
      "earth",
      "soil",
      "4x4",
      "quad track",
    ])
  ) {
    return "offroad";
  }

  if (
    ["offroad", "off-road", "cross", "motocross", "mx", "dirt"].includes(rawType) ||
    ["offroad", "off-road", "cross", "motocross", "mx", "dirt"].includes(rawCategory)
  ) {
    return "offroad";
  }

  if (
    ["dirt", "gravel", "mud", "sand", "terrain", "soil", "earth"].some((k) =>
      rawSurface.includes(k)
    )
  ) {
    return "offroad";
  }

  // se l’asfalto è quasi nullo, spingi verso offroad
  if (asphalt > 0 && asphalt <= 3) {
    return "offroad";
  }

  // ---------------------------------------------------
  // ENDURO / ADVENTURE
  // ---------------------------------------------------
  if (
    hasAny([
      "enduro",
      "adventure",
      "adv",
      "dual sport",
      "dual-sport",
      "dualsport",
      "rally",
      "maxi-enduro",
      "trail ride",
      "adventure bike",
    ])
  ) {
    return "enduro";
  }

  if (
    ["enduro", "adventure", "adv", "dual-sport", "dualsport", "rally"].includes(rawType) ||
    ["enduro", "adventure", "adv", "dual-sport", "dualsport", "rally"].includes(rawCategory)
  ) {
    return "enduro";
  }

  // fondo misto e asfalto medio-basso = più enduro che touring
  if (
    (rawSurface.includes("mixed") || rawSurface.includes("gravel")) &&
    asphalt > 3 &&
    asphalt <= 6
  ) {
    return "enduro";
  }

  // ---------------------------------------------------
  // SPORT / STRADA TECNICA
  // ---------------------------------------------------
  if (
    hasAny([
      "sport",
      "sporty",
      "twisty",
      "performance",
      "tecnico",
      "dinamica",
      "guida dinamica",
      "fast road",
      "race road",
      "twisties",
      "mountain pass",
      "passo",
      "stelvio",
      "gavia",
      "futa",
      "muraglione",
    ])
  ) {
    return "sport";
  }

  if (
    ["sport", "sporty", "twisty", "performance"].includes(rawType) ||
    ["sport", "sporty", "twisty", "performance"].includes(rawCategory) ||
    rawPace.includes("tecnico") ||
    rawPace.includes("sport")
  ) {
    return "sport";
  }

  if ((curves >= 8 && asphalt >= 7) || (rawPace.includes("tecnico") && asphalt >= 6)) {
    return "sport";
  }

  // ---------------------------------------------------
  // TOURING
  // ---------------------------------------------------
  return "touring";
}
export async function getRouteWeatherSummary(route) {
  try {
    if (!KEY) {
      return { ok: false, note: "Chiave OpenWeather mancante (VITE_OWM_KEY)." };
    }

    const p = pickPoint(route);
    if (!p) {
      return { ok: false, note: "Coordinate itinerario mancanti." };
    }

    const [lat, lon] = p;

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${encodeURIComponent(lat)}` +
      `&lon=${encodeURIComponent(lon)}` +
      `&appid=${encodeURIComponent(KEY)}` +
      `&units=metric` +
      `&lang=it`;

    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, note: "Meteo non disponibile." };
    }

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
        route,
        worst,
        windKmh,
        temp,
      }),
    };
  } catch (e) {
    return { ok: false, note: e?.message || "Errore meteo." };
  }
}