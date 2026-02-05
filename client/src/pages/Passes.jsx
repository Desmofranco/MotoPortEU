import { useEffect, useMemo, useState } from "react";
import { googleDirHref, routeOffroad, routeRoad } from "../utils/routeEngine";

export default function Passes() {
  const [passes, setPasses] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [country, setCountry] = useState("ALL");

  const [selected, setSelected] = useState([]); // tappe: [{id,name,coords,country...}]
  const [routing, setRouting] = useState({ busy: false, out: null, error: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const r = await fetch("/data/passes.eu.json", { cache: "no-store" });
        if (!r.ok) throw new Error("Impossibile caricare /data/passes.eu.json");
        const data = await r.json();
        if (!alive) return;
        setPasses(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Errore passi");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const countries = useMemo(() => {
    const set = new Set(passes.map(p => (p.country || "").trim()).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [passes]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = [...passes];

    if (country !== "ALL") out = out.filter(p => (p.country || "") === country);

    if (query) {
      out = out.filter(p => {
        const blob = `${p.name} ${p.country} ${p.elev ?? ""}`.toLowerCase();
        return blob.includes(query);
      });
    }

    // prima quelli con altitudine (più “reali”), poi alfabetico
    out.sort((a,b) => (b.elev||0)-(a.elev||0) || a.name.localeCompare(b.name));
    return out.slice(0, 4000); // safety UI
  }, [passes, q, country]);

  function addStop(p) {
    setSelected(prev => {
      if (prev.some(x => x.id === p.id)) return prev;
      return [...prev, p];
    });
  }
  function removeStop(id) {
    setSelected(prev => prev.filter(p => p.id !== id));
  }
  function clearStops() {
    setSelected([]);
    setRouting({ busy: false, out: null, error: "" });
  }

  async function gen(mode) {
    if (selected.length < 2) {
      setRouting(r => ({ ...r, error: "Aggiungi almeno 2 passi (start + arrivo)." }));
      return;
    }

    setRouting({ busy: true, out: null, error: "" });

    try {
      const points = selected.map(s => s.coords);

      const res = mode === "offroad"
        ? await routeOffroad(points)
        : await routeRoad(points);

      // salva in localStorage come “itinerario generato”
      const payload = {
        id: `gen-${Date.now()}`,
        name: `Pass Tour: ${selected[0].name} → ${selected[selected.length-1].name}`,
        mode,
        provider: res.provider,
        distanceKm: res.distanceKm,
        durationMin: res.durationMin,
        stops: selected.map(s => ({ id: s.id, name: s.name, coords: s.coords, country: s.country, elev: s.elev })),
        line: res.line, // [{lat,lng}...]
        createdAt: new Date().toISOString(),
      };
const KEY = "mp_generated_routes";
const prev = JSON.parse(localStorage.getItem(KEY) || "[]");
const next = [payload, ...prev].slice(0, 200); // max 200 itinerari generati
localStorage.setItem(KEY, JSON.stringify(next));
      setRouting({ busy: false, out: payload, error: "" });
    } catch (e) {
      setRouting({ busy: false, out: null, error: e?.message || "Errore routing" });
    }
  }

  const gmapsHref = useMemo(() => {
    if (selected.length < 2) return "";
    return googleDirHref(selected.map(s => s.coords));
  }, [selected]);

  return (
    <div style={{ padding: 20, maxWidth: 1250, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0 }}>Passi & Itinerari 🏔️🏍️</h1>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Seleziona passi e genera un giro Road o Off-Road on-demand.
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca: Stelvio, Gavia, Col…"
          style={{ minWidth: 320, padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(0,0,0,0.15)", outline: "none" }}
        />
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, padding: 12, borderRadius: 18, border: "1px solid rgba(0,0,0,0.12)", background: "white" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Paese</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}>
            {countries.map(c => <option key={c} value={c}>{c === "ALL" ? "Tutti" : c}</option>)}
          </select>
        </label>

        <div style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Tappe selezionate</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => gen("road")} disabled={routing.busy || selected.length < 2}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer" }}>
              🛣️ Genera Road
            </button>
            <button onClick={() => gen("offroad")} disabled={routing.busy || selected.length < 2}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer" }}>
              🟫 Genera Off-Road
            </button>
            <button onClick={clearStops} disabled={routing.busy}
              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer" }}>
              🧹 Reset
            </button>
            {gmapsHref ? (
              <a href={gmapsHref} target="_blank" rel="noreferrer"
                 style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", textDecoration: "none" }}>
                📍 Apri su Google Maps
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>Carico passi…</div>
      ) : err ? (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 16, background: "rgba(255,0,0,0.08)" }}>{err}</div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 420px", gap: 14 }}>
          {/* lista passi */}
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Trovati: <strong>{filtered.length}</strong> (mostro max 4000 per UI)
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map(p => (
                <div key={p.id}
                  style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.12)", background: "white", padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{p.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {p.country || "—"} {p.elev ? `· ⛰ ${p.elev}m` : ""}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      {p.coords?.lat?.toFixed?.(4)}, {p.coords?.lng?.toFixed?.(4)}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                    <button onClick={() => addStop(p)}
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer" }}>
                      ➕ Aggiungi tappa
                    </button>
                    <a href={`https://www.google.com/maps?q=${p.coords.lat},${p.coords.lng}`} target="_blank" rel="noreferrer"
                      style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", textDecoration: "none", textAlign: "center" }}>
                      📍 Maps
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* tappe + output */}
          <div style={{ borderRadius: 18, border: "1px solid rgba(0,0,0,0.12)", background: "white", padding: 12, height: "fit-content" }}>
            <div style={{ fontWeight: 950 }}>🧭 Itinerario (tappe)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {selected.length === 0 ? (
                <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
                  Aggiungi passi dalla lista a sinistra.
                </div>
              ) : selected.map((s, idx) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderRadius: 14, border: "1px solid rgba(0,0,0,0.10)", padding: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900 }}>{idx + 1}. {s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>{s.country || "—"} {s.elev ? `· ${s.elev}m` : ""}</div>
                  </div>
                  <button onClick={() => removeStop(s.id)} style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 12, padding: "8px 10px", background: "white", cursor: "pointer" }}>
                    ✖
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              {routing.busy ? (
                <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
                  Calcolo itinerario…
                </div>
              ) : routing.error ? (
                <div style={{ padding: 12, borderRadius: 16, background: "rgba(255,0,0,0.08)" }}>
                  {routing.error}
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                    Off-Road richiede <code>VITE_ORS_KEY</code> (OpenRouteService). Se manca, usa fallback road.
                  </div>
                </div>
              ) : routing.out ? (
                <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
                  <div><strong>{routing.out.name}</strong></div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                    Mode: <strong>{routing.out.mode}</strong> · Provider: <strong>{routing.out.provider}</strong>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                    Distanza: <strong>{routing.out.distanceKm.toFixed(1)} km</strong> · Tempo: <strong>{routing.out.durationMin.toFixed(0)} min</strong>
                  </div>

                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(routing.out, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${routing.out.id}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer" }}
                  >
                    ⬇️ Esporta JSON (itinerario)
                  </button>
                </div>
              ) : (
                <div style={{ padding: 12, borderRadius: 16, background: "rgba(0,0,0,0.04)" }}>
                  Seleziona almeno 2 tappe e genera Road/Off-Road.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
