import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

const TOKEN_KEY = "token";

const linkStyle = ({ isActive }) => ({
  padding: "8px 12px",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  background: isActive ? "rgba(0,0,0,0.08)" : "transparent",
  border: isActive ? "1px solid rgba(0,0,0,0.10)" : "1px solid transparent",
  fontWeight: 800,
  fontSize: 14,
  whiteSpace: "nowrap",
});

export default function Navbar() {
  const navigate = useNavigate();
  const isLogged = Boolean(localStorage.getItem(TOKEN_KEY));

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    navigate("/", { replace: true });
  };

  if (!isLogged) return null;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 60,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(0,0,0,0.10)",
      }}
    >
      <div
        style={{
          padding: "10px 10px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          maxWidth: 1250,
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Brand (sempre visibile, non spinge troppo) */}
        <div
          style={{
            fontWeight: 950,
            letterSpacing: -0.3,
            flex: "0 0 auto",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title="MotoPortEU"
        >
          MotoPortEU
        </div>

        {/* Links: scroll orizzontale su mobile, senza tagli */}
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            gap: 8,
            alignItems: "center",
            overflowX: "auto",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 4, // evita che la scrollbar copra
          }}
        >
          <NavLink to="/routes" style={linkStyle}>
            Itinerari
          </NavLink>
          <NavLink to="/tracks" style={linkStyle}>
            🏁 Circuiti
          </NavLink>
          <NavLink to="/map" style={linkStyle}>
            🧭 Rotta Libera
          </NavLink>
          <NavLink to="/garage" style={linkStyle}>
            Garage
          </NavLink>
          <NavLink to="/suppliers" style={linkStyle}>
            Fornitori
          </NavLink>
        </div>

        {/* Logout sempre visibile */}
        <button
          onClick={logout}
          style={{
            flex: "0 0 auto",
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}