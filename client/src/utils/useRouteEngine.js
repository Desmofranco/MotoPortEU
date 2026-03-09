// src/hooks/useRouteEngine.js
import { useCallback, useRef, useState } from "react";
import { buildRoute, snapToRoad } from "../utils/routeEngine";
import { scoreRoute } from "../utils/riderScoring";
import { saveLastRoute } from "../utils/routeStorage";

function normalizeWeatherStub(route) {
  // sprint 1: stub pulito
  return {
    summary: "Meteo rider non ancora caricato",
    risks: [],
    checkpoints: route?.segments?.slice(0, 3).map((seg) => ({
      id: seg.id,
      label: "checkpoint",
      status: "ok",
    })) || [],
  };
}

export default function useRouteEngine() {
  const [route, setRoute] = useState(null);
  const [weather, setWeather] = useState(null);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [error, setError] = useState("");

  const abortRef = useRef(null);

  const reset = useCallback(() => {
    abortRef.current?.abort?.();
    setRoute(null);
    setWeather(null);
    setScore(null);
    setLoading(false);
    setSnapping(false);
    setError("");
  }, []);

  const snapPoints = useCallback(async (points) => {
    setSnapping(true);
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const snapped = [];
      for (const point of points) {
        const p = await snapToRoad(point, controller.signal);
        snapped.push(p);
      }
      return snapped;
    } finally {
      setSnapping(false);
    }
  }, []);

  const build = useCallback(async (points, options = {}) => {
    abortRef.current?.abort?.();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const built = await buildRoute(points, {
        signal: controller.signal,
        annotations: false,
        steps: true,
      });

      const weatherData = normalizeWeatherStub(built);
      const scoreData = scoreRoute(built, weatherData);

      setRoute(built);
      setWeather(weatherData);
      setScore(scoreData);

      saveLastRoute({
        points,
        route: built,
        weather: weatherData,
        score: scoreData,
        meta: options.meta || null,
      });

      return { route: built, weather: weatherData, score: scoreData };
    } catch (err) {
      if (err?.name !== "AbortError") {
        setError(err?.message || "Errore durante la costruzione della rotta");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    route,
    weather,
    score,
    loading,
    snapping,
    error,
    reset,
    snapPoints,
    buildRoute: build,
  };
}