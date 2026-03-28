// =======================================================
// server/scripts/generateEuropeanRoutes.js
// MotoPortEU — European Routes Generator PRO (LIGHT)
// =======================================================

import path from "path";
import fs from "fs/promises";
import process from "process";

const SPOTS_FILE = path.resolve("client/public/data/rider-spots.cleaned.google.json");
const OUT_FILE = path.resolve("client/public/data/routes.generated.json");
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

const MIN_ROUTE_DISTANCE_KM = 45;
const MAX_ROUTE_DISTANCE_KM = 520;
const MAX_NEIGHBOR_KM = 120;

const MAX_SEEDS_PER_CLUSTER = 10;
const MAX_CANDIDATES_PER_CLUSTER = 36;
const MAX_FINAL_ROUTES = 2500;

// -------------------------------------------------------

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function roundCoord(n) {
  return Number(Number(n).toFixed(5));
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
}

function averageLatLng(items) {
  if (!items.length) return { lat: 0, lng: 0 };
  const lat = items.reduce((s, x) => s + Number(x.lat || 0), 0) / items.length;
  const lng = items.reduce((s, x) => s + Number(x.lng || 0), 0) / items.length;
  return { lat, lng };
}

function normalizeRegionHint(s) {
  return String(s || "")
    .replace(/^[A-Z]{2}-/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function guessMacroRegion(spot) {
  const s = `${spot.regionHint || ""} ${spot.address || ""} ${spot.name || ""}`.toLowerCase();

  if (s.includes("dolom")) return "Dolomiti";
  if (s.includes("alpi") || s.includes("alp")) return "Alpi";
  if (s.includes("appenn")) return "Appennino";
  if (s.includes("pyren")) return "Pirenei";
  if (s.includes("carp")) return "Carpazi";
  if (s.includes("highland")) return "Highlands";
  if (s.includes("fjord") || s.includes("fiordo")) return "Fiordi";
  if (s.includes("garda")) return "Lago di Garda";
  if (s.includes("como")) return "Lago di Como";
  if (s.includes("amalfi")) return "Costiera Amalfitana";
  if (s.includes("liguria")) return "Liguria";
  if (s.includes("cote azur")) return "Costa Azzurra";
  if (s.includes("costa brava")) return "Costa Brava";
  if (s.includes("corsica")) return "Corsica";
  if (s.includes("tatra")) return "Tatra";
  if (s.includes("velebit")) return "Velebit";
  if (s.includes("foresta nera")) return "Foresta Nera";
  if (s.includes("vosges")) return "Vosgi";

  return normalizeRegionHint(spot.regionHint) || spot.country || "Europa";
}

function rideTypePriority(rideType) {
  const order = {
    mountain: 6,
    coastal: 5,
    lake: 4,
    scenic: 3,
    fjord: 3,
    forest: 2,
  };
  return order[rideType] || 1;
}

function byScoreThenName(a, b) {
  return (
    (b.score || 0) - (a.score || 0) ||
    rideTypePriority(b.rideType) - rideTypePriority(a.rideType) ||
    a.name.localeCompare(b.name)
  );
}

function buildClusterKey(spot) {
  const country = spot.country || "XX";
  const region = guessMacroRegion(spot);
  const rideType = spot.rideType || "scenic";
  return `${country}__${region}__${rideType}`;
}

function buildRouteType() {
  return "touring";
}

function buildSurface(rideType) {
  return rideType === "forest" ? "mixed" : "asphalt";
}

function buildDifficulty(distanceKm, rideType, pointsCount) {
  let score = 0;
  if (distanceKm >= 280) score += 2;
  else if (distanceKm >= 160) score += 1;
  if (rideType === "mountain") score += 1;
  if (rideType === "fjord") score += 1;
  if (pointsCount >= 4) score += 1;
  if (score >= 3) return "hard";
  if (score >= 1) return "medium";
  return "easy";
}

function buildTags(rideType, region, country, mode, spots) {
  const base = ["rider", "europe", "generated"];
  const byType = {
    mountain: ["mountain", "passes", "twisty", "panoramic"],
    coastal: ["coast", "sea", "scenic", "panoramic"],
    lake: ["lake", "scenic", "panoramic"],
    scenic: ["scenic", "panoramic"],
    fjord: ["fjord", "sea", "panoramic"],
    forest: ["forest", "scenic"],
  };

  const spotTypes = Array.from(new Set((spots || []).map((s) => s.type).filter(Boolean)));

  return Array.from(
    new Set([
      ...base,
      ...(byType[rideType] || []),
      mode,
      String(country || "").toLowerCase(),
      slugify(region || ""),
      ...spotTypes.map((x) => slugify(x)),
    ].filter(Boolean))
  );
}

function buildTitle(points, region, rideType) {
  const names = points.map((p) => p.name);
  const prefixByType = {
    mountain: "Giro Montagna",
    coastal: "Giro Costiero",
    lake: "Giro Lago",
    scenic: "Giro Panoramico",
    fjord: "Giro Fiordi",
    forest: "Giro Foreste",
  };
  const prefix = prefixByType[rideType] || "Itinerario Rider";

  if (names.length === 2) return `${prefix} ${region}: ${names[0]} → ${names[1]}`;
  return `${prefix} ${region}: ${names.slice(0, 4).join(" → ")}`;
}

function buildDescription(points, region, country, rideType, mode, distanceKm) {
  const names = points.slice(0, 5).map((p) => p.name).join(", ");
  const labelByType = {
    mountain: "di montagna",
    coastal: "costiero",
    lake: "sui laghi",
    scenic: "panoramico",
    fjord: "tra fiordi e strade panoramiche",
    forest: "tra boschi e strade verdi",
  };
  const t = labelByType[rideType] || "rider";

  return `Itinerario ${t} in ${region}${country ? ` (${country})` : ""}, generato da rider spots reali europei. Modalità ${mode}. Percorso da circa ${distanceKm} km con focus su guida motociclistica, panorami e punti rider principali: ${names}.`;
}

async function getOsrmRoute(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OSRM ${res.status} ${res.statusText} ${txt.slice(0, 180)}`);
  }

  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route?.geometry?.coordinates?.length) {
    throw new Error("Geometria OSRM vuota");
  }

  return {
    geometry: route.geometry,
    distanceKm: Math.round((route.distance || 0) / 100) / 10,
    durationMin: Math.round((route.duration || 0) / 60),
  };
}

function buildShapeFields(points, osrm) {
  const start = points[0];
  const end = points[points.length - 1];

  return {
    start: {
      name: start.name,
      lat: roundCoord(start.lat),
      lng: roundCoord(start.lng),
    },
    end: {
      name: end.name,
      lat: roundCoord(end.lat),
      lng: roundCoord(end.lng),
    },
    waypoints: points.slice(1, -1).map((p) => ({
      name: p.name,
      lat: roundCoord(p.lat),
      lng: roundCoord(p.lng),
      type: p.type || "scenic_road",
      rideType: p.rideType || "scenic",
    })),
    coords: osrm.geometry.coordinates
      .map(([lng, lat], i, arr) => {
        if (i !== 0 && i !== arr.length - 1 && i % 3 !== 0) return null;
        return [roundCoord(lat), roundCoord(lng)];
      })
      .filter(Boolean),
  };
}

function dedupePointList(points) {
  const seen = new Set();
  const out = [];
  for (const p of points) {
    const key = p.id || `${p.name}-${p.lat}-${p.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function chooseNeighbors(seed, list, max = 6) {
  return list
    .filter((p) => p.id !== seed.id)
    .map((p) => ({
      ...p,
      _d: haversineKm(seed.lat, seed.lng, p.lat, p.lng),
    }))
    .filter((p) => p._d <= MAX_NEIGHBOR_KM)
    .sort((a, b) => a._d - b._d || byScoreThenName(a, b))
    .slice(0, max);
}

function buildCandidatesForCluster(cluster, rideType) {
  const sorted = [...cluster].sort(byScoreThenName);
  const seeds = sorted.slice(0, MAX_SEEDS_PER_CLUSTER);
  const candidates = [];

  if (sorted.length < 2) return candidates;

  for (const seed of seeds) {
    const n = chooseNeighbors(seed, sorted, 6);

    for (const a of n.slice(0, 2)) {
      candidates.push({
        mode: "point_to_point",
        rideType,
        points: dedupePointList([seed, a]),
      });
    }

    if (n.length >= 2) {
      candidates.push({
        mode: "linear",
        rideType,
        points: dedupePointList([seed, n[0], n[1]]),
      });
    }

    if (n.length >= 3) {
      candidates.push({
        mode: "linear",
        rideType,
        points: dedupePointList([seed, n[0], n[1], n[2]]),
      });

      if (rideType !== "coastal" && rideType !== "lake") {
        candidates.push({
          mode: "loop",
          rideType,
          points: dedupePointList([seed, n[0], n[1], seed]),
        });
      }
    }
  }

  return candidates
    .filter((c) => c.points.length >= 2)
    .slice(0, MAX_CANDIDATES_PER_CLUSTER);
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const out = [];

  for (const r of routes) {
    const ordered = (r.spots || []).map((s) => s.slug || s.name);
    const sorted = [...ordered].sort();

    const sigA = [
      r.country || "",
      r.region || "",
      r.rideType || "",
      sorted.join(">"),
    ].join("|");

    const sigB = [
      r.country || "",
      r.region || "",
      r.rideType || "",
      ordered.slice(0, 3).join(">"),
      Math.round(Number(r.distanceKm || 0)),
    ].join("|");

    if (seen.has(sigA) || seen.has(sigB)) continue;

    seen.add(sigA);
    seen.add(sigB);
    out.push(r);
  }

  return out;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Generate European Routes");
  console.log("====================================");

  const raw = JSON.parse(await fs.readFile(SPOTS_FILE, "utf8"));
  const spots = Array.isArray(raw)
    ? raw.filter((s) => toNum(s.lat) != null && toNum(s.lng) != null)
    : [];

  if (!spots.length) {
    console.error("❌ Nessun rider spot valido trovato");
    process.exit(1);
  }

  const clusters = new Map();
  for (const spot of spots) {
    const key = buildClusterKey(spot);
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(spot);
  }

  const routes = [];
  let routeCounter = 1;

  for (const [key, cluster] of clusters.entries()) {
    const [country, region, rideType] = key.split("__");
    console.log(`\n🌍 Cluster ${region} (${country}) [${rideType}] — ${cluster.length} spots`);

    const candidates = buildCandidatesForCluster(cluster, rideType);
    let produced = 0;

    for (const cand of candidates) {
      try {
        const osrm = await getOsrmRoute(cand.points);

        if (osrm.distanceKm < MIN_ROUTE_DISTANCE_KM) continue;
        if (osrm.distanceKm > MAX_ROUTE_DISTANCE_KM) continue;

        const title = buildTitle(cand.points, region, rideType);
        const description = buildDescription(
          cand.points,
          region,
          country,
          rideType,
          cand.mode,
          osrm.distanceKm
        );
        const shape = buildShapeFields(cand.points, osrm);
        const center = averageLatLng(cand.points);

        routes.push({
          id: `route-eu-${String(routeCounter++).padStart(5, "0")}`,
          name: title,
          slug: slugify(`${title}-${routeCounter}`),
          type: buildRouteType(),
          rideType,
          mode: cand.mode,
          country,
          region,
          source: "generated_from_rider_spots",
          distanceKm: osrm.distanceKm,
          durationMin: osrm.durationMin,
          difficulty: buildDifficulty(osrm.distanceKm, rideType, cand.points.length),
          surface: buildSurface(rideType),
          tags: buildTags(rideType, region, country, cand.mode, cand.points),
          description,
          center: {
            lat: roundCoord(center.lat),
            lng: roundCoord(center.lng),
          },
          spots: cand.points.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            type: p.type || "scenic_road",
            rideType: p.rideType || "scenic",
            lat: roundCoord(p.lat),
            lng: roundCoord(p.lng),
            country: p.country || null,
          })),
          ...shape,
        });

        produced += 1;
      } catch (err) {
        console.warn(
          `   ⚠️ skip: ${cand.points.map((p) => p.name).join(" → ").slice(0, 120)} | ${err.message}`
        );
      }
    }

    console.log(`   ✅ generate cluster: ${produced}`);
  }

  const cleaned = dedupeRoutes(routes)
    .sort((a, b) => {
      return (
        (a.country || "").localeCompare(b.country || "") ||
        (a.region || "").localeCompare(b.region || "") ||
        (a.rideType || "").localeCompare(b.rideType || "") ||
        a.name.localeCompare(b.name)
      );
    })
    .slice(0, MAX_FINAL_ROUTES);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(cleaned, null, 2), "utf8");

  const byRideType = cleaned.reduce((acc, item) => {
    acc[item.rideType] = (acc[item.rideType] || 0) + 1;
    return acc;
  }, {});

  console.log("\n------------------------------------");
  console.log(`Routes generated: ${routes.length}`);
  console.log(`Routes deduped:   ${cleaned.length}`);
  console.log("Distribuzione rideType:", byRideType);
  console.log(`Creato: ${OUT_FILE}`);
  console.log("------------------------------------");
}

main().catch((err) => {
  console.error("❌ Errore fatale:", err);
  process.exit(1);
});