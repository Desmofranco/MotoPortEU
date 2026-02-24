import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

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

  background: isActive ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.75)",
  border: isActive ? "1px solid rgba(0,0,0,0.15)" : "1px solid rgba(0,0,0,0.08)",
  boxShadow: isActive ? "0 4px 10px rgba(0,0,0,0.08)" : "0 2px 6px rgba(0,0,0,0.05)",

  backdropFilter: "blur(6px)",
});

export default function Navbar() {
  const navigate = useNavigate();
  const isLogged = Boolean(localStorage.getItem(TOKEN_KEY));
  if (!isLogged) return null;

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    navigate("/", { replace: true });
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 80,
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      {/* TOP BAR COMPATTA */}
      <div
        style={{
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14 }}>
          MotoPortEU
        </div>

        <button
          onClick={logout}
          style={{
            padding: "6px 8px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            cursor: "pointer",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          ⎋
        </button>
      </div>

      {/* TABS COMPATTI */}
      <div
        style={{
          padding: "4px 8px 8px",
          display: "flex",
          gap: 6,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <NavLink to="/routes" style={tabStyle}>
          📍 Itinerari
        </NavLink>

        <NavLink to="/tracks" style={tabStyle}>
          🏁 Circuiti
        </NavLink>

        <NavLink to="/map" style={tabStyle}>
          🧭 Rotte
        </NavLink>

        <NavLink to="/garage" style={tabStyle}>
          🛠️ Garage
        </NavLink>

        <NavLink to="/suppliers" style={tabStyle}>
          ⭐ Fornitori
        </NavLink>
      </div>
    </div>
  );
}