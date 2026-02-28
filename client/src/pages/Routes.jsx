// =======================================================
// src/pages/Routes.jsx
// Itinerari Touring
// UI: split-view su desktop (lista + dettaglio)
// Mobile: lista -> dettaglio (full screen) con back
// Dati: /public/data/routes.json
// ✅ Loading skeleton
// ✅ Dedup key stabile (id o name+start/end)
// ✅ Meteo + Google Maps
// =======================================================

import React, { useEffect, useMemo, useState } from "react";
import RouteMap from "../components/RouteMap";
import { getRouteWeatherSummary } from "../utils/routeWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

function isMobileNow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
}

// ✅ Smart open: mobile -> location.href (apre app meglio), desktop -> window.open
function openGoogleMapsSmart(url) {
  if (!url) return;
  if (isMobileNow()) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}

function latLonStr(p) {
  if (!p || p.length < 2) return null;
  const lat = Number(p[0]);
  const lon = Number(p[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat},${lon}`;
}

// ✅ Android: forza modalità navigazione (mostra "Avvia")
function buildNavigateUrl(destination, travelmode = "driving") {
  if (!destination) return null;
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=${encodeURIComponent(travelmode)}` +
    `&dir_action=navigate`
  );
}

function buildRouteKey(r) {
  const id = String(r?.id || "").trim();
  if (id) return `id:${id}`;
  const name = String(r?.name || "").trim().toLowerCase();
  const s = Array.isArray(r?.start)
    ? `${Number(r.start[0]).toFixed(5)},${Number(r.start[1]).toFixed(5)}`
    : "";
  const e = Array.isArray(r?.end)
    ? `${Number(r.end[0]).toFixed(5)},${Number(r.end[1]).toFixed(5)}`
    : "";
  return `n:${name}|${s}|${e}`;
}

function SkeletonLoading() {
  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 16, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.03)" }}>
      <div style={{ fontSize: 16, fontWeight: 900 }}>Carico itinerari…</div>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <div style={{ height: 12, background: "rgba(0,0,0,0.08)", borderRadius: 8, width: "70%" }} />
        <div style={{ height: 12, background: "rgba(0,0,0,0.08)", borderRadius: 8, width: "55%" }} />
        <div style={{ height: 12, background: "rgba(0,0,0,0.08)", borderRadius: 8, width: "80%" }} />
      </div>
    </div>
  );
}

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filtri base
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [sortBy, setSortBy] = useState("rating"); // rating | distance | curves

  // selezione
  const [activeKey, setActiveKey] = useState(null);
  const [selected, setSelected] = useState(null);

  // mobile view: "list" | "detail"
  const [mobileView, setMobileView] = useState("list");

  const isMobile = isMobileNow();
  const showDetailMobile = isMobile && mobileView === "detail" && selected;

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr("");
      try {
        const data = await fetch("/data/routes.json", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []);

        const arr = Array.isArray(data) ? data : [];

        // dedup
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
    const set = new Set(routes.map((r) => String(r.country || "").toUpperCase()).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [routes]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = [...routes];

    if (query) {
      out = out.filter((r) => {
        const blob = [r.name, r.region, r.country, r.description, r.bestSeason, r.pace].join(" ").toLowerCase();
        return blob.includes(query);
      });
    }

    if (country !== "ALL") out = out.filter((r) => String(r.country || "").toUpperCase() === country);

    const sorter =
      {
        rating: (a, b) => Number(b.rating || 0) - Number(a.rating || 0),
        distance: (a, b) => Number(b.distanceKm || 0) - Number(a.distanceKm || 0),
        curves: (a, b) => Number(b.curvesScore || 0) - Number(a.curvesScore || 0),
      }[sortBy] || (() => 0);

    out.sort(sorter);
    return out;
  }, [routes, q, country, sortBy]);

  // se selezione sparisce coi filtri: ripiega sul primo
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
    if (!routes.length) return null;
    if (activeKey) {
      const found = routes.find((r) => buildRouteKey(r) === activeKey);
      if (found) return found;
    }
    return routes[0] || null;
  }, [routes, activeKey]);

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
    <div className="routes-root" style={{ padding: 12, maxWidth: 1250, margin: "0 auto" }}>
      {/* Header (nascosto nel dettaglio mobile) */}
      {!showDetailMobile && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.5 }}>Itinerari 📍</h1>
              <div className="routes-subtitle" style={{ opacity: 0.75, marginTop: 6 }}>
                Touring emozionale: mappa, meteo e Google Maps.
              </div>
            </div>

            <input
              className="routes-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca: Stelvio, Dolomiti, curve…"
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
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
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
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
              >
                <option value="rating">Rating (desc)</option>
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
        <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: "rgba(255,0,0,0.08)" }}>{err}</div>
      ) : (
        <>
          {/* Mobile detail full screen */}
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

                <div style={{ fontWeight: 950, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selected.name}
                </div>
              </div>

              <div style={{ marginTop: 10, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.10)", background: "white" }}>
                <RouteDetail route={selected} />
              </div>
            </div>
          ) : (
            /* Desktop split + mobile list */
            <div style={{ marginTop: 12 }} className="routes-split">
              <div className="routes-list">
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                  Trovati: <strong>{filtered.length}</strong>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {filtered.map((r) => {
                    const key = buildRouteKey(r);
                    const isActive = key === activeKey;
                    return <RouteCard key={key} route={r} active={isActive} onSelect={() => selectRoute(r)} />;
                  })}
                </div>
              </div>

              <div className="routes-detail">
                <div style={{ borderRadius: 22, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)", background: "white" }}>
                  {!active ? <div style={{ padding: 14 }}>Seleziona un itinerario.</div> : <RouteDetail route={active} />}
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

  const click = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onSelect?.();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={click}
      onTouchStart={click}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? click(e) : null)}
      style={{
        borderRadius: 16,
        overflow: "hidden",
        width: "100%",
        border: active ? "2px solid rgba(0,0,0,0.30)" : "1px solid rgba(0,0,0,0.10)",
        background: "white",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {/* MOBILE */}
      <div className="route-card-mobile" style={{ display: "none", padding: 6, gap: 10, alignItems: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.05)", flex: "0 0 auto" }}>
          <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        </div>

        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
            <div style={{ fontWeight: 950, fontSize: 14, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {route.country ? `${route.country} ` : ""}
              {route.name}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, whiteSpace: "nowrap" }}>⭐ {Number(route.rating || 0).toFixed(1)}</div>
          </div>

          <div style={{ marginTop: 2, fontSize: 11, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {route.region || "—"} · {route.bestSeason || "—"} · {route.distanceKm ? `${route.distanceKm} km` : ""}
          </div>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="route-card-desktop" style={{ display: "block" }}>
        <div style={{ height: 130, backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, lineHeight: 1.15 }}>
              {route.country ? `${route.country} ` : ""}
              {route.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>⭐ {Number(route.rating || 0).toFixed(1)}</div>
          </div>

          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            {route.region || "—"} · {route.bestSeason || "—"} · {route.distanceKm ? `${route.distanceKm} km` : "—"}
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

  const start = Array.isArray(route?.start) ? route.start : null;
  const startNavUrl = start ? buildNavigateUrl(latLonStr(start), "driving") : null;

  const [wx, setWx] = useState(null);
  const [wxBusy, setWxBusy] = useState(false);

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
  }, [buildRouteKey(route)]);

  return (
    <>
      {/* Hero */}
      <div style={{ position: "relative", height: 240, backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.76))" }} />
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, color: "white" }}>
          <div style={{ fontSize: 12, opacity: 0.92 }}>
            {route.country || "—"} · {route.region || "—"} · {route.bestSeason || "—"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 950, lineHeight: 1.05 }}>{route.name}</div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pill("dark")}>⭐ {Number(route.rating || 0).toFixed(1)}</span>
            <span style={pill("dark")}>📏 {route.distanceKm ? `${route.distanceKm} km` : "—"}</span>
            <span style={pill("dark")}>🌀 curve {Number(route.curvesScore || 0)}/10</span>
            <span style={pill("dark")}>🛣️ asfalto {Number(route.asphaltScore || 0)}/10</span>
          </div>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        {/* ✅ SOLO 1 bottone: Avvia verso START (posizione attuale -> start) */}
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
          }}
          title="Avvia navigazione verso l'inizio (usa la tua posizione automaticamente)"
        >
          🧭 Avvia verso START
        </button>

        <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <strong>📌 Descrizione</strong>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9, lineHeight: 1.4 }}>{route.description || "—"}</div>
        </div>


        <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <strong>🌤 Meteo</strong>

          {wxBusy ? (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>Carico meteo…</div>
          ) : !wx || !wx.ok ? (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>{wx?.note || "Meteo non disponibile."}</div>
          ) : (
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={pill("light")}>
                  Condizione: <strong>{wx.worst}</strong>
                </span>
                {wx.temp != null ? (
                  <span style={pill("light")}>
                    🌡 {wx.temp}° {wx.tempMin != null && wx.tempMax != null ? `(min ${wx.tempMin}° / max ${wx.tempMax}°)` : ""}
                  </span>
                ) : null}
                {wx.windKmh != null ? <span style={pill("light")}>💨vento {wx.windKmh} km/h</span> : null}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Aggiornato: {String(wx.updatedAt || "").slice(0, 16).replace("T", " ")}</div>
            </div>
          )}
        </div>
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