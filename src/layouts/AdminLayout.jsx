import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchAdminData } from "../lib/api";
import { useState, useEffect, createContext, useContext } from "react";

export const AdminCtx = createContext({});
export function useAdmin() { return useContext(AdminCtx); }

const navItems = [
  { id: "dashboard", path: "/dashboard", icon: "📊", label: "Dashboard" },
  { id: "services", path: "/services", icon: "✂️", label: "Services" },
  { id: "categories", path: "/categories", icon: "📂", label: "Categories" },
  { id: "offers", path: "/offers", icon: "🏷️", label: "Offers" },
  { id: "gallery", path: "/gallery", icon: "🖼️", label: "Gallery" },
  { id: "bookings", path: "/bookings", icon: "📅", label: "Bookings" },
  { id: "qr", path: "/qr", icon: "⬛", label: "QR Codes" },
  { id: "settings", path: "/settings", icon: "⚙️", label: "Settings" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [adminData, setAdminData] = useState({ categories: [], services: [], offers: [], gallery: [], bookings: [], settings: {} });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || "Admin");
    });
    fetchAdminData()
      .then(setAdminData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8f8f6", fontFamily: "Montserrat, sans-serif", fontSize: "0.72rem", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Loading…
      </div>
    );
  }

  return (
    <AdminCtx.Provider value={{ ...adminData, setAdminData, reload: () => fetchAdminData().then(setAdminData) }}>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-text">Essensuals</div>
            <div className="sidebar-logo-sub">Admin Panel</div>
          </div>
          <nav className="sidebar-nav">
            <div className="sidebar-section">Main</div>
            {navItems.slice(0, 6).map(n => (
              <NavLink key={n.id} to={n.path} className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}>
                <span className="sidebar-icon">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
            <div className="sidebar-section">System</div>
            {navItems.slice(6).map(n => (
              <NavLink key={n.id} to={n.path} className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}>
                <span className="sidebar-icon">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
            <div className="sidebar-section">View</div>
            <a href="/" target="_blank" rel="noopener noreferrer" className="sidebar-item">
              <span className="sidebar-icon">🌐</span>
              <span>Live Site</span>
            </a>
          </nav>
        </aside>

        <div className="admin-main">
          <div className="admin-topbar">
            <div className="topbar-title">
              {navItems.find(n => location.pathname.includes(n.id))?.label || "Dashboard"}
            </div>
            <div className="topbar-user">
              <div className="topbar-avatar">{userEmail[0]?.toUpperCase() || "A"}</div>
              <span style={{ fontSize: "0.7rem" }}>{userEmail}</span>
              <button className="tbl-btn" onClick={handleLogout}>Sign out</button>
            </div>
          </div>
          <div className="admin-content">
            <Outlet />
          </div>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
