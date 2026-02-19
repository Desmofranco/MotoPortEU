// =======================================================
// src/pages/Tracks.jsx
// Piste: supersport / enduro / cross
// UI: split-view su desktop (lista + dettaglio)
// Mobile: lista -> dettaglio (full screen) con back, senza overlay fixed
// Dati: /public/data/tracks.json + /public/data/tracks.eu.json
// ✅ Loading skeleton
// ✅ Dedup key stabile (id o name+coords)
// ✅ Meteo + Google Maps
// ✅ Warning VITE_OWM_KEY solo se manca key E non c’è meteo
// ✅ FIX: Hero mobile più compatto + pill hero "dark glass"
// =======================================================

import React, { useEffect, useMemo, useState } from "react";
import TrackMap from "../components/TrackMap";
import { getTrackWeatherSummary } from "../utils/trackWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

/** Pill "chiaro" (per sezioni normali, non su foto) */
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

/** Pill "dark glass" SOLO per la fascia hero sopra immagine */
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
    backdropFilter: "blur(8px)",
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
        marginTop: 14,
        padding: 16,
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800 }}>Carico piste…</div>
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

  // selezione
  const [activeKey, setActiveKey] = useState(null);
  const [selected, setSelected] = useState(null);

  // mobile view: "list" | "detail"
  const [mobileView, setMobileView] = useState("list");

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

        // se siamo su mobile, rimani in lista di default
        setMobileView("list");
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
    const set = new Set(
      tracks.map((t) => String(t.country || "").toUpperCase()).filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort()];
  }, [tracks]);

  const types = useMemo(() => {
    const set = new Set(
      tracks.map((t) => String(t.type || "").toLowerCase()).filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort()];
  }, [tracks]);

  const surfaces = useMemo(() => {
    const set = new Set(
      tracks.map((t) => String(t.surface || "").toLowerCase()).filter(Boolean)
    );
    return ["ALL", ...Array.from(set).sort()];
  }, [tracks]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = [...tracks];

    if (query) {
      out = out.filter((t) => {
        const blob = [
          t.name,
          t.region,
          t.country,
          t.type,
          t.surface,
          t.description,
          t.bestSeason,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(query);
      });
    }

    if (country !== "ALL")
      out = out.filter(
        (t) => String(t.country || "").toUpperCase() === country
      );
    if (type !== "ALL")
      out = out.filter(
        (t) =>
          String(t.type || "").toLowerCase() === String(type).toLowerCase()
      );
    if (surface !== "ALL")
      out = out.filter(
        (t) =>
          String(t.surface || "").toLowerCase() ===
          String(surface).toLowerCase()
      );

    const sorter =
      {
        rating: (a, b) => Number(b.rating || 0) - Number(a.rating || 0),
        difficulty: (a, b) =>
          Number(b.difficulty || 0) - Number(a.difficulty || 0),
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isMobile = isMobileNow();
  const showDetailMobile = isMobile && mobileView === "detail" && selected;

  return (
    <div
      className="tracks-root"
      style={{ padding: 16, maxWidth: 1250, margin: "0 auto" }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 10,
          alignItems: "start",
        }}
      >
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
            <h1 style={{ margin: 0, fontSize: 44, letterSpacing: -0.5 }}>
              Piste 🏁
            </h1>
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              SuperSport, Enduro e Cross: mappa, meteo e link Google.
            </div>
          </div>

          <input
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
        </div>

        {/* FILTERS */}
        <div
          style={{
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
            <span style={{ fontSize: 12, opacity: 0.75 }}>Tipo</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
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
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
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
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
              }}
            >
              <option value="rating">Rating (desc)</option>
              <option value="difficulty">Difficoltà (desc)</option>
              <option value="length">Lunghezza (desc)</option>
            </select>
          </label>
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <SkeletonLoading />
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
        <>
          {/* MOBILE: dettaglio single-screen */}
          {showDetailMobile ? (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  background: "rgba(255,255,255,0.96)",
                  backdropFilter: "blur(8px)",
                  borderBottom: "1px solid rgba(0,0,0,0.10)",
                  padding: 12,
                  borderRadius: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setMobileView("list")}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  ← Indietro
                </button>
                <div style={{ marginTop: 10, fontWeight: 900 }}>
                  {countryFlag(selected.country)} {selected.name}
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  borderRadius: 22,
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "white",
                }}
              >
                <TrackDetail track={selected} />
              </div>
            </div>
          ) : (
            /* DESKTOP: split + MOBILE: lista */
            <div style={{ marginTop: 14 }} className="tracks-split">
              {/* LIST */}
              <div className="tracks-list">
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
                  Trovate: <strong>{filtered.length}</strong> (EU import incluse)
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {filtered.map((t) => {
                    const key = getTrackKey(t);
                    const isActive = key === activeKey;
                    return (
                      <TrackCard
                        key={key}
                        track={t}
                        active={isActive}
                        onSelect={() => selectTrack(t)}
                      />
                    );
                  })}

                  {filtered.length === 0 && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 16,
                        background: "rgba(0,0,0,0.04)",
                      }}
                    >
                      Nessuna pista trovata.
                    </div>
                  )}
                </div>
              </div>

              {/* DETAIL (solo desktop/tablet) */}
              <div className="tracks-detail">
                <div
                  style={{
                    borderRadius: 22,
                    overflow: "hidden",
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "white",
                  }}
                >
                  {!active ? (
                    <div style={{ padding: 14 }}>Seleziona una pista.</div>
                  ) : (
                    <TrackDetail track={active} />
                  )}
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
          .tracks-detail{
            height: fit-content;
          }
        }

        @media (max-width: 1023px){
          .tracks-split{
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
          }
          /* su mobile/tablet, nascondiamo il dettaglio split */
          .tracks-detail{
            display: none;
          }
        }

        @media (max-width: 767px){
          .tracks-root{ padding: 10px !important; }
          .tracks-root h1{ font-size: 30px !important; line-height: 1.05 !important; }
          /* Hero mobile più compatto */
          .track-hero{ height: 210px !important; }
          .track-hero-title{ font-size: 22px !important; line-height: 1.08 !important; }
          .track-hero-sub{ font-size: 12px !important; }
          .hero-pills span{ font-size: 11px !important; padding: 5px 9px !important; }
        }
      `}</style>
    </div>
  );
}

/** Card: mobile compatta, desktop “vetrina” (ma click sempre affidabile) */
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
      onTouchStart={click} // ✅ Android friendly
      onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? click(e) : null)}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        width: "100%",
        border: active ? "2px solid rgba(0,0,0,0.35)" : "1px solid rgba(0,0,0,0.12)",
        background: "white",
        boxShadow: active ? "0 10px 30px rgba(0,0,0,0.12)" : "none",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
    >
      {/* MOBILE ROW */}
      <div
        className="track-card-mobile"
        style={{ display: "none", padding: 10, gap: 10, alignItems: "center" }}
      >
        <div
          style={{
            width: 88,
            height: 64,
            borderRadius: 14,
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
                lineHeight: 1.15,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {countryFlag(track.country)} {track.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
              {typeLabel(track.type)}
            </div>
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              opacity: 0.75,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {track.region || "—"} · {surfaceLabel(track.surface)} ·{" "}
            {track.bestSeason || "—"}
          </div>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={pillStyle(p.level)}>
              ⭐ {Number.isFinite(rating) ? rating.toFixed(1) : "0.0"} · {p.label}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12,
                opacity: 0.6,
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}
            >
              Tocca →
            </span>
          </div>
        </div>
      </div>

      {/* DESKTOP “vetrina” */}
      <div className="track-card-desktop" style={{ display: "block" }}>
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
              {countryFlag(track.country)} {track.name}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>
              {typeLabel(track.type)}
            </div>
          </div>

          <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
            {track.region} · fondo: {surfaceLabel(track.surface)} · stagione:{" "}
            {track.bestSeason || "—"}
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

function TrackDetail({ track }) {
  const photo = track.photo || FALLBACK_PHOTO;
  const lat = track?.coords?.lat;
  const lng = track?.coords?.lng;

  const googleHref =
    lat != null && lng != null
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : "https://www.google.com/maps";

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
    if (wxBusy)
      return (
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
      );

    if (!wx || !wx.ok)
      return (
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
      );

    return (
      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={pillStyle(weatherLevel(wx.worst))}>
            Condizione: <strong>{wx.worst}</strong>
          </span>
          {wx.temp != null ? (
            <span style={pillStyle("ok")}>
              🌡 {wx.temp}° (min {wx.tempMin}° / max {wx.tempMax}°)
            </span>
          ) : null}
          {wx.windKmh != null ? (
            <span style={pillStyle(wx.windKmh >= 50 ? "warn" : "ok")}>
              💨 vento {wx.windKmh} km/h
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Aggiornato: {String(wx.updatedAt || "").slice(0, 16).replace("T", " ")}
        </div>
      </div>
    );
  })();

  const OWM_KEY = (import.meta?.env?.VITE_OWM_KEY || "").trim();
  const keyMissing = !OWM_KEY;
  const hasWeather =
    !!wx &&
    wx.ok &&
    (wx.temp != null ||
      wx.tempMin != null ||
      wx.tempMax != null ||
      wx.windKmh != null ||
      !!wx.worst);

  return (
    <>
      {/* Hero */}
      <div
        className="track-hero"
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
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.72))",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 14,
            color: "white",
          }}
        >
          <div className="track-hero-sub" style={{ fontSize: 13, opacity: 0.92 }}>
            {countryFlag(track.country)} {track.country} · {track.region} ·{" "}
            {typeLabel(track.type)}
          </div>

          <div
            className="track-hero-title"
            style={{ fontSize: 30, fontWeight: 950, letterSpacing: 0.2 }}
          >
            {track.name}
          </div>

          {/* PILL HERO (dark glass) */}
          <div className="hero-pills" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={pillStyleHero("ok")}>⭐ {Number(track.rating || 0).toFixed(1)}</span>
            <span style={pillStyleHero("ok")}>🧠 diff {Number(track.difficulty || 0)}/10</span>
            <span style={pillStyleHero("ok")}>⚡ speed {Number(track.speed || 0)}/10</span>
            <span style={pillStyleHero("ok")}>🧩 tech {Number(track.technique || 0)}/10</span>
            <span style={pillStyleHero("ok")}>🗓 {track.bestSeason || "—"}</span>
            {track.lengthKm ? <span style={pillStyleHero("ok")}>📏 {track.lengthKm} km</span> : null}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <Stat label="Tipo" value={typeLabel(track.type)} />
          <Stat label="Fondo" value={surfaceLabel(track.surface)} />
          <Stat label="Rating" value={`${Number(track.rating || 0).toFixed(1)} / 10`} />
        </div>

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

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
          <strong>📌 Descrizione</strong>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9, lineHeight: 1.4 }}>
            {track.description || "—"}
          </div>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
          <strong>🗺️ Mappa</strong>
          <div style={{ marginTop: 10 }}>
            <TrackMap track={track} />
          </div>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
          <strong>🌤 Meteo</strong>
          {wxBox}

          {!keyMissing ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              ✅ <strong>VITE_OWM_KEY</strong> (OpenWeather) presente.
            </div>
          ) : !hasWeather ? (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              ⚠️ Manca <strong>VITE_OWM_KEY</strong> (OpenWeather): aggiungila in{" "}
              <code>client/.env</code> e riavvia Vite.
            </div>
          ) : null}
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