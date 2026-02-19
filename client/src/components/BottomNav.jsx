import React from "react";
import { NavLink } from "react-router-dom";

const tabStyle = ({ isActive }) => ({
  textDecoration: "none",
  color: "inherit",
  fontWeight: isActive ? 800 : 600,
  opacity: isActive ? 1 : 0.75,
});

export default function BottomNav() {
  const tabs = [
    { to: "/map", label: "Mappa", icon: "🗺️" },
    { to: "/routes", label: "Itinerari", icon: "📍" },
    { to: "/tracks", label: "Circuiti", icon: "🏁" },
    { to: "/garage", label: "Garage", icon: "🛠️" },
    { to: "/my-tracks", label: "Storico", icon: "📡" },
  ];

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-black/10 w-full overflow-x-hidden"
      style={{ backdropFilter: "blur(10px)" }}
    >
      {/* FULL WIDTH: niente max-w, niente mx-auto */}
      <div className="w-full flex items-stretch justify-between px-2 py-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            style={tabStyle}
            className="flex-1"
          >
            <div className="flex flex-col items-center text-[11px] px-1">
              <div className="text-lg leading-none">{t.icon}</div>
              <div className="leading-none">{t.label}</div>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}