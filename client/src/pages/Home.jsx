import React from "react";
import { useNavigate } from "react-router-dom";

function EUCrown({ size = 30, opacity = 0.95 }) {
  // 12 stelle in cerchio (stile UE)
  const stars = Array.from({ length: 12 });
  const r = 12;
  const cx = 16;
  const cy = 16;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ opacity }}
    >
      {stars.map((_, i) => {
        const a = (i * 360) / 12;
        const rad = (a * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fill="#ffffff"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
          >
            ★
          </text>
        );
      })}
    </svg>
  );
}

export default function Home() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        margin: 0,
        padding: 0,
        zIndex: 0,
      }}
    >
      {/* background */}
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
          background: "rgba(0,0,0,0.70)",
        }}
      />

      {/* content: TOP + BOTTOM */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: "white",
          textAlign: "center",
          padding: "44px 24px",
        }}
      >
        {/* TOP */}
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <h1
              style={{
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: 0.5,
                margin: 0,
                textShadow: "0 6px 18px rgba(0,0,0,0.65)",
              }}
            >
              MotoPortEU
            </h1>
            <EUCrown size={30} />
          </div>

          <p
            style={{
              fontSize: 18,
              opacity: 0.94,
              margin: 0,
              textShadow: "0 4px 12px rgba(0,0,0,0.6)",
            }}
          >
            La rete dei motociclisti europei. Strade.
            <br />
            Viaggi. Libertà.
          </p>
        </div>

        {/* BOTTOM */}
        <div style={{ width: "100%", maxWidth: 520, margin: "0 auto 8px" }}>
          <div style={{ display: "grid", gap: 14, marginBottom: 6 }}>
            <button
              onClick={() => navigate("/routes")}
              style={{
                background: "white",
                color: "black",
                fontWeight: 800,
                padding: "16px 18px",
                borderRadius: 18,
                border: "none",
                fontSize: 18,
                boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
              }}
            >
              Entra
            </button>

            <button
              onClick={() => navigate("/login")}
              style={{
                background: "rgba(0,0,0,0.10)",
                color: "white",
                fontWeight: 800,
                padding: "16px 18px",
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.9)",
                fontSize: 18,
                boxShadow: "0 10px 26px rgba(0,0,0,0.25)",
                backdropFilter: "blur(6px)",
              }}
            >
              Accedi
            </button>
          </div>

          <div style={{ fontSize: 12, opacity: 0.55, marginTop: 8 }}>
            Touring • Tracks • Garage • Meteo
          </div>
        </div>
      </div>
    </div>
  );
}