// =======================================================
// src/pages/Tracks.jsx
// Piste: supersport / enduro / cross
// UI: split-view su desktop (lista + dettaglio)
// Mobile: lista -> dettaglio (full screen) con back
// Dati: /public/data/tracks.json + /public/data/tracks.eu.json
// ✅ Loading skeleton
// ✅ Dedup key stabile (id o name+coords)
// ✅ Meteo + Google Maps
// ✅ Warning VITE_OWM_KEY solo se manca key E non c’è meteo
// ✅ Mobile: filtri collassabili inline
// ✅ Mobile detail: mini header sticky + swipe down close + hero che si riduce
// ✅ Mobile ULTRA COMPACT: header + lista più piccoli
// =======================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import TrackMap from "../components/TrackMap";
import { getTrackWeatherSummary } from "../utils/trackWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

/** Pill "chiaro" (sezioni normali) */
function pillStyle(level) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.14)",
    background: "rgba(255,255,255,0.86)",
    backdropFilter: "blur(6px)",
    whiteSpace: "nowrap",
    color: "rgba(10,10,10,0.92)",
  };
  if (level === "bad") return { ...base, background: "rgba(255,0,0,0.10)" };
  if (level === "warn") return { ...base, background: "rgba(255,140,0,0.12)" };
  if (level === "soon") return { ...base, background: "rgba(255,215,0,0.16)" };
  return base;
}

/** Pill "dark glass" SOLO su hero foto */
function pillStyleHero(level) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(255,255,255,0.20)",
    background: "rgba(0,0,0,0.38)",
    backdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,0.95)",
    textShadow: "0 1px 2px rgba(0,0,0,0.35)",
  };
  if (level === "bad") return { ...base, background: "rgba(220,38,38,0.30)" };
  if (level === "warn") return { ...base, background: "rgba(245,158,11,0.30)" };
  if (level === "soon") return { ...base, background: "rgba(234,179,8,0.28)" };
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
    NL: "🇳🇱",
    BE: "🇧🇪",
    PT: "🇵🇹",
    GB: "🇬🇧",
    IE: "🇮🇪",
    PL: "🇵🇱",
    CZ: "🇨🇿",
    SK: "🇸🇰",
    HU: "🇭🇺",
    SI: "🇸🇮",
    HR: "🇭🇷",
    GR: "🇬🇷",
  };
  return map[c] || "🏁";
}

function typeLabel(t) {
  const s = String(t || "").toLowerCase();
  if (s === "supersport") return "SuperSport";
  if (s === "enduro") return "Enduro";
  if (s === "cross") return "Cross";
  return t ? String(t) : "—";
}

function surfaceLabel(s) {
  const v = String(s || "").toLowerCase();
  if (v === "asphalt") return "Asfalto";
  if (v === "dirt") return "Terra";
  if (v === "mixed") return "Misto";
  return s ? String(s) : "—";
}

function scorePill(v) {
  const n = Number(v || 0);
  if (n >= 9) return { label: "TOP", level: "ok" };
  if (n >= 7.5) return { label: "OTTIMA", level: "soon" };
  if (n >= 6) return { label: "BUONA", level: "warn" };
  return { label: "BASIC", level: "bad" };
}

function weatherLevel(worst) {
  const s = String(worst || "").toLowerCase();
  if (!s) return "ok";
  if (s.includes("temporale")) return "bad";
  if (s.includes("neve")) return "warn";
  if (s.includes("pioggia")) return "warn";
  if (s.includes("nebbia")) return "warn";
  if (s.includes("variabile")) return "soon";
  if (s.includes("nuvoloso")) return "soon";
  return "ok";
}

function normalizeIncomingTrack(t) {
  const id = String(t?.id || "").trim();
  const name = t?.name || t?.title || "Senza nome";
  const country = String(t?.country || "").toUpperCase();
  const region = t?.region || "";
  const type = String(t?.type || t?.kind || "").toLowerCase();
  const surface = String(t?.surface || "").toLowerCase();
  const lat = t?.coords?.lat ?? t?.start?.lat ?? null;
  const lng = t?.coords?.lng ?? t?.start?.lng ?? null;

  return {
    ...t,
    id,
    name,
    country,
    region,
    type,
    surface,
    coords: {
      lat: lat ?? t?.coords?.lat,
      lng: lng ?? t?.coords?.lng,
    },
  };
}

function buildDedupeKey(t) {
  const id = String(t?.id || "").trim();
  if (id) return `id:${id}`;
  const name = String(t?.name || "").trim().toLowerCase();
  const lat = t?.coords?.lat != null ? Number(t.coords.lat).toFixed(6) : "";
  const lng = t?.coords?.lng != null ? Number(t.coords.lng).toFixed(6) : "";
  return `n:${name}|${lat}|${lng}`;
}

function getTrackKey(t) {
  return buildDedupeKey(t);
}

function isMobileNow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
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
      <div style={{ fontSize: 16, fontWeight: 800 }}>Carico piste…</div>
      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <div style={{ height: 12, background: "rgba(0,0,0,0.08)", borderRadius: 8, width: "70%" }} />
        <div style={{ height: 12, background: "rgba(0,0,0,0.08)", borderRadius: 8, width: "55%" }} />
        <div style={{ height: 12, background: "rgba(0,0,0,0.08)", borderRadius: 8, width: "80%" }} />
      </div>
    </div>
  );
}

export default function Tracks() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filtri
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [surface, setSurface] = useState("ALL");
  const [sortBy, setSortBy] = useState("rating"); // rating | difficulty | length

  // mobile: filtri collassabili
  const [showFilters, setShowFilters] = useState(false);

  // selezione
  const [activeKey, setActiveKey] = useState(null);
  const [selected, setSelected] = useState(null);

  // mobile view: "list" | "detail"
  const [mobileView, setMobileView] = useState("list");

  // sticky mini header (mobile detail)
  const [miniHeader, setMiniHeader] = useState(false);

  const isMobile = isMobileNow();
  const showDetailMobile = isMobile && mobileView === "detail" && selected;

  useEffect(() => {
    let alive = true;

    async function run() {
      setLoading(true);
      setErr("");

      try {
        const [a, b] = await Promise.all([
          fetch("/data/tracks.json", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
          fetch("/data/tracks.eu.json", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ]);

        const arrA = Array.isArray(a) ? a : [];
        const arrB = Array.isArray(b) ? b : [];
        const merged = [...arrA, ...arrB].map(normalizeIncomingTrack);

        const seen = new Set();
        const dedup = [];
        for (const t of merged) {
          const key = buildDedupeKey(t);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          dedup.push(t);
        }

        if (!alive) return;

        setTracks(dedup);

        const first = dedup[0] || null;
        const firstKey = first ? getTrackKey(first) : null;

        setActiveKey((prev) => prev || firstKey);
        setSelected((prev) => prev || first);

        setMobileView("list");
        setMiniHeader(false);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Errore caricamento piste");
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
    const set = new Set(tracks.map((t) => String(t.country || "").toUpperCase()).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [tracks]);

  const types = useMemo(() => {
    const set = new Set(tracks.map((t) => String(t.type || "").toLowerCase()).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [tracks]);

  const surfaces = useMemo(() => {
    const set = new Set(tracks.map((t) => String(t.surface || "").toLowerCase()).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [tracks]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = [...tracks];

    if (query) {
      out = out.filter((t) => {
        const blob = [t.name, t.region, t.country, t.type, t.surface, t.description, t.bestSeason]
          .join(" ")
          .toLowerCase();
        return blob.includes(query);
      });
    }

    if (country !== "ALL") out = out.filter((t) => String(t.country || "").toUpperCase() === country);
    if (type !== "ALL") out = out.filter((t) => String(t.type || "").toLowerCase() === String(type).toLowerCase());
    if (surface !== "ALL") out = out.filter((t) => String(t.surface || "").toLowerCase() === String(surface).toLowerCase());

    const sorter =
      {
        rating: (a, b) => Number(b.rating || 0) - Number(a.rating || 0),
        difficulty: (a, b) => Number(b.difficulty || 0) - Number(a.difficulty || 0),
        length: (a, b) => Number(b.lengthKm || 0) - Number(a.lengthKm || 0),
      }[sortBy] || (() => 0);

    out.sort(sorter);
    return out;
  }, [tracks, q, country, type, surface, sortBy]);

  // se i filtri cambiano e la selezione non esiste più, ripiega sul primo
  useEffect(() => {
    if (!filtered.length) return;
    const exists = filtered.some((t) => getTrackKey(t) === activeKey);
    if (!exists) {
      const first = filtered[0];
      setActiveKey(getTrackKey(first));
      setSelected(first);
      if (isMobileNow()) setMobileView("list");
    }
  }, [filtered, activeKey]);

  const active = useMemo(() => {
    if (!tracks.length) return null;
    if (activeKey) {
      const found = tracks.find((t) => getTrackKey(t) === activeKey);
      if (found) return found;
    }
    return tracks[0] || null;
  }, [tracks, activeKey]);

  const selectTrack = (t) => {
    const key = getTrackKey(t);
    setActiveKey(key);
    setSelected(t);

    if (isMobileNow()) {
      setMobileView("detail");
      setMiniHeader(false);
      setShowFilters(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Sticky mini header: quando scrolli abbastanza nel dettaglio mobile
  useEffect(() => {
    if (!showDetailMobile) return;

    const onScroll = () => {
      setMiniHeader((window.scrollY || 0) > 90);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [showDetailMobile]);

  return (
    <div className="tracks-root" style={{ padding: 16, maxWidth: 1250, margin: "0 auto" }}>
      {/* HEADER + FILTRI: nascosti nel dettaglio mobile */}
      {!showDetailMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "start" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 44, letterSpacing: -0.5 }}>Piste 🏁</h1>
              <div className="tracks-subtitle" style={{ opacity: 0.75, marginTop: 6 }}>
                SuperSport, Enduro e Cross: mappa, meteo e link Google.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input
                className="tracks-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca: Mugello, Misano, enduro, cross…"
                style={{
                  width: "min(520px, 100%)",
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.15)",
                  outline: "none",
                }}
              />

              {/* Mobile: bottone filtri */}
              {isMobile && (
                <button
                  className="tracks-filters-btn"
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  {showFilters ? "Chiudi filtri ✕" : "Filtri ⚙️"}
                </button>
              )}
            </div>
          </div>

          {/* FILTERS */}
          {(!isMobile || showFilters) && (
            <div
              style={{
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
                      {c === "ALL" ? "Tutti" : `${countryFlag(c)} ${c}`}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Tipo</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
                >
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {t === "ALL" ? "Tutti" : typeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, opacity: 0.75 }}>Fondo</span>
                <select
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
                >
                  {surfaces.map((s) => (
                    <option key={s} value={s}>
                      {s === "ALL" ? "Tutti" : surfaceLabel(s)}
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
                  <option value="difficulty">Difficoltà (desc)</option>
                  <option value="length">Lunghezza (desc)</option>
                </select>
              </label>
            </div>
          )}
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <SkeletonLoading />
      ) : err ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: "rgba(255,0,0,0.08)" }}>{err}</div>
      ) : (
        <>
          {/* MOBILE: dettaglio single-screen */}
          {showDetailMobile ? (
            <div style={{ marginTop: 10 }}>
              {/* Sticky mini header */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  background: "rgba(255,255,255,0.96)",
                  backdropFilter: "blur(10px)",
                  borderBottom: "1px solid rgba(0,0,0,0.10)",
                  padding: miniHeader ? "8px 10px" : "10px 10px",
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
                    setMiniHeader(false);
                    window.scrollTo({ top: 0, behavior: "auto" });
                  }}
                  style={{
                    padding: miniHeader ? "8px 10px" : "9px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    flex: "0 0 auto",
                    fontWeight: 900,
                  }}
                >
                  ← Indietro
                </button>

                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div
                    style={{
                      fontWeight: 950,
                      fontSize: miniHeader ? 14 : 15,
                      lineHeight: 1.15,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {countryFlag(selected.country)} {selected.name}
                  </div>
                  {miniHeader ? (
                    <div style={{ marginTop: 2, fontSize: 12, opacity: 0.75, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span>⭐ {Number(selected.rating || 0).toFixed(1)}</span>
                      <span>{typeLabel(selected.type)}</span>
                      <span>{surfaceLabel(selected.surface)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={{ marginTop: 10, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.10)", background: "white" }}>
                <TrackDetail
                  track={selected}
                  onClose={() => {
                    setMobileView("list");
                    setMiniHeader(false);
                    window.scrollTo({ top: 0, behavior: "auto" });
                  }}
                />
              </div>
            </div>
          ) : (
            /* DESKTOP: split + MOBILE: lista */
            <div style={{ marginTop: 12 }} className="tracks-split">
              {/* LIST */}
              <div className="tracks-list">
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                  Trovate: <strong>{filtered.length}</strong> (EU import incluse)
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {filtered.map((t) => {
                    const key = getTrackKey(t);
                    const isActive = key === activeKey;
                    return <TrackCard key={key} track={t} active={isActive} onSelect={() => selectTrack(t)} />;
                  })}

                  {filtered.length === 0 && (
                    <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>Nessuna pista trovata.</div>
                  )}
                </div>
              </div>

              {/* DETAIL (solo desktop/tablet) */}
              <div className="tracks-detail">
                <div style={{ borderRadius: 22, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)", background: "white" }}>
                  {!active ? <div style={{ padding: 14 }}>Seleziona una pista.</div> : <TrackDetail track={active} />}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* STILI UNICI IN FONDO */}
      <style>{`
        @media (min-width: 1024px){
          .tracks-split{
            display: grid;
            grid-template-columns: 420px 1fr;
            gap: 14px;
            align-items: start;
          }
          .tracks-list{
            position: sticky;
            top: 10px;
            height: calc(100dvh - 20px);
            overflow: auto;
            padding-right: 6px;
          }
          .tracks-detail{ height: fit-content; }
        }

        @media (max-width: 1023px){
          .tracks-split{
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .tracks-detail{ display: none; }
        }

        /* ✅ MOBILE ULTRA COMPACT */
        @media (max-width: 767px){
          .tracks-root{ padding: 8px !important; }
          .tracks-root h1{
            font-size: 22px !important;
            line-height: 1.05 !important;
            margin-bottom: 4px !important;
          }
          .tracks-subtitle{ display:none !important; }
          .tracks-search{ padding: 8px 10px !important; border-radius: 12px !important; }
          .tracks-filters-btn{ padding: 8px 10px !important; border-radius: 12px !important; }
        }
      `}</style>
    </div>
  );
}

/** Card: mobile COMPATTA, desktop “vetrina” */
function TrackCard({ track, active, onSelect }) {
  const photo = track.photo || FALLBACK_PHOTO;
  const rating = Number(track.rating || 0);
  const p = scorePill(rating);

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
        boxShadow: active ? "0 10px 22px rgba(0,0,0,0.08)" : "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {/* MOBILE ROW (ULTRA COMPATTA) */}
      <div className="track-card-mobile" style={{ display: "none", padding: 6, gap: 10, alignItems: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", background: "rgba(0,0,0,0.05)", flex: "0 0 auto" }}>
          <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
        </div>

        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
            <div style={{ fontWeight: 950, fontSize: 14, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {countryFlag(track.country)} {track.name}
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, whiteSpace: "nowrap" }}>{typeLabel(track.type)}</div>
          </div>

          <div style={{ marginTop: 2, fontSize: 11, opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {track.region || "—"} · {surfaceLabel(track.surface)} · {track.bestSeason || "—"}
          </div>

          <div style={{ marginTop: 5, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...pillStyle(p.level), fontSize: 10, padding: "4px 7px" }}>
              ⭐ {Number.isFinite(rating) ? rating.toFixed(1) : "0.0"} · {p.label}
            </span>
          </div>
        </div>
      </div>

      {/* DESKTOP “vetrina” */}
      <div className="track-card-desktop" style={{ display: "block" }}>
        <div style={{ height: 130, backgroundImage: `url(${photo})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 900, lineHeight: 1.15 }}>
              {countryFlag(track.country)} {track.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{typeLabel(track.type)}</div>
          </div>

          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            {track.region} · fondo: {surfaceLabel(track.surface)} · stagione: {track.bestSeason || "—"}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pillStyle(p.level)}>
              ⭐ {Number.isFinite(rating) ? rating.toFixed(1) : "0.0"} · {p.label}
            </span>
            <span style={pillStyle("ok")}>🧠 diff {Number(track.difficulty || 0)}/10</span>
            <span style={pillStyle("ok")}>⚡ speed {Number(track.speed || 0)}/10</span>
            <span style={pillStyle("ok")}>🧩 tech {Number(track.technique || 0)}/10</span>
          </div>
        </div>
      </div>

      {/* switch mobile/desktop */}
      <style>{`
        @media (max-width: 1023px){
          .track-card-mobile{ display: flex !important; }
          .track-card-desktop{ display: none !important; }
        }
      `}</style>
    </div>
  );
}

function TrackDetail({ track, onClose }) {
  const photo = track.photo || FALLBACK_PHOTO;
  const lat = track?.coords?.lat;
  const lng = track?.coords?.lng;

  const googleHref = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : "https://www.google.com/maps";
  const isMobile = isMobileNow();

  // scroll -> hero shrink (mobile)
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (!isMobile) return;
    const onScroll = () => setScrollY(window.scrollY || 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  // swipe down -> close (solo se sei in cima)
  const touchRef = useRef({ startY: 0, startT: 0, active: false, fired: false });

  const onTouchStart = (e) => {
    if (!isMobile || !onClose) return;
    const y = e?.touches?.[0]?.clientY ?? 0;
    touchRef.current = { startY: y, startT: Date.now(), active: true, fired: false };
  };

  const onTouchMove = (e) => {
    if (!isMobile || !onClose) return;
    const st = touchRef.current;
    if (!st.active || st.fired) return;
    if ((window.scrollY || 0) > 6) return;

    const y = e?.touches?.[0]?.clientY ?? 0;
    const dy = y - st.startY;
    const dt = Date.now() - st.startT;

    if (dy > 90 && dt < 650) {
      st.fired = true;
      onClose();
    }
  };

  const onTouchEnd = () => {
    touchRef.current.active = false;
  };

  // HERO HEIGHT — più compatto
  const heroMax = isMobile ? 140 : 280;
  const heroMin = isMobile ? 84 : 280;
  const heroH = isMobile ? Math.max(heroMin, heroMax - Math.min(scrollY, heroMax - heroMin)) : heroMax;

  const [wx, setWx] = useState(null);
  const [wxBusy, setWxBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setWxBusy(true);
        const res = await getTrackWeatherSummary(track);
        if (!alive) return;
        setWx(res);
      } catch (e) {
        if (!alive) return;
        setWx({ ok: false, note: e?.message || "Meteo non disponibile." });
      } finally {
        if (alive) setWxBusy(false);
      }
    }

    if (track?.coords?.lat == null || track?.coords?.lng == null) {
      setWx({ ok: false, note: "Coordinate mancanti." });
      setWxBusy(false);
      return () => {
        alive = false;
      };
    }

    run();
    return () => {
      alive = false;
    };
  }, [getTrackKey(track)]);

  const wxBox = (() => {
    if (wxBusy) return <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>Carico meteo…</div>;
    if (!wx || !wx.ok) return <div style={{ marginTop: 10, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>{wx?.note || "Meteo non disponibile."}</div>;

    return (
      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle(weatherLevel(wx.worst))}>
            Condizione: <strong>{wx.worst}</strong>
          </span>
          {wx.temp != null ? <span style={pillStyle("ok")}>🌡 {wx.temp}° (min {wx.tempMin}° / max {wx.tempMax}°)</span> : null}
          {wx.windKmh != null ? <span style={pillStyle(wx.windKmh >= 50 ? "warn" : "ok")}>💨 vento {wx.windKmh} km/h</span> : null}
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
        <div style={{ fontSize: 12, opacity: 0.7 }}>Aggiornato: {String(wx.updatedAt || "").slice(0, 16).replace("T", " ")}</div>
      </div>
    );
  })();

  const OWM_KEY = (import.meta?.env?.VITE_OWM_KEY || "").trim();
  const keyMissing = !OWM_KEY;
  const hasWeather =
    !!wx &&
    wx.ok &&
    (wx.temp != null || wx.tempMin != null || wx.tempMax != null || wx.windKmh != null || !!wx.worst);

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Hero (collapsing on mobile) */}
      <div
        className="track-hero"
        style={{
          position: "relative",
          height: heroH,
          backgroundImage: `url(${photo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transition: isMobile ? "height 110ms linear" : "none",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.76))" }} />

        <div style={{ position: "absolute", left: 12, right: 12, bottom: 8, color: "white" }}>
          <div style={{ fontSize: isMobile ? 11 : 13, opacity: 0.92 }}>
            {countryFlag(track.country)} {track.country} · {track.region} · {typeLabel(track.type)}
          </div>

          <div style={{ fontSize: isMobile ? 20 : 30, fontWeight: 950, letterSpacing: 0.2, lineHeight: 1.05 }}>
            {track.name}
          </div>

          {/* PILL HERO: una riga scrollabile */}
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              flexWrap: "nowrap",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 2,
            }}
          >
            <span style={{ ...pillStyleHero("ok"), fontSize: isMobile ? 10 : 12, padding: isMobile ? "4px 8px" : "6px 10px" }}>
              ⭐ {Number(track.rating || 0).toFixed(1)}
            </span>
            <span style={{ ...pillStyleHero("ok"), fontSize: isMobile ? 10 : 12, padding: isMobile ? "4px 8px" : "6px 10px" }}>
              🧠 diff {Number(track.difficulty || 0)}/10
            </span>
            <span style={{ ...pillStyleHero("ok"), fontSize: isMobile ? 10 : 12, padding: isMobile ? "4px 8px" : "6px 10px" }}>
              ⚡ speed {Number(track.speed || 0)}/10
            </span>
            <span style={{ ...pillStyleHero("ok"), fontSize: isMobile ? 10 : 12, padding: isMobile ? "4px 8px" : "6px 10px" }}>
              🧩 tech {Number(track.technique || 0)}/10
            </span>
            <span style={{ ...pillStyleHero("ok"), fontSize: isMobile ? 10 : 12, padding: isMobile ? "4px 8px" : "6px 10px" }}>
              🗓 {track.bestSeason || "—"}
            </span>
            {track.lengthKm ? (
              <span style={{ ...pillStyleHero("ok"), fontSize: isMobile ? 10 : 12, padding: isMobile ? "4px 8px" : "6px 10px" }}>
                📏 {track.lengthKm} km
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: isMobile ? 10 : 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          <Stat compact={isMobile} label="Tipo" value={typeLabel(track.type)} />
          <Stat compact={isMobile} label="Fondo" value={surfaceLabel(track.surface)} />
          {!isMobile ? <Stat compact={false} label="Rating" value={`${Number(track.rating || 0).toFixed(1)} / 10`} /> : null}
        </div>

        {isMobile ? (
          <div style={{ marginTop: 10 }}>
            <Stat compact={true} label="Rating" value={`${Number(track.rating || 0).toFixed(1)} / 10`} />
          </div>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <a
            href={googleHref}
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

        <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <strong>📌 Descrizione</strong>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9, lineHeight: 1.4 }}>{track.description || "—"}</div>
        </div>

        <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <strong>🗺️ Mappa</strong>
          <div style={{ marginTop: 10 }}>
            <TrackMap track={track} />
          </div>
        </div>

        <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 12 }}>
          <strong>🌤 Meteo</strong>
          {wxBox}

        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, compact = false }) {
  return (
    <div
      style={{
        padding: compact ? 9 : 12,
        borderRadius: compact ? 14 : 16,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "white",
      }}
    >
      <div style={{ fontSize: compact ? 11 : 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 950, marginTop: 2, fontSize: compact ? 14 : 16 }}>{value}</div>
    </div>
  );
}