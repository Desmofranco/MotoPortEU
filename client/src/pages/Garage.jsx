// =======================================================
// src/pages/Garage.jsx
// ✅ Garage 3D Premium – Gomme Anteriore/Posteriore
// ✅ Alert documenti + alert manutenzione reali
// ✅ Moto premium effetto 3D con bollini dinamici
// ✅ Gomme separate: anteriore + posteriore
// ✅ FIX: puoi salvare documenti anche SENZA file
// ✅ Storico Tagliandi / Interventi offline per ogni moto
// ✅ MOBILE: layout mobile-first, premium cards, bottoni full width
// ✅ FIX: logica km manutenzione corretta
// =======================================================

import { useEffect, useMemo, useState } from "react";
import { loadBikes, saveBikes, fileToDataUrl } from "../utils/storage";
import garageBike3d from "../assets/garage-bike-3d.png";
const uid = () => `bike-${Math.random().toString(16).slice(2)}-${Date.now()}`;

const DEFAULTS = {
  oilEveryKm: 6000,
  chainEveryKm: 800,
  frontTireEveryKm: 9000,
  rearTireEveryKm: 9000,
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

  if (t.includes("olio") || t.includes("tagliando") || t.includes("service")) {
    return "oil";
  }

  if (t.includes("catena") || t.includes("chain")) {
    return "chain";
  }

  if (
    t.includes("gomma") ||
    t.includes("gomme") ||
    t.includes("pneumatic") ||
    t.includes("tire") ||
    t.includes("tyre")
  ) {
    if (
      t.includes("anteriore") ||
      t.includes("front") ||
      t.includes("davanti")
    ) {
      return "frontTire";
    }

    if (
      t.includes("posteriore") ||
      t.includes("rear") ||
      t.includes("dietro")
    ) {
      return "rearTire";
    }

    return "tires";
  }

  return "other";
}

function getLastServiceKm(serviceLog = [], category) {
  const arr = Array.isArray(serviceLog) ? serviceLog : [];

  const matches = arr
    .filter((x) => {
      const inferred = inferServiceCategory(x?.type);

      if (category === "frontTire") {
        return inferred === "frontTire" || inferred === "tires";
      }

      if (category === "rearTire") {
        return inferred === "rearTire" || inferred === "tires";
      }

      return inferred === category;
    })
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

function levelRank(level) {
  if (level === "bad") return 4;
  if (level === "warn") return 3;
  if (level === "soon") return 2;
  return 1;
}

function worstLevel(items = []) {
  const sorted = [...items].sort(
    (a, b) => levelRank(b?.level) - levelRank(a?.level)
  );
  return sorted[0]?.level || "ok";
}

export default function Garage() {
  const [bikes, setBikes] = useState(() => loadBikes());
  const [activeId, setActiveId] = useState(() => {
    const initial = loadBikes();
    return initial?.[0]?.id || null;
  });

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [km, setKm] = useState("");

  const [kmUpdate, setKmUpdate] = useState("");

  const [docType, setDocType] = useState("insurance");
  const [docExpiry, setDocExpiry] = useState("");
  const [docNote, setDocNote] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [docBusy, setDocBusy] = useState(false);

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
    const maintenance = activeBike.maintenance || {};

    const oilInterval = parseKm(
      maintenance.oilEveryKm ?? DEFAULTS.oilEveryKm,
      DEFAULTS.oilEveryKm
    );

    const chainInterval = parseKm(
      maintenance.chainEveryKm ?? DEFAULTS.chainEveryKm,
      DEFAULTS.chainEveryKm
    );

    const legacyTires =
      maintenance.tiresEveryKm ??
      maintenance.frontTireEveryKm ??
      DEFAULTS.frontTireEveryKm;

    const frontTireInterval = parseKm(
      maintenance.frontTireEveryKm ?? legacyTires,
      DEFAULTS.frontTireEveryKm
    );

    const rearTireInterval = parseKm(
      maintenance.rearTireEveryKm ??
        maintenance.tiresEveryKm ??
        DEFAULTS.rearTireEveryKm,
      DEFAULTS.rearTireEveryKm
    );

    const log = Array.isArray(activeBike.serviceLog) ? activeBike.serviceLog : [];

    return {
      currentKm,
      oil: buildMaintenanceItem({
        currentKm,
        interval: oilInterval,
        lastEntry: getLastServiceKm(log, "oil"),
        categoryLabel: "Olio",
      }),
      chain: buildMaintenanceItem({
        currentKm,
        interval: chainInterval,
        lastEntry: getLastServiceKm(log, "chain"),
        categoryLabel: "Catena",
      }),
      frontTire: buildMaintenanceItem({
        currentKm,
        interval: frontTireInterval,
        lastEntry: getLastServiceKm(log, "frontTire"),
        categoryLabel: "Gomma anteriore",
      }),
      rearTire: buildMaintenanceItem({
        currentKm,
        interval: rearTireInterval,
        lastEntry: getLastServiceKm(log, "rearTire"),
        categoryLabel: "Gomma posteriore",
      }),
    };
  }, [activeBike]);

  const maintenanceAlerts = useMemo(() => {
    if (!computed) return [];

    return [
      { key: "oil", label: "Olio", icon: "🛢️", item: computed.oil },
      { key: "chain", label: "Catena", icon: "⛓️", item: computed.chain },
      {
        key: "frontTire",
        label: "Gomma anteriore",
        icon: "🛞",
        item: computed.frontTire,
      },
      {
        key: "rearTire",
        label: "Gomma posteriore",
        icon: "🛞",
        item: computed.rearTire,
      },
    ].filter((x) => ["bad", "warn", "soon"].includes(x.item.level));
  }, [computed]);

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
              documents: [doc, ...(Array.isArray(b.documents) ? b.documents : [])],
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
            serviceLog: [entry, ...(Array.isArray(b.serviceLog) ? b.serviceLog : [])],
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

  const garageStats = useMemo(() => {
    const docsCount = activeBike?.documents?.length || 0;
    const svcCount = activeBike?.serviceLog?.length || 0;
    const expired = expiryLists.expired.length;
    const due = expiryLists.dueSoon.length;
    const maintenance = maintenanceAlerts.length;

    return { docsCount, svcCount, expired, due, maintenance };
  }, [activeBike, expiryLists, maintenanceAlerts]);

  const totalAlerts =
    garageStats.expired + garageStats.due + garageStats.maintenance;

  return (
    <div className="garage-page">
      <style>{`
        .garage-page {
          min-height: 100vh;
          padding: 14px;
          padding-bottom: 96px;
          max-width: 1180px;
          margin: 0 auto;
          color: #111827;
          background:
            radial-gradient(circle at top left, rgba(245, 158, 11, 0.16), transparent 28%),
            radial-gradient(circle at top right, rgba(30, 64, 175, 0.12), transparent 30%);
        }

        .garage-hero {
          border-radius: 28px;
          padding: 18px;
          background: linear-gradient(135deg, #111827, #1f2937 55%, #92400e);
          color: white;
          box-shadow: 0 18px 40px rgba(17, 24, 39, 0.20);
          overflow: hidden;
          position: relative;
        }

        .garage-hero::after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          border-radius: 999px;
          right: -80px;
          top: -80px;
          background: rgba(245, 158, 11, 0.20);
        }

        .garage-head {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .garage-title {
          margin: 0;
          font-weight: 950;
          letter-spacing: -0.04em;
          font-size: clamp(32px, 8vw, 54px);
          line-height: 0.95;
        }

        .garage-sub {
          margin: 8px 0 0;
          opacity: 0.82;
          font-size: 14px;
          max-width: 680px;
        }

        .premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.13);
          border: 1px solid rgba(255, 255, 255, 0.20);
          font-size: 12px;
          font-weight: 900;
          backdrop-filter: blur(8px);
        }

        .garage-stats {
          position: relative;
          z-index: 1;
          margin-top: 16px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        @media (min-width: 720px) {
          .garage-stats {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        .stat-card {
          padding: 12px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.11);
          border: 1px solid rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(8px);
        }

        .stat-num {
          font-size: 22px;
          font-weight: 950;
          line-height: 1;
        }

        .stat-label {
          margin-top: 4px;
          font-size: 12px;
          opacity: 0.78;
        }

        .card {
          margin-top: 14px;
          border: 1px solid rgba(17, 24, 39, 0.10);
          border-radius: 24px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 12px 32px rgba(17, 24, 39, 0.08);
          backdrop-filter: blur(10px);
        }

        .section-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .section-title strong {
          font-size: 16px;
        }

        .mutedBox {
          padding: 12px;
          border-radius: 16px;
          background: rgba(17, 24, 39, 0.05);
          font-size: 13px;
          color: rgba(17, 24, 39, 0.78);
        }

        .bike-form {
          margin-top: 10px;
          display: grid;
          gap: 10px;
          grid-template-columns: 1fr;
        }

        @media (min-width: 560px) {
          .bike-form {
            grid-template-columns: 1fr 1fr;
          }
        }

        .bike-form .full {
          grid-column: 1 / -1;
        }

        .in {
          width: 100%;
          padding: 12px 13px;
          border-radius: 15px;
          border: 1px solid rgba(17, 24, 39, 0.14);
          box-sizing: border-box;
          outline: none;
          background: #fff;
          font-size: 14px;
        }

        .in:focus {
          border-color: rgba(245, 158, 11, 0.75);
          box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.13);
        }

        .btn {
          width: 100%;
          padding: 12px 14px;
          border-radius: 15px;
          border: 1px solid rgba(17, 24, 39, 0.12);
          background: linear-gradient(135deg, #111827, #374151);
          color: white;
          cursor: pointer;
          font-weight: 900;
          box-shadow: 0 10px 22px rgba(17, 24, 39, 0.12);
        }

        .btnWhite {
          background: white;
          color: #111827;
          box-shadow: none;
        }

        .btnGold {
          background: linear-gradient(135deg, #f59e0b, #b45309);
          color: white;
        }

        .btnDanger {
          background: white;
          color: #991b1b;
          border-color: rgba(153, 27, 27, 0.22);
          box-shadow: none;
        }

        .btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .garage-grid {
          margin-top: 14px;
          display: grid;
          gap: 14px;
          grid-template-columns: 1fr;
        }

        @media (min-width: 940px) {
          .garage-grid {
            grid-template-columns: 330px 1fr;
          }
        }

        .listItem {
          padding: 12px;
          border-radius: 18px;
          border: 1px solid rgba(17, 24, 39, 0.10);
          cursor: pointer;
          background: #fff;
          transition: transform .15s ease, border-color .15s ease, background .15s ease;
        }

        .listItem:hover {
          transform: translateY(-1px);
          border-color: rgba(245, 158, 11, 0.35);
        }

        .listItemActive {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(255,255,255,1));
          border-color: rgba(245, 158, 11, 0.46);
        }

        .row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .row > input {
          flex: 1;
          min-width: 180px;
        }

        @media (max-width: 560px) {
          .row .btn,
          .section-action,
          .inline-btn {
            width: 100% !important;
          }
        }

        .active-bike-hero {
          margin-top: 14px;
          padding: 16px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(17,24,39,0.97), rgba(55,65,81,0.96));
          color: white;
          box-shadow: 0 14px 34px rgba(17,24,39,0.16);
        }

        .mini-grid {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        @media (min-width: 700px) {
          .mini-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        .mini-card {
          padding: 10px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.14);
        }

        .premium-panel {
          margin-top: 14px;
          padding: 14px;
          border-radius: 20px;
          border: 1px solid rgba(17,24,39,0.10);
          background: rgba(17, 24, 39, 0.025);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }

        .soft-card {
          border: 1px solid rgba(17,24,39,0.10);
          border-radius: 18px;
          padding: 12px;
          background: white;
        }

        .small-muted {
          font-size: 12px;
          opacity: 0.72;
        }

        .moto-health-box {
          margin-top: 14px;
          border-radius: 22px;
          padding: 14px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.14);
        }

        .moto-health-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .legend-grid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        @media (min-width: 760px) {
          .legend-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .legend-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="garage-hero">
        <div className="garage-head">
          <div>
            <div className="premium-badge">🏍️ MotoPortEU Premium Garage</div>
            <h1 className="garage-title">Garage</h1>
            <p className="garage-sub">
              Libretto digitale offline, manutenzione, scadenze e storico
              interventi. Tutto salvato sul dispositivo.
            </p>
          </div>
        </div>

        <div className="garage-stats">
          <HeroStat value={bikes.length} label="Moto salvate" />
          <HeroStat value={garageStats.docsCount} label="Documenti moto" />
          <HeroStat value={garageStats.svcCount} label="Interventi" />
          <HeroStat value={totalAlerts} label="Alert totali" />
        </div>
      </div>

      <div className="card">
        <div className="section-title">
          <strong>➕ Aggiungi moto</strong>
          <span className="small-muted">Marca e modello sono obbligatori</span>
        </div>

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
            <button type="button" onClick={addBike} className="btn btnGold">
              Aggiungi al Garage
            </button>
          </div>
        </div>
      </div>

      <div className="garage-grid">
        <div className="card" style={{ height: "fit-content" }}>
          <div className="section-title">
            <strong>🏍️ Le tue moto</strong>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {bikes.length === 0 && (
              <div className="mutedBox">Nessuna moto. Aggiungine una sopra.</div>
            )}

            {bikes.map((b) => (
              <div
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className={`listItem ${b.id === activeId ? "listItemActive" : ""}`}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 950 }}>
                      {b.brand} {b.model}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 3 }}>
                      {b.year ? `${b.year} · ` : ""}
                      {parseKm(b.km, 0).toLocaleString()} km
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBike(b.id);
                    }}
                    className="btn btnDanger"
                    style={{
                      width: "auto",
                      padding: "7px 10px",
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

        <div className="card">
          {!activeBike ? (
            <div className="mutedBox">
              Seleziona una moto per vedere manutenzione e libretto.
            </div>
          ) : (
            <>
              <div className="active-bike-hero">
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div className="small-muted">Moto selezionata</div>
                    <h2 style={{ margin: "4px 0 0", fontSize: 28 }}>
                      {activeBike.brand} {activeBike.model}
                    </h2>
                  </div>

                  <span style={heroPillStyle()}>
                    {activeBike.year ? `${activeBike.year} · ` : ""}
                    {parseKm(activeBike.km, 0).toLocaleString()} km
                  </span>
                </div>

                <div className="mini-grid">
                  <MiniStat label="Documenti" value={garageStats.docsCount} />
                  <MiniStat label="Interventi" value={garageStats.svcCount} />
                  <MiniStat label="Doc. scaduti" value={garageStats.expired} />
                  <MiniStat label="Alert manut." value={garageStats.maintenance} />
                </div>

                {computed && <MotoHealthSilhouette computed={computed} />}
              </div>

              <div className="premium-panel">
                <div className="section-title">
                  <strong>🚨 Alert Garage</strong>
                  <span className="small-muted">
                    Documenti + manutenzione automatica
                  </span>
                </div>

                {expiryLists.expired.length === 0 &&
                expiryLists.dueSoon.length === 0 &&
                maintenanceAlerts.length === 0 ? (
                  <div className="mutedBox">Nessun alert attivo. 🔥</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {maintenanceAlerts.map((a) => (
                      <MaintenanceAlertRow key={a.key} alert={a} />
                    ))}

                    {expiryLists.expired.map((d) => (
                      <ExpiryRow key={d.id} doc={d} />
                    ))}

                    {expiryLists.dueSoon.map((d) => (
                      <ExpiryRow key={d.id} doc={d} />
                    ))}
                  </div>
                )}
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                <input
                  value={kmUpdate}
                  onChange={(e) => setKmUpdate(e.target.value)}
                  placeholder="Aggiorna km (es. 12500)"
                  inputMode="numeric"
                  className="in"
                />
                <button
                  type="button"
                  onClick={updateBikeKm}
                  className="btn btnWhite inline-btn"
                  style={{ width: "auto" }}
                >
                  Salva km
                </button>
              </div>

              {computed && (
                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                  <HealthRow title="🛢️ Olio" item={computed.oil} />
                  <HealthRow title="⛓️ Catena" item={computed.chain} />
                  <HealthRow title="🛞 Gomma anteriore" item={computed.frontTire} />
                  <HealthRow title="🛞 Gomma posteriore" item={computed.rearTire} />
                </div>
              )}

              <div className="premium-panel">
                <div className="section-title">
                  <strong>⚙️ Intervalli manutenzione</strong>
                  <span className="small-muted">
                    Personalizzabili per ogni moto
                  </span>
                </div>

                <div className="form-grid">
                  <IntervalInput
                    label="Olio ogni"
                    value={String(
                      activeBike.maintenance?.oilEveryKm ?? DEFAULTS.oilEveryKm
                    )}
                    min={500}
                    max={50000}
                    onCommit={(v) => updateIntervals({ oilEveryKm: v })}
                  />

                  <IntervalInput
                    label="Catena ogni"
                    value={String(
                      activeBike.maintenance?.chainEveryKm ??
                        DEFAULTS.chainEveryKm
                    )}
                    min={100}
                    max={10000}
                    onCommit={(v) => updateIntervals({ chainEveryKm: v })}
                  />

                  <IntervalInput
                    label="Gomma anteriore ogni"
                    value={String(
                      activeBike.maintenance?.frontTireEveryKm ??
                        activeBike.maintenance?.tiresEveryKm ??
                        DEFAULTS.frontTireEveryKm
                    )}
                    min={1000}
                    max={50000}
                    onCommit={(v) => updateIntervals({ frontTireEveryKm: v })}
                  />

                  <IntervalInput
                    label="Gomma posteriore ogni"
                    value={String(
                      activeBike.maintenance?.rearTireEveryKm ??
                        activeBike.maintenance?.tiresEveryKm ??
                        DEFAULTS.rearTireEveryKm
                    )}
                    min={1000}
                    max={50000}
                    onCommit={(v) => updateIntervals({ rearTireEveryKm: v })}
                  />
                </div>

                <div style={{ marginTop: 10 }} className="small-muted">
                  Per distinguere le gomme nello storico usa testi tipo:
                  “Gomma anteriore”, “Gomma posteriore” oppure “Cambio gomme”.
                </div>
              </div>

              <div className="premium-panel">
                <div className="section-title">
                  <strong>📒 Storico Tagliandi / Interventi</strong>
                  <span className="small-muted">
                    Base reale per le prossime scadenze
                  </span>
                </div>

                <div className="soft-card">
                  <div className="form-grid">
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Data</span>
                      <input
                        type="date"
                        value={svcDate}
                        onChange={(e) => setSvcDate(e.target.value)}
                        className="in"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Km</span>
                      <input
                        value={svcKm}
                        onChange={(e) => setSvcKm(e.target.value)}
                        inputMode="numeric"
                        placeholder="es. 12500"
                        className="in"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Tipo</span>
                      <input
                        value={svcType}
                        onChange={(e) => setSvcType(e.target.value)}
                        placeholder="Tagliando / Olio / Gomma anteriore..."
                        className="in"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Costo € (opz.)</span>
                      <input
                        value={svcCost}
                        onChange={(e) => setSvcCost(e.target.value)}
                        inputMode="decimal"
                        placeholder="es. 180"
                        className="in"
                      />
                    </label>

                    <label
                      style={{
                        display: "grid",
                        gap: 6,
                        gridColumn: "1 / -1",
                      }}
                    >
                      <span className="small-muted">Note (opz.)</span>
                      <input
                        value={svcNote}
                        onChange={(e) => setSvcNote(e.target.value)}
                        placeholder="es. Olio Motul 7100, gomma posteriore..."
                        className="in"
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={addServiceEntry}
                      className="btn btnGold section-action"
                      style={{ width: "auto" }}
                    >
                      Aggiungi intervento
                    </button>
                    <span className="small-muted">
                      Data + km obbligatori. Il resto è opzionale.
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {serviceSorted.length === 0 ? (
                    <div className="mutedBox">Nessun intervento registrato.</div>
                  ) : (
                    serviceSorted.map((s) => (
                      <div key={s.id} className="soft-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900 }}>
                              {s.type} · {s.date} ·{" "}
                              {parseKm(s.km, 0).toLocaleString()} km
                            </div>
                            <div className="small-muted" style={{ marginTop: 4 }}>
                              {s.cost !== ""
                                ? `Costo: €${Number(s.cost).toLocaleString()} · `
                                : ""}
                              {s.note ? s.note : "—"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => deleteServiceEntry(s.id)}
                            className="btn btnDanger inline-btn"
                            style={{
                              width: "auto",
                              padding: "7px 10px",
                              height: "fit-content",
                            }}
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="premium-panel">
                <div className="section-title">
                  <strong>📂 Libretto & Documenti offline</strong>
                  <span className="small-muted">
                    Foto, PDF, scadenze o solo note
                  </span>
                </div>

                <div className="soft-card">
                  <div className="form-grid">
                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Tipo</span>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="in"
                      >
                        {DOC_TYPES.map((d) => (
                          <option key={d.key} value={d.key}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Scadenza (opz.)</span>
                      <input
                        type="date"
                        value={docExpiry}
                        onChange={(e) => setDocExpiry(e.target.value)}
                        className="in"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Note (opz.)</span>
                      <input
                        value={docNote}
                        onChange={(e) => setDocNote(e.target.value)}
                        placeholder="Es. polizza, compagnia, ecc."
                        className="in"
                      />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                      <span className="small-muted">Foto/PDF (opz.)</span>
                      <input
                        id="docFileInput"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                        style={{ padding: "10px 0" }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <button
                      type="button"
                      onClick={addDocument}
                      disabled={docBusy}
                      className="btn btnGold section-action"
                      style={{ width: "auto" }}
                    >
                      {docBusy ? "Salvataggio..." : "Aggiungi documento"}
                    </button>
                    <span className="small-muted">
                      Puoi salvare anche senza allegato.
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  {docsSorted.length === 0 ? (
                    <div className="mutedBox">
                      Nessun documento salvato per questa moto.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {docsSorted.map((d) => (
                        <DocCard
                          key={d.id}
                          doc={d}
                          onDelete={() => deleteDocument(d.id)}
                        />
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

function HeroStat({ value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="mini-card">
      <div style={{ fontWeight: 950, fontSize: 20 }}>{value}</div>
      <div className="small-muted">{label}</div>
    </div>
  );
}

function MotoHealthSilhouette({ computed }) {
  const items = [
    { key: "oil", label: "Olio", icon: "🛢️", item: computed.oil },
    { key: "chain", label: "Catena", icon: "⛓️", item: computed.chain },
    {
      key: "frontTire",
      label: "Gomma anteriore",
      icon: "🛞",
      item: computed.frontTire,
    },
    {
      key: "rearTire",
      label: "Gomma posteriore",
      icon: "🛞",
      item: computed.rearTire,
    },
  ];

  const overall = worstLevel(items.map((x) => x.item));

  return (
    <div className="moto-health-box">
      <div className="moto-health-top">
        <div>
          <strong>Stato moto 3D</strong>
          <div className="small-muted">
            Olio, catena, gomma anteriore e gomma posteriore
          </div>
        </div>

        <span style={pillStyle(overall)}>
          {overall === "bad"
            ? "ATTENZIONE"
            : overall === "warn"
            ? "URGENTE"
            : overall === "soon"
            ? "DA CONTROLLARE"
            : "TUTTO OK"}
        </span>
      </div>

      <div
        style={{
          marginTop: 12,
          borderRadius: 26,
          padding: 16,
          background:
            "radial-gradient(circle at 50% 12%, rgba(245,158,11,0.22), transparent 32%), linear-gradient(145deg, rgba(2,6,23,0.98), rgba(30,41,59,0.92) 62%, rgba(120,53,15,0.72))",
          border: "1px solid rgba(255,255,255,0.16)",
          overflow: "hidden",
          position: "relative",
        }}
      >
<img
  src={garageBike3d}
  alt="Moto 3D Garage"
  style={{
    width: "100%",
    maxHeight: 360,
    objectFit: "contain",
    display: "block",
    filter: "drop-shadow(0 28px 35px rgba(0,0,0,0.45))",
  }}
/>
        <StatusDot
          label="Olio"
          icon="🛢️"
          level={computed.oil.level}
          style={{ left: "51%", top: "62%" }}
        />

        <StatusDot
          label="Catena"
          icon="⛓️"
          level={computed.chain.level}
          style={{ left: "31%", top: "72%" }}
        />

        <StatusDot
          label="Gomma posteriore"
          icon="🛞"
          level={computed.rearTire.level}
          style={{ left: "24%", top: "69%" }}
        />

        <StatusDot
          label="Gomma anteriore"
          icon="🛞"
          level={computed.frontTire.level}
          style={{ left: "76%", top: "69%" }}
        />
      </div>

      <div className="legend-grid">
        {items.map((x) => (
          <div key={x.key} className="soft-card" style={{ color: "#111827" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
              }}
            >
              <strong>
                {x.icon} {x.label}
              </strong>
              <span style={pillStyle(x.item.level)}>{x.item.label}</span>
            </div>

            <div className="small-muted" style={{ marginTop: 6 }}>
              Mancano: <strong>{x.item.left.toLocaleString()} km</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ icon, label, level, style }) {
  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 640;

  const size = isMobile ? 34 : 46;
  const fontSize = isMobile ? 15 : 19;
  const border = isMobile ? 3 : 4;

  const mobileAdjustments = {
    ...(label === "Catena" && isMobile
      ? { left: "27%", top: "72%" }
      : {}),
    ...(label === "Gomma posteriore" && isMobile
      ? { left: "20%", top: "67%" }
      : {}),
    ...(label === "Olio" && isMobile
      ? { left: "50%", top: "58%" }
      : {}),
    ...(label === "Gomma anteriore" && isMobile
      ? { left: "74%", top: "66%" }
      : {}),
  };

  return (
    <div
      title={label}
      style={{
        position: "absolute",
        transform: "translate(-50%, -50%)",
        width: size,
        height: size,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `${border}px solid rgba(255,255,255,0.92)`,
        boxShadow: "0 14px 26px rgba(0,0,0,0.30)",
        fontSize,
        fontWeight: 950,
        ...dotStyle(level),
        ...style,
        ...mobileAdjustments,
      }}
    >
      {icon}
    </div>
  );
}
function MaintenanceAlertRow({ alert }) {
  const item = alert.item;

  return (
    <div className="soft-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 13 }}>
          <strong>
            {alert.icon} {alert.label}
          </strong>{" "}
          <span style={{ opacity: 0.75 }}>
            · prossima a {item.next.toLocaleString()} km · mancano{" "}
            {item.left.toLocaleString()} km
          </span>
        </div>
        <span style={pillStyle(item.level)}>{item.label}</span>
      </div>
    </div>
  );
}

function ExpiryRow({ doc }) {
  const days = doc.days;
  const st = doc.st || { label: "OK", level: "ok" };

  return (
    <div className="soft-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 13 }}>
          <strong>📄 {doc.label}</strong>{" "}
          <span style={{ opacity: 0.75 }}>
            · {doc.expiry} · {days < 0 ? "scaduto" : `${days} giorni`}
          </span>
          {doc.note ? <span style={{ opacity: 0.7 }}> · {doc.note}</span> : null}
        </div>
        <span style={pillStyle(st.level)}>{st.label}</span>
      </div>
    </div>
  );
}

function HealthRow({ title, item }) {
  const lastText =
    item.lastKm !== null
      ? `${item.lastKm.toLocaleString()} km${
          item.lastType ? ` · ${item.lastType}` : ""
        }`
      : "non registrato";

  const modeText =
    item.calcMode === "from-service-log"
      ? "Calcolo da ultimo intervento"
      : "Calcolo da km attuali";

  return (
    <div className="soft-card">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <strong>{title}</strong>
        <span style={pillStyle(item.level)}>{item.label}</span>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 13 }}>
          Prossima: <strong>{item.next.toLocaleString()} km</strong>
        </div>
        <div style={{ fontSize: 13 }}>
          Mancano: <strong>{item.left.toLocaleString()} km</strong>
        </div>
        <div className="small-muted">
          Intervallo: {item.interval.toLocaleString()} km
        </div>
        <div className="small-muted">Ultimo intervento: {lastText}</div>
        <div className="small-muted">{modeText}</div>
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
      <span className="small-muted">{label}</span>
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
        className="in"
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
    <div className="soft-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 900 }}>
            {doc.label}
            {expiryBadge}
          </div>

          <div className="small-muted" style={{ marginTop: 4 }}>
            {doc.fileName ? `${doc.fileName} · ` : ""}
            {hasAttachment ? "" : "Solo dati · "}
            Salvato: {String(doc.createdAt || "").slice(0, 10)}
            {doc.note ? ` · ${doc.note}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="btn btnDanger inline-btn"
          style={{
            width: "auto",
            padding: "7px 10px",
            height: "fit-content",
          }}
        >
          Elimina
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        {!hasAttachment ? (
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px dashed rgba(17,24,39,0.18)",
              background: "rgba(17,24,39,0.03)",
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            Nessun file allegato. Documento salvato solo con dati.
          </div>
        ) : isPdf ? (
          <a href={dataUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
            Apri PDF
          </a>
        ) : (
          <img
            src={dataUrl}
            alt={doc.label}
            style={{
              width: "100%",
              maxHeight: 380,
              objectFit: "contain",
              borderRadius: 16,
              border: "1px solid rgba(17,24,39,0.10)",
              background: "rgba(17,24,39,0.03)",
            }}
          />
        )}
      </div>
    </div>
  );
}

function heroPillStyle() {
  return {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.12)",
  };
}

function dotStyle(level) {
  if (level === "bad") {
    return {
      background: "#ef4444",
      color: "white",
    };
  }

  if (level === "warn") {
    return {
      background: "#f97316",
      color: "white",
    };
  }

  if (level === "soon") {
    return {
      background: "#facc15",
      color: "#422006",
    };
  }

  return {
    background: "#22c55e",
    color: "white",
  };
}

function pillStyle(level) {
  const base = {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(17,24,39,0.12)",
    background: "rgba(17,24,39,0.05)",
  };

  if (level === "bad") {
    return {
      ...base,
      color: "#991b1b",
      background: "rgba(239,68,68,0.12)",
      borderColor: "rgba(239,68,68,0.22)",
    };
  }

  if (level === "warn") {
    return {
      ...base,
      color: "#92400e",
      background: "rgba(245,158,11,0.15)",
      borderColor: "rgba(245,158,11,0.28)",
    };
  }

  if (level === "soon") {
    return {
      ...base,
      color: "#854d0e",
      background: "rgba(250,204,21,0.18)",
      borderColor: "rgba(250,204,21,0.30)",
    };
  }

  return {
    ...base,
    color: "#166534",
    background: "rgba(34,197,94,0.11)",
    borderColor: "rgba(34,197,94,0.22)",
  };
}