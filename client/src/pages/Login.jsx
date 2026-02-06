import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const BG =
  "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=2400&q=80";

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
      // TODO: integra la tua API qui
      // esempio:
      // const res = await fetch(`${API_URL}/auth/login`, { ... })
      // if (!res.ok) throw new Error("Credenziali non valide");
      // const data = await res.json();
      // localStorage.setItem("token", data.token);

      // DEMO: simulazione
      await new Promise((r) => setTimeout(r, 450));

      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Errore durante il login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG})` }}
      />
      {/* Overlay + blur */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-white">
              <span className="text-lg">🏍️</span>
              <span className="font-semibold tracking-wide">MotoPortEU</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold text-white">Login</h1>
            <p className="mt-2 text-white/80">
              Bentornato. Accedi e riparti con i tuoi giri.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl bg-white/95 shadow-2xl border border-black/5 p-6">
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 focus:border-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-black/20 focus:border-slate-400"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-black text-white py-2.5 font-semibold shadow-md hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Accesso..." : "Sign In"}
              </button>
            </form>

            <div className="mt-4 text-sm text-slate-700">
              Non hai un account?{" "}
              <Link
                to="/register"
                className="font-semibold text-blue-600 hover:underline"
              >
                Registrati
              </Link>
            </div>
          </div>

          {/* Footer micro */}
          <p className="mt-6 text-center text-xs text-white/70">
            © {new Date().getFullYear()} MotoPortEU
          </p>
        </div>
      </div>
    </div>
  );
}