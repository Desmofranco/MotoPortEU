import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function AppShell({ children }) {
  const location = useLocation();

  const nav = [
    { path: "/", label: "Home" },
    { path: "/routes", label: "Itinerari" },
    { path: "/tracks", label: "Circuiti" },
    { path: "/map", label: "Mappa" },
    { path: "/garage", label: "Garage" }
  ];

  const isActive = (path) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div style={{ minHeight: "100vh", background: "#0b1428", color: "white" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(9,18,36,0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap"
          }}
        >
          <Link
            to="/"
            style={{
              textDecoration: "none",
              color: "white",
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.02em"
            }}
          >
            🏍️ MotoPortEU
          </Link>

          <nav
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center"
            }}
          >
            {nav.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  textDecoration: "none",
                  color: isActive(item.path) ? "#ffd54a" : "white",
                  background: isActive(item.path)
                    ? "rgba(255,255,255,0.10)"
                    : "transparent",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}