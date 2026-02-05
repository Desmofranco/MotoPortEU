import React, { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const TOKEN_KEY = "token";

const linkStyle = ({ isActive }) => ({
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: "inherit",
  background: isActive ? "rgba(0,0,0,0.08)" : "transparent",
});

export default function Navbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isLogged = useMemo(() => Boolean(localStorage.getItem(TOKEN_KEY)), []);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    navigate("/", { replace: true });
  };

  const links = (
    <>
      <NavLink to="/dashboard" style={linkStyle} onClick={() => setOpen(false)}>
        Dashboard
      </NavLink>
      <NavLink to="/map" style={linkStyle} onClick={() => setOpen(false)}>
        Mappa
      </NavLink>
      <NavLink to="/routes" style={linkStyle} onClick={() => setOpen(false)}>
        Itinerari
      </NavLink>
      <NavLink to="/tracks" style={linkStyle} onClick={() => setOpen(false)}>
        🏁 Piste
      </NavLink>
      <NavLink to="/garage" style={linkStyle} onClick={() => setOpen(false)}>
        Garage
      </NavLink>
      <NavLink to="/suppliers" style={linkStyle} onClick={() => setOpen(false)}>
        Fornitori
      </NavLink>
      <NavLink to="/passes" style={linkStyle} onClick={() => setOpen(false)}>
        Pass
      </NavLink>
      <NavLink to="/my-tracks" style={linkStyle} onClick={() => setOpen(false)}>
        📡 Storico
      </NavLink>
    </>
  );

  if (!isLogged) return null; // con RequireAuth non dovrebbe mai vedersi

  return (
    <div
      style={{
        padding: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        borderBottom: "1px solid rgba(0,0,0,0.12)",
        position: "sticky",
        top: 0,
        background: "white",
        zIndex: 60,
      }}
    >
      <strong style={{ marginRight: 8 }}>MotoPortEU</strong>

      {/* Desktop links */}
      <div className="hidden md:flex gap-2 items-center">{links}</div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          ☰
        </button>

        <button
          onClick={logout}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden absolute left-0 right-0 top-full bg-white border-b border-black/10">
          <div style={{ padding: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {links}
          </div>
        </div>
      )}
    </div>
  );
}