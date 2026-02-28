// =======================================================
// src/pages/Tracks.jsx
// MotoPortEU — Circuiti (Piste)
// ✅ Responsive: mobile (lista -> dettaglio fullscreen) / desktop (split view)
// ✅ Filtri: paese, tipo, fondo, ordine
// ✅ Mappa: TrackMap
// ✅ Meteo: getTrackWeatherSummary
// ✅ Google Maps: apertura smart (mobile -> app)
// Dati: /public/data/tracks.json + /public/data/tracks.eu.json (se presente)
// =======================================================

import React, { useEffect, useMemo, useState } from "react";
import TrackMap from "../components/TrackMap";
import { getTrackWeatherSummary } from "../utils/trackWeather";

const FALLBACK_PHOTO =
  "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1600&q=80";

const isMobileUA = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
const openGoogleMapsSmart = (url) => {
  if (!url) return;
  if (isMobileUA()) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
};

const buildSearchUrl = (lat, lon) => {
  const a = Number(lat);
  const b = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a},${b}`)}`;
};

function getTrackLatLon(track) {
  const lat =
    Number(track?.lat) ??
    Number(track?.latitude) ??
    Number(track?.coords?.[0]) ??
    Number(track?.location?.[0]);

  const lon =
    Number(track?.lon) ??
    Number(track?.lng) ??
    Number(track?.longitude) ??
    Number(track?.coords?.[1]) ??
    Number(track?.location?.[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

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

export default function Tracks() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");
  const [type, setType] = useState("ALL"); // supersport / enduro / cross / ecc
  const [surface, setSurface] = useState("ALL"); // asphalt / mixed / dirt ...
  const [order, setOrder] = useState("best"); // best | rating | name

  const [selectedKey, setSelectedKey] = useState("");
  const keyOf = (t) =>
    t?.id ||
    `${t?.name || "track"}-${Number(getTrackLatLon(t)?.lat || 0).toFixed(5)}-${Number(getTrackLatLon(t)?.lon || 0).toFixed(5)}`;

  const selected = useMemo(
    () => tracks.find((t) => keyOf(t) === selectedKey) || null,
    [tracks, selectedKey]
  );

  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const onResize = () => setIsLg(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // mobile detail fullscreen
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  useEffect(() => {
    if (!isLg && selected) setShowDetailMobile(true);
  }, [isLg, selected]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [a, b] = await Promise.allSettled([
          fetch("/data/tracks.json").then((r) => r.json()),
          fetch("/data/tracks.eu.json").then((r) => r.json()),
        ]);

        const arrA = a.status === "fulfilled" && Array.isArray(a.value) ? a.value : [];
        const arrB = b.status === "fulfilled" && Array.isArray(b.value) ? b.value : [];
        const merged = [...arrA, ...arrB];

        if (!alive) return;
        setTracks(merged);

        const first = merged[0];
        setSelectedKey(first ? keyOf(first) : "");
      } catch {
        if (!alive) return;
        setTracks([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countries = useMemo(() => {
    const s = new Set(tracks.map((t) => t.country).filter(Boolean));
    return ["ALL", ...Array.from(s).sort()];
  }, [tracks]);

  const types = useMemo(() => {
    const s = new Set(tracks.map((t) => t.type).filter(Boolean));
    return ["ALL", ...Array.from(s).sort()];
  }, [tracks]);

  const surfaces = useMemo(() => {
    const s = new Set(tracks.map((t) => t.surface).filter(Boolean));
    return ["ALL", ...Array.from(s).sort()];
  }, [tracks]);

  const filtered = useMemo(() => {
    const needle = String(q || "").trim().toLowerCase();
    let arr = tracks.slice();

    if (country !== "ALL") arr = arr.filter((t) => String(t.country || "") === country);
    if (type !== "ALL") arr = arr.filter((t) => String(t.type || "") === type);
    if (surface !== "ALL") arr = arr.filter((t) => String(t.surface || "") === surface);

    if (needle) {
      arr = arr.filter((t) => {
        const blob = `${t.name || ""} ${t.city || ""} ${t.region || ""}`.toLowerCase();
        return blob.includes(needle);
      });
    }

    if (order === "name") {
      arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    } else if (order === "rating") {
      arr.sort((a, b) => score(b.rating, 0) - score(a.rating, 0));
    } else {
      // best: rating + lengthKm (se esiste) + surface/asphalt bonus
      arr.sort((a, b) => {
        const ab = score(b.rating, 0) + score(b.lengthKm, 0) / 50;
        const aa = score(a.rating, 0) + score(a.lengthKm, 0) / 50;
        return ab - aa;
      });
    }

    return arr;
  }, [tracks, q, country, type, surface, order]);

  const weather = useMemo(() => {
    if (!selected) return null;
    try {
      return getTrackWeatherSummary(selected);
    } catch {
      return null;
    }
  }, [selected]);

  const openMaps = () => {
    if (!selected) return;
    const p = getTrackLatLon(selected);
    const url = p ? buildSearchUrl(p.lat, p.lon) : null;
    if (!url) return alert("Coordinate circuito non disponibili.");
    openGoogleMapsSmart(url);
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
            <div style={{ ...S.small, fontWeight: 800 }}>Tipo</div>
            <select style={S.select} value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t === "ALL" ? "Tutti" : t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ ...S.small, fontWeight: 800 }}>Fondo</div>
            <select style={S.select} value={surface} onChange={(e) => setSurface(e.target.value)}>
              {surfaces.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "Tutti" : s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ ...S.small, fontWeight: 800 }}>Ordine</div>
            <select style={S.select} value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="best">Migliori</option>
              <option value="rating">Rating</option>
              <option value="name">Nome</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ ...S.small, fontWeight: 800 }}>Ricerca</div>
          <input style={S.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Es: Imola, Mugello..." />
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Circuiti</div>
          <span style={S.pill}>{filtered.length}</span>
        </div>

        {loading ? (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={S.skeleton} />
            <div style={S.skeleton} />
            <div style={S.skeleton} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.78 }}>Nessun risultato. Cambia filtri.</div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((t) => {
              const k = keyOf(t);
              const active = k === selectedKey;
              return (
                <button
                  key={k}
                  onClick={() => {
                    setSelectedKey(k);
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
                    <div style={{ fontWeight: 900 }}>{t.name || "—"}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      ⭐ {score(t.rating, 0).toFixed(1)}
                    </div>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.78 }}>
                    {t.country || "—"} • {t.type || "—"} • {t.surface || "—"}
                    {t.lengthKm ? ` • ${score(t.lengthKm, 0).toFixed(1)} km` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const Detail = () => {
    if (!selected) {
      return (
        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Seleziona un circuito</div>
          <div style={{ marginTop: 6, opacity: 0.75 }}>Tocca una card dalla lista.</div>
        </div>
      );
    }

    const photo = selected.photo || FALLBACK_PHOTO;
    const coords = getTrackLatLon(selected);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!isLg && showDetailMobile && (
          <button style={{ ...S.btnGhost, alignSelf: "flex-start" }} onClick={() => setShowDetailMobile(false)}>
            ← Indietro
          </button>
        )}

        <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
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
                {selected.city || selected.region || "—"} • {selected.country || "—"}
              </div>
            </div>
          </div>

          <div style={{ padding: 14 }}>
            <div style={S.row}>
              <span style={S.pill}>⭐ {score(selected.rating, 0).toFixed(1)}</span>
              <span style={S.pill}>🏁 {selected.type || "—"}</span>
              <span style={S.pill}>🪨 {selected.surface || "—"}</span>
              {selected.lengthKm ? <span style={S.pill}>📏 {score(selected.lengthKm, 0).toFixed(1)} km</span> : null}
            </div>

            {weather ? (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.82 }}>
                🌦️ Meteo: <b>{weather.summary || "—"}</b>
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.72 }}>
                🌦️ Meteo: disponibile se utility/chiave attive.
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.35, opacity: 0.9 }}>
              {selected.description || "—"}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button style={S.btn} onClick={openMaps}>
                🧭 Invio navigazione
              </button>
              {coords ? (
                <span style={S.pill}>
                  📍 {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>🗺️ Mappa</div>
          <TrackMap track={selected} height={isLg ? 420 : 320} />
        </div>
      </div>
    );
  };

  const showDetail = isLg ? true : showDetailMobile;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <style>{`
          input::placeholder { color: rgba(0,0,0,0.55); }
        `}</style>

        <div style={S.header}>
          <div>
            <h1 style={S.title}>Circuiti 🏁</h1>
            <p style={S.sub}>Seleziona un circuito, vedi mappa + meteo e apri Google Maps (mobile: apre l’app).</p>
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