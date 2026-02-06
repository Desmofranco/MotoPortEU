import React from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <>
      {/* 🔥 reset body layout che Vite imposta */}
      <style>{`
        body, #root {
          margin: 0;
          padding: 0;
          display: block !important;
          height: 100%;
          width: 100%;
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
              background: "rgba(0,0,0,0.45)",
            }}
          />

          {/* buttons */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              height: "100%",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: "0 24px 64px",
            }}
          >
            <div style={{ width: "100%", maxWidth: 360 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <button
                  onClick={() => navigate("/login")}
                  style={{
                    background: "white",
                    color: "black",
                    fontWeight: 800,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "none",
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Accedi
                </button>

                <button
                  onClick={() => navigate("/register")}
                  style={{
                    background: "rgba(0,0,0,0.15)",
                    color: "white",
                    fontWeight: 800,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.85)",
                    fontSize: 15,
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