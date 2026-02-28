import React from "react";
import { useNavigate } from "react-router-dom";
const TOKEN_KEY = "token"; // se usi un altro nome dimmelo
const isLogged = Boolean(localStorage.getItem(TOKEN_KEY));
export default function Home() {
  const navigate = useNavigate();

  return (
    <>
      {/* 🔥 reset layout Vite */}
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

      {/* OUTER CENTER */}
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
        {/* PHONE FRAME */}
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
          {/* background */}
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

          {/* overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.7))",
            }}
          />
<MenuItem icon="❓" label="FAQ" path="/faq" />
<MenuItem icon="📜" label="Condizioni d’uso" path="/terms" />

<button
  type="button"
  onClick={() => {
    setMenuOpen(false);
    window.location.href = "mailto:motoporteu@gmail.com?subject=MotoPortEU%20-%20Contatto";
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
  <span style={{ opacity: 0.7 }}>motoporteu@gmail.com</span>
</button>

<div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "2px 0" }} />

{!isLogged ? (
  <>
    <MenuItem icon="🔑" label="Accedi" path="/login" />
    <MenuItem icon="✨" label="Registrati" path="/register" />
  </>
) : (
  <button
    type="button"
    onClick={() => {
      // logout semplice (adatta se hai altri storage key)
      localStorage.removeItem(TOKEN_KEY);
      setMenuOpen(false);
      navigate("/"); // torna home
    }}
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
          {/* CONTENT */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "0 20px",
            }}
          >
            {/* CTA BOX */}
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
                {/* ACCEDI */}
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

                {/* REGISTRATI */}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}