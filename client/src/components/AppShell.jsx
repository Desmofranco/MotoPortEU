import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

export default function AppShell() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Content */}
      <div className="pb-16 md:pb-0">
        <Outlet />
      </div>

      {/* Mobile */}
      <BottomNav />
    </>
  );
}