import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchAdminData } from "../lib/api";
import { buildWhatsAppLink, formatAdminBookingMessage } from "../lib/whatsapp";
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import toast from "react-hot-toast";

export const AdminCtx = createContext({});
export function useAdmin() { return useContext(AdminCtx); }

// ── Notification sound via Web Audio API (no external files needed) ──────────
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Two-tone pleasant chime: 880 Hz then 1100 Hz
    [{ freq: 880, start: 0 }, { freq: 1100, start: 0.2 }].forEach(({ freq, start }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.28, ctx.currentTime + start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.55);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.6);
    });
  } catch (_) { /* browser blocked audio */ }
}

const mainNav = [
  { id: "dashboard",  path: "/dashboard",  icon: "📊", label: "Dashboard" },
  { id: "billing",    path: "/billing",    icon: "🧾", label: "Billing POS" },
  { id: "clients",    path: "/clients",    icon: "👤", label: "Clients" },
  { id: "membership", path: "/membership", icon: "⭐", label: "Membership" },
  { id: "attendance", path: "/attendance", icon: "👥", label: "HR / Attendance" },
  { id: "register",   path: "/register",   icon: "💵", label: "Cash Register" },
];
const contentNav = [
  { id: "services",   path: "/services",   icon: "✂️",  label: "Services" },
  { id: "categories", path: "/categories", icon: "📂", label: "Categories" },
  { id: "offers",     path: "/offers",     icon: "🏷️", label: "Offers" },
  { id: "gallery",    path: "/gallery",    icon: "🖼️", label: "Gallery" },
  { id: "settings",   path: "/settings",   icon: "⚙️", label: "Settings" },
];
const systemNav = [
  { id: "analytics",  path: "/analytics",  icon: "📈", label: "Analytics" },
  { id: "reports",    path: "/reports",    icon: "💬", label: "Reports" },
  { id: "bookings",   path: "/bookings",   icon: "📅", label: "Bookings" },
  { id: "inventory",  path: "/inventory",  icon: "📦", label: "Inventory" },
];
const navItems = [...mainNav, ...contentNav, ...systemNav];

// ── Booking notification popup card ─────────────────────────────────────────
function BookingNotifCard({ notif, settings, onDismiss }) {
  const [secondsLeft, setSecondsLeft] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(timer); onDismiss(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDismiss]);

  const openWhatsApp = () => {
    const msg  = formatAdminBookingMessage(notif.booking, settings);
    const link = buildWhatsAppLink(notif.booking.phone, msg);
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const b = notif.booking;
  const timeStr = new Date(notif.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      background: "var(--a-surface, #1a1a18)",
      border: "1px solid var(--gold, #c9a84c)",
      borderLeft: "4px solid var(--gold, #c9a84c)",
      borderRadius: "4px",
      padding: "1rem 1.25rem",
      boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      width: "340px",
      fontFamily: "'Montserrat', sans-serif",
      animation: "notifSlideIn 0.35s cubic-bezier(.22,.68,0,1.2) both",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{
            display: "inline-block",
            width: 8, height: 8,
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 6px #22c55e",
            animation: "pulse 1.2s infinite",
          }} />
          <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gold, #c9a84c)" }}>
            New Booking
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.6rem", color: "#666" }}>{timeStr} · {secondsLeft}s</span>
          <button
            onClick={onDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#666", fontSize: "1rem", lineHeight: 1, padding: "0 2px" }}
          >✕</button>
        </div>
      </div>

      {/* Booking details */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--a-text, #f0ede8)", marginBottom: "0.2rem" }}>{b.name}</div>
        <div style={{ fontSize: "0.7rem", color: "#999" }}>{b.phone}</div>
        {b.service && (
          <div style={{ fontSize: "0.72rem", color: "var(--a-muted, #aaa)", marginTop: "0.3rem" }}>
            Service: <strong style={{ color: "var(--a-text, #f0ede8)" }}>{b.service}</strong>
          </div>
        )}
        {b.date && (
          <div style={{ fontSize: "0.72rem", color: "var(--a-muted, #aaa)" }}>
            Date: <strong style={{ color: "var(--a-text, #f0ede8)" }}>{new Date(b.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong>
            {b.time && <span> at <strong style={{ color: "var(--a-text, #f0ede8)" }}>{b.time}</strong></span>}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {b.phone && (
          <button
            onClick={openWhatsApp}
            style={{
              flex: 1,
              background: "#25D366",
              color: "#fff",
              border: "none",
              borderRadius: "3px",
              padding: "0.45rem 0.5rem",
              fontSize: "0.7rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.04em",
            }}
          >
            WhatsApp Customer
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{
            flex: 1,
            background: "transparent",
            color: "var(--a-muted, #aaa)",
            border: "1px solid var(--a-border, #333)",
            borderRadius: "3px",
            padding: "0.45rem 0.5rem",
            fontSize: "0.7rem",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Dismiss
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div style={{ marginTop: "0.75rem", height: "2px", background: "var(--a-border, #333)", borderRadius: "1px" }}>
        <div style={{
          height: "100%",
          background: "var(--gold, #c9a84c)",
          borderRadius: "1px",
          width: `${(secondsLeft / 30) * 100}%`,
          transition: "width 1s linear",
        }} />
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [adminData, setAdminData]             = useState({ categories: [], services: [], offers: [], gallery: [], bookings: [], settings: {}, inventory: [] });
  const [loading, setLoading]                 = useState(true);
  const [userEmail, setUserEmail]             = useState("");
  const [hasAlertedLowStock, setHasAlertedLowStock] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("admin_sidebar_collapsed") === "true");
  const [mobileOpen, setMobileOpen]           = useState(false);

  // Notification queue — each entry: { id, booking, timestamp }
  const [notifications, setNotifications]     = useState([]);
  const adminDataRef = useRef(adminData);
  adminDataRef.current = adminData;

  // ── Reload helper ──────────────────────────────────────────────────────────
  const reload = useCallback(() => fetchAdminData().then(setAdminData), []);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email || "Admin");
    });
    fetchAdminData()
      .then(setAdminData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Low stock toast (kept) ─────────────────────────────────────────────────
  useEffect(() => {
    if (adminData.inventory && adminData.inventory.length > 0 && !hasAlertedLowStock) {
      const lowStockItems = adminData.inventory.filter(
        item => Number(item.stock_qty) <= Number(item.min_qty)
      );
      if (lowStockItems.length > 0) {
        setHasAlertedLowStock(true);
        toast.error(
          `⚠️ Low Stock Alert: ${lowStockItems.length} item(s) are low on stock! (${lowStockItems.slice(0, 3).map(i => i.name).join(", ")}${lowStockItems.length > 3 ? "..." : ""})`,
          { duration: 6000 }
        );
      }
    }
  }, [adminData.inventory, hasAlertedLowStock]);

  // ── Supabase Realtime subscriptions ───────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime-v1")

      // New booking → popup + sound + reload
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, (payload) => {
        const booking = payload.new;
        playNotifSound();
        setNotifications(prev => [
          { id: booking.id || Date.now(), booking, timestamp: Date.now() },
          ...prev,
        ]);
        // Reload admin data so bookings list updates instantly
        fetchAdminData().then(setAdminData);
      })

      // Any invoice change (new bill, update) → silent reload
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        fetchAdminData().then(setAdminData);
      })

      // Any customer change → silent reload
      .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => {
        fetchAdminData().then(setAdminData);
      })

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Close sidebar on route change (mobile) ─────────────────────────────────
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const dismissNotif = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8f8f6", fontFamily: "Montserrat, sans-serif", fontSize: "0.72rem", color: "#999", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Loading…
      </div>
    );
  }

  return (
    <AdminCtx.Provider value={{ ...adminData, setAdminData, reload, notifications }}>
      {/* ── Keyframe styles ──────────────────────────────────────────────── */}
      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateX(60px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>

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
                {/* Live badge on bookings nav item */}
                {n.id === "bookings" && notifications.length > 0 && (
                  <span style={{
                    marginLeft: "auto",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: "999px",
                    minWidth: 16,
                    textAlign: "center",
                  }}>{notifications.length}</span>
                )}
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
                style={{ padding: "0.4rem 0.6rem", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid var(--a-border)", cursor: "pointer" }}
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
              {/* Notification bell */}
              {notifications.length > 0 && (
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>🔔</span>
                  <span style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>{notifications.length}</span>
                </div>
              )}
              <div className="topbar-avatar">{userEmail[0]?.toUpperCase() || "A"}</div>
              <span className="topbar-email" style={{ fontSize: "0.7rem" }}>{userEmail}</span>
              <button className="tbl-btn" onClick={handleLogout}>Sign out</button>
            </div>
          </div>
          <div className="admin-content">
            <Outlet />
          </div>
        </div>
      </div>

      {/* ── Booking notification popups (bottom-right, stacked) ──────────── */}
      {notifications.length > 0 && (
        <div style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          alignItems: "flex-end",
        }}>
          {notifications.slice(0, 3).map(notif => (
            <BookingNotifCard
              key={notif.id}
              notif={notif}
              settings={adminData.settings}
              onDismiss={() => dismissNotif(notif.id)}
            />
          ))}
          {notifications.length > 3 && (
            <div style={{
              fontSize: "0.65rem",
              color: "#999",
              textAlign: "right",
              padding: "0.25rem 0.5rem",
              background: "rgba(0,0,0,0.5)",
              borderRadius: "3px",
            }}>
              +{notifications.length - 3} more new booking{notifications.length - 3 > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </AdminCtx.Provider>
  );
}
