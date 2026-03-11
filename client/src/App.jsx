import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Garage from "./pages/Garage";
import Suppliers from "./pages/Suppliers";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SupplierPage from "./pages/SupplierPage";
import RoutesPage from "./pages/Routes";
import Tracks from "./pages/Tracks";

import MyTrackDetail from "./pages/MyTrackDetail";
import Map from "./pages/Map";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import Faq from "./pages/Faq";
import Terms from "./pages/Terms";
import React, { useEffect, useState } from "react";
import { clearAuthSession, fetchMe, getStoredUser } from "./utils/auth";

const [authUser, setAuthUser] = useState(getStoredUser());
const [authReady, setAuthReady] = useState(false);

useEffect(() => {
  let mounted = true;

  async function bootstrapAuth() {
    try {
      const me = await fetchMe();

      if (mounted && me) {
        localStorage.setItem("mp_user", JSON.stringify(me));
        setAuthUser(me);
      }
    } catch (err) {
      clearAuthSession();
      if (mounted) {
        setAuthUser(null);
      }
    } finally {
      if (mounted) {
        setAuthReady(true);
      }
    }
  }

  bootstrapAuth();

  return () => {
    mounted = false;
  };
}, []);
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Private */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
          
        >
          <Route path="/garage" element={<Garage />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/supplier/:id" element={<SupplierPage />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/tracks" element={<Tracks />} />
          <Route path="/map" element={<Map />} />
          <Route path="/my-tracks/:id" element={<MyTrackDetail />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/terms" element={<Terms />} />
        </Route>
      </Routes>
      
    </BrowserRouter>
  );
}