import React from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../utils/auth";

export default function Dashboard() {
  const navigate = useNavigate();

  const items = [
    { label: "Home", path: "/", emoji: "🏠" },
    { label: "Mappa", path: "/map", emoji: "🗺️" },
    { label: "Itinerari", path: "/routes", emoji: "📍" },
    { label: "Piste", path: "/tracks", emoji: "🏁" },
    { label: "Garage", path: "/garage", emoji: "🛠️" },
    { label: "Fornitori", path: "/suppliers", emoji: "🏪" },
    { label: "Pass", path: "/passes", emoji: "⛰️" },
    { label: "Storico GPS", path: "/my-tracks", emoji: "📡" },
  ];

  return (
    <div className="min-h-screen bg-[#061417] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-white text-3xl font-extrabold tracking-widest text-center mb-8">
          MOTOPORT
        </h1>

        <div className="grid grid-cols-2 gap-4">
          {items.map((it) => (
            <button
              key={it.path}
              onClick={() => navigate(it.path)}
              className="rounded-2xl bg-white/10 border border-white/15 text-white p-5 shadow-lg active:scale-[0.98] transition"
            >
              <div className="text-3xl mb-2">{it.emoji}</div>
              <div className="font-semibold">{it.label}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            logout();
            navigate("/", { replace: true });
          }}
          className="w-full mt-6 rounded-2xl bg-white/10 border border-white/15 text-white py-3 shadow-lg"
        >
          Logout
        </button>
      </div>
    </div>
  );
}