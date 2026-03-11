import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://motoporteu.onrender.com";

export default function PremiumSuccess() {
  const [status, setStatus] = useState("Verifica attivazione Premium in corso...");

  useEffect(() => {
    const syncUser = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setStatus("Pagamento completato. Effettua il login per aggiornare il profilo.");
          return;
        }

        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (res.ok && data?.user) {
          localStorage.setItem("user", JSON.stringify(data.user));
          setStatus("✅ Premium attivato correttamente!");
        } else {
          setStatus("Pagamento riuscito, ma il profilo non è ancora sincronizzato.");
        }
      } catch (err) {
        console.error(err);
        setStatus("Pagamento riuscito, ma serve una verifica della sincronizzazione.");
      }
    };

    syncUser();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🏍️ Pagamento completato</h1>
        <p style={styles.text}>{status}</p>

        <div style={styles.actions}>
          <a href="/premium" style={styles.secondary}>
            Torna a Premium
          </a>
          <a href="/routes" style={styles.primary}>
            Vai agli Itinerari
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "linear-gradient(180deg, #0b1220 0%, #101a2f 45%, #0f172a 100%)",
  },
  card: {
    width: "100%",
    maxWidth: 680,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 28,
    color: "#fff",
    textAlign: "center",
  },
  title: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: 34,
  },
  text: {
    fontSize: 18,
    opacity: 0.92,
  },
  actions: {
    marginTop: 24,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primary: {
    textDecoration: "none",
    background: "linear-gradient(90deg, #f59e0b, #fb7185)",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: 14,
    fontWeight: 800,
  },
  secondary: {
    textDecoration: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    fontWeight: 700,
  },
};