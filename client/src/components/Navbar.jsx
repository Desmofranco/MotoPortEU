import React from "react";
import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }) => ({
  padding: "8px 14px",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 900,
  fontSize: 14,
  whiteSpace: "nowrap",

  // STILE FIGO tipo "Rotte"
  background: isActive
    ? "rgba(0,0,0,0.08)"
    : "rgba(255,255,255,0.6)",

  border: isActive
    ? "1px solid rgba(0,0,0,0.15)"
    : "1px solid rgba(0,0,0,0.08)",

  boxShadow: isActive
    ? "0 4px 10px rgba(0,0,0,0.08)"
    : "0 2px 6px rgba(0,0,0,0.05)",

  backdropFilter: "blur(6px)",
  transition: "all 0.2s ease",
});

export default function Navbar() {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          padding: "10px 8px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          whiteSpace: "nowrap",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <NavLink to="/routes" style={linkStyle}>
          Itinerari
        </NavLink>

        <NavLink to="/tracks" style={linkStyle}>
          🏁 Circuiti
        </NavLink>

        <NavLink to="/map" style={linkStyle}>
          🧭 Rotte
        </NavLink>

        <NavLink to="/garage" style={linkStyle}>
          Garage
        </NavLink>

        <NavLink to="/suppliers" style={linkStyle}>
          Fornitori
        </NavLink>
      </div>
    </div>
  );
}