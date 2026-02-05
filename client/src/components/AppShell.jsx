// client/src/components/AppShell.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

export default function AppShell() {
  return (
    <div className="min-h-screen relative">
      {/* Navbar desktop */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Contenuto: padding bottom per non finire sotto la bottom nav su mobile */}
      <main className="pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom nav mobile: è fixed quindi NON deve mai finire “in fondo alla pagina” */}
      <BottomNav />
    </div>
  );
}