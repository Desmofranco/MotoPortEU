import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getTrack } from "../utils/gpsTrackStore";

export default function MyTrackDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const track = useMemo(() => getTrack(id), [id]);

  if (!track) {
    return (
      <div className="min-h-screen bg-[#061417] text-white flex items-center justify-center p-6">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
          <div className="font-semibold mb-3">Giro non trovato.</div>
          <button
            onClick={() => navigate("/my-tracks")}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15"
          >
            Torna allo storico
          </button>
        </div>
      </div>
    );
  }

  const km = (track.distanceMeters / 1000).toFixed(2);
  const durationSec = Math.max(
    0,
    Math.floor(((track.endedAt || track.createdAt) - track.createdAt) / 1000)
  );

  return (
    <div className="min-h-screen bg-[#061417] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold">🏍️ {track.title}</h1>
          <button
            onClick={() => navigate("/my-tracks")}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15"
          >
            Indietro
          </button>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="text-white/80">
            <div>📅 Inizio: {new Date(track.createdAt).toLocaleString()}</div>
            <div>
              ✅ Fine:{" "}
              {track.endedAt ? new Date(track.endedAt).toLocaleString() : "—"}
            </div>
            <div>📍 Punti: {track.points?.length || 0}</div>
            <div>📏 Distanza: {km} km</div>
            <div>⏱️ Durata: {durationSec}s</div>
          </div>

          <button
            onClick={() => {
              // Per step successivo: apriamo /map con trackId
              navigate(`/map?trackId=${track.id}`);
            }}
            className="mt-4 w-full px-4 py-2 rounded-xl bg-white/10 border border-white/15"
          >
            Apri su Mappa
          </button>
        </div>
      </div>
    </div>
  );
}