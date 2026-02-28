// client/src/components/AppShell.jsx
import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

export default function AppShell() {
  const { pathname } = useLocation();

  // ✅ Mostra la bottom nav SOLO dove serve davvero su mobile.
  // Cambia liberamente questa lista.
  const SHOW_BOTTOMNAV_ON = ["/", "/map"]; // Home + Mappa (esempio)
  const showBottomNav = SHOW_BOTTOMNAV_ON.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p)
  );

  return (
    <div className="min-h-screen relative w-full overflow-x-hidden">
      {/* Navbar desktop */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Contenuto: padding bottom SOLO se la bottom nav è visibile */}
      <main
        className={`w-full max-w-full overflow-x-hidden px-3 md:px-6 ${
          showBottomNav ? "pb-20 md:pb-0" : "pb-0"
        }`}
      >
        <Outlet />
      </main>

      {/* Bottom nav mobile */}
      {showBottomNav ? <BottomNav /> : null}

      {/* Hard guard: se qualche componente sfora, non deve allargare la pagina */}
      <style>{`
        html, body { max-width: 100%; overflow-x: hidden; }
      `}</style>
    </div>
  );
}