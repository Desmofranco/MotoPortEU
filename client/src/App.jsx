import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import Map from "./pages/Map";
import Garage from "./pages/Garage";
import Suppliers from "./pages/Suppliers";
import Pass from "./pages/Pass";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<Map />} />
        <Route path="/garage" element={<Garage />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/pass" element={<Pass />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}
