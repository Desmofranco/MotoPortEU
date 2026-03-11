function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingDeg(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function deltaAngle(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function analyzeRouteGeometry(geometry = [], routeMeta = {}) {
  const pts = Array.isArray(geometry) ? geometry : [];
  if (pts.length < 2) {
    return {
      valid: false,
      distanceKm: 0,
      durationMin: 0,
      avgSpeedKmh: 0,
      segmentCount: 0,
      totalTurns: 0,
      mediumTurns: 0,
      sharpTurns: 0,
      turnDensity: 0,
      technicality: 0,
      smoothness: 0,
      routeCharacter: "unknown",
    };
  }

  let distanceKm = 0;
  const bearings = [];

  for (let i = 1; i < pts.length; i++) {
    distanceKm += haversineKm(pts[i - 1], pts[i]);
    bearings.push(bearingDeg(pts[i - 1], pts[i]));
  }

  let totalTurns = 0;
  let mediumTurns = 0;
  let sharpTurns = 0;
  let angleSum = 0;

  for (let i = 1; i < bearings.length; i++) {
    const d = deltaAngle(bearings[i - 1], bearings[i]);
    angleSum += d;

    if (d >= 18) {
      totalTurns += 1;
      if (d >= 40) mediumTurns += 1;
      if (d >= 75) sharpTurns += 1;
    }
  }

  const durationMin = Number(routeMeta?.durationMin || 0);
  const avgSpeedKmh =
    durationMin > 0 ? distanceKm / (durationMin / 60) : 0;

  const turnDensity = distanceKm > 0 ? totalTurns / distanceKm : 0;

  const technicality = clamp(
    Math.round(turnDensity * 22 + sharpTurns * 1.4 + mediumTurns * 0.7),
    0,
    100
  );

  const smoothness = clamp(
    Math.round(100 - technicality + Math.min(avgSpeedKmh, 90) * 0.15),
    0,
    100
  );

  let routeCharacter = "balanced";
  if (technicality >= 70) routeCharacter = "technical";
  else if (technicality >= 45) routeCharacter = "twisty";
  else if (smoothness >= 72) routeCharacter = "flowing";
  else if (avgSpeedKmh < 45) routeCharacter = "urban";

  return {
    valid: true,
    distanceKm: Number(distanceKm.toFixed(1)),
    durationMin: Number(durationMin.toFixed(0)),
    avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
    segmentCount: Math.max(0, pts.length - 1),
    totalTurns,
    mediumTurns,
    sharpTurns,
    turnDensity: Number(turnDensity.toFixed(2)),
    technicality,
    smoothness,
    routeCharacter,
  };
}