import React, { useMemo, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://motoporteu.onrender.com";

export default function Premium() {
  const [loading, setLoading] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const isPremium = !!(user?.isPremium || user?.passActive || user?.role === "premium");

  const handleCheckout = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token) {
        alert("Devi prima registrarti o effettuare il login.");
        window.location.href = "/register";
        return;
      }

      const res = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Errore nell'avvio del pagamento");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore Stripe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.badge}>ACCESSO APP</div>
        <h1 style={styles.title}>🏍️ MotoPortEU Pass</h1>
        <p style={styles.subtitle}>
          Per entrare nell’app e usare itinerari, circuiti, navigatore e garage,
          è necessario attivare il Pass.
        </p>

        <div style={styles.priceCard}>
          <div style={styles.priceLabel}>PASS ANNUALE</div>
          <div style={styles.price}>€ 9,99 / anno</div>
          <div style={styles.note}>Accesso completo a MotoPortEU</div>
        </div>

        <ul style={styles.list}>
          <li>✅ Accesso agli itinerari</li>
          <li>✅ Accesso ai circuiti</li>
          <li>✅ Accesso al navigatore</li>
          <li>✅ Accesso al garage</li>
          <li>✅ Supporto diretto allo sviluppo della piattaforma</li>
        </ul>

        {isPremium ? (
          <div style={styles.successBox}>
            ✅ Pass attivo. Puoi entrare nell’app.
            <div style={{ marginTop: 14 }}>
              <a href="/routes" style={styles.enterButton}>
                Entra negli Itinerari
              </a>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCheckout}
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Reindirizzamento a Stripe..." : "Attiva Pass"}
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b1428 0%, #12203d 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  box: {
    width: "100%",
    maxWidth: 720,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 28,
    color: "#fff",
    boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
  },
  badge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: "clamp(30px, 5vw, 46px)",
    margin: "14px 0 10px",
  },
  subtitle: {
    margin: 0,
    opacity: 0.9,
    fontSize: 16,
    lineHeight: 1.6,
  },
  priceCard: {
    marginTop: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 20,
    padding: 20,
    textAlign: "center",
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1,
    opacity: 0.9,
  },
  price: {
    fontSize: 38,
    fontWeight: 900,
    marginTop: 10,
  },
  note: {
    marginTop: 8,
    opacity: 0.8,
  },
  list: {
    marginTop: 22,
    paddingLeft: 22,
    lineHeight: 1.9,
    fontSize: 16,
  },
  button: {
    width: "100%",
    marginTop: 20,
    border: "none",
    borderRadius: 18,
    padding: "16px 18px",
    fontSize: 18,
    fontWeight: 900,
    background: "linear-gradient(90deg, #f59e0b, #fb7185)",
    color: "#111827",
  },
  successBox: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    background: "rgba(34,197,94,0.16)",
    border: "1px solid rgba(34,197,94,0.35)",
    fontWeight: 800,
    textAlign: "center",
  },
  enterButton: {
    display: "inline-block",
    textDecoration: "none",
    background: "#ffffff",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: 14,
    fontWeight: 900,
  },
};