import React from "react";
import { useNavigate } from "react-router-dom";
import BG from "../assets/home-moto.jpg";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG})` }}
      />

      {/* overlay scuro */}
      <div className="absolute inset-0 bg-black/70" />

      {/* contenuto */}
      <div className="relative z-10 h-full flex items-center justify-center text-white">
        <div className="text-center px-6 max-w-xl">
          <h1 className="text-4xl md:text-6xl font-bold tracking-wide mb-4">
            MotoPortEU
          </h1>

          <p className="text-lg md:text-xl opacity-90 mb-8">
            La rete dei motociclisti europei.
            Strade. Viaggi. Libertà.
          </p>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => navigate("/routes")}
              className="bg-white text-black font-semibold py-3 rounded-xl hover:opacity-90 transition"
            >
              Entra
            </button>

            <button
              onClick={() => navigate("/login")}
              className="border border-white py-3 rounded-xl hover:bg-white hover:text-black transition"
            >
              Accedi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}