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

  const isPremium = !!(user?.isPremium || user?.role === "premium");

  const handleBuyPremium = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token) {
        alert("Devi effettuare il login prima di attivare Premium.");
        window.location.href = "/login";
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
        throw new Error(data?.error || "Errore Stripe");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore nell'avvio del checkout Stripe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <h1 style={styles.title}>🏁 MotoPortEU Premium</h1>
        <p style={styles.subtitle}>
          Sblocca l’esperienza rider completa e sostieni la crescita del progetto.
        </p>
      </div>

      <div style={styles.card}>
        <div style={styles.priceBox}>
          <div style={styles.badge}>PASS ANNUALE</div>
          <h2 style={styles.price}>€ 9,99 / anno</h2>
          <p style={styles.small}>
            Prezzo lancio. Attivazione immediata dopo il pagamento.
          </p>
        </div>

        <ul style={styles.list}>
          <li>✅ Supporto allo sviluppo MotoPortEU</li>
          <li>✅ Badge Premium nel profilo</li>
          <li>✅ Accesso funzioni Premium future</li>
          <li>✅ Priorità su nuove feature rider</li>
          <li>✅ Esperienza pro pronta per la crescita</li>
        </ul>

        {isPremium ? (
          <div style={styles.premiumActive}>
            ✅ Sei già un utente Premium
          </div>
        ) : (
          <button
            onClick={handleBuyPremium}
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Reindirizzamento a Stripe..." : "Attiva Premium"}
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #0b1220 0%, #101a2f 45%, #0f172a 100%)",
    color: "#fff",
    padding: "24px 16px 90px",
  },
  hero: {
    maxWidth: 900,
    margin: "0 auto 24px",
    textAlign: "center",
  },
  title: {
    margin: 0,
    fontSize: "clamp(30px, 5vw, 46px)",
    fontWeight: 800,
  },
  subtitle: {
    marginTop: 10,
    opacity: 0.88,
    fontSize: 16,
  },
  card: {
    maxWidth: 760,
    margin: "0 auto",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
    backdropFilter: "blur(8px)",
  },
  priceBox: {
    textAlign: "center",
    marginBottom: 22,
  },
  badge: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  price: {
    margin: "14px 0 8px",
    fontSize: 38,
  },
  small: {
    margin: 0,
    opacity: 0.8,
  },
  list: {
    margin: "20px 0 28px",
    paddingLeft: 18,
    lineHeight: 1.9,
    fontSize: 16,
  },
  button: {
    width: "100%",
    border: "none",
    borderRadius: 16,
    padding: "16px 18px",
    fontSize: 18,
    fontWeight: 800,
    background: "linear-gradient(90deg, #f59e0b, #fb7185)",
    color: "#111827",
  },
  premiumActive: {
    marginTop: 18,
    textAlign: "center",
    padding: 16,
    borderRadius: 16,
    background: "rgba(34,197,94,0.18)",
    border: "1px solid rgba(34,197,94,0.35)",
    fontWeight: 700,
  },
};