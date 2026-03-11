import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function RequireAuth({ children }) {
  const location = useLocation();

  const token = localStorage.getItem("token");

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    user = null;
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isPremium = !!(user?.isPremium || user?.passActive || user?.role === "premium");

  if (!isPremium) {
    return <Navigate to="/premium" replace state={{ from: location }} />;
  }

  return children;
}