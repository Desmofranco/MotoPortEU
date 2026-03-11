function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function uniq(arr = []) {
  return [...new Set(arr.filter(Boolean))];
}

function profileLabel(profile) {
  switch (profile) {
    case "relax":
      return "Relax";
    case "sport":
      return "Sport";
    case "rain":
      return "Pioggia / prudenza";
    case "touring":
    default:
      return "Touring";
  }
}

export function scoreRouteForRider(analysis, rideProfile = "touring", weather = null) {
  if (!analysis?.valid) {
    return {
      riderScore: 0,
      profile: profileLabel(rideProfile),
      highlights: [],
      warnings: ["Rotta non valida"],
      summary: "Dati rotta insufficienti",
    };
  }

  let score = 68;
  const highlights = [];
  const warnings = [];

  const { distanceKm, avgSpeedKmh, technicality, smoothness, routeCharacter, sharpTurns, mediumTurns } =
    analysis;

  if (rideProfile === "touring") {
    if (routeCharacter === "flowing" || routeCharacter === "balanced") {
      score += 12;
      highlights.push("guida fluida e piacevole");
    }
    if (distanceKm >= 80 && distanceKm <= 320) {
      score += 8;
      highlights.push("lunghezza ideale per touring");
    }
    if (technicality >= 35 && technicality <= 70) {
      score += 8;
      highlights.push("buon mix di curve e scorrevolezza");
    }
  }

  if (rideProfile === "sport") {
    if (technicality >= 55) {
      score += 14;
      highlights.push("tratto ricco di curve");
    }
    if (sharpTurns >= 8 || mediumTurns >= 20) {
      score += 10;
      highlights.push("ritmo tecnico interessante");
    }
    if (avgSpeedKmh >= 55 && avgSpeedKmh <= 95) {
      score += 6;
      highlights.push("passo dinamico");
    }
  }

  if (rideProfile === "relax") {
    if (smoothness >= 60) {
      score += 14;
      highlights.push("rotta scorrevole");
    }
    if (technicality <= 45) {
      score += 8;
      highlights.push("poco stress di guida");
    }
    if (distanceKm >= 40 && distanceKm <= 220) {
      score += 6;
      highlights.push("durata ben gestibile");
    }
  }

  if (rideProfile === "rain") {
    if (technicality <= 40) {
      score += 14;
      highlights.push("tracciato prudente");
    } else {
      warnings.push("rotta un po' tecnica per guida prudente");
      score -= 10;
    }
    if (smoothness >= 58) {
      score += 8;
      highlights.push("linea abbastanza regolare");
    }
  }

  if (routeCharacter === "technical" && rideProfile !== "sport") {
    warnings.push("molti cambi di direzione");
    score -= 6;
  }

  if (routeCharacter === "urban") {
    warnings.push("possibili tratti lenti o urbani");
    score -= 8;
  }

  if (distanceKm > 360) {
    warnings.push("rotta lunga: valuta una sosta");
    score -= 5;
  }

  if (distanceKm < 25) {
    warnings.push("rotta molto corta");
    score -= 4;
  }

  if (weather?.severity >= 3) {
    warnings.push("meteo rider non ideale");
    score -= 10;
  }

  if (weather?.severity >= 4) {
    warnings.push("condizioni sfavorevoli");
    score -= 8;
  }

  if (!highlights.length) {
    if (routeCharacter === "flowing") highlights.push("percorso scorrevole");
    if (routeCharacter === "twisty") highlights.push("buona presenza di curve");
    if (routeCharacter === "technical") highlights.push("itinerario impegnativo");
    if (routeCharacter === "balanced") highlights.push("rotta equilibrata");
  }

  score = clamp(Math.round(score), 0, 100);

  let summary = "Rotta discreta";
  if (score >= 86) summary = "Rotta eccellente per rider";
  else if (score >= 75) summary = "Rotta molto interessante";
  else if (score >= 62) summary = "Rotta valida";
  else if (score >= 48) summary = "Rotta da valutare con attenzione";
  else summary = "Rotta poco convincente";

  return {
    riderScore: score,
    profile: profileLabel(rideProfile),
    highlights: uniq(highlights).slice(0, 4),
    warnings: uniq(warnings).slice(0, 4),
    summary,
    routeCharacter,
    technicality: analysis.technicality,
    smoothness: analysis.smoothness,
    avgSpeedKmh: analysis.avgSpeedKmh,
  };
}