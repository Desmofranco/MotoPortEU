import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authBg from "../assets/auth-bg.jpg";
import "../styles/auth.css";

const BG = authBg;

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 👉 QUI integra la tua API reale di registrazione
      // esempio:
      // const res = await fetch(`${API_URL}/auth/register`, {...})
      // if (!res.ok) throw new Error("Registrazione fallita")
      // const data = await res.json()
      // localStorage.setItem("token", data.token)

      await new Promise((r) => setTimeout(r, 400));
navigate("/routes", { replace: true });
    } catch (err) {
      setError(err?.message || "Errore durante la registrazione.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-bg" style={{ backgroundImage: `url(${BG})` }} />
      <div className="auth-overlay" />

      <div className="auth-content">
        <div className="auth-container">
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div className="auth-badge">
            </div>
            <h1 className="auth-title">Register</h1>
            <p className="auth-subtitle">
              Crea un account e inizia a registrare i giri.
            </p>
          </div>

          <div className="auth-card">
            {error && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={onSubmit}>
              <div className="auth-row">
                <label className="auth-label">Email</label>
                <input
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  required
                />
              </div>

              <div className="auth-row">
                <label className="auth-label">Password</label>
                <input
                  className="auth-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <p
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  Suggerito: almeno 8 caratteri.
                </p>
              </div>

              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? "Creazione..." : "Register"}
              </button>
            </form>

            <div className="auth-linkrow">
              Hai già un account? <Link to="/login">Login</Link>
            </div>
          </div>

          <div className="auth-footer">
            © {new Date().getFullYear()} MotoPortEU
          </div>
        </div>
      </div>
    </div>
  );
}