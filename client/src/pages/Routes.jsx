// =======================================================
// src/pages/Routes.jsx
// UI Touring emozionale: foto + rating + curve + pace + filtri
// ✅ MAPPA (traccia) + METEO sul tragitto (campionamento punti)
// ✅ FIX: filtri paese/ricerca funzionanti
// ✅ Google Maps link ripristinato (nel posto giusto)
// Carica dati da: /public/data/routes.json
// =======================================================
import { useEffect, useMemo, useState } from "react";
import RouteMap from "../components/RouteMap";
import { getRouteWeatherSummary } from "../utils/routeWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

const paceLabel = (p) => {
  const s = String(p || "").toLowerCase();
  if (s === "lento") return "Lento";
  if (s === "misto") return "Misto";
  if (s === "veloce") return "Veloce";
  if (s === "tecnico") return "Tecnico";
  if (s === "touring") return "Touring";
  if (s === "avventura") return "Avventura";
  return p ? String(p) : "—";
};

const curveLabel = (n) => {
  const v = Number(n || 0);
  if (v >= 9) return "Tornanti";
  if (v >= 7) return "Curve";
  if (v >= 5) return "Misto";
  return "Scorrevole";
};

const scorePill = (v) => {
  const n = Number(v || 0);
  if (n >= 9) return { label: "TOP", level: "ok" };
  if (n >= 7) return { label: "OTTIMO", level: "soon" };
  if (n >= 5) return { label: "BUONO", level: "warn" };
  return { label: "BASIC", level: "bad" };
};

function pillStyle(level) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.78)",
    backdropFilter: "blur(6px)",
    whiteSpace: "nowrap",
  };
  if (level === "bad") return { ...base, background: "rgba(255,0,0,0.10)" };
  if (level === "warn") return { ...base, background: "rgba(255,140,0,0.12)" };
  if (level === "soon") return { ...base, background: "rgba(255,215,0,0.16)" };
  return base;
}

function countryFlag(cc) {
  const c = String(cc || "").toUpperCase();
  const map = {
    IT: "🇮🇹",
    FR: "🇫🇷",
    DE: "🇩🇪",
    AT: "🇦🇹",
    CH: "🇨🇭",
    ES: "🇪🇸",
    NO: "🇳🇴",
    SE: "🇸🇪",
    FI: "🇫🇮",
    RO: "🇷🇴",
    SI: "🇸🇮",
    HR: "🇭🇷",
    BA: "🇧🇦",
    ME: "🇲🇪",
    AL: "🇦🇱",
    GR: "🇬🇷",
  };
  return map[c] || "🏍️";
}

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filtri UI
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [pace, setPace] = useState("ALL");
  const [minCurves, setMinCurves] = useState(0); // 0..10
  const [sortBy, setSortBy] = useState("curves"); // curves | asphalt | distance

  const [activeId, setActiveId] = useState(null);

  // load
  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/data/routes.json", { cache: "no-store" });
        if (!r.ok) throw new Error("Impossibile caricare /data/routes.json");
        const data = await r.json();
        const arr = Array.isArray(data) ? data : [];
        if (!alive) return;
        setRoutes(arr);

        // se avevi un activeId che dopo filtro scompare, qui rimaniamo su primo disponibile
        setActiveId((prev) => prev || arr?.[0]?.id || null);
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

  const paces = useMemo(() => {
    const set = new Set(
      routes.map((r) => String(r.pace || "").toLowerCase()).filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort()];
  }, [routes]);

  // ✅ FILTRO + RICERCA (fix)
  const filtered = useMemo(() => {
    let out = [...routes];

    const query = q.trim().toLowerCase();
    if (query) {
      out = out.filter((r) => {
        const blob = [
          r.name,
          r.region,
          r.country,
          r.bestSeason,
          r.description,
          r.pace,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(query);
      });
    }

    if (country !== "ALL") {
      out = out.filter(
        (r) => String(r.country || "").toUpperCase() === country
      );
    }

    if (pace !== "ALL") {
      out = out.filter(
        (r) => String(r.pace || "").toLowerCase() === String(pace).toLowerCase()
      );
    }

    out = out.filter(
      (r) => Number(r.curvesScore || 0) >= Number(minCurves || 0)
    );

    const sorter = {
      curves: (a, b) =>
        Number(b.curvesScore || 0) - Number(a.curvesScore || 0),
      asphalt: (a, b) =>
        Number(b.asphaltScore || 0) - Number(a.asphaltScore || 0),
      distance: (a, b) =>
        Number(a.distanceKm || 0) - Number(b.distanceKm || 0),
    }[sortBy];

    return sorter ? out.sort(sorter) : out;
  }, [routes, q, country, pace, minCurves, sortBy]);

  // ✅ active: se filtro cambia e active non è più presente, scegli il primo
  useEffect(() => {
    if (!filtered.length) return;
    const exists = filtered.some((r) => r.id === activeId);
    if (!exists) setActiveId(filtered[0].id);
  }, [filtered, activeId]);

  const active = useMemo(
    () => routes.find((r) => r.id === activeId) || null,
    [routes, activeId]
  );

  return (
    <div style={{ padding: 20, maxWidth: 1250, margin: "0 auto" }}>
      {/* Header */}
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
          <h1 style={{ margin: 0 }}>Itinerari 🗺️</h1>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Touring emozionale: foto, voto, curve e ritmo. (Con mappa + meteo.)
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca: Stelvio, Dolomiti, Capo Nord, neve…"
          style={{
            minWidth: 320,
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            outline: "none",
          }}
        />
      </div>

      {/* Filters */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
                {c === "ALL" ? "Tutti" : `${countryFlag(c)} ${c}`}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Ritmo</span>
          <select
            value={pace}
            onChange={(e) => setPace(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          >
            {paces.map((p) => (
              <option key={p} value={p}>
                {p === "ALL" ? "Tutti" : paceLabel(p)}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Curve min</span>
          <input
            type="range"
            min="0"
            max="10"
            value={minCurves}
            onChange={(e) => setMinCurves(Number(e.target.value))}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {minCurves}/10 (da {curveLabel(minCurves)})
          </div>
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
            <option value="curves">Curve (desc)</option>
            <option value="asphalt">Asfalto (desc)</option>
            <option value="distance">Distanza (asc)</option>
          </select>
        </label>
      </div>

      {/* Content */}
      {loading ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 16,
            background: "rgba(0,0,0,0.04)",
          }}
        >
          Carico itinerari…
        </div>
      ) : err ? (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 16,
            background: "rgba(255,0,0,0.08)",
          }}
        >
          {err}
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "420px 1fr",
            gap: 14,
          }}
        >
          {/* Cards */}
          <div style={{ display: "grid", gap: 12, height: "fit-content" }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Trovati: <strong>{filtered.length}</strong>
            </div>

            {filtered.map((r) => (
              <RouteCard
                key={r.id}
                route={r}
                active={r.id === activeId}
                onClick={() => setActiveId(r.id)}
              />
            ))}

            {filtered.length === 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "rgba(0,0,0,0.04)",
                }}
              >
                Nessun itinerario trovato.
              </div>
            )}
          </div>

          {/* Detail */}
          <div
            style={{
              borderRadius: 22,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.12)",
              background: "white",
              height: "fit-content",
            }}
          >
            {!active ? (
              <div style={{ padding: 14 }}>Seleziona un itinerario.</div>
            ) : (
              <RouteDetail route={active} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RouteCard({ route, active, onClick }) {
  const photo = route.photo || FALLBACK_PHOTO;
  const curves = Number(route.curvesScore || 0);
  const asphalt = Number(route.asphaltScore || 0);

  const cPill = scorePill(curves);
  const aPill = scorePill(asphalt);

  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        borderRadius: 18,
        overflow: "hidden",
        border: active
          ? "2px solid rgba(0,0,0,0.35)"
          : "1px solid rgba(0,0,0,0.12)",
        background: "white",
        boxShadow: active ? "0 10px 30px rgba(0,0,0,0.12)" : "none",
      }}
    >
      <div
        style={{
          height: 130,
          backgroundImage: `url(${photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontWeight: 900, lineHeight: 1.15 }}>
            {countryFlag(route.country)} {route.name}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
            {route.distanceKm} km
          </div>
        </div>

        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
          {route.region} · stagione: {route.bestSeason || "—"}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={pillStyle(cPill.level)}>
            🌀 Curve {curves}/10 · {cPill.label}
          </span>
          <span style={pillStyle(aPill.level)}>
            🛣️ Asfalto {asphalt}/10 · {aPill.label}
          </span>
          <span style={pillStyle("ok")}>🏍 {paceLabel(route.pace)}</span>
        </div>

        {route.description ? (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            {route.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RouteDetail({ route }) {
  const photo = route.photo || FALLBACK_PHOTO;
  const curves = Number(route.curvesScore || 0);
  const asphalt = Number(route.asphaltScore || 0);

  const cPill = scorePill(curves);
  const aPill = scorePill(asphalt);

  // ✅ METEO (campionamento punti) — usa routeWeather.js
  const [wx, setWx] = useState(null);
  const [wxBusy, setWxBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function run() {
      setWxBusy(true);
      try {
        const out = await getRouteWeatherSummary(route);
        if (alive) setWx(out);
      } finally {
        if (alive) setWxBusy(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [route?.id]);

  const wxBox = (() => {
    if (wxBusy) {
      return (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
          Carico meteo sul tragitto…
        </div>
      );
    }
    if (!wx) {
      return (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
          Meteo non disponibile.
        </div>
      );
    }
    if (!wx.ok) {
      return (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
          {wx.note || "Meteo non disponibile."}
        </div>
      );
    }

    const worstLevel =
      wx.worst === "sereno"
        ? "ok"
        : wx.worst === "nuvoloso"
        ? "soon"
        : wx.worst === "variabile"
        ? "soon"
        : wx.worst === "nebbia"
        ? "warn"
        : wx.worst === "pioggia"
        ? "warn"
        : wx.worst === "neve"
        ? "warn"
        : "bad";

    return (
      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle(worstLevel)}>
            Condizione peggiore: <strong>{wx.worst}</strong>
          </span>

          {wx.tempMin !== null && wx.tempMax !== null ? (
            <span style={pillStyle("ok")}>
              🌡 {wx.tempMin}° / {wx.tempMax}° (avg {wx.temp}°)
            </span>
          ) : null}

          {wx.windAvgKmh !== null && wx.windMaxKmh !== null ? (
            <span style={pillStyle(wx.windMaxKmh >= 50 ? "warn" : "ok")}>
              💨 vento avg {wx.windAvgKmh} km/h · max {wx.windMaxKmh} km/h
            </span>
          ) : null}

          <span style={pillStyle("ok")}>📍 punti: {wx.points}</span>
        </div>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Aggiornato: {String(wx.updatedAt || "").slice(0, 16).replace("T", " ")}
        </div>
      </div>
    );
  })();

  return (
    <>
      {/* Hero */}
      <div
        style={{
          position: "relative",
          height: 280,
          backgroundImage: `url(${photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.72))",
          }}
        />
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: "white" }}>
          <div style={{ fontSize: 13, opacity: 0.92 }}>
            {countryFlag(route.country)} {route.country} · {route.region}
          </div>
          <div style={{ fontSize: 30, fontWeight: 950, letterSpacing: 0.2 }}>{route.name}</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pillStyle(cPill.level)}>
              🌀 Curve {curves}/10 · {cPill.label}
            </span>
            <span style={pillStyle(aPill.level)}>
              🛣️ Asfalto {asphalt}/10 · {aPill.label}
            </span>
            <span style={pillStyle("ok")}>
              🏍 Ritmo: <strong>{paceLabel(route.pace)}</strong>
            </span>
            <span style={pillStyle("ok")}>📏 {route.distanceKm} km</span>
            <span style={pillStyle("ok")}>🗓 {route.bestSeason || "—"}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          <Stat label="Curve" value={`${curves}/10 (${curveLabel(curves)})`} />
          <Stat label="Asfalto" value={`${asphalt}/10`} />
          <Stat label="Ritmo" value={paceLabel(route.pace)} />
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
          <strong>📌 Descrizione</strong>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9, lineHeight: 1.4 }}>
            {route.description || "—"}
          </div>

          {/* ✅ Google Maps link (messo nel posto giusto) */}
          <div style={{ marginTop: 12 }}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${route.name} ${route.region || ""}`
              )}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              📍 Apri in Google Maps
            </a>
          </div>
        </div>

        {/* ✅ MAPPA (traccia reale se nel JSON c'è polyline; fallback start/end) */}
        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
          <strong>🗺️ Percorso</strong>
          <div style={{ marginTop: 10 }}>
            <RouteMap route={route} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Traccia reale: aggiungi <code>polyline</code> (array di [lat,lng]) nel routes.json.
            Fallback: <code>start/end</code>.
          </div>
        </div>

        {/* ✅ METEO */}
        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
          <strong>🌤 Meteo sul tragitto</strong>
          {wxBox}
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Serve <code>VITE_OWM_KEY</code>. Se manca polyline/start-end il meteo non può campionare.
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ padding: 12, borderRadius: 16, border: "1px solid rgba(0,0,0,0.12)" }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 950, marginTop: 2 }}>{value}</div>
    </div>
  );
}
