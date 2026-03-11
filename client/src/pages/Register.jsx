import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL || "https://motoporteu.onrender.com";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Registrazione non riuscita");
      }

      // salviamo token/user se il backend li restituisce
      if (data?.token) {
        localStorage.setItem("token", data.token);
      }

      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      } else {
        // fallback: utente appena creato ma non premium
        localStorage.setItem(
          "user",
          JSON.stringify({
            name: form.name,
            email: form.email,
            role: "user",
            isPremium: false,
            passActive: false,
          })
        );
      }

      navigate("/premium");
    } catch (err) {
      console.error(err);
      alert(err.message || "Errore durante la registrazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Crea il tuo account</h1>
        <p style={styles.subtitle}>
          Registrati per attivare il Pass MotoPortEU ed entrare nell’app.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            name="name"
            type="text"
            placeholder="Nome"
            value={form.name}
            onChange={handleChange}
            required
            style={styles.input}
          />

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            style={styles.input}
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            style={styles.input}
          />

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Registrazione..." : "Registrati e continua"}
          </button>
        </form>

        <p style={styles.footer}>
          Hai già un account?{" "}
          <Link to="/login" style={styles.link}>
            Accedi
          </Link>
        </p>
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
    maxWidth: 520,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: 28,
    color: "#fff",
  },
  title: {
    margin: 0,
    fontSize: 34,
  },
  subtitle: {
    marginTop: 10,
    opacity: 0.9,
    lineHeight: 1.6,
  },
  form: {
    marginTop: 18,
    display: "grid",
    gap: 12,
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 16,
    outline: "none",
  },
  button: {
    marginTop: 8,
    border: "none",
    borderRadius: 14,
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 900,
    background: "linear-gradient(90deg, #f59e0b, #fb7185)",
    color: "#111827",
  },
  footer: {
    marginTop: 18,
    opacity: 0.9,
  },
  link: {
    color: "#ffd54a",
    fontWeight: 800,
  },
};