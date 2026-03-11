import React from "react";
import { Link, useLocation } from "react-router-dom";

const nav = [
  { path: "/", label: "Home", icon: "🏠" },
  { path: "/routes", label: "Itinerari", icon: "🗺️" },
  { path: "/tracks", label: "Circuiti", icon: "🏁" },
  { path: "/map", label: "Navigatore", icon: "🧭" },
  { path: "/garage", label: "Garage", icon: "🔧" },
  { path: "/premium", label: "Premium", icon: "⭐" },
];

function isActive(pathname, path) {
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(path + "/");
}

export default function AppShell({ children }) {
  const location = useLocation();

  return (
    <div style={styles.app}>
      <style>{`
        @media (max-width: 760px) {
          .mp-brand-text {
            font-size: 24px !important;
          }

          .mp-topbar-inner {
            padding: 12px 14px !important;
          }

          .mp-nav {
            gap: 6px !important;
          }

          .mp-link {
            padding: 8px 10px !important;
            font-size: 13px !important;
          }

          .mp-link-icon {
            font-size: 14px !important;
          }
        }
      `}</style>

      <header style={styles.header}>
        <div className="mp-topbar-inner" style={styles.headerInner}>
          <Link to="/" style={styles.brand}>
            <span style={styles.brandEmoji}>🏍️</span>
            <span className="mp-brand-text" style={styles.brandText}>
              MotoPortEU
            </span>
          </Link>

          <nav className="mp-nav" style={styles.nav}>
            {nav.map((item) => {
              const active = isActive(location.pathname, item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="mp-link"
                  style={{
                    ...styles.link,
                    ...(active ? styles.linkActive : {}),
                  }}
                >
                  <span className="mp-link-icon" style={styles.linkIcon}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main style={styles.main}>{children}</main>
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
    zIndex: 50,
    background: "rgba(15,23,42,0.92)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  headerInner: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: "14px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    color: "#fff",
  },

  brandEmoji: {
    fontSize: 24,
    lineHeight: 1,
  },

  brandText: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },

  nav: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  link: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 15,
    transition: "all 0.18s ease",
  },

  linkActive: {
    background: "rgba(255,255,255,0.10)",
    color: "#ffd54a",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
  },

  linkIcon: {
    fontSize: 15,
    lineHeight: 1,
  },

  main: {
    minHeight: "calc(100vh - 76px)",
    background: "#f4f6f8",
    color: "#111827",
  },
};