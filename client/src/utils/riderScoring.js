// src/utils/riderScoring.js
// Scoring rider semplice ma già utile

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleBetween(a, b, c) {
  if (!a || !b || !c) return 0;

  const abx = b.lng - a.lng;
  const aby = b.lat - a.lat;
  const bcx = c.lng - b.lng;
  const bcy = c.lat - b.lat;

  const dot = abx * bcx + aby * bcy;
  const mag1 = Math.sqrt(abx * abx + aby * aby);
  const mag2 = Math.sqrt(bcx * bcx + bcy * bcy);

  if (!mag1 || !mag2) return 0;

  const cos = clamp(dot / (mag1 * mag2), -1, 1);
  const rad = Math.acos(cos);
  return (rad * 180) / Math.PI;
}

export function countCurves(latlngs = []) {
  let curves = 0;

  for (let i = 1; i < latlngs.length - 1; i++) {
    const angle = angleBetween(latlngs[i - 1], latlngs[i], latlngs[i + 1]);
    if (angle > 18) curves += 1;
  }

  return curves;
}

export function getRouteProfile({
  distanceKm = 0,
  durationMin = 0,
  curveCount = 0,
}) {
  const pace = durationMin > 0 ? distanceKm / (durationMin / 60) : 0;

  if (curveCount > 80 && pace < 70) return "Sport";
  if (curveCount > 35) return "Sport Touring";
  if (distanceKm > 180) return "Touring";
  return "Balanced";
}

export function scoreRoute(route, weatherSummary = null) {
  if (!route?.geometry?.length) {
    return {
      riderScore: 0,
      profile: "Unknown",
      highlights: [],
      metrics: {},
    };
  }

  const curveCount = countCurves(route.geometry);
  const distanceKm = route.distanceKm ?? 0;
  const durationMin = route.durationMin ?? 0;

  let score = 50;

  // curve bonus
  score += Math.min(curveCount * 0.35, 25);

  // distanza equilibrata bonus
  if (distanceKm >= 80 && distanceKm <= 280) score += 10;

  // durata equilibrata bonus
  if (durationMin >= 90 && durationMin <= 360) score += 10;

  const highlights = [];

  if (curveCount > 25) highlights.push("Serie di curve interessanti");
  if (distanceKm >= 120) highlights.push("Giro adatto a uscita completa");
  if (durationMin <= 180) highlights.push("Buono anche per mezza giornata");

  if (weatherSummary?.risks?.length) {
    score -= weatherSummary.risks.length * 6;
    highlights.push(...weatherSummary.risks.map((r) => `Attenzione: ${r}`));
  } else {
    score += 5;
    highlights.push("Condizioni meteo favorevoli");
  }

  score = clamp(Math.round(score), 0, 100);

  return {
    riderScore: score,
    profile: getRouteProfile({ distanceKm, durationMin, curveCount }),
    highlights: highlights.slice(0, 4),
    metrics: {
      distanceKm,
      durationMin,
      curveCount,
    },
  };
}