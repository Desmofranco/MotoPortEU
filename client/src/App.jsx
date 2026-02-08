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

import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";

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

          <Route path="/my-tracks/:id" element={<MyTrackDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}