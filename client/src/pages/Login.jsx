import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginRequest, setAuthSession } from "../utils/auth";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();

    if (!email || !password) {
      setError("Compila email e password.");
      return;
    }

    try {
      setLoading(true);

      const data = await loginRequest(email, password);

      setAuthSession(data.token, data.user);
      setSuccess("Accesso effettuato con successo.");

      setTimeout(() => {
        navigate("/");
      }, 500);
    } catch (err) {
      setError(err.message || "Errore durante il login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>🏍️ Accedi a MotoPortEU</h1>
          <p style={styles.subtitle}>
            Entra nel tuo profilo rider e riprendi i tuoi percorsi.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="nome@email.com"
              autoComplete="email"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Inserisci la password"
              autoComplete="current-password"
              style={styles.input}
            />
          </label>

          {error ? <div style={styles.error}>{error}</div> : null}
          {success ? <div style={styles.success}>{success}</div> : null}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>

        <div style={styles.footer}>
          Non hai un account?{" "}
          <Link to="/register" style={styles.link}>
            Registrati
          </Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "linear-gradient(135deg, #0b1220 0%, #111827 45%, #1f2937 100%)",
  },
  card: {
    width: "100%",
    maxWidth: "460px",
    background: "rgba(255,255,255,0.96)",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  },
  header: {
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.2,
    color: "#111827",
  },
  subtitle: {
    margin: "10px 0 0 0",
    color: "#4b5563",
    fontSize: "15px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "14px",
    color: "#111827",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    borderRadius: "14px",
    border: "1px solid #d1d5db",
    padding: "13px 14px",
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    marginTop: "6px",
    border: "none",
    borderRadius: "14px",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    background: "#111827",
    color: "#ffffff",
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
  },
  footer: {
    marginTop: "18px",
    fontSize: "14px",
    color: "#4b5563",
    textAlign: "center",
  },
  link: {
    color: "#111827",
    fontWeight: 700,
    textDecoration: "none",
  },
};