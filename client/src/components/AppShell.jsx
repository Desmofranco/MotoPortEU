import React from "react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/routes", label: "Itinerari", icon: "🗺️" },
  { to: "/tracks", label: "Circuiti", icon: "🏁" },
  { to: "/map", label: "Mappa", icon: "🧭" },
  { to: "/garage", label: "Garage", icon: "🔧" },
  { to: "/premium", label: "Premium", icon: "⭐" },
];

const desktopItems = [
  { to: "/", label: "Home" },
  { to: "/routes", label: "Itinerari" },
  { to: "/tracks", label: "Circuiti" },
  { to: "/map", label: "Mappa" },
  { to: "/garage", label: "Garage" },
  { to: "/premium", label: "Premium" },
];
function isActive(pathname, to) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AppShell({ children }) {
  const location = useLocation();

  return (
    <div style={styles.app}>
      <style>{`
        .mp-desktop-nav { display: none; }
        .mp-bottom-nav { display: flex; }

        @media (min-width: 900px) {
          .mp-desktop-nav { display: flex; }
          .mp-bottom-nav { display: none; }
        }

        .mp-hide-scrollbar::-webkit-scrollbar {
          width: 0;
          height: 0;
        }

        .mp-hide-scrollbar {
          scrollbar-width: none;
        }
      `}</style>

      <header style={styles.header}>
        <Link to="/" style={styles.brandWrap}>
          <span style={styles.brandEmoji}>🏍️</span>
          <span style={styles.brandText}>MotoPortEU</span>
        </Link>

        <nav className="mp-desktop-nav" style={styles.desktopNav}>
          {desktopItems.map((item) => {
            const active = isActive(location.pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  ...styles.desktopLink,
                  ...(active ? styles.desktopLinkActive : {}),
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main style={styles.main}>{children}</main>

      <nav className="mp-bottom-nav mp-hide-scrollbar" style={styles.bottomNav}>
        {navItems.map((item) => {
          const active = isActive(location.pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              style={styles.bottomLink}
              aria-label={item.label}
            >
              <div
                style={{
                  ...styles.bottomItem,
                  ...(active ? styles.bottomItemActive : {}),
                }}
              >
                <div style={styles.bottomIcon}>{item.icon}</div>
                <div style={styles.bottomLabel}>{item.label}</div>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #091224 0%, #0b1730 100%)",
    color: "#ffffff",
  },

  header: {
    position: "sticky",
    top: 0,
    zIndex: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    background: "rgba(8, 16, 34, 0.9)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
    color: "#fff",
    minWidth: 0,
  },

  brandEmoji: {
    fontSize: 22,
    lineHeight: 1,
  },

  brandText: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    lineHeight: 1,
  },

  desktopNav: {
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  desktopLink: {
    textDecoration: "none",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    padding: "10px 14px",
    borderRadius: 14,
    transition: "all 0.18s ease",
  },

  desktopLinkActive: {
    background: "rgba(255,255,255,0.14)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
  },

  main: {
    minHeight: "calc(100vh - 70px)",
    paddingBottom: "92px",
  },

  bottomNav: {
    position: "fixed",
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 60,
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px",
    borderRadius: 22,
    background: "rgba(9, 18, 36, 0.94)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },

  bottomLink: {
    textDecoration: "none",
    color: "#fff",
    flex: 1,
    minWidth: 0,
  },

  bottomItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 58,
    borderRadius: 16,
    padding: "8px 6px",
    transition: "all 0.18s ease",
    opacity: 0.88,
  },

  bottomItemActive: {
    background: "rgba(255,255,255,0.12)",
    opacity: 1,
    transform: "translateY(-1px)",
  },

  bottomIcon: {
    fontSize: 18,
    lineHeight: 1,
  },

  bottomLabel: {
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
};