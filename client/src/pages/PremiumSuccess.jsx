import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://motoporteu.onrender.com";

export default function PremiumSuccess() {
  const [status, setStatus] = useState("Attivazione Pass in corso...");

  useEffect(() => {
    const syncUser = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          setStatus("Pagamento completato. Effettua il login per continuare.");
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

          const isPremium = !!(
            data.user.isPremium ||
            data.user.passActive ||
            data.user.role === "premium"
          );

          if (isPremium) {
            setStatus("✅ Pass attivato correttamente! Reindirizzamento...");
            setTimeout(() => {
              window.location.href = "/routes";
            }, 1200);
          } else {
            setStatus("Pagamento riuscito, ma il profilo non risulta ancora aggiornato.");
          }
        } else {
          setStatus("Pagamento riuscito, ma sincronizzazione profilo da verificare.");
        }
      } catch (err) {
        console.error(err);
        setStatus("Pagamento riuscito, ma serve una verifica del profilo.");
      }
    };

    syncUser();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🏍️ Pagamento completato</h1>
        <p style={styles.text}>{status}</p>
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
    background: "linear-gradient(180deg, #0b1428 0%, #12203d 100%)",
  },
  card: {
    width: "100%",
    maxWidth: 640,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 28,
    color: "#fff",
    textAlign: "center",
  },
  title: {
    margin: 0,
    fontSize: 34,
  },
  text: {
    marginTop: 12,
    fontSize: 18,
    opacity: 0.92,
  },
};