// =======================================================
// src/pages/Routes.jsx
// MotoPortEU — Itinerari (Touring)
// ✅ Responsive: mobile (lista -> dettaglio fullscreen) / desktop (split view)
// ✅ Filtri: paese, ricerca, pace, ordine
// ✅ Mappa traccia: RouteMap
// ✅ Meteo sul tragitto: getRouteWeatherSummary
// ✅ Google Maps: apertura smart (mobile -> app)
// Dati: /public/data/routes.json
// =======================================================

import { useEffect, useMemo, useState } from "react";
import RouteMap from "../components/RouteMap";
import { getRouteWeatherSummary } from "../utils/routeWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

const isMobileUA = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
const openGoogleMapsSmart = (url) => {
  if (!url) return;
  if (isMobileUA()) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
};

const latLonStr = (p) => {
  if (!p || p.length < 2) return null;
  const lat = Number(p[0]);
  const lon = Number(p[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `${lat},${lon}`;
};

const buildDirUrl = ({ origin, destination, waypoints = [], travelmode = "driving" }) => {
  if (!destination) return null;
  const o = origin ? `&origin=${encodeURIComponent(origin)}` : "";
  const d = `&destination=${encodeURIComponent(destination)}`;
  const mid = (waypoints || []).filter(Boolean).slice(0, 8).join("|");
  const w = mid ? `&waypoints=${encodeURIComponent(mid)}` : "";
  return `https://www.google.com/maps/dir/?api=1&travelmode=${encodeURIComponent(travelmode)}${o}${d}${w}`;
};

// prova a costruire un URL navigazione anche se i dati del percorso sono incompleti
function buildRouteNavUrl(route) {
  if (!route) return null;

  // 1) start/end (standard)
  if (Array.isArray(route.start) && Array.isArray(route.end)) {
    return buildDirUrl({
      origin: latLonStr(route.start),
      destination: latLonStr(route.end),
      travelmode: "driving",
    });
  }

  // 2) points/polyline/path (se presenti)
  const pts =
    route.points ||
    route.polylinePoints ||
    route.path ||
    route.polyline ||
    null;

  if (Array.isArray(pts) && pts.length >= 2) {
    const origin = latLonStr(pts[0]);
    const destination = latLonStr(pts[pts.length - 1]);
    const waypoints = pts.slice(1, -1).map(latLonStr).filter(Boolean).slice(0, 8);
    return buildDirUrl({ origin, destination, waypoints, travelmode: "driving" });
  }

  return null;
}

const paceLabel = (p) => {
  const s = String(p || "").toLowerCase();
  if (s.includes("tecn")) return "tecnico";
  if (s.includes("velo")) return "veloce";
  if (s.includes("pan")) return "panoramico";
  if (s.includes("mix")) return "misto";
  return p || "—";
};

const score = (n, fallback = 0) => {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
};

const S = {
  page: { width: "100%", padding: "16px 12px" },
  container: { maxWidth: 1180, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" },
  title: { margin: 0, fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em" },
  sub: { margin: "6px 0 0", opacity: 0.78, fontSize: 14, lineHeight: 1.35 },
  grid: { display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 },
  gridLg: { display: "grid", gridTemplateColumns: "420px 1fr", gap: 14, marginTop: 14 },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(255,255,255,0.72)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
    padding: 14,
  },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    background: "white",
    fontSize: 14,
    color: "#111",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.14)",
    outline: "none",
    background: "white",
    fontSize: 14,
    color: "#111",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  },
  btnGhost: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.60)",
    cursor: "pointer",
    fontWeight: 900,
  },
  pill: {
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(255,255,255,0.65)",
    fontWeight: 800,
    fontSize: 13,
  },
  small: { fontSize: 13, opacity: 0.78 },
  skeleton: {
    height: 78,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(0,0,0,0.04)",
  },
};

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [pace, setPace] = useState("ALL");
  const [order, setOrder] = useState("best"); // best | distance | curves

  const [selectedId, setSelectedId] = useState("");
  const selected = useMemo(
    () => routes.find((r) => r.id === selectedId) || null,
    [routes, selectedId]
  );

  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const onResize = () => setIsLg(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // mobile: dettaglio fullscreen
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  useEffect(() => {
    if (!isLg && selected) setShowDetailMobile(true);
  }, [isLg, selected]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/data/routes.json");
        const data = await res.json();
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];
        setRoutes(arr);
        setSelectedId(arr?.[0]?.id || "");
      } catch {
        if (!alive) return;
        setRoutes([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const countries = useMemo(() => {
    const s = new Set(routes.map((r) => r.country).filter(Boolean));
    return ["ALL", ...Array.from(s).sort()];
  }, [routes]);

  const filtered = useMemo(() => {
    const needle = String(q || "").trim().toLowerCase();
    let arr = routes.slice();

    if (country !== "ALL") arr = arr.filter((r) => String(r.country || "") === country);
    if (pace !== "ALL") arr = arr.filter((r) => paceLabel(r.pace) === pace);

    if (needle) {
      arr = arr.filter((r) => {
        const blob = `${r.name || ""} ${r.region || ""} ${r.description || ""}`.toLowerCase();
        return blob.includes(needle);
      });
    }

    if (order === "distance") {
      arr.sort((a, b) => score(a.distanceKm, 0) - score(b.distanceKm, 0));
    } else if (order === "curves") {
      arr.sort((a, b) => score(b.curvesScore, 0) - score(a.curvesScore, 0));
    } else {
      // "best" = curvesScore + asphaltScore
      arr.sort(
        (a, b) =>
          score(b.curvesScore, 0) + score(b.asphaltScore, 0) - (score(a.curvesScore, 0) + score(a.asphaltScore, 0))
      );
    }

    return arr;
  }, [routes, q, country, pace, order]);

  const selectedWeather = useMemo(() => {
    if (!selected) return null;
    try {
      return getRouteWeatherSummary(selected);
    } catch {
      return null;
    }
  }, [selected]);

  const openNav = () => {
    const url = buildRouteNavUrl(selected);
    if (!url) return alert("Navigazione non disponibile: mancano start/end o punti percorso.");
    openGoogleMapsSmart(url);
  };

  const Detail = () => {
    if (!selected) {
      return (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Seleziona un itinerario</div>
          <div style={{ marginTop: 6, opacity: 0.75 }}>Tocca una card dalla lista.</div>
        </div>
      );
    }

    const photo = selected.photo || FALLBACK_PHOTO;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!isLg && showDetailMobile && (
          <button
            style={{ ...S.btnGhost, alignSelf: "flex-start" }}
            onClick={() => setShowDetailMobile(false)}
          >
            ← Indietro
          </button>
        )}

        <div
          style={{
            ...S.card,
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative" }}>
            <img
              src={photo}
              alt={selected.name}
              style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
              onError={(e) => {
                e.currentTarget.src = FALLBACK_PHOTO;
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                right: 12,
                padding: 12,
                borderRadius: 16,
                background: "rgba(0,0,0,0.45)",
                color: "white",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.15 }}>{selected.name}</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>
                {selected.region || "—"} • {selected.country || "—"}
              </div>
            </div>
          </div>

          <div style={{ padding: 14 }}>
            <div style={S.row}>
              <span style={S.pill}>📏 {score(selected.distanceKm, 0).toFixed(0)} km</span>
              <span style={S.pill}>🌀 Curve {score(selected.curvesScore, 0)}/10</span>
              <span style={S.pill}>🛣️ Asfalto {score(selected.asphaltScore, 0)}/10</span>
              <span style={S.pill}>⚡ Pace {paceLabel(selected.pace)}</span>
            </div>

            {selectedWeather ? (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.82 }}>
                🌦️ Meteo (stima): <b>{selectedWeather.summary || "—"}</b>
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.72 }}>
                🌦️ Meteo: disponibile se config OWM/utility attive.
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.35, opacity: 0.9 }}>
              {selected.description || "—"}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={S.btn} onClick={openNav}>
                🧭 Invio navigazione
              </button>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>🗺️ Mappa</div>
          <RouteMap route={selected} height={isLg ? 420 : 320} />
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Tip: se un itinerario non mostra traccia, controlla che abbia start/end o points/polyline nel JSON.
          </div>
        </div>
      </div>
    );
  };

  const List = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={S.card}>
        <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 10 }}>Filtri</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ ...S.small, fontWeight: 800 }}>Paese</div>
            <select style={S.select} value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c === "ALL" ? "Tutti" : c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ ...S.small, fontWeight: 800 }}>Pace</div>
            <select style={S.select} value={pace} onChange={(e) => setPace(e.target.value)}>
              <option value="ALL">Tutte</option>
              <option value="tecnico">tecnico</option>
              <option value="veloce">veloce</option>
              <option value="panoramico">panoramico</option>
              <option value="misto">misto</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ ...S.small, fontWeight: 800 }}>Ricerca</div>
          <input
            style={S.input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Es: Stelvio, Dolomiti, Costa..."
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ ...S.small, fontWeight: 800 }}>Ordine</div>
          <select style={S.select} value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="best">Migliori (curve+asfalto)</option>
            <option value="curves">Più curve</option>
            <option value="distance">Più corti</option>
          </select>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Itinerari</div>
          <span style={S.pill}>{filtered.length}</span>
        </div>

        {loading ? (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={S.skeleton} />
            <div style={S.skeleton} />
            <div style={S.skeleton} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.78 }}>Nessun risultato. Prova a cambiare filtri.</div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((r) => {
              const active = r.id === selectedId;
              const rating = (score(r.curvesScore, 0) + score(r.asphaltScore, 0)) / 2;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedId(r.id);
                    if (!isLg) setShowDetailMobile(true);
                  }}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid rgba(0,0,0,0.10)",
                    background: active ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.65)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900 }}>{r.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{score(r.distanceKm, 0).toFixed(0)} km</div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
                    {r.country || "—"} • {paceLabel(r.pace)} • ⭐ {rating.toFixed(1)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // layout finale
  const showDetail = isLg ? true : showDetailMobile;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <style>{`
          input::placeholder { color: rgba(0,0,0,0.55); }
        `}</style>

        <div style={S.header}>
          <div>
            <h1 style={S.title}>Itinerari 🏍️</h1>
            <p style={S.sub}>Seleziona un itinerario e avvia la navigazione su Google Maps (mobile: apre l’app).</p>
          </div>

          {!isLg && showDetail && (
            <button style={S.btnGhost} onClick={() => setShowDetailMobile(false)}>
              📋 Torna alla lista
            </button>
          )}
        </div>

        <div style={isLg ? S.gridLg : S.grid}>
          {!isLg && showDetail ? null : <List />}
          {showDetail ? <Detail /> : null}
        </div>
      </div>
    </div>
  );
}