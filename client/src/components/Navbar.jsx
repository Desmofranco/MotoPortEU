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

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    navigate("/", { replace: true });
  };

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

      <NavLink to="/map" style={linkStyle}>Mappa</NavLink>
      <NavLink to="/routes" style={linkStyle}>Itinerari</NavLink>
      <NavLink to="/tracks" style={linkStyle}>🏁 Piste</NavLink>
      <NavLink to="/garage" style={linkStyle}>Garage</NavLink>
      <NavLink to="/suppliers" style={linkStyle}>Fornitori</NavLink>
      <NavLink to="/passes" style={linkStyle}>Pass</NavLink>
      <NavLink to="/my-tracks" style={linkStyle}>📡 Storico</NavLink>

      <div style={{ marginLeft: "auto" }}>
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
    </div>
  );
}