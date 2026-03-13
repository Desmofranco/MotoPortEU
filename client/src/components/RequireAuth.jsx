import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken, getStoredUser } from "../utils/auth";

export default function RequireAuth({ children }) {
  const location = useLocation();

  const token = getToken();
  const user = getStoredUser();

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