import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://motoporteu.onrender.com";

export default function PremiumSuccess() {
  const [status, setStatus] = useState("Attivazione Pass in corso...");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const isPremiumUser = (user) => {
      return !!(
        user?.isPremium ||
        user?.passActive ||
        user?.role === "premium"
      );
    };

    const syncUser = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setStatus("Pagamento completato. Effettua il login per continuare.");
        return;
      }

      const maxAttempts = 6;

      for (let i = 1; i <= maxAttempts; i++) {
        if (cancelled) return;

        setAttempt(i);
        setStatus(
          i === 1
            ? "Verifica attivazione Pass in corso..."
            : `Sincronizzazione profilo in corso... tentativo ${i}/${maxAttempts}`
        );

        try {
          const res = await fetch(`${API_URL}/api/auth/refresh-token`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const data = await res.json().catch(() => null);

          if (res.ok && data?.token && data?.user) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            // compatibilità con eventuali chiavi legacy già usate nell'app
            localStorage.setItem("mp_token", data.token);
            localStorage.setItem("mp_user", JSON.stringify(data.user));

            if (isPremiumUser(data.user)) {
              setStatus("✅ Pass attivato correttamente! Reindirizzamento...");

              setTimeout(() => {
                window.location.href = "/routes";
              }, 1200);

              return;
            }
          }

          // fallback: controllo profilo dal DB
          const meRes = await fetch(`${API_URL}/api/auth/me`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const meData = await meRes.json().catch(() => null);

          if (meRes.ok && meData?.user) {
            localStorage.setItem("user", JSON.stringify(meData.user));
            localStorage.setItem("mp_user", JSON.stringify(meData.user));

            if (isPremiumUser(meData.user)) {
              setStatus(
                "✅ Pass attivo nel profilo. Aggiornamento sessione in corso..."
              );

              // se /me vede premium ma refresh-token non ha ancora dato token nuovo,
              // aspettiamo un attimo e ritentiamo
            }
          }
        } catch (err) {
          console.error("Premium sync error:", err);
        }

        if (i < maxAttempts) {
          await wait(1500);
        }
      }

      if (!cancelled) {
        setStatus(
          "Pagamento completato, ma la sincronizzazione del profilo richiede ancora qualche secondo. Riapri l’app oppure effettua di nuovo il login."
        );
      }
    };

    syncUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🏍️ Pagamento completato</h1>
        <p style={styles.text}>{status}</p>

        {attempt > 0 && (
          <p style={styles.subtext}>Tentativo sincronizzazione: {attempt}</p>
        )}

        <div style={styles.actions}>
          <button
            style={styles.buttonPrimary}
            onClick={() => {
              window.location.href = "/routes";
            }}
          >
            Vai agli itinerari
          </button>

          <button
            style={styles.buttonSecondary}
            onClick={() => {
              window.location.href = "/login";
            }}
          >
            Vai al login
          </button>
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
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
  },
  text: {
    marginTop: 14,
    fontSize: 18,
    opacity: 0.95,
  },
  subtext: {
    marginTop: 10,
    fontSize: 14,
    opacity: 0.72,
  },
  actions: {
    marginTop: 24,
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  buttonPrimary: {
    padding: "12px 18px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    background: "#f7c948",
    color: "#1a1a1a",
  },
  buttonSecondary: {
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    background: "transparent",
    color: "#fff",
  },
};