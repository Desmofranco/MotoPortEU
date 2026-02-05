import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const TOKEN_KEY = "token";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    setErr("");

    if (!email.trim() || !password.trim()) {
      setErr("Inserisci email e password.");
      return;
    }

    // ✅ token demo
    localStorage.setItem(TOKEN_KEY, `demo_${Date.now()}`);
    navigate("/routes", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#061417] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-6 shadow-xl text-white">
        <h2 className="text-2xl font-bold mb-2">Login</h2>

        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-white outline-none"
          />

          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-200 text-sm">
              {err}
            </div>
          )}

          <button className="w-full rounded-xl bg-white/15 border border-white/20 py-3 font-semibold">
            Sign In
          </button>
        </form>

        <div className="mt-5 text-sm text-white/70">
          Non hai un account?{" "}
          <Link to="/register" className="text-white underline">
            Registrati
          </Link>
        </div>
      </div>
    </div>
  );
}