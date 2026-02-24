import React from "react";
import { NavLink } from "react-router-dom";

const TOKEN_KEY = "token";

const tabStyle = ({ isActive }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 10px",
  borderRadius: 999,
  textDecoration: "none",
  whiteSpace: "nowrap",
  fontWeight: 900,
  fontSize: 13,
  color: "inherit",
  background: isActive ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.80)",
  border: isActive ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(0,0,0,0.10)",
  boxShadow: isActive ? "0 4px 10px rgba(0,0,0,0.08)" : "0 2px 6px rgba(0,0,0,0.05)",
});

const rowStyle = {
  display: "flex",
  gap: 6,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  padding: "6px 10px",
};

export default function Navbar() {
  const isLogged = Boolean(localStorage.getItem(TOKEN_KEY));
  if (!isLogged) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 80,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(0,0,0,0.10)",
      }}
    >
      {/* ROW 1 — titolo piccolo */}
      <div
        style={{
          padding: "6px 10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 13 }}>
          MotoPortEU
        </div>
      </div>

      {/* ROW 2 — MAIN (utente) */}
      <div style={{ ...rowStyle, paddingTop: 2, paddingBottom: 6 }}>
        <NavLink to="/routes" style={tabStyle}>📍 Itinerari</NavLink>
        <NavLink to="/tracks" style={tabStyle}>🏁 Circuiti</NavLink>
        <NavLink to="/map" style={tabStyle}>🧭 Rotte</NavLink>
        <NavLink to="/garage" style={tabStyle}>🛠️ Garage</NavLink>
      </div>

      {/* ROW 3 — nascosta per ora (business pronto) */}
      {/* 
      <div style={{ ...rowStyle, paddingTop: 0, paddingBottom: 8 }}>
        <NavLink to="/suppliers" style={tabStyle}>⭐ Fornitori</NavLink>
      </div>
      */}
    </div>
  );
}