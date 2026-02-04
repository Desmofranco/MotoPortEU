import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

const CATEGORY_LABELS = {
  bar: "Bar",
  restaurant: "Ristorante",
  accessories: "Accessori Moto",
  apparel: "Abbigliamento Tecnico",
};

export default function SupplierPage() {
  const { id } = useParams();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch("/data/suppliers.json");
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Supplier load error", e);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const supplier = useMemo(() => suppliers.find((s) => String(s.id) === String(id)), [suppliers, id]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <p>Caricamento scheda fornitore…</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Fornitore non trovato</h2>
        <p>Questo ID non esiste nei dati locali.</p>
        <Link to="/map">← Torna alla mappa</Link>
      </div>
    );
  }

  const catLabel = CATEGORY_LABELS[supplier.category] || supplier.category;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Link to="/map">← Torna alla mappa</Link>
        <Link to="/suppliers">Vedi tutti i fornitori →</Link>
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          padding: 18,
          background: "white",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 26 }}>⭐ {supplier.name}</h1>
          <span
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(0,0,0,0.04)",
            }}
          >
            {catLabel}
          </span>
          {supplier.city && (
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              📍 {supplier.city}
            </span>
          )}
        </div>

        {supplier.description && (
          <p style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
            {supplier.description}
          </p>
        )}

        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85 }}>
          Coordinate: {Number(supplier.lat).toFixed(5)}, {Number(supplier.lng).toFixed(5)}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              window.open(
                `https://www.google.com/maps?q=${supplier.lat},${supplier.lng}`,
                "_blank",
                "noopener,noreferrer"
              )
            }
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              cursor: "pointer",
            }}
          >
            Apri su Google Maps
          </button>

          <button
            type="button"
            onClick={() => alert("Qui metteremo: richiesta contatto / convenzione / promo.")}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              cursor: "pointer",
            }}
          >
            Contatta / Promo
          </button>

          <button
            type="button"
            onClick={() => alert("Qui metteremo: onboarding fornitore + pagamento Pass Fornitore.")}
            style={{
              marginLeft: "auto",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            Diventa fornitore
          </button>
        </div>
      </div>
    </div>
  );
}
