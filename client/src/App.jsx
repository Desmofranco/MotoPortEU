import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Garage from "./pages/Garage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RoutesPage from "./pages/Routes";
import Tracks from "./pages/Tracks";
import MyTrackDetail from "./pages/MyTrackDetail";
import Map from "./pages/Map";
import Faq from "./pages/Faq";
import Terms from "./pages/Terms";
import Premium from "./pages/Premium";
import PremiumSuccess from "./pages/PremiumSuccess";

import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import Privacy from "./pages/Privacy";
import {
  setInstallPrompt,
  clearInstallPrompt,
} from "./utils/installPrompt";

function InnerLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleAppInstalled = () => {
      clearInstallPrompt();
      console.log("✅ MotoPortEU installata");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/premium" element={<Premium />} />
        <Route path="/premium-success" element={<PremiumSuccess />} />
<Route path="/privacy" element={<Privacy />} />
        <Route
          path="/routes"
          element={
            <RequireAuth>
              <InnerLayout>
                <RoutesPage />
              </InnerLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/tracks"
          element={
            <RequireAuth>
              <InnerLayout>
                <Tracks />
              </InnerLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/tracks/:id"
          element={
            <RequireAuth>
              <InnerLayout>
                <MyTrackDetail />
              </InnerLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/map"
          element={
            <RequireAuth>
              <InnerLayout>
                <Map />
              </InnerLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/garage"
          element={
            <RequireAuth>
              <InnerLayout>
                <Garage />
              </InnerLayout>
            </RequireAuth>
          }
        />

        <Route
          path="/faq"
          element={
            <InnerLayout>
              <Faq />
            </InnerLayout>
          }
        />

        <Route
          path="/terms"
          element={
            <InnerLayout>
              <Terms />
            </InnerLayout>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}