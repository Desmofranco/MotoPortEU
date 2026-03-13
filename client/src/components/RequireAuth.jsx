import React from "react";
import { Navigate, useLocation } from "react-router-dom";

function getAnyToken() {
  return (
    localStorage.getItem("mp_token") ||
    localStorage.getItem("token") ||
    null
  );
}

function getAnyUser() {
  const raw =
    localStorage.getItem("mp_user") ||
    localStorage.getItem("user") ||
    null;

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function RequireAuth({ children }) {
  const location = useLocation();

  const token = getAnyToken();
  const user = getAnyUser();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isPremium = !!(
    user?.isPremium ||
    user?.passActive ||
    user?.role === "premium"
  );

  if (!isPremium) {
    return <Navigate to="/premium" replace state={{ from: location }} />;
  }

  return children;
}