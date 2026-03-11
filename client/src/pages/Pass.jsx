import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://motoporteu.onrender.com";

export default function Pass() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const token =
    localStorage.getItem("token") || localStorage.getItem("mp_token");

  const isPremiumUser = (u) =>
    !!(u?.isPremium || u?.passActive || u?.role === "premium");

  useEffect(() => {
    let mounted = true;

    const syncProfile = async () => {
      if (!token) {
        if (mounted) {
          setLoading(false);
          setStatus("Devi effettuare il login per attivare il Pass.");
        }
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.user) {
          if (!mounted) return;

          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
          localStorage.setItem("mp_user", JSON.stringify(data.user));
          setStatus("");
        } else {
          if (!mounted) return;
          setStatus("Non è stato possibile verificare il profilo.");
        }
      } catch (err) {
        console.error("Pass page sync error:", err);
        if (mounted) {
          setStatus("Errore di connessione durante la verifica del profilo.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    syncProfile();

    return () => {
      mounted = false;
    };
  }, [token]);

  const handleActivatePass = async () => {
    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (isPremiumUser(user)) {
      setStatus("Il tuo Pass è già attivo.");
      return;
    }

    try {
      setStatus("Reindirizzamento al pagamento in corso...");

      const res = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "pass",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.url) {
        setStatus(data?.message || "Impossibile avviare il pagamento.");
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Stripe checkout error:", err);
      setStatus("Errore durante l’avvio del pagamento.");
    }
  };

  const premium = isPremiumUser(user);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>🏍️ Pass Annuale</h2>

        {loading ? (
          <p style={styles.text}>Verifica del profilo in corso...</p>
        ) : !token ? (
          <>
            <p style={styles.text}>
              Devi effettuare il login per attivare il Pass Premium.
            </p>
            <button
              style={styles.secondaryButton}
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Vai al login
            </button>
          </>
        ) : premium ? (
          <>
            <p style={styles.success}>✅ Il tuo Pass Premium è attivo.</p>
            <p style={styles.text}>
              Accesso premium abilitato su itinerari, mappe e funzioni avanzate.
            </p>

            <div style={styles.actions}>
              <button
                style={styles.primaryButton}
                onClick={() => {
                  window.location.href = "/routes";
                }}
              >
                Vai agli itinerari
              </button>

              <button
                style={styles.secondaryButton}
                onClick={() => {
                  window.location.href = "/map";
                }}
              >
                Apri navigatore
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={styles.text}>1 mese gratuito → poi 10€/anno.</p>
            <p style={styles.subtext}>
              Attiva il Pass per sbloccare le funzioni premium di MotoPortEU.
            </p>

            <button style={styles.primaryButton} onClick={handleActivatePass}>
              Attiva Pass
            </button>
          </>
        )}

        {!!status && <p style={styles.status}>{status}</p>}
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
    maxWidth: 720,
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
    fontSize: 15,
    opacity: 0.78,
  },
  success: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: 700,
    color: "#8ff0a4",
  },
  status: {
    marginTop: 18,
    fontSize: 14,
    opacity: 0.82,
  },
  actions: {
    marginTop: 20,
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  primaryButton: {
    marginTop: 18,
    padding: "12px 18px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 700,
    background: "#f7c948",
    color: "#1a1a1a",
  },
  secondaryButton: {
    marginTop: 18,
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