import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const TOKEN_KEY = "token";

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) navigate("/dashboard", { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#061417] flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-md text-center">
        <h1 className="text-5xl font-extrabold tracking-widest mb-10">MOTOPORT</h1>

        <button
          onClick={() => navigate("/login")}
          className="w-full rounded-2xl bg-white/15 border border-white/20 py-4 text-xl mb-4"
        >
          Sign In
        </button>

        <button
          onClick={() => navigate("/register")}
          className="w-full rounded-2xl bg-white/15 border border-white/20 py-4 text-xl"
        >
          Register
        </button>
      </div>
    </div>
  );
}