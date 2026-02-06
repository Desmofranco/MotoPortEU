import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
      }}
    >
      {/* background con titolo già stampato */}
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

      {/* overlay leggero per leggibilità bottoni */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
        }}
      />

      {/* solo pulsanti */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "0 24px 48px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ display: "grid", gap: 12 }}>
            <button
              onClick={() => navigate("/routes")}
              style={{
                background: "white",
                color: "black",
                fontWeight: 800,
                padding: "12px",
                borderRadius: 16,
                border: "none",
                fontSize: 16,
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
                padding: "12px",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.9)",
                fontSize: 16,
              }}
            >
              Accedi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}