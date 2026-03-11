import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function AppShell({ children }) {
  const location = useLocation();

  const nav = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/routes", label: "Itinerari", icon: "🗺️" },
    { path: "/tracks", label: "Circuiti", icon: "🏁" },
    { path: "/map", label: "Mappa", icon: "🧭" },
    { path: "/garage", label: "Garage", icon: "🔧" }
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0b1428", color: "white" }}>
      
      <main style={{ paddingBottom: 90 }}>
        {children}
      </main>

      <nav
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 70,
          background: "#091224",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        {nav.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              textDecoration: "none",
              color:
                location.pathname === item.path
                  ? "#ffd54a"
                  : "white",
              fontSize: 12,
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 20 }}>{item.icon}</div>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}