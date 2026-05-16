import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import Home from "./pages/public/Home";
import Services from "./pages/public/Services";
import Gallery from "./pages/public/Gallery";
import Offers from "./pages/public/Offers";
import Contact from "./pages/public/Contact";
import QRMenu from "./pages/public/QRMenu";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      {/* QR Menu — no nav/footer, mobile-optimized */}
      <Route path="/menu" element={<QRMenu />} />
      <Route path="/menu/:branch" element={<QRMenu />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
