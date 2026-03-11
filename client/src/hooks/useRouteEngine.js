import { useState } from "react";

function toMessage(err, fallback = "Errore route engine") {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "object" && typeof err.message === "string") {
    return err.message;
  }
  return fallback;
}

export default function useRouteEngine() {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [error, setError] = useState(null);

  // placeholders compatibili con Map.jsx
  const [weather] = useState(null);
  const [score] = useState(null);

  async function snapPoints(points) {
    setSnapping(true);
    setError(null);

    try {
      if (!Array.isArray(points) || points.length < 2) {
        throw new Error("Servono almeno 2 punti per lo snap.");
      }

      const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
      const url =
        `https://router.project-osrm.org/route/v1/driving/${coords}` +
        `?overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error("Servizio di snap momentaneamente non disponibile.");
      }

      const data = await res.json();

      if (!data?.routes?.length) {
        throw new Error("Snap non riuscito. Riprova.");
      }

      const r = data.routes[0];

      const geometry = (r.geometry?.coordinates || []).map((c) => ({
        lat: Number(c[1]),
        lng: Number(c[0]),
      }));

      if (!geometry.length) {
        throw new Error("Geometria rotta non disponibile.");
      }

      return {
        geometry,
        distanceKm: Number(r.distance || 0) / 1000,
        durationMin: Number(r.duration || 0) / 60,
        legs: Array.isArray(r.legs) ? r.legs : [],
      };
    } catch (e) {
      const msg = toMessage(e, "Snap non riuscito. Riprova.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setSnapping(false);
    }
  }

  async function buildRoute(points, options = {}) {
    setLoading(true);
    setError(null);

    try {
      const snapped = await snapPoints(points);

      const builtRoute = {
        geometry: snapped.geometry,
        distanceKm: snapped.distanceKm,
        durationMin: snapped.durationMin,
        legs: snapped.legs || [],
        meta: options?.meta || {},
      };

      setRoute(builtRoute);

      return { route: builtRoute };
    } catch (e) {
      const msg = toMessage(e, "Errore nella costruzione della rotta.");
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setRoute(null);
    setError(null);
  }

  return {
    route,
    weather,
    score,
    loading,
    snapping,
    error,
    snapPoints,
    buildRoute,
    reset,
  };
}