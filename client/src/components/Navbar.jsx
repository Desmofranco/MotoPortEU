import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

const TOKEN_KEY = "token";

const linkStyle = (isMobile) => ({ isActive }) => ({
  padding: isMobile ? "6px 8px" : "8px 12px",
  borderRadius: 999,
  textDecoration: "none",
  color: "inherit",
  background: isActive ? "rgba(0,0,0,0.08)" : "transparent",
  border: isActive ? "1px solid rgba(0,0,0,0.10)" : "1px solid transparent",
  fontWeight: 900,
  fontSize: isMobile ? 13 : 14,
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

  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(max-width: 640px), (pointer: coarse)").matches;

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
          padding: isMobile ? "8px 8px" : "10px 10px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 1250,
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {/* Brand SOLO desktop (su mobile lo togliamo per spazio) */}
        {!isMobile && (
          <div
            style={{
              fontWeight: 950,
              letterSpacing: -0.3,
              flex: "0 0 auto",
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title="MotoPortEU"
          >
            MotoPortEU
          </div>
        )}

        {/* Links: sempre scroll orizzontale */}
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            gap: isMobile ? 6 : 8,
            alignItems: "center",
            overflowX: "auto",
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
            paddingBottom: 3,
            minWidth: 0, // IMPORTANTISSIMO per evitare tagli in flex
          }}
        >
          <NavLink to="/routes" style={linkStyle(isMobile)}>
            Itinerari
          </NavLink>
          <NavLink to="/tracks" style={linkStyle(isMobile)}>
            🏁 Circuiti
          </NavLink>
          <NavLink to="/map" style={linkStyle(isMobile)}>
            🧭 Rotte
          </NavLink>
          <NavLink to="/garage" style={linkStyle(isMobile)}>
            Garage
          </NavLink>
          <NavLink to="/suppliers" style={linkStyle(isMobile)}>
            Fornitori
          </NavLink>
        </div>

        {/* Logout compatto su mobile */}
        <button
          onClick={logout}
          title="Logout"
          style={{
            flex: "0 0 auto",
            padding: isMobile ? "7px 9px" : "8px 10px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: "pointer",
            fontWeight: 950,
            fontSize: isMobile ? 13 : 14,
          }}
        >
          {isMobile ? "⎋" : "Logout"}
        </button>
      </div>
    </div>
  );
}