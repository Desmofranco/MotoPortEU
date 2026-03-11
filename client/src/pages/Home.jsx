// =======================================================
// src/pages/Home.jsx
// MotoPortEU — Home intelligente + menu dropdown + logout reale
// ✅ Layout centrato (phone frame)
// ✅ Dropdown stabile (z-index alto + non tagliato)
// ✅ Home pubblica / Home utente loggato
// ✅ Logout reale con clearAuthSession()
// ✅ Coerente con mp_token / mp_user
// =======================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthSession, getStoredUser, getToken } from "../utils/auth";

export default function Home({ authUser }) {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [localUser, setLocalUser] = useState(getStoredUser());
  const [isLogged, setIsLogged] = useState(Boolean(getToken()));

  const activeUser = useMemo(() => authUser || localUser, [authUser, localUser]);

  useEffect(() => {
    const sync = () => {
      setIsLogged(Boolean(getToken()));
      setLocalUser(getStoredUser());
    };

    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setIsLogged(false);
    setLocalUser(null);
    setMenuOpen(false);
    navigate("/");
  };

  const MenuItem = ({ icon, label, path, accent = false }) => (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        navigate(path);
      }}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.14)",
        background: accent ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.95)",
        cursor: "pointer",
        fontWeight: 900,
        textAlign: "left",
      }}
    >
      <span style={{ width: 22, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ opacity: 0.7 }}>›</span>
    </button>
  );

  return (
    <>
      <style>{`
        body, #root {
          margin: 0;
          padding: 0;
          display: block !important;
          height: 100%;
          width: 100%;
        }

        .btn {
          transition: all 0.2s ease;
        }

        .btn:active {
          transform: scale(0.96);
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#0b0f14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "min(420px, 100vw)",
            height: "min(860px, 100vh)",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
          }}
        >
          <img
            src="/home-moto.jpg"
            alt="MotoPortEU"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.78))",
            }}
          />

          <div style={{ position: "absolute", top: 14, right: 14, zIndex: 50 }}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.35)",
                color: "white",
                cursor: "pointer",
                fontSize: 18,
                fontWeight: 900,
                backdropFilter: "blur(10px)",
              }}
              aria-label="Menu"
            >
              ☰
            </button>

            {menuOpen && (
              <div
                style={{
                  marginTop: 10,
                  width: 320,
                  maxWidth: "calc(100vw - 28px)",
                  padding: 12,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(15,18,25,0.82)",
                  backdropFilter: "blur(14px)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
                  display: "grid",
                  gap: 10,
                }}
              >
                {isLogged && activeUser ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                      Profilo attivo
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {activeUser.name || "Rider"}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>
                      {activeUser.email || ""}
                    </div>
                  </div>
                ) : null}

                {isLogged ? (
                  <>
                    <MenuItem icon="🗺️" label="Itinerari" path="/routes" accent />
                    <MenuItem icon="🏁" label="Circuiti" path="/tracks" />
                    <MenuItem icon="🧭" label="Navigatore" path="/map" />
                    <MenuItem icon="🛠️" label="Garage" path="/garage" />
                    <MenuItem icon="🏪" label="Fornitori" path="/suppliers" />
                  </>
                ) : null}

                <MenuItem icon="❓" label="FAQ" path="/faq" />
                <MenuItem icon="📜" label="Condizioni d’uso" path="/terms" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    window.location.href =
                      "mailto:motoporteu@gmail.com?subject=MotoPortEU%20-%20Contatto";
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.95)",
                    cursor: "pointer",
                    fontWeight: 900,
                    textAlign: "left",
                  }}
                >
                  <span style={{ width: 22, textAlign: "center" }}>✉️</span>
                  <span style={{ flex: 1 }}>Contatti</span>
                  <span style={{ opacity: 0.7 }}>›</span>
                </button>

                <div
                  style={{
                    height: 1,
                    background: "rgba(255,255,255,0.12)",
                    margin: "2px 0",
                  }}
                />

                {!isLogged ? (
                  <>
                    <MenuItem icon="🔑" label="Accedi" path="/login" />
                    <MenuItem icon="✨" label="Registrati" path="/register" />
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,0,0,0.10)",
                      color: "rgba(255,255,255,0.95)",
                      cursor: "pointer",
                      fontWeight: 950,
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: 22, textAlign: "center" }}>🚪</span>
                    <span style={{ flex: 1 }}>Logout</span>
                    <span style={{ opacity: 0.7 }}>›</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {menuOpen && (
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 40,
                background: "transparent",
              }}
            />
          )}

          <div
            style={{
              position: "relative",
              zIndex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "28px 20px 0 20px",
            }}
          >
            <div
              style={{
                paddingTop: 42,
                textAlign: "center",
                color: "white",
              }}
            >
              {isLogged && activeUser ? (
                <div
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    backdropFilter: "blur(8px)",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  👋 Bentornato, {activeUser.name || "Rider"}
                </div>
              ) : null}
            </div>

            <div
              style={{
                width: "100%",
                maxWidth: 360,
                margin: "0 auto",
                marginBottom: "env(safe-area-inset-bottom, 40px)",
                transform: "translateY(-20px)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 14,
                  borderRadius: 20,
                  backdropFilter: "blur(12px)",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {!isLogged ? (
                  <>
                    <button
                      className="btn"
                      onClick={() => navigate("/login")}
                      style={{
                        background: "white",
                        color: "black",
                        fontWeight: 900,
                        padding: "12px",
                        borderRadius: 14,
                        border: "none",
                        fontSize: 16,
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                      }}
                    >
                      Accedi
                    </button>

                    <button
                      className="btn"
                      onClick={() => navigate("/register")}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "white",
                        fontWeight: 900,
                        padding: "12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.8)",
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      Registrati
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn"
                      onClick={() => navigate("/routes")}
                      style={{
                        background: "white",
                        color: "black",
                        fontWeight: 900,
                        padding: "12px",
                        borderRadius: 14,
                        border: "none",
                        fontSize: 16,
                        cursor: "pointer",
                        boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                      }}
                    >
                      Continua su Itinerari
                    </button>

                    <button
                      className="btn"
                      onClick={() => navigate("/garage")}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "white",
                        fontWeight: 900,
                        padding: "12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.8)",
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      Apri Garage
                    </button>

                    <button
                      className="btn"
                      onClick={() => navigate("/map")}
                      style={{
                        background: "rgba(255,255,255,0.08)",
                        color: "white",
                        fontWeight: 900,
                        padding: "12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.4)",
                        fontSize: 16,
                        cursor: "pointer",
                      }}
                    >
                      Apri Navigatore
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}