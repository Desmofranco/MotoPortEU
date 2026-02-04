import { useMemo, useState } from "react";
import { loadBikes, saveBikes } from "../utils/storage";

const uid = () => `bike-${Math.random().toString(16).slice(2)}-${Date.now()}`;

const DEFAULTS = {
  oilEveryKm: 6000,
  chainEveryKm: 800,
  tiresEveryKm: 9000,
};

function clampNum(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function nextDueAt(currentKm, intervalKm) {
  const km = Number(currentKm || 0);
  const interval = Math.max(1, Number(intervalKm || 1));
  return Math.ceil(km / interval) * interval + interval;
}

function statusFor(nextDueKm, currentKm) {
  const left = nextDueKm - currentKm;
  if (left <= 0) return { label: "SCADUTO", level: "bad" };
  if (left <= 150) return { label: "URGENTE", level: "warn" };
  if (left <= 500) return { label: "PRESTO", level: "soon" };
  return { label: "OK", level: "ok" };
}

export default function Garage() {
  // ✅ inizializzo direttamente da storage (no useEffect)
  const [bikes, setBikes] = useState(() => loadBikes());
  const [activeId, setActiveId] = useState(() => loadBikes()[0]?.id || null);

  // form nuova moto
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [km, setKm] = useState("");

  // km update moto attiva
  const [kmUpdate, setKmUpdate] = useState("");

  const activeBike = useMemo(
    () => bikes.find((b) => b.id === activeId) || null,
    [bikes, activeId]
  );

  const computed = useMemo(() => {
    if (!activeBike) return null;

    const currentKm = Number(activeBike.km || 0);
    const oilInterval = Number(activeBike.maintenance?.oilEveryKm ?? DEFAULTS.oilEveryKm);
    const chainInterval = Number(activeBike.maintenance?.chainEveryKm ?? DEFAULTS.chainEveryKm);
    const tiresInterval = Number(activeBike.maintenance?.tiresEveryKm ?? DEFAULTS.tiresEveryKm);

    const oilNext = nextDueAt(currentKm, oilInterval);
    const chainNext = nextDueAt(currentKm, chainInterval);
    const tiresNext = nextDueAt(currentKm, tiresInterval);

    return {
      currentKm,
      oil: { interval: oilInterval, next: oilNext, left: oilNext - currentKm, ...statusFor(oilNext, currentKm) },
      chain: { interval: chainInterval, next: chainNext, left: chainNext - currentKm, ...statusFor(chainNext, currentKm) },
      tires: { interval: tiresInterval, next: tiresNext, left: tiresNext - currentKm, ...statusFor(tiresNext, currentKm) },
    };
  }, [activeBike]);

  // ✅ helper: aggiorna stato + salva subito (a prova di F5)
  const setBikesAndPersist = (next) => {
    setBikes(next);
    saveBikes(next);
  };

  const addBike = () => {
    const b = brand.trim();
    const m = model.trim();
    if (!b || !m) {
      alert("Inserisci almeno Marca e Modello.");
      return;
    }

    const y = year ? clampNum(year, 1950, new Date().getFullYear() + 1) : "";
    const k = km ? clampNum(km, 0, 9999999) : 0;

    const newBike = {
      id: uid(),
      brand: b,
      model: m,
      year: y,
      km: k,
      createdAt: new Date().toISOString(),
      maintenance: { ...DEFAULTS },
    };

    const next = [newBike, ...bikes];
    setBikesAndPersist(next);
    setActiveId(newBike.id);

    setBrand("");
    setModel("");
    setYear("");
    setKm("");
  };

  const deleteBike = (id) => {
    if (!confirm("Eliminare questa moto dal Garage?")) return;
    const next = bikes.filter((b) => b.id !== id);
    setBikesAndPersist(next);

    if (activeId === id) {
      setActiveId(next[0]?.id || null);
    }
  };

  const updateBikeKm = () => {
    if (!activeBike) return;
    const newKm = clampNum(kmUpdate, 0, 9999999);

    const next = bikes.map((b) =>
      b.id === activeBike.id ? { ...b, km: newKm, updatedAt: new Date().toISOString() } : b
    );

    setBikesAndPersist(next);
    setKmUpdate("");
  };

  const updateIntervals = (patch) => {
    if (!activeBike) return;

    const next = bikes.map((b) =>
      b.id === activeBike.id
        ? {
            ...b,
            maintenance: { ...b.maintenance, ...patch },
            updatedAt: new Date().toISOString(),
          }
        : b
    );

    setBikesAndPersist(next);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Garage 🧰</h1>
        <span style={{ opacity: 0.75 }}>Libretto digitale (locale). Niente login per ora.</span>
      </div>

      {/* Add bike */}
      <div
        style={{
          marginTop: 14,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 16,
          padding: 14,
          background: "white",
        }}
      >
        <strong>Aggiungi moto</strong>
        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Marca (es. Ducati)"
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
          />
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Modello (es. Monster 821)"
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
          />
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Anno (opz.)"
            inputMode="numeric"
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
          />
          <input
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="Km attuali (opz.)"
            inputMode="numeric"
            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
          />
          <button
            type="button"
            onClick={addBike}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            Aggiungi
          </button>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
        {/* List */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 16,
            padding: 14,
            background: "white",
            height: "fit-content",
          }}
        >
          <strong>Le tue moto</strong>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {bikes.length === 0 && (
              <div style={{ padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.04)" }}>
                Nessuna moto. Aggiungine una sopra.
              </div>
            )}

            {bikes.map((b) => (
              <div
                key={b.id}
                onClick={() => setActiveId(b.id)}
                style={{
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  cursor: "pointer",
                  background: b.id === activeId ? "rgba(0,0,0,0.05)" : "white",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {b.brand} {b.model}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {b.year ? `${b.year} · ` : ""}
                      {Number(b.km || 0).toLocaleString()} km
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBike(b.id);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.15)",
                      background: "white",
                      cursor: "pointer",
                      height: "fit-content",
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 16,
            padding: 14,
            background: "white",
          }}
        >
          {!activeBike ? (
            <div style={{ padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.04)" }}>
              Seleziona una moto per vedere la Salute Moto.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>
                  {activeBike.brand} {activeBike.model}
                </h2>
                <span style={{ opacity: 0.75, fontSize: 13 }}>
                  {activeBike.year ? `${activeBike.year} · ` : ""}
                  {Number(activeBike.km || 0).toLocaleString()} km
                </span>
              </div>

              {/* Update km */}
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={kmUpdate}
                  onChange={(e) => setKmUpdate(e.target.value)}
                  placeholder="Aggiorna km (es. 12500)"
                  inputMode="numeric"
                  style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", minWidth: 220 }}
                />
                <button
                  type="button"
                  onClick={updateBikeKm}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Salva km
                </button>
              </div>

              {/* Health cards */}
              {computed && (
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <HealthRow title="🛢️ Olio" item={computed.oil} />
                  <HealthRow title="⛓️ Catena" item={computed.chain} />
                  <HealthRow title="🛞 Gomme" item={computed.tires} />
                </div>
              )}

              {/* Intervalli */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                <strong>Intervalli (km)</strong>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  <IntervalInput
                    label="Olio ogni"
                    value={activeBike.maintenance?.oilEveryKm ?? DEFAULTS.oilEveryKm}
                    onChange={(v) => updateIntervals({ oilEveryKm: clampNum(v, 500, 50000) })}
                  />
                  <IntervalInput
                    label="Catena ogni"
                    value={activeBike.maintenance?.chainEveryKm ?? DEFAULTS.chainEveryKm}
                    onChange={(v) => updateIntervals({ chainEveryKm: clampNum(v, 100, 10000) })}
                  />
                  <IntervalInput
                    label="Gomme ogni"
                    value={activeBike.maintenance?.tiresEveryKm ?? DEFAULTS.tiresEveryKm}
                    onChange={(v) => updateIntervals({ tiresEveryKm: clampNum(v, 1000, 50000) })}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HealthRow({ title, item }) {
  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 12, background: "white" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <strong>{title}</strong>
        <span style={{ opacity: 0.8, fontSize: 12 }}>
          Prossima: <strong>{item.next.toLocaleString()} km</strong> · Mancano{" "}
          <strong>{item.left.toLocaleString()} km</strong>
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
        Intervallo: {item.interval.toLocaleString()} km
      </div>
      <div style={{ marginTop: 8 }}>
        <span style={pillStyle(item.level)}>{item.label}</span>
      </div>
    </div>
  );
}

function IntervalInput({ label, value, onChange }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.8 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.15)",
          outline: "none",
        }}
      />
    </label>
  );
}

function pillStyle(level) {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "rgba(0,0,0,0.04)",
  };
  if (level === "bad") return { ...base, background: "rgba(255,0,0,0.10)" };
  if (level === "warn") return { ...base, background: "rgba(255,140,0,0.12)" };
  if (level === "soon") return { ...base, background: "rgba(255,215,0,0.18)" };
  return base;
}
