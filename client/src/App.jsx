import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Map from "./pages/Map";
import Garage from "./pages/Garage";
import Suppliers from "./pages/Suppliers";
import Pass from "./pages/Pass";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SupplierPage from "./pages/SupplierPage";
import RoutesPage from "./pages/Routes";
import Tracks from "./pages/Tracks";
import Passes from "./pages/Passes";

import MyTracks from "./pages/MyTracks";
import MyTrackDetail from "./pages/MyTrackDetail";

import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public (no navbar) */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Private (with navbar) */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/map" element={<Map />} />
          <Route path="/garage" element={<Garage />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/supplier/:id" element={<SupplierPage />} />
          <Route path="/pass" element={<Pass />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/tracks" element={<Tracks />} />
          <Route path="/passes" element={<Passes />} />

          {/* GPS history */}
          <Route path="/my-tracks" element={<MyTracks />} />
          <Route path="/my-tracks/:id" element={<MyTrackDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}