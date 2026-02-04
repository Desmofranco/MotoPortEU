import { useEffect, useMemo, useState } from "react";

export default function Routes() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/data/routes.json");
        const data = await res.json();
        setRoutes(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Routes load error", e);
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => {
      const hay = `${r.name || ""} ${r.region || ""} ${r.country || ""} ${r.description || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [routes, query]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Itinerari 🗺️</h1>
        <span style={{ opacity: 0.75 }}>
          {loading ? "Caricamento…" : `${filtered.length} / ${routes.length}`}
        </span>
      </div>

      <div
        style={{
          marginTop: 14,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          padding: 14,
          background: "white",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca itinerario (nome, regione, descrizione)…"
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            outline: "none",
          }}
        />

        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          (Offline: qui metteremo “Scarica itinerario” con salvataggio locale.)
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.04)" }}>
            Nessun itinerario trovato.
          </div>
        )}

        {filtered.map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 16,
              padding: 14,
              background: "white",
              display: "grid",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 16 }}>{r.name}</strong>
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                {r.country} · {r.region}
              </span>
            </div>

            {r.description && <div style={{ opacity: 0.9 }}>{r.description}</div>}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, opacity: 0.85 }}>
              {typeof r.distanceKm === "number" && <span>📏 {r.distanceKm} km</span>}
              {typeof r.curvesScore === "number" && <span>🌀 Pieghe: {r.curvesScore}/10</span>}
              {typeof r.asphaltScore === "number" && <span>🛣️ Asfalto: {r.asphaltScore}/10</span>}
              {r.bestSeason && <span>☀️ Stagione: {r.bestSeason}</span>}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => alert("Qui: apriamo mappa con traccia itinerario (step successivo).")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Apri su mappa
              </button>

              <button
                type="button"
                onClick={() => alert("Qui: scarica offline (IndexedDB) (step successivo).")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Scarica offline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
