// src/pages/MyTracks.jsx
import React, { useMemo, useState } from "react";
import { deleteTrack, getTracks } from "../utils/gpsTrackStore";
import { useNavigate } from "react-router-dom";

const PLANNER_STORAGE_KEY = "mpeu_planner_saved_routes_v1";

function readPlannerRoutes() {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const saved = Array.isArray(parsed?.saved) ? parsed.saved : [];
    // normalizza un minimo
    return saved
      .filter((r) => r && r.id && Array.isArray(r.points) && r.points.length >= 2)
      .map((r) => ({
        id: String(r.id),
        name: String(r.name || "Percorso salvato"),
        createdAt: Number(r.createdAt || Date.now()),
        distanceKm: Number(r.distanceKm || 0),
        estTime: r.estTime ? String(r.estTime) : "",
        pointsCount: r.points?.length || 0,
      }));
  } catch {
    return [];
  }
}

function deletePlannerRoute(routeId) {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : { saved: [] };
    const saved = Array.isArray(parsed?.saved) ? parsed.saved : [];
    const nextSaved = saved.filter((r) => String(r?.id) !== String(routeId));
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify({ ...parsed, saved: nextSaved }));
    return true;
  } catch {
    return false;
  }
}

export default function MyTracks() {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState("all"); // all | gps | routes

  const gpsTracks = useMemo(() => getTracks(), [refresh]);
  const plannerRoutes = useMemo(() => readPlannerRoutes(), [refresh]);

  const mergedList = useMemo(() => {
    const gps = (gpsTracks || []).map((t) => ({
      type: "gps",
      id: t.id,
      title: t.title,
      createdAt: t.createdAt,
      distanceKm: Number(t.distanceMeters || 0) / 1000,
      pointsCount: t.points?.length || 0,
    }));

    const routes = (plannerRoutes || []).map((r) => ({
      type: "route",
      id: r.id,
      title: r.name,
      createdAt: r.createdAt,
      distanceKm: Number(r.distanceKm || 0),
      pointsCount: r.pointsCount || 0,
      estTime: r.estTime || "",
    }));

    let all = [...gps, ...routes];

    // filtro tab
    if (tab === "gps") all = all.filter((x) => x.type === "gps");
    if (tab === "routes") all = all.filter((x) => x.type === "route");

    // sort: più recenti prima
    all.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    return all;
  }, [gpsTracks, plannerRoutes, tab]);

  return (
    <div className="min-h-screen bg-[#061417] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">📚 Storico</h1>
            <div className="text-sm text-white/70">
              GPS: {gpsTracks.length} • Percorsi: {plannerRoutes.length}
            </div>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15"
          >
            Dashboard
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-2 rounded-xl border ${
              tab === "all" ? "bg-white/15 border-white/25" : "bg-white/5 border-white/10"
            }`}
          >
            Tutto
          </button>
          <button
            onClick={() => setTab("gps")}
            className={`px-3 py-2 rounded-xl border ${
              tab === "gps" ? "bg-white/15 border-white/25" : "bg-white/5 border-white/10"
            }`}
          >
            📡 GPS
          </button>
          <button
            onClick={() => setTab("routes")}
            className={`px-3 py-2 rounded-xl border ${
              tab === "routes" ? "bg-white/15 border-white/25" : "bg-white/5 border-white/10"
            }`}
          >
            🧭 Percorsi
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {mergedList.length === 0 ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-white/80">
              Nessun elemento salvato.
              <div className="mt-2">
                • GPS: premi <b>Avvia</b> e poi <b>Stop & Salva</b>.<br />
                • Percorsi: crea su <b>Mappa</b> e premi <b>Salva</b>.
              </div>
            </div>
          ) : (
            mergedList.map((x) => (
              <div
                key={`${x.type}-${x.id}`}
                className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <span className="opacity-90">
                      {x.type === "gps" ? "📡" : "🧭"}
                    </span>
                    <span>{x.title}</span>
                  </div>

                  <div className="text-sm text-white/70">
                    {new Date(x.createdAt).toLocaleString()} •{" "}
                    {Number(x.distanceKm || 0).toFixed(2)} km • punti: {x.pointsCount || 0}
                    {x.type === "route" && x.estTime ? ` • ⏱ ${x.estTime}` : ""}
                  </div>
                </div>

                <div className="flex gap-2">
                  {x.type === "gps" ? (
                    <button
                      onClick={() => navigate(`/my-tracks/${x.id}`)}
                      className="px-3 py-2 rounded-xl bg-white/10 border border-white/15"
                    >
                      Apri
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/map?routeId=${encodeURIComponent(x.id)}`)}
                      className="px-3 py-2 rounded-xl bg-white/10 border border-white/15"
                    >
                      Apri
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (x.type === "gps") {
                        deleteTrack(x.id);
                        setRefresh((v) => v + 1);
                        return;
                      }
                      const ok = deletePlannerRoute(x.id);
                      if (!ok) alert("⚠️ Non riesco a eliminare il percorso (localStorage).");
                      setRefresh((v) => v + 1);
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/15"
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA veloce */}
        <div className="mt-6 grid gap-2">
          <button
            onClick={() => navigate("/map")}
            className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15"
          >
            🗺 Crea un nuovo percorso
          </button>
        </div>
      </div>
    </div>
  );
}