import { NavLink } from "react-router-dom";
import { Link } from "react-router-dom";

const linkStyle = ({ isActive }) => ({
  padding: "8px 12px",
  borderRadius: 8,
  textDecoration: "none",
  color: "inherit",
  background: isActive ? "rgba(0,0,0,0.08)" : "transparent",
});

export default function Navbar() {
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
        zIndex: 10,
      }}
    >
      <strong style={{ marginRight: 8 }}>MotoPortEU</strong>

      <NavLink to="/" style={linkStyle} end>Home</NavLink>
      <NavLink to="/map" style={linkStyle}>Mappa</NavLink>
      <NavLink to="/routes" style={linkStyle}>Itinerari</NavLink>
      <Link to="/tracks">🏁 Piste</Link>
      <NavLink to="/garage" style={linkStyle}>Garage</NavLink>
      <NavLink to="/suppliers" style={linkStyle}>Fornitori</NavLink>
      <NavLink to="/pass" style={linkStyle}>Pass</NavLink>
     
      <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
        <NavLink to="/login" style={linkStyle}>Login</NavLink>
        <NavLink to="/register" style={linkStyle}>Register</NavLink>
      </div>
    </div>
  );
}
