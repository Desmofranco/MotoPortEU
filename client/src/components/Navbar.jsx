import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

const TOKEN_KEY = "token";

const tabStyle = ({ isActive }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 12px",
  borderRadius: 999,
  textDecoration: "none",
  whiteSpace: "nowrap",
  fontWeight: 900,
  fontSize: 14,
  color: "inherit",
  background: isActive ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.75)",
  border: isActive ? "1px solid rgba(0,0,0,0.16)" : "1px solid rgba(0,0,0,0.10)",
  boxShadow: isActive ? "0 6px 16px rgba(0,0,0,0.10)" : "0 2px 8px rgba(0,0,0,0.06)",
  backdropFilter: "blur(6px)",
  transition: "all .15s ease",
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
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(0,0,0,0.10)",
      }}
    >
      {/* ROW 1: Brand + Logout (non compete coi tab) */}
      <div
        style={{
          padding: "10px 12px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 950, letterSpacing: -0.4, fontSize: 16 }}>
          MotoPortEU
        </div>

        <button
          onClick={logout}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.14)",
            background: "white",
            cursor: "pointer",
            fontWeight: 900,
            fontSize: 13,
            boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
            whiteSpace: "nowrap",
          }}
          title="Logout"
        >
          ⎋ Logout
        </button>
      </div>

      {/* ROW 2: Tabs pill con icone (scrollabile, zero tagli) */}
      <div
        style={{
          padding: "6px 10px 10px",
          display: "flex",
          gap: 8,
          alignItems: "center",
          overflowX: "auto",
          whiteSpace: "nowrap",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <NavLink to="/routes" style={tabStyle}>
          <span aria-hidden="true">📍</span>
          <span>Itinerari</span>
        </NavLink>

        <NavLink to="/tracks" style={tabStyle}>
          <span aria-hidden="true">🏁</span>
          <span>Circuiti</span>
        </NavLink>

        <NavLink to="/map" style={tabStyle}>
          <span aria-hidden="true">🧭</span>
          <span>Rotte</span>
        </NavLink>

        <NavLink to="/garage" style={tabStyle}>
          <span aria-hidden="true">🛠️</span>
          <span>Garage</span>
        </NavLink>

        <NavLink to="/suppliers" style={tabStyle}>
          <span aria-hidden="true">⭐</span>
          <span>Fornitori</span>
        </NavLink>
      </div>
    </div>
  );
}