// =======================================================
// src/pages/Garage.jsx
// ✅ FIX: puoi salvare documenti anche SENZA file (solo tipo+scadenza+note)
// ✅ NEW: Storico Tagliandi / Interventi (offline) per ogni moto
// ✅ MOBILE: layout mobile-first (titoli, griglie, bottoni full width)
// ✅ FIX: logica km manutenzione corretta
//    - usa ultimo intervento compatibile se presente
//    - fallback: km attuali + intervallo
//    - niente multipli incoerenti
// =======================================================
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
  const normalized = String(v ?? "")
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const n = Number(normalized.trim());
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function parseKm(v, fallback = 0) {
  const n = clampNum(v, 0, 9999999);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function statusFor(nextDueKm, currentKm) {
  const left = Number(nextDueKm || 0) - Number(currentKm || 0);
  if (left <= 0) return { label: "SCADUTO", level: "bad" };
  if (left <= 150) return { label: "URGENTE", level: "warn" };
  if (left <= 500) return { label: "PRESTO", level: "soon" };
  return { label: "OK", level: "ok" };
}

function diffDaysFromToday(isoDate) {
  if (!isoDate) return null;
  const now = new Date();
  const exp = new Date(String(isoDate) + "T00:00:00");
  if (Number.isNaN(exp.getTime())) return null;
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function expiryStatus(diffDays) {
  if (diffDays === null) return null;
  if (diffDays < 0) return { label: "SCADUTO", level: "bad" };
  if (diffDays <= 15) return { label: "URGENTE", level: "warn" };
  if (diffDays <= 45) return { label: "PRESTO", level: "soon" };
  return { label: "OK", level: "ok" };
}

function normalizeType(str) {
  return String(str || "").trim().toLowerCase();
}

function inferServiceCategory(type) {
  const t = normalizeType(type);

  if (
    t.includes("olio") ||
    t.includes("tagliando") ||
    t.includes("service")
  ) {
    return "oil";
  }

  if (t.includes("catena") || t.includes("chain")) {
    return "chain";
  }

  if (
    t.includes("gomme") ||
    t.includes("gomme") ||
    t.includes("pneumatic") ||
    t.includes("tire") ||
    t.includes("tyre")
  ) {
    return "tires";
  }

  return "other";
}

function getLastServiceKm(serviceLog = [], category) {
  const arr = Array.isArray(serviceLog) ? serviceLog : [];
  const matches = arr
    .filter((x) => inferServiceCategory(x?.type) === category)
    .map((x) => ({
      km: parseKm(x?.km, 0),
      date: String(x?.date || ""),
      createdAt: String(x?.createdAt || ""),
      type: String(x?.type || ""),
    }))
    .sort((a, b) => {
      if (a.km !== b.km) return b.km - a.km;
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });

  return matches[0] || null;
}

function buildMaintenanceItem({
  currentKm,
  interval,
  lastEntry,
  categoryLabel,
}) {
  const safeCurrent = parseKm(currentKm, 0);
  const safeInterval = Math.max(1, parseKm(interval, 1));

  const lastKm = lastEntry ? parseKm(lastEntry.km, 0) : null;

  // Se c'è uno storico valido, usiamo quello come base.
  // Altrimenti baseline semplice e chiara: km attuali + intervallo.
  const nextDueKm =
    lastKm !== null ? lastKm + safeInterval : safeCurrent + safeInterval;

  const left = nextDueKm - safeCurrent;
  const status = statusFor(nextDueKm, safeCurrent);

  return {
    interval: safeInterval,
    next: nextDueKm,
    left,
    lastKm,
    lastType: lastEntry?.type || "",
    categoryLabel,
    calcMode: lastKm !== null ? "from-service-log" : "from-current-km",
    ...status,
  };
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

  // Documenti form
  const [docType, setDocType] = useState("insurance");
  const [docExpiry, setDocExpiry] = useState("");
  const [docNote, setDocNote] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [docBusy, setDocBusy] = useState(false);

  // Storico tagliandi/interventi
  const [svcDate, setSvcDate] = useState("");
  const [svcKm, setSvcKm] = useState("");
  const [svcType, setSvcType] = useState("Tagliando");
  const [svcCost, setSvcCost] = useState("");
  const [svcNote, setSvcNote] = useState("");

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

    const currentKm = parseKm(activeBike.km, 0);
    const oilInterval = parseKm(
      activeBike.maintenance?.oilEveryKm ?? DEFAULTS.oilEveryKm,
      DEFAULTS.oilEveryKm
    );
    const chainInterval = parseKm(
      activeBike.maintenance?.chainEveryKm ?? DEFAULTS.chainEveryKm,
      DEFAULTS.chainEveryKm
    );
    const tiresInterval = parseKm(
      activeBike.maintenance?.tiresEveryKm ?? DEFAULTS.tiresEveryKm,
      DEFAULTS.tiresEveryKm
    );

    const log = Array.isArray(activeBike.serviceLog) ? activeBike.serviceLog : [];

    const oilLast = getLastServiceKm(log, "oil");
    const chainLast = getLastServiceKm(log, "chain");
    const tiresLast = getLastServiceKm(log, "tires");

    return {
      currentKm,
      oil: buildMaintenanceItem({
        currentKm,
        interval: oilInterval,
        lastEntry: oilLast,
        categoryLabel: "Olio / Tagliando",
      }),
      chain: buildMaintenanceItem({
        currentKm,
        interval: chainInterval,
        lastEntry: chainLast,
        categoryLabel: "Catena",
      }),
      tires: buildMaintenanceItem({
        currentKm,
        interval: tiresInterval,
        lastEntry: tiresLast,
        categoryLabel: "Gomme",
      }),
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

    const y = year
      ? clampNum(year, 1950, new Date().getFullYear() + 1)
      : "";
    const k = km ? parseKm(km, 0) : 0;

    const newBike = {
      id: uid(),
      brand: b,
      model: m,
      year: y,
      km: k,
      createdAt: new Date().toISOString(),
      maintenance: { ...DEFAULTS },
      documents: [],
      serviceLog: [],
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

    const newKm = parseKm(raw, 0);

    const next = bikes.map((b) =>
      b.id === activeBike.id
        ? { ...b, km: newKm, updatedAt: new Date().toISOString() }
        : b
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

  const addDocument = async () => {
    if (!activeBike) return;

    const note = docNote.trim();
    const hasAnyInfo = !!docExpiry || !!note || !!docFile;

    if (!hasAnyInfo) {
      alert("Inserisci almeno una Scadenza o una Nota (oppure carica un file).");
      return;
    }

    setDocBusy(true);
    try {
      const typeMeta = DOC_TYPES.find((d) => d.key === docType);

      let dataUrl = null;
      let fileName = "";

      if (docFile) {
        dataUrl = await fileToDataUrl(docFile);
        fileName = docFile.name || "";
      }

      const doc = {
        id: `doc-${Math.random().toString(16).slice(2)}-${Date.now()}`,
        type: docType,
        label: typeMeta?.label || "Documento",
        expiry: docExpiry || "",
        note,
        fileName,
        dataUrl,
        createdAt: new Date().toISOString(),
      };

      const next = bikes.map((b) =>
        b.id === activeBike.id
          ? {
              ...b,
              documents: [
                doc,
                ...(Array.isArray(b.documents) ? b.documents : []),
              ],
              updatedAt: new Date().toISOString(),
            }
          : b
      );

      setBikesAndPersist(next);

      setDocType("insurance");
      setDocExpiry("");
      setDocNote("");
      setDocFile(null);

      const el = document.getElementById("docFileInput");
      if (el) el.value = "";
    } catch (e) {
      console.error(e);
      alert("Errore nel salvataggio documento.");
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
            documents: (Array.isArray(b.documents) ? b.documents : []).filter(
              (d) => d.id !== docId
            ),
            updatedAt: new Date().toISOString(),
          }
        : b
    );

    setBikesAndPersist(next);
  };

  const addServiceEntry = () => {
    if (!activeBike) return;

    const date = String(svcDate || "").trim();
    const kmRaw = String(svcKm || "").trim();

    if (!date) {
      alert("Inserisci la data dell'intervento.");
      return;
    }
    if (!kmRaw) {
      alert("Inserisci i km dell'intervento.");
      return;
    }

    const kmNum = parseKm(kmRaw, 0);
    const costRaw = String(svcCost || "").trim();
    const normalizedCost = costRaw.replace(",", ".");
    const costNum =
      normalizedCost === "" ? "" : clampNum(normalizedCost, 0, 999999);

    const entry = {
      id: `svc-${Math.random().toString(16).slice(2)}-${Date.now()}`,
      date,
      km: kmNum,
      type: String(svcType || "Intervento").trim() || "Intervento",
      cost: costNum,
      note: String(svcNote || "").trim(),
      createdAt: new Date().toISOString(),
    };

    const next = bikes.map((b) =>
      b.id === activeBike.id
        ? {
            ...b,
            serviceLog: [
              entry,
              ...(Array.isArray(b.serviceLog) ? b.serviceLog : []),
            ],
            updatedAt: new Date().toISOString(),
          }
        : b
    );

    setBikesAndPersist(next);

    setSvcDate("");
    setSvcKm("");
    setSvcType("Tagliando");
    setSvcCost("");
    setSvcNote("");
  };

  const deleteServiceEntry = (entryId) => {
    if (!activeBike) return;
    if (!confirm("Eliminare questo intervento dallo storico?")) return;

    const next = bikes.map((b) =>
      b.id === activeBike.id
        ? {
            ...b,
            serviceLog: (Array.isArray(b.serviceLog) ? b.serviceLog : []).filter(
              (x) => x.id !== entryId
            ),
            updatedAt: new Date().toISOString(),
          }
        : b
    );

    setBikesAndPersist(next);
  };

  const docsSorted = useMemo(() => {
    if (!activeBike) return [];
    const docs = Array.isArray(activeBike.documents) ? activeBike.documents : [];
    return [...docs].sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
  }, [activeBike]);

  const serviceSorted = useMemo(() => {
    if (!activeBike) return [];
    const arr = Array.isArray(activeBike.serviceLog) ? activeBike.serviceLog : [];
    return [...arr].sort((a, b) => {
      const ak = parseKm(a.km, 0);
      const bk = parseKm(b.km, 0);
      if (ak !== bk) return bk - ak;
      const ad = String(a.date || "");
      const bd = String(b.date || "");
      if (ad !== bd) return bd.localeCompare(ad);
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }, [activeBike]);

  const expiryLists = useMemo(() => {
    if (!activeBike) return { dueSoon: [], expired: [] };
    const docs = Array.isArray(activeBike.documents) ? activeBike.documents : [];

    const enriched = docs
      .filter((d) => d.expiry)
      .map((d) => {
        const days = diffDaysFromToday(d.expiry);
        const st = expiryStatus(days);
        return { ...d, days, st };
      })
      .filter((d) => d.days !== null);

    const expired = enriched
      .filter((d) => d.days < 0)
      .sort((a, b) => a.days - b.days);
    const dueSoon = enriched
      .filter((d) => d.days >= 0 && d.days <= 45)
      .sort((a, b) => a.days - b.days);

    return { dueSoon, expired };
  }, [activeBike]);

  return (
    <div className="garage-wrap">
      <style>{`
        .garage-wrap { padding: 14px; padding-bottom: 88px; max-width: 1100px; margin: 0 auto; }
        .garage-head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .garage-title { margin:0; font-weight:900; letter-spacing:-0.02em; font-size: clamp(28px, 7vw, 44px); line-height: 1.0; }
        .garage-sub { margin:0; opacity:0.78; font-size: 13px; }

        .card { margin-top: 12px; border: 1px solid rgba(0,0,0,0.12); border-radius: 16px; padding: 14px; background: #fff; }
        .mutedBox { padding: 10px; border-radius: 12px; background: rgba(0,0,0,0.04); }

        .bike-form { margin-top:10px; display:grid; gap:10px; grid-template-columns: 1fr; }
        @media (min-width: 520px) { .bike-form { grid-template-columns: 1fr 1fr; } }
        .bike-form .full { grid-column: 1 / -1; }

        .in { width:100%; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.15); box-sizing:border-box; }
        .btn { width:100%; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.15); background: rgba(0,0,0,0.06); cursor:pointer; font-weight:800; }
        .btnWhite { background:#fff; }
        .btn:disabled { opacity:0.65; cursor:not-allowed; }

        .garage-grid { margin-top: 14px; display: grid; gap: 14px; grid-template-columns: 1fr; }
        @media (min-width: 900px) { .garage-grid { grid-template-columns: 320px 1fr; } }

        .listItem { padding: 10px; border-radius: 14px; border: 1px solid rgba(0,0,0,0.12); cursor: pointer; background: #fff; }
        .listItemActive { background: rgba(0,0,0,0.05); }

        .row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .row > input { flex: 1; min-width: 180px; }
      `}</style>

      <div className="garage-head">
        <div>
          <h1 className="garage-title">Garage 🧰</h1>
          <p className="garage-sub">Libretto digitale offline (foto + scadenze). Niente login.</p>
        </div>
      </div>

      <div className="card">
        <strong>Aggiungi moto</strong>
        <div className="bike-form">
          <input
            className="in"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Marca (es. Ducati)"
          />
          <input
            className="in"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Modello (es. Monster 821)"
          />
          <input
            className="in"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Anno (opz.)"
            inputMode="numeric"
          />
          <input
            className="in"
            value={km}
            onChange={(e) => setKm(e.target.value)}
            placeholder="Km attuali (opz.)"
            inputMode="numeric"
          />

          <div className="full">
            <button type="button" onClick={addBike} className="btn">
              Aggiungi
            </button>
          </div>
        </div>
      </div>

      <div className="garage-grid">
        <div className="card" style={{ height: "fit-content" }}>
          <strong>Le tue moto</strong>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {bikes.length === 0 && <div className="mutedBox">Nessuna moto. Aggiungine una sopra.</div>}
            {bikes.map((b) => (
              <div
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className={`listItem ${b.id === activeId ? "listItemActive" : ""}`}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{b.brand} {b.model}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {b.year ? `${b.year} · ` : ""}{parseKm(b.km, 0).toLocaleString()} km
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteBike(b.id); }}
                    className="btn btnWhite"
                    style={{ width: "auto", padding: "6px 10px", height: "fit-content" }}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          {!activeBike ? (
            <div className="mutedBox">Seleziona una moto per vedere manutenzione e libretto.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>
                  {activeBike.brand} {activeBike.model}
                </h2>
                <span style={{ opacity: 0.75, fontSize: 13 }}>
                  {activeBike.year ? `${activeBike.year} · ` : ""}
                  {parseKm(activeBike.km, 0).toLocaleString()} km
                </span>
              </div>

              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <strong>📅 Scadenze in arrivo (45gg)</strong>
                  <span style={{ fontSize: 12, opacity: 0.75 }}>
                    {expiryLists.expired.length > 0 ? `Scaduti: ${expiryLists.expired.length} · ` : ""}
                    In arrivo: {expiryLists.dueSoon.length}
                  </span>
                </div>

                {(expiryLists.expired.length === 0 && expiryLists.dueSoon.length === 0) ? (
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    Nessuna scadenza imminente. 🔥
                  </div>
                ) : (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {expiryLists.expired.map((d) => <ExpiryRow key={d.id} doc={d} />)}
                    {expiryLists.dueSoon.map((d) => <ExpiryRow key={d.id} doc={d} />)}
                  </div>
                )}
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <input
                  value={kmUpdate}
                  onChange={(e) => setKmUpdate(e.target.value)}
                  placeholder="Aggiorna km (es. 12500)"
                  inputMode="numeric"
                  className="in"
                />
                <button type="button" onClick={updateBikeKm} className="btn btnWhite" style={{ width: "auto" }}>
                  Salva km
                </button>
              </div>

              {computed && (
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <HealthRow title="🛢️ Olio" item={computed.oil} />
                  <HealthRow title="⛓️ Catena" item={computed.chain} />
                  <HealthRow title="🛞 Gomme" item={computed.tires} />
                </div>
              )}

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                <strong>Intervalli (km)</strong>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <IntervalInput
  label="Olio ogni"
  value={String(activeBike.maintenance?.oilEveryKm ?? DEFAULTS.oilEveryKm)}
  min={500}
  max={50000}
  onCommit={(v) => updateIntervals({ oilEveryKm: v })}
/>
<IntervalInput
  label="Catena ogni"
  value={String(activeBike.maintenance?.chainEveryKm ?? DEFAULTS.chainEveryKm)}
  min={100}
  max={10000}
  onCommit={(v) => updateIntervals({ chainEveryKm: v })}
/>
<IntervalInput
  label="Gomme ogni"
  value={String(activeBike.maintenance?.tiresEveryKm ?? DEFAULTS.tiresEveryKm)}
  min={1000}
  max={50000}
  onCommit={(v) => updateIntervals({ tiresEveryKm: v })}
/>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.72 }}>
                  Suggerimento: registra un intervento nello storico per avere scadenze davvero precise su olio, catena e gomme.
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                <strong>📒 Storico Tagliandi / Interventi</strong>

                <div style={{ marginTop: 10, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 12, background: "rgba(0,0,0,0.02)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Data</span>
                      <input type="date" value={svcDate} onChange={(e) => setSvcDate(e.target.value)} className="in" />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Km</span>
                      <input value={svcKm} onChange={(e) => setSvcKm(e.target.value)} inputMode="numeric" placeholder="es. 12500" className="in" />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Tipo</span>
                      <input value={svcType} onChange={(e) => setSvcType(e.target.value)} placeholder="Tagliando / Olio / Gomme..." className="in" />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Costo € (opz.)</span>
                      <input value={svcCost} onChange={(e) => setSvcCost(e.target.value)} inputMode="decimal" placeholder="es. 180" className="in" />
                    </label>

                    <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>Note (opz.)</span>
                      <input value={svcNote} onChange={(e) => setSvcNote(e.target.value)} placeholder="es. Olio Motul 7100, filtro…" className="in" />
                    </label>
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" onClick={addServiceEntry} className="btn btnWhite" style={{ width: "auto" }}>
                      Aggiungi intervento
                    </button>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>
                      Inserisci sempre data + km, il resto è opzionale.
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {serviceSorted.length === 0 ? (
                    <div className="mutedBox">Nessun intervento registrato.</div>
                  ) : (
                    serviceSorted.map((s) => (
                      <div key={s.id} style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 12, background: "white" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>
                              {s.type} · {s.date} · {parseKm(s.km, 0).toLocaleString()} km
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              {s.cost !== "" ? `Costo: €${Number(s.cost).toLocaleString()} · ` : ""}
                              {s.note ? s.note : "—"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => deleteServiceEntry(s.id)}
                            className="btn btnWhite"
                            style={{ width: "auto", padding: "6px 10px", height: "fit-content" }}
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(0,0,0,0.10)" }}>
                <strong>Libretto & Documenti (offline)</strong>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <div style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 12, background: "rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Tipo</span>
                        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="in">
                          {DOC_TYPES.map((d) => (
                            <option key={d.key} value={d.key}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Scadenza (opz.)</span>
                        <input type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} className="in" />
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Note (opz.)</span>
                        <input value={docNote} onChange={(e) => setDocNote(e.target.value)} placeholder="Es. polizza, compagnia, ecc." className="in" />
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>Foto/PDF (opz.)</span>
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
                      <button type="button" onClick={addDocument} disabled={docBusy} className="btn btnWhite" style={{ width: "auto" }}>
                        {docBusy ? "Salvataggio..." : "Aggiungi documento"}
                      </button>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>
                        ✅ Ora puoi salvare anche senza allegato (solo dati).
                      </span>
                    </div>
                  </div>

                  {docsSorted.length === 0 ? (
                    <div className="mutedBox">Nessun documento salvato per questa moto.</div>
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

function ExpiryRow({ doc }) {
  const days = doc.days;
  const st = doc.st || { label: "OK", level: "ok" };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", background: "white" }}>
      <div style={{ fontSize: 13 }}>
        <strong>{doc.label}</strong>{" "}
        <span style={{ opacity: 0.75 }}>
          · {doc.expiry} · {days < 0 ? "scaduto" : `${days} giorni`}
        </span>
        {doc.note ? <span style={{ opacity: 0.7 }}> · {doc.note}</span> : null}
      </div>
      <span style={pillStyle(st.level)}>{st.label}</span>
    </div>
  );
}

function HealthRow({ title, item }) {
  const lastText =
    item.lastKm !== null
      ? `${item.lastKm.toLocaleString()} km${item.lastType ? ` · ${item.lastType}` : ""}`
      : "non registrato";

  const modeText =
    item.calcMode === "from-service-log"
      ? "Calcolo da ultimo intervento"
      : "Calcolo da km attuali (nessuno storico trovato)";

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
      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
        Ultimo intervento: {lastText}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.65 }}>
        {modeText}
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={pillStyle(item.level)}>{item.label}</span>
      </div>
    </div>
  );
}

function IntervalInput({ label, value, min = 0, max = 9999999, onCommit }) {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  const commit = () => {
    const raw = String(draft ?? "").trim();

    // se l’utente lascia vuoto, ripristina il valore attuale senza salvare schifezze
    if (!raw) {
      setDraft(String(value ?? ""));
      return;
    }

    const next = clampNum(raw, min, max);
    setDraft(String(next));
    onCommit?.(next);
  };

  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.8 }}>{label}</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
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
  const dataUrl = doc.dataUrl || null;
  const isPdf = dataUrl ? String(dataUrl).startsWith("data:application/pdf") : false;
  const hasAttachment = !!dataUrl;

  let expiryBadge = null;
  if (doc.expiry) {
    const diffDays = diffDaysFromToday(doc.expiry);
    const st = expiryStatus(diffDays) || { label: "OK", level: "ok" };
    expiryBadge = (
      <span style={{ ...pillStyle(st.level), marginLeft: 8 }}>
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
            {hasAttachment ? "" : "Solo dati (nessun allegato) · "}
            Salvato: {String(doc.createdAt || "").slice(0, 10)}
            {doc.note ? ` · ${doc.note}` : ""}
          </div>
        </div>

        <button type="button" onClick={onDelete} style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.15)", background: "white", cursor: "pointer", height: "fit-content" }}>
          Elimina
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        {!hasAttachment ? (
          <div style={{ padding: 12, borderRadius: 12, border: "1px dashed rgba(0,0,0,0.18)", background: "rgba(0,0,0,0.02)", fontSize: 13, opacity: 0.85 }}>
            Nessun file allegato. (Documento salvato solo con dati.)
          </div>
        ) : isPdf ? (
          <a href={dataUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            Apri PDF
          </a>
        ) : (
          <img
            src={dataUrl}
            alt={doc.label}
            style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)", background: "rgba(0,0,0,0.02)" }}
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