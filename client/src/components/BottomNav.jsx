import React from "react";
import { NavLink } from "react-router-dom";

const tabStyle = ({ isActive }) => ({
  textDecoration: "none",
  color: "inherit",
  fontWeight: isActive ? 700 : 500,
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-black/10"
      style={{ backdropFilter: "blur(10px)" }}
    >
      <div className="max-w-5xl mx-auto flex justify-around py-2">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} style={tabStyle}>
            <div className="flex flex-col items-center text-xs px-2">
              <div className="text-lg leading-none">{t.icon}</div>
              <div>{t.label}</div>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}