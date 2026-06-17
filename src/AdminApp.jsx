import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import AdminLayout from "./layouts/AdminLayout";
import AdminLogin from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import ServicesManager from "./pages/admin/ServicesManager";
import CategoriesManager from "./pages/admin/CategoriesManager";
import OffersManager from "./pages/admin/OffersManager";
import GalleryManager from "./pages/admin/GalleryManager";
import BookingsManager from "./pages/admin/BookingsManager";
import QRManager from "./pages/admin/QRManager";
import Settings from "./pages/admin/Settings";
import BillingPOS from "./pages/admin/BillingPOS";
import ClientsManager from "./pages/admin/ClientsManager";
import AnalyticsDashboard from "./pages/admin/AnalyticsDashboard";
import ImportSales from "./pages/admin/ImportSales";
import ReportsManager from "./pages/admin/ReportsManager";
import MembershipManager from "./pages/admin/MembershipManager";
import AttendanceManager from "./pages/admin/AttendanceManager";
import InventoryManager from "./pages/admin/InventoryManager";
import CashRegisterManager from "./pages/admin/CashRegisterManager";
import StaffProfile from "./pages/admin/StaffProfile";

function RequireAuth({ children }) {
  const [status, setStatus] = useState("loading"); // loading | authed | unauthed

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "authed" : "unauthed");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setStatus(session ? "authed" : "unauthed");
    });
    return () => subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f8f8f6",fontFamily:"'Montserrat',sans-serif",fontSize:"0.75rem",letterSpacing:"0.1em",color:"#999",textTransform:"uppercase" }}>
        Verifying session…
      </div>
    );
  }
  if (status === "unauthed") return <Navigate to="/login" replace />;
  return children;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="services" element={<ServicesManager />} />
        <Route path="categories" element={<CategoriesManager />} />
        <Route path="offers" element={<OffersManager />} />
        <Route path="gallery" element={<GalleryManager />} />
        <Route path="bookings" element={<BookingsManager />} />
        <Route path="billing" element={<BillingPOS />} />
        <Route path="clients" element={<ClientsManager />} />
        <Route path="membership" element={<MembershipManager />} />
        <Route path="attendance" element={<AttendanceManager />} />
        <Route path="inventory" element={<InventoryManager />} />
        <Route path="register" element={<CashRegisterManager />} />
        <Route path="analytics" element={<AnalyticsDashboard />} />
        <Route path="imports" element={<ImportSales />} />
        <Route path="reports" element={<ReportsManager />} />
        <Route path="qr" element={<QRManager />} />
        <Route path="settings" element={<Settings />} />
        <Route path="staff/:id" element={<StaffProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
