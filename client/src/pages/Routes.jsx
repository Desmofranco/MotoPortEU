// =======================================================
// client/src/pages/Routes.jsx
// Itinerari Touring
// UI: split-view su desktop (lista + dettaglio)
// Mobile: lista -> dettaglio (full screen) con back
// Dati LIVE: /public/data/routes.json
// ✅ Loading skeleton
// ✅ Meteo + Google Maps
// ✅ FIX mobile: no aperture accidentali durante scroll
// ✅ Ricerca intelligente su:
//    - name
//    - description
//    - aliases
//    - searchText
//    - tags
//    - waypoints[].name
// ✅ Filtri: Paese / Regione / Categoria
// ✅ Categorie commerciali: Montagna / Laghi / Mare
// ✅ Supporto completo nuovo dataset routes.json
// =======================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import RouteMap from "../components/RouteMap";
import { getRouteWeatherSummary } from "../utils/routeWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

const TAP_MOVE_THRESHOLD = 12;

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

function normalizeRoute(route) {
  return {
    ...route,
    aliases: Array.isArray(route?.aliases) ? route.aliases : [],
    tags: Array.isArray(route?.tags) ? route.tags : [],
    searchTags: Array.isArray(route?.searchTags) ? route.searchTags : [],
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
    route?.countryName,
    route?.description,
    route?.bestSeason,
    route?.pace,
    route?.rideType,
    route?.routeFamily,
    route?.mode,
    route?.surface,
    route?.difficulty,
    route?.searchText,
    ...(route?.aliases || []),
    ...(route?.tags || []),
    ...(route?.searchTags || []),
    ...(route?.waypoints || []).map((w) => w?.name),
    ...(route?.spots || []).map((s) => s?.name),
    route?.start?.name,
    route?.end?.name,
  ].filter(Boolean);

  return normalizeText(parts.join(" "));
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

  return null;
}

function normalizeCategory(route) {
  const family = normalizeText(route?.routeFamily || route?.rideType);

  if (family === "mountain") return "mountain";
  if (family === "lake") return "lake";
  if (family === "coastal") return "coastal";

  const tags = Array.isArray(route?.searchTags)
    ? route.searchTags.map((x) => normalizeText(x))
    : [];

  if (tags.includes("montagna")) return "mountain";
  if (tags.includes("lago") || tags.includes("laghi")) return "lake";
  if (tags.includes("mare")) return "coastal";

  const blob = routeSearchBlob(route);

  if (
    blob.includes("lago") ||
    blob.includes("lake") ||
    blob.includes("garda") ||
    blob.includes("como") ||
    blob.includes("maggiore") ||
    blob.includes("iseo") ||
    blob.includes("trasimeno") ||
    blob.includes("ledro") ||
    blob.includes("orta")
  ) {
    return "lake";
  }

  if (
    blob.includes("coast") ||
    blob.includes("costiera") ||
    blob.includes("mare") ||
    blob.includes("riviera") ||
    blob.includes("amalfi") ||
    blob.includes("salento") ||
    blob.includes("liguria") ||
    blob.includes("sardegna") ||
    blob.includes("sicilia") ||
    blob.includes("adriatic") ||
    blob.includes("tirreno") ||
    blob.includes("ionio") ||
    blob.includes("conero")
  ) {
    return "coastal";
  }

  return "mountain";
}

function categoryLabel(category) {
  if (category === "mountain") return "Montagna";
  if (category === "lake") return "Laghi";
  if (category === "coastal") return "Mare";
  return "Tutte";
}

function countryLabel(code) {
  const map = {
    IT: "Italia",
    FR: "Francia",
    CH: "Svizzera",
    AT: "Austria",
    DE: "Germania",
    ES: "Spagna",
    PT: "Portogallo",
    SI: "Slovenia",
    HR: "Croazia",
    BA: "Bosnia",
    ME: "Montenegro",
    AL: "Albania",
    RO: "Romania",
    SK: "Slovacchia",
    CZ: "Cechia",
    PL: "Polonia",
    NO: "Norvegia",
    SE: "Svezia",
    UK: "Regno Unito",
    IE: "Irlanda",
    BE: "Belgio",
    NL: "Olanda",
    LU: "Lussemburgo",
  };
  return map[code] || code;
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
  const [region, setRegion] = useState("ALL");
  const [category, setCategory] = useState("ALL");

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
      routes
        .map((r) => String(r.country || r.countryName || "").toUpperCase())
        .filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort()];
  }, [routes]);

  const regions = useMemo(() => {
    const set = new Set();

    routes.forEach((r) => {
      const rc = String(r.country || r.countryName || "").toUpperCase();
      if (country !== "ALL" && rc !== country) return;

      const rg = String(r.region || "").trim();
      if (rg) set.add(rg);
    });

    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b, "it"))];
  }, [routes, country]);

  useEffect(() => {
    setRegion("ALL");
  }, [country]);

  const filtered = useMemo(() => {
    const query = normalizeText(q.trim());
    let out = [...routes];

    if (country !== "ALL") {
      out = out.filter(
        (r) => String(r.country || r.countryName || "").toUpperCase() === country
      );
    }

    if (region !== "ALL") {
      out = out.filter((r) => String(r.region || "").trim() === region);
    }

    if (category !== "ALL") {
      out = out.filter((r) => normalizeCategory(r) === category);
    }

    if (query) {
      out = out.filter((r) => routeSearchBlob(r).includes(query));
    }

    out.sort((a, b) => {
      const ca = normalizeCategory(a);
      const cb = normalizeCategory(b);

      if (category === "ALL" && ca !== cb) {
        const order = { mountain: 1, lake: 2, coastal: 3 };
        return (order[ca] || 99) - (order[cb] || 99);
      }

      const ra = String(a.region || "");
      const rb = String(b.region || "");
      if (ra !== rb) return ra.localeCompare(rb, "it");

      return Number(b.distanceKm || 0) - Number(a.distanceKm || 0);
    });

    return out;
  }, [routes, q, country, region, category]);

  useEffect(() => {
    if (!filtered.length) {
      setActiveKey(null);
      setSelected(null);
      return;
    }

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
                Touring emozionale: mappa e meteo lungo il percorso.
              </div>
            </div>

            <input
              className="routes-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca: Stelvio, Garda, Amalfi, Dolomiti…"
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
                    {c === "ALL" ? "Tutti" : countryLabel(c)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Regione</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r === "ALL" ? "Tutte" : r}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Categoria</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                }}
              >
                <option value="ALL">Tutte</option>
                <option value="mountain">Montagna</option>
                <option value="lake">Laghi</option>
                <option value="coastal">Mare</option>
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
                  {selected?.name}
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
  const category = normalizeCategory(route);

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
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              fontSize: 11,
              opacity: 0.82,
            }}
          >
            <span>{route.region || "—"}</span>
            <span>·</span>
            <span>{categoryLabel(category)}</span>
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
              {route.country ? `${route.country} ` : ""}
              {route.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
              {route.distanceKm ? `${route.distanceKm} km` : "—"}
            </div>
          </div>

          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <span style={pill("light")}>{categoryLabel(category)}</span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              {route.region || "—"}
            </span>
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
  const category = normalizeCategory(route);

  const [wx, setWx] = useState(null);
  const [wxBusy, setWxBusy] = useState(false);

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
            {categoryLabel(category)}
          </div>
          <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1.05 }}>
            {route.name}
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill("dark")}>
              📏 {route.distanceKm ? `${route.distanceKm} km` : "—"}
            </span>
            {route.durationMin != null ? (
              <span style={pill("dark")}>⏱ {route.durationMin} min</span>
            ) : null}
            <span style={pill("dark")}>🏍️ {categoryLabel(category)}</span>
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