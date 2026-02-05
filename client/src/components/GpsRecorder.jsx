import React, { useMemo, useRef, useState } from "react";
import { saveTrack } from "../utils/gpsTrackStore";

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export default function GpsRecorder({ onSaved }) {
  const [isRecording, setIsRecording] = useState(false);
  const [points, setPoints] = useState([]);
  const [error, setError] = useState("");
  const watchIdRef = useRef(null);
  const startedAtRef = useRef(null);

  const distanceMeters = useMemo(() => {
    if (points.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < points.length; i++) {
      d += haversineMeters(points[i - 1], points[i]);
    }
    return d;
  }, [points]);

  const start = async () => {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Geolocalizzazione non supportata su questo dispositivo.");
      return;
    }

    startedAtRef.current = Date.now();
    setPoints([]);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const p = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
          speed: pos.coords.speed ?? null,
          acc: pos.coords.accuracy ?? null,
        };
        setPoints((prev) => {
          // evita duplicati identici
          const last = prev[prev.length - 1];
          if (last && last.lat === p.lat && last.lng === p.lng) return prev;
          return [...prev, p];
        });
      },
      (e) => {
        setError(e.message || "Errore GPS");
        stop(false);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    watchIdRef.current = id;
    setIsRecording(true);
  };

  const stop = (shouldSave = true) => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsRecording(false);

    if (!shouldSave) return;

    const startedAt = startedAtRef.current || Date.now();
    const endedAt = Date.now();

    const track = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: `Giro ${new Date(startedAt).toLocaleString()}`,
      createdAt: startedAt,
      endedAt,
      distanceMeters: Math.round(distanceMeters),
      points,
    };

    saveTrack(track);
    onSaved?.(track);
  };

  const km = (distanceMeters / 1000).toFixed(2);
  const secs = startedAtRef.current
    ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
    : 0;

  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 text-white p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">📡 Registrazione GPS</div>
          <div className="text-sm text-white/80">
            Punti: {points.length} • Distanza: {km} km • Tempo: {secs}s
          </div>
        </div>

        {!isRecording ? (
          <button
            onClick={start}
            className="px-4 py-2 rounded-xl bg-white/15 border border-white/20"
          >
            Avvia
          </button>
        ) : (
          <button
            onClick={() => stop(true)}
            className="px-4 py-2 rounded-xl bg-white/15 border border-white/20"
          >
            Stop & Salva
          </button>
        )}
      </div>

      {isRecording && (
        <button
          onClick={() => stop(false)}
          className="mt-3 w-full px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-white/90"
        >
          Stop senza salvare
        </button>
      )}

      {error && (
        <div className="mt-3 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          {error}
        </div>
      )}
    </div>
  );
}