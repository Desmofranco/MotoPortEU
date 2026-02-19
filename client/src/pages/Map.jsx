// =======================================================
// src/pages/Map.jsx
// MotoPortEU — Rotta Libera 🏁
// Route Builder V1: crea e salva itinerari (localStorage)
// =======================================================

import React, { useEffect, useMemo, useState } from "react";
import RouteBuilderMap from "../components/RouteBuilderMap";

const STORAGE_KEY = "mp_routes_v1";

const uid = () => `rt-${Math.random().toString(16).slice(2)}-${Date.now()}`;

function loadRoutes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveRoutes(routes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes || []));
}

// distanza approssimata km (haversine)
function haversineKm(a, b) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

function computeDistanceKm(points) {
  if (!points || points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += haversineKm(points[i - 1], points[i]);
  return sum;
}

export default function Map() {
  const [routes, setRoutes] = useState(() => loadRoutes());
  const [activeId, setActiveId] = useState(() => routes?.[0]?.id || "");
  const [points, setPoints] = useState([]);
  const [name, setName] = useState("");
  const [addingEnabled, setAddingEnabled] = useState(true);
  const [note, setNote] = useState("");

  // Selezione route attiva
  const activeRoute = useMemo(() => routes.find((r) => r.id === activeId) || null, [routes, activeId]);

  const distanceKm = useMemo(() => computeDistanceKm(points), [points]);

  useEffect(() => {
    saveRoutes(routes);
  }, [routes]);

  // Quando seleziono una route salvata → carico punti e info
  useEffect(() => {
    if (!activeRoute) return;
    setPoints(activeRoute.points || []);
    setName(activeRoute.name || "");
    setNote(activeRoute.note || "");
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAddPoint = (p) => setPoints((prev) => [...prev, p]);

  const undo = () => setPoints((prev) => prev.slice(0, -1));
  const clear = () => setPoints([]);

  const newRoute = () => {
    setActiveId("");
    setName("");
    setNote("");
    setPoints([]);
  };

  const saveCurrent = () => {
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      alert("Dai un nome all’itinerario.");
      return;
    }
    if (!points || points.length < 2) {
      alert("Aggiungi almeno 2 punti sulla mappa.");
      return;
    }

    const payload = {
      id: activeId || uid(),
      name: cleanName,
      note: String(note || "").trim(),
      points,
      updatedAt: new Date().toISOString(),
      distanceKm: Math.round(computeDistanceKm(points) * 10) / 10,
    };

    setRoutes((prev) => {
      const exists = prev.some((r) => r.id === payload.id);
      const next = exists ? prev.map((r) => (r.id === payload.id ? payload : r)) : [payload, ...prev];
      return next;
    });

    setActiveId(payload.id);
  };

  const deleteRoute = () => {
    if (!activeRoute) return;
    const ok = confirm(`Eliminare "${activeRoute.name}"?`);
    if (!ok) return;

    setRoutes((prev) => prev.filter((r) => r.id !== activeRoute.id));
    newRoute();
  };

  const loadRoute = (id) => {
    setActiveId(id);
  };

  return (
    <div className="w-full px-3 sm:px-6 py-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Rotta Libera <span className="opacity-80">🏁</span>
            </h1>
            <p className="text-sm opacity-80 mt-1">
              Tocca/clicca sulla mappa per creare un itinerario. Salva e riapri quando vuoi.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="px-3 py-2 rounded-xl border shadow-sm hover:shadow"
              onClick={() => setAddingEnabled((v) => !v)}
              title="Abilita/Disabilita aggiunta punti"
            >
              {addingEnabled ? "✍️ Aggiunta ON" : "⛔ Aggiunta OFF"}
            </button>

            <button className="px-3 py-2 rounded-xl border shadow-sm hover:shadow" onClick={undo} disabled={!points.length}>
              ↩️ Undo
            </button>
            <button className="px-3 py-2 rounded-xl border shadow-sm hover:shadow" onClick={clear} disabled={!points.length}>
              🧹 Clear
            </button>
          </div>
        </div>

        {/* Layout */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left panel */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border p-4 shadow-sm bg-white/70">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold text-lg">Itinerario</h2>
                <button className="px-3 py-2 rounded-xl border shadow-sm hover:shadow" onClick={newRoute}>
                  ➕ Nuovo
                </button>
              </div>

              <div className="mt-3">
                <label className="text-sm font-semibold opacity-80">Nome</label>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-xl border"
                  placeholder="Es: Stelvio + Gavia"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="mt-3">
                <label className="text-sm font-semibold opacity-80">Note</label>
                <textarea
                  className="mt-1 w-full px-3 py-2 rounded-xl border min-h-[90px]"
                  placeholder="Info utili: soste, benzina, orari..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-sm opacity-80">
                <div>📍 Punti: <b>{points.length}</b></div>
                <div>📏 Km: <b>{distanceKm.toFixed(1)}</b></div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  className="flex-1 px-3 py-2 rounded-xl border shadow-sm hover:shadow font-semibold"
                  onClick={saveCurrent}
                >
                  💾 Salva
                </button>
                <button
                  className="px-3 py-2 rounded-xl border shadow-sm hover:shadow"
                  onClick={deleteRoute}
                  disabled={!activeRoute}
                  title={!activeRoute ? "Seleziona un itinerario salvato" : "Elimina itinerario"}
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Saved list */}
            <div className="rounded-2xl border p-4 shadow-sm bg-white/70 mt-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">Salvati</h2>
                <span className="text-sm opacity-70">{routes.length}</span>
              </div>

              {routes.length === 0 ? (
                <p className="text-sm opacity-80 mt-2">Nessun itinerario salvato. Creane uno sulla mappa 👇</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {routes.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => loadRoute(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl border hover:shadow-sm ${
                        r.id === activeId ? "bg-black/5" : "bg-white/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-xs opacity-70">{(r.distanceKm ?? 0).toFixed(1)} km</div>
                      </div>
                      <div className="text-xs opacity-70 mt-1">
                        {r.points?.length || 0} punti • aggiornato{" "}
                        {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "-"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <RouteBuilderMap
              points={points}
              onAddPoint={onAddPoint}
              isAddingEnabled={addingEnabled}
              center={points?.[0] || [45.4642, 9.19]}
              zoom={points?.length ? 9 : 6}
              height="70vh"
            />

            <div className="mt-3 text-sm opacity-80 rounded-2xl border p-3 bg-white/60">
              <b>Tip:</b> disattiva “Aggiunta ON” quando vuoi solo spostarti sulla mappa senza aggiungere punti.
              <span className="hidden sm:inline"> Su mobile: fai pinch zoom e trascina normalmente.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}