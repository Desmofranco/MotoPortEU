import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const TOKEN_KEY = "token";

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      if (!email.trim() || !password.trim()) {
        throw new Error("Inserisci email e password.");
      }
      if (password.trim().length < 4) {
        throw new Error("Password troppo corta (min 4 caratteri).");
      }

      // ✅ DEMO REGISTER: salva token finto e vai dashboard
      const fakeToken = `demo_${Date.now()}_${btoa(email).slice(0, 10)}`;
      localStorage.setItem(TOKEN_KEY, fakeToken);
navigate("/routes", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Errore registrazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#061417] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-6 shadow-xl text-white">
        <h2 className="text-2xl font-bold mb-2">Register</h2>
        <p className="text-white/70 mb-6">Crea un account e inizia a registrare i giri.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-white/70">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@email.com"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white outline-none"
            />
          </div>

          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-200 text-sm">
              {err}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-white/15 border border-white/20 py-3 font-semibold disabled:opacity-60"
          >
            {loading ? "Creazione..." : "Register"}
          </button>
        </form>

        <div className="mt-5 text-sm text-white/70">
          Hai già un account?{" "}
          <Link to="/login" className="text-white underline">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}