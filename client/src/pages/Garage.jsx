import { useEffect, useMemo, useState } from "react";
import { loadBikes, saveBikes, fileToDataUrl } from "../utils/storage";

const uid = () => `bike-${Math.random().toString(16).slice(2)}-${Date.now()}`;

const DEFAULTS = {
  oilEveryKm: 6000,
  chainEveryKm: 800,
  tiresEveryKm: 9000,
};

const DOC_TYPES = [
  { key: "insurance", label: "Assicurazione" },
  { key: "tax", label: "Bollo" },
  { key: "inspection", label: "Revisione" },
  { key: "service", label: "Tagliando" },
  { key: "other", label: "Altro" },
];

function clampNum(v, min, max) {
  const n = Number(String(v).trim());
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

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function Garage() {
  const [bikes, setBikes] = useState(() => loadBikes());
  const [activeId, setActiveId] = useState(() => {
    const initial = loadBikes();
    return initial?.[0]?.id || null;
  });

  // form nuova moto
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [km, setKm] = useState("");

  // km update moto attiva
  const [kmUpdate, setKmUpdate] = useState("");

  // ✅ Documenti form
  const [docType, setDocType] = useState("insurance");
  const [docExpiry, setDocExpiry] = useState("");
  const [docNote, setDocNote] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [docBusy, setDocBusy] = useState(false);

  useEffect(() => {
    if (bikes.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    const exists = bikes.some((b) => b.id === activeId);
    if (!exists) setActiveId(bikes[0].id);
  }, [bikes, activeId]);

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
      // ✅ Documenti libretto
      documents: [], // array {id,type,label,expiry,note,fileName,dataUrl,createdAt}
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
  };

  const updateBikeKm = () => {
    if (!activeBike) return;

    const raw = String(kmUpdate).trim();
    if (!raw) return;

    const newKm = clampNum(raw, 0, 9999999);

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

  // ✅ aggiungi documento con foto offline
  const addDocument = async () => {
    if (!activeBike) return;
    if (!docFile) {
      alert("Carica una foto o PDF del documento.");
      return;
    }

    setDocBusy(true);
    try {
      const dataUrl = await fileToDataUrl(docFile);
      const typeMeta = DOC_TYPES.find((d) => d.key === docType);
      const doc = {
        id: `doc-${Math.random().toString(16).slice(2)}-${Date.now()}`,
        type: docType,
        label: typeMeta?.label || "Documento",
        expiry: docExpiry || "",
        note: docNote.trim(),
        fileName: docFile.name || "",
        dataUrl,
        createdAt: new Date().toISOString(),
      };

      const next = bikes.map((b) =>
        b.id === activeBike.id
          ? {
              ...b,
              documents: [doc, ...(Array.isArray(b.documents) ? b.documents : [])],
              updatedAt: new Date().toISOString(),
            }
          : b
      );

      setBikesAndPersist(next);

      // reset form
      setDocType("insurance");
      setDocExpiry("");
      setDocNote("");
      setDocFile(null);

      // reset input file (hack semplice)
      const el = document.getElementById("docFileInput");
      if (el) el.value = "";
    } catch (e) {
      console.error(e);
      alert("Errore nel caricamento documento.");
    } finally {
      setDocBusy(false);
    }
  };

  const deleteDocument = (docId) => {
    if (!activeBike) return;
    if (!confirm("Eliminare questo documento?")) return;

    const next = bikes.map((b) =>
      b.id === activeBike.id
        ? {
            ...b,
            documents: (Array.isArray(b.documents) ? b.documents : []).filter((d) => d.id !== docId),
            updatedAt: new Date().toISOString(),
          }
        : b
    );

    setBikesAndPersist(next);
  };

  const docsSorted = useMemo(() => {
    if (!activeBike) return [];
    const docs = Array.isArray(activeBike.documents) ? activeBike.documents : [];
    return [...docs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [activeBike]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Garage 🧰</h1>
        <span style={{ opacity: 0.75 }}>Libretto digitale offline (foto + scadenze). Niente login.</span>
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
              Seleziona una moto per vedere manutenzione e libretto.
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
                    value={String(activeBike.maintenance?.oilEveryKm ?? DEFAULTS.oilEveryKm)}
                    onChange={(v) => updateIntervals({ oilEveryKm: clampNum(v, 500, 50000) })}
                  />
                  <IntervalInput
                    label="Catena ogni"
                    value={String(activeBike.maintenance?.chainEveryKm ?? DEFAULTS.chainEveryKm)}
                    onChange={(v) => updateIntervals({ chainEveryKm: clampNum(v, 100, 10000) })}
                  />
                  <IntervalInput
                    label="Gomme ogni"
                    value={String(activeBike.maintenance?.tiresEveryKm ?? DEFAULTS.tiresEveryKm)}
                    onChange={(v) => updateIntervals({ tiresEveryKm: clampNum(v, 1000, 50000) })}
                  />
                </div>
              </div>

              {/* ✅ LIBRETTO DOCUMENTI */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                <strong>Libretto & Documenti (offline)</strong>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <div
                    style={{
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Tipo</span>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
                        >
                          {DOC_TYPES.map((d) => (
                            <option key={d.key} value={d.key}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Scadenza (opz.)</span>
                        <input
                          type="date"
                          value={docExpiry}
                          onChange={(e) => setDocExpiry(e.target.value)}
                          min="2000-01-01"
                          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Note (opz.)</span>
                        <input
                          value={docNote}
                          onChange={(e) => setDocNote(e.target.value)}
                          placeholder="Es. polizza, compagnia, ecc."
                          style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)" }}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Foto/PDF</span>
                        <input
                          id="docFileInput"
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                          style={{ padding: "8px 0" }}
                        />
                      </label>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={addDocument}
                        disabled={docBusy}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: "white",
                          cursor: docBusy ? "not-allowed" : "pointer",
                          opacity: docBusy ? 0.7 : 1,
                        }}
                      >
                        {docBusy ? "Caricamento..." : "Aggiungi documento"}
                      </button>

                      <span style={{ fontSize: 12, opacity: 0.75 }}>
                        ⚠️ Nota: le foto vengono salvate in locale. Se carichi file enormi, il browser può saturare lo storage.
                      </span>
                    </div>
                  </div>

                  {/* lista documenti */}
                  {docsSorted.length === 0 ? (
                    <div style={{ padding: 10, borderRadius: 12, background: "rgba(0,0,0,0.04)" }}>
                      Nessun documento salvato per questa moto.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {docsSorted.map((d) => (
                        <DocCard key={d.id} doc={d} onDelete={() => deleteDocument(d.id)} />
                      ))}
                    </div>
                  )}
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
          Prossima: <strong>{item.next.toLocaleString()} km</strong> · Mancano <strong>{item.left.toLocaleString()} km</strong>
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>Intervallo: {item.interval.toLocaleString()} km</div>
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

function DocCard({ doc, onDelete }) {
  const isPdf = String(doc.dataUrl || "").startsWith("data:application/pdf");
  const hasExpiry = !!doc.expiry;

  // badge scadenza semplice
  let expiryBadge = null;
  if (hasExpiry) {
    const now = new Date();
    const exp = new Date(doc.expiry + "T00:00:00");
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    let level = "ok";
    if (diffDays < 0) level = "bad";
    else if (diffDays <= 15) level = "warn";
    else if (diffDays <= 45) level = "soon";

    expiryBadge = (
      <span style={{ ...pillStyle(level), marginLeft: 8 }}>
        Scade: {doc.expiry} ({diffDays < 0 ? "scaduto" : `${diffDays}gg`})
      </span>
    );
  }

  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 12, background: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800 }}>
            {doc.label}
            {expiryBadge}
          </div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {doc.fileName ? `${doc.fileName} · ` : ""}
            Salvato: {String(doc.createdAt || "").slice(0, 10)}
            {doc.note ? ` · ${doc.note}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
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

      <div style={{ marginTop: 10 }}>
        {isPdf ? (
          <a href={doc.dataUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            Apri PDF
          </a>
        ) : (
          <img
            src={doc.dataUrl}
            alt={doc.label}
            style={{
              width: "100%",
              maxHeight: 360,
              objectFit: "contain",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(0,0,0,0.02)",
            }}
          />
        )}
      </div>
    </div>
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
