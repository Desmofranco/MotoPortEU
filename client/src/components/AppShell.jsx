// client/src/components/AppShell.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

export default function AppShell() {
  return (
    <div className="min-h-screen relative w-full overflow-x-hidden">
      {/* Navbar desktop */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Contenuto: padding bottom per non finire sotto la bottom nav su mobile */}
      <main className="w-full max-w-full overflow-x-hidden pb-20 md:pb-0 px-3 md:px-6">
        <Outlet />
      </main>

      {/* Bottom nav mobile */}
      <BottomNav />

      {/* Hard guard: se qualche componente sfora, non deve allargare la pagina */}
      <style>{`
        html, body { max-width: 100%; overflow-x: hidden; }
      `}</style>
    </div>
  );
}