import React, { useMemo, useState } from "react";
import { deleteTrack, getTracks } from "../utils/gpsTrackStore";
import { useNavigate } from "react-router-dom";

export default function MyTracks() {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);

  const tracks = useMemo(() => getTracks(), [refresh]);

  return (
    <div className="min-h-screen bg-[#061417] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold">📡 Storico GPS</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15"
          >
            Dashboard
          </button>
        </div>


        <div className="mt-6 space-y-3">
          {tracks.length === 0 ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-white/80">
              Nessun giro salvato. Premi <b>Avvia</b> e poi <b>Stop & Salva</b>.
            </div>
          ) : (
            tracks.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-sm text-white/70">
                    {new Date(t.createdAt).toLocaleString()} •{" "}
                    {(t.distanceMeters / 1000).toFixed(2)} km • punti:{" "}
                    {t.points?.length || 0}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/my-tracks/${t.id}`)}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/15"
                  >
                    Apri
                  </button>
                  <button
                    onClick={() => {
                      deleteTrack(t.id);
                      setRefresh((x) => x + 1);
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
      </div>
    </div>
  );
}