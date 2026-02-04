import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const CATEGORY_LABELS = {
  bar: "Bar",
  restaurant: "Ristoranti",
  accessories: "Accessori Moto",
  apparel: "Abbigliamento Tecnico",
};

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState({
    bar: true,
    restaurant: true,
    accessories: true,
    apparel: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/data/suppliers.json");
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Suppliers load error", e);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const countsByCat = useMemo(() => {
    const c = { bar: 0, restaurant: 0, accessories: 0, apparel: 0 };
    for (const s of suppliers) if (c[s.category] !== undefined) c[s.category] += 1;
    return c;
  }, [suppliers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      const catOk = !!catFilter[s.category];
      if (!catOk) return false;

      if (!q) return true;
      const hay = `${s.name || ""} ${s.city || ""} ${s.description || ""} ${s.category || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [suppliers, query, catFilter]);

  const setAllCats = (value) => {
    setCatFilter({
      bar: value,
      restaurant: value,
      accessories: value,
      apparel: value,
    });
  };

  const allCatsOn =
    catFilter.bar && catFilter.restaurant && catFilter.accessories && catFilter.apparel;
  const allCatsOff =
    !catFilter.bar && !catFilter.restaurant && !catFilter.accessories && !catFilter.apparel;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Fornitori ⭐</h1>
        <span style={{ opacity: 0.75 }}>
          {loading ? "Caricamento…" : `${filtered.length} / ${suppliers.length}`}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <Link to="/map">Vai alla mappa →</Link>
        </div>
      </div>

      {/* Search + filters */}
      <div
        style={{
          marginTop: 14,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          padding: 14,
          background: "white",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca (nome, città, descrizione)…"
            style={{
              flex: "1 1 280px",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              outline: "none",
            }}
          />

          <button
            type="button"
            onClick={() => setAllCats(true)}
            disabled={allCatsOn}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: allCatsOn ? "rgba(0,0,0,0.06)" : "white",
              cursor: allCatsOn ? "not-allowed" : "pointer",
            }}
          >
            Tutte
          </button>

          <button
            type="button"
            onClick={() => setAllCats(false)}
            disabled={allCatsOff}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: allCatsOff ? "rgba(0,0,0,0.06)" : "white",
              cursor: allCatsOff ? "not-allowed" : "pointer",
            }}
          >
            Nessuna
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {Object.keys(CATEGORY_LABELS).map((k) => (
            <label key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={catFilter[k]}
                onChange={(e) => setCatFilter((p) => ({ ...p, [k]: e.target.checked }))}
              />
              <span>
                {CATEGORY_LABELS[k]}{" "}
                <span style={{ opacity: 0.7 }}>({countsByCat[k] || 0})</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 14, borderRadius: 14, background: "rgba(0,0,0,0.04)" }}>
            Nessun fornitore trovato con questi filtri.
          </div>
        )}

        {filtered.map((s) => (
          <div
            key={s.id}
            style={{
              border: "1px solid rgba(0,0,0,0.12)",
              borderRadius: 16,
              padding: 14,
              background: "white",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 280px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 16 }}>⭐ {s.name}</strong>
                <span
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "rgba(0,0,0,0.04)",
                  }}
                >
                  {CATEGORY_LABELS[s.category] || s.category}
                </span>
                {s.city && <span style={{ fontSize: 12, opacity: 0.75 }}>📍 {s.city}</span>}
              </div>

              {s.description && (
                <p style={{ margin: "8px 0 0", opacity: 0.9 }}>{s.description}</p>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link
                to={`/supplier/${s.id}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  textDecoration: "none",
                  color: "inherit",
                  background: "white",
                }}
              >
                Apri scheda →
              </Link>

              <button
                type="button"
                onClick={() => {
                  const url = `https://www.google.com/maps?q=${s.lat},${s.lng}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Naviga
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div
        style={{
          marginTop: 18,
          padding: 16,
          borderRadius: 16,
          border: "1px dashed rgba(0,0,0,0.18)",
          background: "rgba(0,0,0,0.03)",
        }}
      >
        <strong>Sei un’attività biker-friendly?</strong>
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          Entra tra i fornitori MotoPortEU e compari su mappa e scheda dedicata.
        </div>
        <div style={{ marginTop: 10 }}>
          <Link to="/pass">Vai al Pass →</Link>
        </div>
      </div>
    </div>
  );
}
