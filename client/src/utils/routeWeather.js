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
  const raw = String(
    route?.type || route?.category || route?.style || route?.pace || ""
  )
    .trim()
    .toLowerCase();

  const blob = [
    route?.name,
    route?.region,
    route?.description,
    route?.type,
    route?.category,
    route?.style,
    route?.pace,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasAny = (arr) => arr.some((k) => blob.includes(k));

  if (
    hasAny([
      "offroad",
      "off-road",
      "cross",
      "motocross",
      "mx",
      "dirt",
      "trail",
      "sterrato",
      "ghiaia",
    ])
  ) {
    return "offroad";
  }

  if (
    hasAny([
      "enduro",
      "adventure",
      "adv",
      "dual sport",
      "dual-sport",
      "rally",
      "maxi-enduro",
    ])
  ) {
    return "enduro";
  }

  if (
    hasAny([
      "sport",
      "sporty",
      "twisty",
      "performance",
      "tecnico",
      "dinamica",
      "guida dinamica",
    ])
  ) {
    return "sport";
  }

  if (raw.includes("tecnico")) return "sport";

  return "touring";
}

function buildRideInsight({ route, worst, windKmh, temp }) {
  const w = String(worst || "").toLowerCase();
  const mode = normalizeRouteMode(route);

  const isStorm = w.includes("temporale");
  const isSnow = w.includes("neve");
  const isRain = w.includes("pioggia") || w.includes("pioviggine");
  const isFog = w.includes("nebbia");

  const strongWind = Number.isFinite(windKmh) && windKmh >= 50;
  const veryStrongWind = Number.isFinite(windKmh) && windKmh >= 65;
  const cold = Number.isFinite(temp) && temp <= 3;
  const veryCold = Number.isFinite(temp) && temp <= 0;

  // ---------------------------------------------------
  // PERICOLO ALTO
  // ---------------------------------------------------
  if (isStorm || isSnow) {
    if (mode === "offroad" || mode === "enduro") {
      return {
        level: "danger",
        label: "Off-road sconsigliato",
        advice:
          "Con temporale o neve il fondo può diventare molto instabile e la trazione peggiora rapidamente. Meglio evitare il giro.",
      };
    }

    if (mode === "sport") {
      return {
        level: "danger",
        label: "Guida dinamica sconsigliata",
        advice:
          "Con temporale o neve non ci sono le condizioni per una guida sportiva sicura. Meglio rimandare.",
      };
    }

    return {
      level: "danger",
      label: "Condizioni critiche",
      advice: "Meglio evitare il giro in moto.",
    };
  }

  // ---------------------------------------------------
  // ATTENZIONE MEDIA
  // ---------------------------------------------------
  if (isRain) {
    if (mode === "offroad") {
      return {
        level: "warn",
        label: "Sterrato delicato",
        advice:
          "Con pioggia o pioviggine il fondo può diventare viscido e scavato. Serve molta attenzione a trazione e appoggi.",
      };
    }

    if (mode === "enduro") {
      return {
        level: "warn",
        label: "Enduro con prudenza",
        advice:
          "Con fondo umido o bagnato alcuni tratti possono diventare più tecnici del previsto. Meglio guidare con margine.",
      };
    }

    if (mode === "sport") {
      return {
        level: "warn",
        label: "Guida dinamica con prudenza",
        advice:
          "Con pioggia il ritmo va abbassato: meno aderenza, frenata più delicata e traiettorie da pulire bene.",
      };
    }

    return {
      level: "warn",
      label: "Fondo potenzialmente bagnato",
      advice: "Guida prudente, occhio a pieghe, frenata e tornanti.",
    };
  }

  if (isFog) {
    if (mode === "offroad" || mode === "enduro") {
      return {
        level: "warn",
        label: "Visibilità ridotta sul percorso",
        advice:
          "Su sterrato o percorsi adventure la visibilità ridotta può complicare lettura del terreno, ostacoli e cambi di fondo.",
      };
    }

    if (mode === "sport") {
      return {
        level: "warn",
        label: "Visibilità ridotta",
        advice:
          "Con nebbia o foschia non ci sono le condizioni ideali per una guida brillante. Meglio aumentare il margine.",
      };
    }

    return {
      level: "warn",
      label: "Visibilità ridotta",
      advice: "Attenzione nei tratti esposti e nei cambi di luce.",
    };
  }

  if (veryStrongWind || strongWind) {
    if (mode === "offroad" || mode === "enduro") {
      return {
        level: "warn",
        label: "Vento fastidioso sul percorso",
        advice:
          "Il vento può rendere più nervosa la moto nei tratti aperti e meno prevedibili alcuni passaggi, soprattutto su maxi-enduro.",
      };
    }

    if (mode === "sport") {
      return {
        level: "warn",
        label: "Vento sfavorevole alla guida dinamica",
        advice:
          "Con vento forte il feeling in inserimento e percorrenza può peggiorare. Meglio guidare puliti e senza forzare.",
      };
    }

    return {
      level: "warn",
      label: "Vento forte",
      advice: "Prudenza su passi, viadotti e uscite di galleria.",
    };
  }

  if (veryCold || cold) {
    if (mode === "offroad" || mode === "enduro") {
      return {
        level: "warn",
        label: "Fondo freddo e delicato",
        advice:
          "Con temperature basse il terreno può essere più umido, duro o scivoloso del previsto. Serve una guida più rotonda.",
      };
    }

    if (mode === "sport") {
      return {
        level: "warn",
        label: "Asfalto freddo",
        advice:
          "Con temperature basse l’aderenza può non essere ideale, soprattutto nei tratti in ombra. Meglio alzare il ritmo con calma.",
      };
    }

    return {
      level: "warn",
      label: "Freddo intenso",
      advice: "Possibile asfalto freddo o umido soprattutto in ombra.",
    };
  }

  // ---------------------------------------------------
  // CONDIZIONI BUONE
  // ---------------------------------------------------
  if (mode === "offroad") {
    return {
      level: "ok",
      label: "Buono per off-road",
      advice:
        "Condizioni generalmente favorevoli per lo sterrato, con buona leggibilità del fondo e gestione più semplice della trazione.",
    };
  }

  if (mode === "enduro") {
    return {
      level: "ok",
      label: "Buono per enduro",
      advice:
        "Condizioni generalmente favorevoli per adventure ed enduro, con fondo più gestibile e buona continuità di guida.",
    };
  }

  if (mode === "sport") {
    return {
      level: "ok",
      label: "Ottimo per guida dinamica",
      advice:
        "Condizioni generalmente favorevoli per una guida dinamica, con buon margine per traiettorie, ritmo e continuità.",
    };
  }

  return {
    level: "ok",
    label: "Ottimo per il touring",
    advice: "Condizioni generalmente favorevoli per il touring.",
  };
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