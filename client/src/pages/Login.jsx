import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authBg from "../assets/auth-bg.jpg";
import "../styles/auth.css";

const BG = authBg;

export default function Login() {
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
      // DEMO login
      await new Promise((r) => setTimeout(r, 300));

      // ✅ SENZA QUESTO /routes ti rimanda in home
      localStorage.setItem("token", "dev-token");

      navigate("/routes", { replace: true });
    } catch (err) {
      setError(err?.message || "Errore durante il login.");
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
            <h1 className="auth-title">Login</h1>
            <p className="auth-subtitle">
              Bentornato. Accedi e riparti con i tuoi giri.
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? "Accesso..." : "Sign In"}
              </button>
            </form>

            <div className="auth-linkrow">
              Non hai un account? <Link to="/register">Registrati</Link>
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