import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchAdminData } from "../lib/api";
import { useState, useEffect, createContext, useContext } from "react";

export const AdminCtx = createContext({});
export function useAdmin() { return useContext(AdminCtx); }

const mainNav = [
  { id: "dashboard", path: "/dashboard", icon: "📊", label: "Dashboard" },
  { id: "billing", path: "/billing", icon: "🧾", label: "Billing POS" },
  { id: "clients", path: "/clients", icon: "👤", label: "Clients" },
  { id: "membership", path: "/membership", icon: "⭐", label: "Membership" },
  { id: "attendance", path: "/attendance", icon: "👥", label: "HR / Attendance" },
  { id: "register", path: "/register", icon: "💵", label: "Cash Register" },
];

const contentNav = [
  { id: "services", path: "/services", icon: "✂️", label: "Services" },
  { id: "categories", path: "/categories", icon: "📂", label: "Categories" },
  { id: "offers", path: "/offers", icon: "🏷️", label: "Offers" },
  { id: "gallery", path: "/gallery", icon: "🖼️", label: "Gallery" },
  { id: "bookings", path: "/bookings", icon: "📅", label: "Bookings" },
  { id: "inventory", path: "/inventory", icon: "📦", label: "Inventory" },
];

const systemNav = [
  { id: "analytics", path: "/analytics", icon: "📈", label: "Analytics" },
  { id: "reports", path: "/reports", icon: "💬", label: "Reports" },
  { id: "settings", path: "/settings", icon: "⚙️", label: "Settings" },
];

const navItems = [...mainNav, ...contentNav, ...systemNav];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminData, setAdminData] = useState({ categories: [], services: [], offers: [], gallery: [], bookings: [], settings: {} });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("admin_sidebar_collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || "Admin");
    });
    fetchAdminData()
      .then(setAdminData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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
      <div className={`admin-shell${sidebarCollapsed ? " collapsed" : ""}`}>
        {mobileOpen && (
          <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
        )}
        <aside className={`admin-sidebar${sidebarCollapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
          <div className="sidebar-logo">
            <div className="sidebar-logo-text" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--gold)" }}>
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <line x1="9.8" y1="8.2" x2="22" y2="20"></line>
                <line x1="9.8" y1="15.8" x2="22" y2="4"></line>
              </svg>
              <span>Essensuals <em style={{ fontStyle: "normal", color: "var(--gold)" }}>Gorantla</em></span>
            </div>
            <div className="sidebar-logo-sub">Admin Panel</div>
          </div>
          <nav className="sidebar-nav">
            <div className="sidebar-section">Main</div>
            {mainNav.map(n => (
              <NavLink key={n.id} to={n.path} className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}>
                <span className="sidebar-icon">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
            <div className="sidebar-section">System</div>
            {systemNav.map(n => (
              <NavLink key={n.id} to={n.path} className={({ isActive }) => `sidebar-item${isActive ? " active" : ""}`}>
                <span className="sidebar-icon">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            ))}
            <div className="sidebar-section">Content</div>
            {contentNav.map(n => (
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
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                type="button"
                className="tbl-btn"
                onClick={() => {
                  if (window.innerWidth <= 768) {
                    setMobileOpen(prev => !prev);
                  } else {
                    setSidebarCollapsed(prev => {
                      const newVal = !prev;
                      localStorage.setItem("admin_sidebar_collapsed", String(newVal));
                      return newVal;
                    });
                  }
                }}
                style={{
                  padding: "0.4rem 0.6rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "1px solid var(--a-border)",
                  cursor: "pointer"
                }}
                aria-label="Toggle Sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </button>
              <div className="topbar-title">
                {navItems.find(n => location.pathname.includes(n.id))?.label || "Dashboard"}
              </div>
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
