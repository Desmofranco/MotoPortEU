import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    // OUTER: sfondo desktop + centratura
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        background: "#0b0f14",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      {/* FRAME: simulazione telefono su desktop */}
      <div
        className="_frameFix"
        style={{
          position: "relative",
          width: "min(420px, 100vw)",
          height: "min(860px, 100vh)",
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 30px 90px rgba(0,0,0,0.6)",
        }}
      >
        {/* background con titolo stampato */}
        <img
          src="/home-moto.jpg"
          alt=""
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
            background: "rgba(0,0,0,0.45)",
          }}
        />

        {/* pulsanti */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "0 24px 56px",
          }}
        >
          <div style={{ width: "100%", maxWidth: 360 }}>
            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={() => navigate("/routes")}
                style={{
                  background: "white",
                  color: "black",
                  fontWeight: 800,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "none",
                  fontSize: 15,
                  boxShadow: "0 12px 26px rgba(0,0,0,0.35)",
                }}
              >
                Entra
              </button>

              <button
                onClick={() => navigate("/login")}
                style={{
                  background: "rgba(0,0,0,0.15)",
                  color: "white",
                  fontWeight: 800,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.85)",
                  fontSize: 15,
                  boxShadow: "0 12px 26px rgba(0,0,0,0.25)",
                  backdropFilter: "blur(6px)",
                }}
              >
                Accedi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* mobile override */}
      <style>{`
        @media (max-width: 520px) {
          ._frameFix {
            width: 100vw !important;
            height: 100vh !important;
            border-radius: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}