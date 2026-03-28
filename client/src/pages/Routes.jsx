// =======================================================
// client/src/pages/Routes.jsx
// Itinerari Touring
// UI: split-view su desktop (lista + dettaglio)
// Mobile: lista -> dettaglio (full screen) con back
// Dati LIVE: /public/data/routes.json
// ✅ Loading skeleton
// ✅ Meteo + Google Maps
// ✅ FIX mobile: no aperture accidentali durante scroll
// ✅ NEW: ricerca intelligente su:
//    - name
//    - description
//    - aliases
//    - searchText
//    - tags
//    - spots[].name
//    - waypoints[].name
// ✅ NEW: priorità hero routes
// ✅ NEW: supporto completo nuovo dataset routes.json
// =======================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import RouteMap from "../components/RouteMap";
import { getRouteWeatherSummary } from "../utils/routeWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

const TAP_MOVE_THRESHOLD = 12;
const MAX_ROUTE_SPOTS = 12;
const SPOT_NEAR_ROUTE_KM = 28;
const SPOT_NEAR_POINT_KM = 12;

function isMobileNow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
}

function openGoogleMapsSmart(url) {
  if (!url) return;
  if (isMobileNow()) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pairFrom(a, b) {
  const lat = toNum(a);
  const lon = toNum(b);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

function latLonStr(p) {
  if (!p || p.length < 2) return null;
  const lat = Number(p[0]);
  const lon = Number(p[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat},${lon}`;
}

function buildNavigateUrl(destination, travelmode = "driving") {
  if (!destination) return null;
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${encodeURIComponent(travelmode)}` +
    `&dir_action=navigate`
  );
}

function pointFromObject(obj) {
  if (!obj) return null;
  return pairFrom(
    obj?.lat ?? obj?.latitude,
    obj?.lng ?? obj?.lon ?? obj?.longitude
  );
}

function buildRouteKey(r) {
  const id = String(r?.id || "").trim();
  if (id) return `id:${id}`;

  const name = String(r?.name || "").trim().toLowerCase();

  const sp = pointFromObject(r?.start);
  const ep = pointFromObject(r?.end);

  const s = sp ? `${Number(sp[0]).toFixed(5)},${Number(sp[1]).toFixed(5)}` : "";
  const e = ep ? `${Number(ep[0]).toFixed(5)},${Number(ep[1]).toFixed(5)}` : "";

  return `n:${name}|${s}|${e}`;
}

function haversineKm(a, b) {
  if (!a || !b) return Infinity;

  const lat1 = toNum(a[0]);
  const lon1 = toNum(a[1]);
  const lat2 = toNum(b[0]);
  const lon2 = toNum(b[1]);

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Infinity;
  }

  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function normalizeRoute(route) {
  return {
    ...route,
    aliases: Array.isArray(route?.aliases) ? route.aliases : [],
    tags: Array.isArray(route?.tags) ? route.tags : [],
    waypoints: Array.isArray(route?.waypoints) ? route.waypoints : [],
    spots: Array.isArray(route?.spots) ? route.spots : [],
    coords: Array.isArray(route?.coords) ? route.coords : [],
    hero: Boolean(route?.hero),
    distanceKm: toNum(route?.distanceKm),
    durationMin: toNum(route?.durationMin),
    rating: toNum(route?.rating),
    curvesScore: toNum(route?.curvesScore),
    asphaltScore: toNum(route?.asphaltScore),
  };
}

function routeSearchBlob(route) {
  const parts = [
    route?.name,
    route?.region,
    route?.country,
    route?.description,
    route?.bestSeason,
    route?.pace,
    route?.rideType,
    route?.mode,
    route?.surface,
    route?.difficulty,
    route?.searchText,
    ...(route?.aliases || []),
    ...(route?.tags || []),
    ...(route?.spots || []).map((s) => s?.name),
    ...(route?.waypoints || []).map((w) => w?.name),
    route?.start?.name,
    route?.end?.name,
  ].filter(Boolean);

  return normalizeText(parts.join(" "));
}

function getRouteRatingForSort(route) {
  if (Number.isFinite(toNum(route?.rating))) return Number(route.rating);
  if (route?.hero) return 5;
  return 0;
}

function getRouteCurvesForSort(route) {
  if (Number.isFinite(toNum(route?.curvesScore))) return Number(route.curvesScore);
  if (route?.rideType === "mountain") return 8;
  if (route?.rideType === "scenic") return 6;
  if (route?.rideType === "lake") return 5;
  if (route?.rideType === "coastal") return 5;
  return 0;
}

function pickRoutePoint(route) {
  {
    const p = pointFromObject(route?.start);
    if (p) return p;
  }

  {
    const p = pointFromObject(route?.end);
    if (p) return p;
  }

  {
    const p = pointFromObject(route?.center);
    if (p) return p;
  }

  if (Array.isArray(route?.center) && route.center.length >= 2) {
    const p = pairFrom(route.center[0], route.center[1]);
    if (p) return p;
  }

  if (Array.isArray(route?.coords) && route.coords.length) {
    const c0 = route.coords[0];
    if (Array.isArray(c0) && c0.length >= 2) {
      const p = pairFrom(c0[0], c0[1]);
      if (p) return p;
    }
  }

  if (Array.isArray(route?.waypoints) && route.waypoints.length) {
    for (const w of route.waypoints) {
      const p = pointFromObject(w);
      if (p) return p;
    }
  }

  if (Array.isArray(route?.spots) && route.spots.length) {
    for (const s of route.spots) {
      const p = pointFromObject(s);
      if (p) return p;
    }
  }

  return null;
}

function extractRoutePoints(route) {
  const points = [];
  const seen = new Set();

  function addPoint(p) {
    if (!p || p.length < 2) return;
    const lat = toNum(p[0]);
    const lon = toNum(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push([lat, lon]);
  }

  addPoint(pointFromObject(route?.start));
  addPoint(pointFromObject(route?.end));
  addPoint(pointFromObject(route?.center));

  if (Array.isArray(route?.center) && route.center.length >= 2) {
    addPoint(pairFrom(route.center[0], route.center[1]));
  }

  if (Array.isArray(route?.waypoints)) {
    for (const w of route.waypoints) addPoint(pointFromObject(w));
  }

  if (Array.isArray(route?.spots)) {
    for (const s of route.spots) addPoint(pointFromObject(s));
  }

  if (Array.isArray(route?.coords) && route.coords.length) {
    const step = Math.max(1, Math.floor(route.coords.length / 32));
    for (let i = 0; i < route.coords.length; i += step) {
      const c = route.coords[i];
      if (Array.isArray(c) && c.length >= 2) {
        addPoint(pairFrom(c[0], c[1]));
      }
    }

    const last = route.coords[route.coords.length - 1];
    if (Array.isArray(last) && last.length >= 2) {
      addPoint(pairFrom(last[0], last[1]));
    }
  }

  return points;
}

function getRouteBounds(points = []) {
  if (!points.length) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const p of points) {
    const lat = toNum(p[0]);
    const lng = toNum(p[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLng)
  ) {
    return null;
  }

  const latPad = 0.28;
  const lngPad = 0.38;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function pointInBounds(point, bounds) {
  if (!point || !bounds) return false;
  const lat = toNum(point[0]);
  const lng = toNum(point[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

function getSpotPoint(spot) {
  return pairFrom(spot?.lat, spot?.lng ?? spot?.lon);
}

function buildSpotGoogleMapsUri(spot) {
  const lat = toNum(spot?.lat);
  const lng = toNum(spot?.lng ?? spot?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function normalizeSpot(spot) {
  const lat = toNum(spot?.lat);
  const lng = toNum(spot?.lng ?? spot?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    ...spot,
    lat,
    lng,
    lon: lng,
    googleMapsUri: spot?.googleMapsUri || buildSpotGoogleMapsUri({ lat, lng }),
  };
}

function findSpotsAlongRoute(route, spots = []) {
  if (!route || !Array.isArray(spots) || !spots.length) return [];

  const routePoints = extractRoutePoints(route);
  if (!routePoints.length) return [];

  const bounds = getRouteBounds(routePoints);
  const candidates = [];

  for (const rawSpot of spots) {
    const spot = normalizeSpot(rawSpot);
    if (!spot) continue;

    const sp = getSpotPoint(spot);
    if (!sp) continue;
    if (bounds && !pointInBounds(sp, bounds)) continue;

    let bestKm = Infinity;

    for (const rp of routePoints) {
      const km = haversineKm(rp, sp);
      if (km < bestKm) bestKm = km;
      if (bestKm <= SPOT_NEAR_POINT_KM) break;
    }

    if (bestKm <= SPOT_NEAR_ROUTE_KM) {
      candidates.push({
        ...spot,
        _distanceKm: Math.round(bestKm * 10) / 10,
      });
    }
  }

  candidates.sort((a, b) => {
    const da = Number(a._distanceKm ?? Infinity);
    const db = Number(b._distanceKm ?? Infinity);
    if (da !== db) return da - db;

    const sa = Number(a.score || a.riderScore || 0);
    const sb = Number(b.score || b.riderScore || 0);
    if (sb !== sa) return sb - sa;

    const ra = Number(a.rating || 0);
    const rb = Number(b.rating || 0);
    return rb - ra;
  });

  const seen = new Set();
  const final = [];

  for (const spot of candidates) {
    const spotLng = Number(spot.lng ?? spot.lon);

    const key =
      String(spot.id || spot.sourceId || "").trim() ||
      `${String(spot.name || "").toLowerCase()}_${Number(spot.lat).toFixed(4)}_${spotLng.toFixed(4)}`;

    if (seen.has(key)) continue;
    seen.add(key);
    final.push(spot);

    if (final.length >= MAX_ROUTE_SPOTS) break;
  }

  return final;
}

function SkeletonLoading() {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 900 }}>Carico itinerari…</div>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <div
          style={{
            height: 12,
            background: "rgba(0,0,0,0.08)",
            borderRadius: 8,
            width: "70%",
          }}
        />
        <div
          style={{
            height: 12,
            background: "rgba(0,0,0,0.08)",
            borderRadius: 8,
            width: "55%",
          }}
        />
        <div
          style={{
            height: 12,
            background: "rgba(0,0,0,0.08)",
            borderRadius: 8,
            width: "80%",
          }}
        />
      </div>
    </div>
  );
}

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [sortBy, setSortBy] = useState("hero");

  const [activeKey, setActiveKey] = useState(null);
  const [selected, setSelected] = useState(null);

  const [mobileView, setMobileView] = useState("list");

  const isMobile = isMobileNow();
  const showDetailMobile = isMobile && mobileView === "detail" && selected;

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr("");

      try {
        const data = await fetch("/data/routes.json", {
          cache: "no-store",
        })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []);

        const arr = Array.isArray(data) ? data.map(normalizeRoute) : [];

        const seen = new Set();
        const dedup = [];

        for (const r of arr) {
          const key = buildRouteKey(r);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          dedup.push(r);
        }

        if (!alive) return;

        setRoutes(dedup);

        const first = dedup[0] || null;
        const firstKey = first ? buildRouteKey(first) : null;

        setActiveKey((prev) => prev || firstKey);
        setSelected((prev) => prev || first);
        setMobileView("list");
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Errore caricamento itinerari");
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  const countries = useMemo(() => {
    const set = new Set(
      routes.map((r) => String(r.country || "").toUpperCase()).filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort()];
  }, [routes]);

  const filtered = useMemo(() => {
    const query = normalizeText(q.trim());
    let out = [...routes];

    if (query) {
      out = out
        .map((r) => {
          const blob = routeSearchBlob(r);
          const exactName = normalizeText(r.name) === query;
          const aliasHit = (r.aliases || []).some((a) => normalizeText(a).includes(query));
          const heroBoost = r.hero ? 1000 : 0;
          const exactBoost = exactName ? 500 : 0;
          const aliasBoost = aliasHit ? 250 : 0;
          const textBoost = blob.includes(query) ? 100 : 0;
          const score = heroBoost + exactBoost + aliasBoost + textBoost;

          return {
            ...r,
            _searchScore: score,
          };
        })
        .filter((r) => r._searchScore > 0);
    }

    if (country !== "ALL") {
      out = out.filter(
        (r) => String(r.country || "").toUpperCase() === country
      );
    }

    const sorter =
      {
        hero: (a, b) => {
          const ah = a.hero ? 1 : 0;
          const bh = b.hero ? 1 : 0;
          if (bh !== ah) return bh - ah;
          const as = Number(a._searchScore || 0);
          const bs = Number(b._searchScore || 0);
          if (bs !== as) return bs - as;
          return (Number(b.distanceKm || 0) - Number(a.distanceKm || 0));
        },
        rating: (a, b) => {
          const ah = a.hero ? 1 : 0;
          const bh = b.hero ? 1 : 0;
          if (bh !== ah) return bh - ah;
          return getRouteRatingForSort(b) - getRouteRatingForSort(a);
        },
        distance: (a, b) => {
          const ah = a.hero ? 1 : 0;
          const bh = b.hero ? 1 : 0;
          if (bh !== ah) return bh - ah;
          return Number(b.distanceKm || 0) - Number(a.distanceKm || 0);
        },
        curves: (a, b) => {
          const ah = a.hero ? 1 : 0;
          const bh = b.hero ? 1 : 0;
          if (bh !== ah) return bh - ah;
          return getRouteCurvesForSort(b) - getRouteCurvesForSort(a);
        },
      }[sortBy] || (() => 0);

    out.sort(sorter);
    return out;
  }, [routes, q, country, sortBy]);

  useEffect(() => {
    if (!filtered.length) return;

    const exists = filtered.some((r) => buildRouteKey(r) === activeKey);

    if (!exists) {
      const first = filtered[0];
      setActiveKey(buildRouteKey(first));
      setSelected(first);
      if (isMobileNow()) setMobileView("list");
    }
  }, [filtered, activeKey]);

  const active = useMemo(() => {
    if (!filtered.length && !routes.length) return null;

    const source = filtered.length ? filtered : routes;

    if (activeKey) {
      const found = source.find((r) => buildRouteKey(r) === activeKey);
      if (found) return found;
    }

    return source[0] || null;
  }, [routes, filtered, activeKey]);

  const selectRoute = (r) => {
    const key = buildRouteKey(r);
    setActiveKey(key);
    setSelected(r);

    if (isMobileNow()) {
      setMobileView("detail");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div
      className="routes-root"
      style={{ padding: 12, maxWidth: 1250, margin: "0 auto" }}
    >
      {!showDetailMobile && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "baseline",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.5 }}>
                Itinerari 📍
              </h1>
              <div
                className="routes-subtitle"
                style={{ opacity: 0.75, marginTop: 6 }}
              >
                Touring emozionale: mappa, meteo e passi reali lungo il percorso.
              </div>
            </div>

            <input
              className="routes-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca: Stelvio, Forra, Dolomiti, Grossglockner…"
              style={{
                width: "min(520px, 100%)",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              padding: 12,
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Paese</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "Tutti" : c}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Ordina</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                <option value="hero">Hero / rilevanza</option>
                <option value="rating">Rating</option>
                <option value="distance">Distanza (desc)</option>
                <option value="curves">Curve (desc)</option>
              </select>
            </label>
          </div>
        </>
      )}

      {loading ? (
        <SkeletonLoading />
      ) : err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,0,0,0.08)",
          }}
        >
          {err}
        </div>
      ) : (
        <>
          {showDetailMobile ? (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  background: "rgba(255,255,255,0.96)",
                  backdropFilter: "blur(10px)",
                  borderBottom: "1px solid rgba(0,0,0,0.10)",
                  padding: 10,
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMobileView("list");
                    window.scrollTo({ top: 0, behavior: "auto" });
                  }}
                  style={{
                    padding: "9px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  ← Indietro
                </button>

                <div
                  style={{
                    fontWeight: 950,
                    fontSize: 15,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {selected.name}
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  borderRadius: 18,
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "white",
                }}
              >
                <RouteDetail route={selected} />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 12 }} className="routes-split">
              <div className="routes-list">
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                  Itinerari trovati: <strong>{filtered.length}</strong>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {filtered.map((r) => {
                    const key = buildRouteKey(r);
                    const isActive = key === activeKey;
                    return (
                      <RouteCard
                        key={key}
                        route={r}
                        active={isActive}
                        onSelect={() => selectRoute(r)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="routes-detail">
                <div
                  style={{
                    borderRadius: 22,
                    overflow: "hidden",
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "white",
                  }}
                >
                  {!active ? (
                    <div style={{ padding: 14 }}>Seleziona un itinerario.</div>
                  ) : (
                    <RouteDetail route={active} />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @media (min-width: 1024px){
          .routes-split{
            display: grid;
            grid-template-columns: 420px 1fr;
            gap: 14px;
            align-items: start;
          }
          .routes-list{
            position: sticky;
            top: 10px;
            height: calc(100dvh - 20px);
            overflow: auto;
            padding-right: 6px;
          }
        }

        @media (max-width: 1023px){
          .routes-split{ display: grid; grid-template-columns: 1fr; gap: 12px; }
          .routes-detail{ display:none; }
        }

        @media (max-width: 767px){
          .routes-root h1{ font-size: 22px !important; line-height: 1.05 !important; margin-bottom: 4px !important; }
          .routes-subtitle{ display:none !important; }
          .routes-search{ padding: 8px 10px !important; border-radius: 12px !important; }
        }
      `}</style>
    </div>
  );
}

function RouteCard({ route, active, onSelect }) {
  const photo = route.photo || FALLBACK_PHOTO;

  const touchRef = useRef({
    startX: 0,
    startY: 0,
    moved: false,
  });

  const handleClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onSelect?.();
  };

  const handleTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    touchRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      moved: false,
    };
  };

  const handleTouchMove = (e) => {
    const t = e.touches?.[0];
    if (!t) return;

    const dx = Math.abs(t.clientX - touchRef.current.startX);
    const dy = Math.abs(t.clientY - touchRef.current.startY);

    if (dx > TAP_MOVE_THRESHOLD || dy > TAP_MOVE_THRESHOLD) {
      touchRef.current.moved = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchRef.current.moved) return;
    handleClick(e);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={(e) =>
        e.key === "Enter" || e.key === " " ? handleClick(e) : null
      }
      style={{
        borderRadius: 16,
        overflow: "hidden",
        width: "100%",
        border: active
          ? "2px solid rgba(0,0,0,0.30)"
          : "1px solid rgba(0,0,0,0.10)",
        background: "white",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "pan-y",
        userSelect: "none",
      }}
    >
      <div
        className="route-card-mobile"
        style={{ display: "none", padding: 6, gap: 10, alignItems: "center" }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            overflow: "hidden",
            background: "rgba(0,0,0,0.05)",
            flex: "0 0 auto",
          }}
        >
          <img
            src={photo}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>

        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              alignItems: "start",
            }}
          >
            <div
              style={{
                fontWeight: 950,
                fontSize: 14,
                lineHeight: 1.15,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {route.hero ? "🔥 " : ""}
              {route.country ? `${route.country} ` : ""}
              {route.name}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, whiteSpace: "nowrap" }}>
              {route.distanceKm ? `${route.distanceKm} km` : "—"}
            </div>
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              opacity: 0.75,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {route.region || "—"} · {route.rideType || "touring"} ·{" "}
            {route.hero ? "hero" : "standard"}
          </div>
        </div>
      </div>

      <div className="route-card-desktop" style={{ display: "block" }}>
        <div
          style={{
            height: 130,
            backgroundImage: `url(${photo})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div style={{ padding: 12 }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
          >
            <div style={{ fontWeight: 900, lineHeight: 1.15 }}>
              {route.hero ? "🔥 " : ""}
              {route.country ? `${route.country} ` : ""}
              {route.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
              {route.distanceKm ? `${route.distanceKm} km` : "—"}
            </div>
          </div>

          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            {route.region || "—"} · {route.rideType || "touring"} ·{" "}
            {route.difficulty || "—"}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1023px){
          .route-card-mobile{ display:flex !important; }
          .route-card-desktop{ display:none !important; }
        }
      `}</style>
    </div>
  );
}

function RouteDetail({ route }) {
  const photo = route.photo || FALLBACK_PHOTO;
  const navPoint = pickRoutePoint(route);
  const startNavUrl = navPoint
    ? buildNavigateUrl(latLonStr(navPoint), "driving")
    : null;

  const [wx, setWx] = useState(null);
  const [wxBusy, setWxBusy] = useState(false);

  const [spots, setSpots] = useState([]);
  const [spotsBusy, setSpotsBusy] = useState(false);
  const [spotsDatasetCount, setSpotsDatasetCount] = useState(0);

  const routeKey = buildRouteKey(route);
  const displayDescription =
    String(route?.description || "").trim() || "Descrizione non disponibile.";

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setWxBusy(true);
        const res = await getRouteWeatherSummary(route);
        if (!alive) return;
        setWx(res);
      } catch (e) {
        if (!alive) return;
        setWx({ ok: false, note: e?.message || "Meteo non disponibile." });
      } finally {
        if (alive) setWxBusy(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [routeKey, route]);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setSpotsBusy(true);

        if (Array.isArray(route?.spots) && route.spots.length) {
          if (!alive) return;
          const linked = route.spots
            .map(normalizeSpot)
            .filter(Boolean)
            .slice(0, MAX_ROUTE_SPOTS);

          setSpotsDatasetCount(route.spots.length);
          setSpots(linked);
          return;
        }

        const tryFiles = [
          "/data/rider-spots.cleaned.google.json",
          "/data/rider-spots.cleaned.json",
        ];

        let arr = [];

        for (const file of tryFiles) {
          const data = await fetch(file, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []);

          if (Array.isArray(data) && data.length) {
            arr = data;
            break;
          }
        }

        if (!alive) return;

        setSpotsDatasetCount(arr.length);
        const linked = findSpotsAlongRoute(route, arr);
        setSpots(linked);
      } catch {
        if (!alive) return;
        setSpots([]);
        setSpotsDatasetCount(0);
      } finally {
        if (alive) setSpotsBusy(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [routeKey, route]);

  return (
    <>
      <div
        style={{
          position: "relative",
          height: 240,
          backgroundImage: `url(${photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.76))",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 10,
            color: "white",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.92 }}>
            {route.country || "—"} · {route.region || "—"} ·{" "}
            {route.rideType || "touring"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1.05 }}>
            {route.hero ? "🔥 " : ""}
            {route.name}
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {route.hero ? <span style={pill("dark")}>Hero</span> : null}
            <span style={pill("dark")}>
              📏 {route.distanceKm ? `${route.distanceKm} km` : "—"}
            </span>
            {route.durationMin != null ? (
              <span style={pill("dark")}>⏱ {route.durationMin} min</span>
            ) : null}
            <span style={pill("dark")}>
              🏍️ {route.rideType || "touring"}
            </span>
            {route.difficulty ? (
              <span style={pill("dark")}>⚡ {route.difficulty}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <button
          type="button"
          onClick={() => openGoogleMapsSmart(startNavUrl)}
          disabled={!startNavUrl}
          style={{
            display: "inline-block",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontSize: 13,
            cursor: startNavUrl ? "pointer" : "not-allowed",
            fontWeight: 900,
            opacity: startNavUrl ? 1 : 0.55,
          }}
          title={
            startNavUrl
              ? "Avvia navigazione verso l'inizio (usa la tua posizione automaticamente)"
              : "Coordinate itinerario non disponibili"
          }
        >
          🧭 Avvia verso START
        </button>

        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid rgba(0,0,0,0.08)",
            paddingTop: 12,
          }}
        >
          <strong>📌 Descrizione</strong>
          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              opacity: 0.9,
              lineHeight: 1.4,
            }}
          >
            {displayDescription}
          </div>
        </div>

        {Array.isArray(route?.aliases) && route.aliases.length ? (
          <div
            style={{
              marginTop: 12,
              borderTop: "1px solid rgba(0,0,0,0.08)",
              paddingTop: 12,
            }}
          >
            <strong>🏷️ Nomi collegati</strong>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {route.aliases.slice(0, 12).map((a) => (
                <span key={a} style={pill("light")}>
                  {a}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid rgba(0,0,0,0.08)",
            paddingTop: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <strong>🏔️ Passi / spot lungo il percorso</strong>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={pill("light")}>
                Dataset spot: <strong>{spotsDatasetCount}</strong>
              </span>
              <span style={pill("light")}>
                Collegati a questa rotta: <strong>{spots.length}</strong>
              </span>
            </div>
          </div>

          {spotsBusy ? (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 16,
                background: "rgba(0,0,0,0.04)",
              }}
            >
              Cerco i passi reali lungo la rotta…
            </div>
          ) : !spots.length ? (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 16,
                background: "rgba(0,0,0,0.04)",
              }}
            >
              Nessun passo collegato trovato nel dataset pulito.
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {spots.map((spot) => (
                <div
                  key={spot.id || spot.sourceId || `${spot.name}-${spot.lat}-${spot.lng}`}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: "white",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontWeight: 900, lineHeight: 1.2 }}>
                      {spot.name}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {spot._distanceKm != null ? (
                        <span style={pill("light")}>
                          📍 {spot._distanceKm} km
                        </span>
                      ) : null}

                      {spot.rating != null ? (
                        <span style={pill("light")}>
                          ⭐ {Number(spot.rating).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ fontSize: 13, opacity: 0.82 }}>
                    {spot.region || spot.regionHint || spot.country || "—"}
                    {spot.address ? ` · ${spot.address}` : ""}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Array.isArray(spot.tags)
                      ? spot.tags.slice(0, 4).map((tag) => (
                          <span key={tag} style={pill("light")}>
                            #{tag}
                          </span>
                        ))
                      : null}
                  </div>

                  {spot.googleMapsUri ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => openGoogleMapsSmart(spot.googleMapsUri)}
                        style={{
                          padding: "9px 11px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: "white",
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        📍 Apri in Google Maps
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid rgba(0,0,0,0.08)",
            paddingTop: 12,
          }}
        >
          <strong>🗺️ Mappa</strong>
          <div style={{ marginTop: 10 }}>
            <RouteMap route={route} />
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid rgba(0,0,0,0.08)",
            paddingTop: 12,
          }}
        >
          <strong>🌤 Meteo</strong>

          {wxBusy ? (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 16,
                background: "rgba(0,0,0,0.04)",
              }}
            >
              Carico meteo…
            </div>
          ) : !wx || !wx.ok ? (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 16,
                background: "rgba(0,0,0,0.04)",
              }}
            >
              {wx?.note || "Meteo non disponibile."}
            </div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span style={pill("light")}>
                  Condizione: <strong>{wx.worst}</strong>
                </span>

                {wx.temp != null ? (
                  <span style={pill("light")}>
                    🌡 {wx.temp}°{" "}
                    {wx.tempMin != null && wx.tempMax != null
                      ? `(min ${wx.tempMin}° / max ${wx.tempMax}°)`
                      : ""}
                  </span>
                ) : null}

                {wx.windKmh != null ? (
                  <span style={pill("light")}>
                    💨 vento {wx.windKmh} km/h
                  </span>
                ) : null}
              </div>

              {wx.ride ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background:
                      wx.ride.level === "danger"
                        ? "rgba(255,0,0,0.08)"
                        : wx.ride.level === "warn"
                        ? "rgba(255,180,0,0.12)"
                        : "rgba(0,140,80,0.10)",
                    border:
                      wx.ride.level === "danger"
                        ? "1px solid rgba(255,0,0,0.16)"
                        : wx.ride.level === "warn"
                        ? "1px solid rgba(255,180,0,0.22)"
                        : "1px solid rgba(0,140,80,0.18)",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 13 }}>
                    🏍 {wx.ride.label}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.85 }}>
                    {wx.ride.advice}
                  </div>
                </div>
              ) : null}

              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Aggiornato:{" "}
                {String(wx.updatedAt || "").slice(0, 16).replace("T", " ")}
              </div>
            </div>
          )}
        </div>

        {!navPoint ? (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
            Nota: questo itinerario non ha coordinate start/end complete nel dataset.
          </div>
        ) : null}
      </div>
    </>
  );
}

function pill(kind) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  if (kind === "dark") {
    return {
      ...base,
      border: "1px solid rgba(255,255,255,0.20)",
      background: "rgba(0,0,0,0.38)",
      color: "rgba(255,255,255,0.95)",
      backdropFilter: "blur(10px)",
      textShadow: "0 1px 2px rgba(0,0,0,0.35)",
    };
  }

  return {
    ...base,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.86)",
    color: "rgba(10,10,10,0.92)",
    backdropFilter: "blur(6px)",
  };
}