import React from "react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/routes", label: "Itinerari" },
  { to: "/tracks", label: "Circuiti" },
  { to: "/map", label: "Mappa" },
  { to: "/garage", label: "Garage" },
  { to: "/suppliers", label: "Fornitori" },
  { to: "/premium", label: "Premium" },
];

export default function AppShell({ children }) {
  const location = useLocation();

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.brand}>🏍️ MotoPortEU</div>

        <nav style={styles.navDesktop}>
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  ...styles.link,
                  ...(active ? styles.linkActive : {}),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main style={styles.main}>{children}</main>

      <nav style={styles.bottomNav}>
        {navItems.slice(0, 5).map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              style={{
                ...styles.bottomLink,
                ...(active ? styles.bottomLinkActive : {}),
              }}
            >
              {item.label}
            </Link>
          );
        })}

        <Link
          to="/premium"
          style={{
            ...styles.bottomLink,
            ...(location.pathname === "/premium" ? styles.bottomLinkActive : {}),
          }}
        >
          Premium
        </Link>
      </nav>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#fff",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "14px 18px",
    background: "rgba(15,23,42,0.92)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
  },
  brand: {
    fontWeight: 900,
    fontSize: 22,
  },
  navDesktop: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  link: {
    textDecoration: "none",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 12,
    fontWeight: 700,
  },
  linkActive: {
    background: "rgba(255,255,255,0.14)",
  },
  main: {
    minHeight: "calc(100vh - 72px)",
  },
  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "space-around",
    gap: 6,
    padding: "10px 8px calc(10px + env(safe-area-inset-bottom))",
    background: "rgba(10,15,29,0.96)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
  },
  bottomLink: {
    textDecoration: "none",
    color: "#fff",
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 10,
    fontWeight: 700,
  },
  bottomLinkActive: {
    background: "rgba(255,255,255,0.14)",
  },
};