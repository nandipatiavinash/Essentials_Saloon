import { useAdmin } from "../../layouts/AdminLayout";
import { Link, useNavigate } from "react-router-dom";
import { buildAnalytics, cleanDemographicData } from "../../lib/api";
import { AlertTriangle, Package } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";

export default function Dashboard() {
  const { services, bookings, offers, invoices, customers, inventory, reload } = useAdmin();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  const pendingBookings = bookings?.filter(b => b.status === "pending") || [];
  const analytics = buildAnalytics(invoices || []);

  // Inventory metrics
  const lowStockItems = (inventory || []).filter(item => Number(item.stock_qty) <= Number(item.min_qty));
  const inventoryValue = (inventory || []).reduce((sum, item) => sum + (Number(item.stock_qty) * Number(item.unit_price)), 0);

  const handleResetData = async () => {
    const confirmed = window.confirm(
      "WARNING: This will permanently erase all client profiles, bills/invoices, bookings, cash register reconciliation records, and staff attendance logs.\n\nService categories, service offerings, inventory configurations, and staff members will be preserved.\n\nAre you absolutely sure you want to proceed?"
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      await cleanDemographicData();
      toast.success("Demographic & Transaction database reset successfully!");
      if (reload) await reload();
    } catch (err) {
      toast.error(err.message || "Failed to clear client data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Today Revenue</div>
          <div className="stat-value">Rs {analytics.todayRevenue.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Live billing total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Monthly Revenue</div>
          <div className="stat-value">Rs {analytics.monthlyRevenue.toLocaleString("en-IN")}</div>
          <div className="stat-sub">{analytics.billCount} invoices tracked</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clients</div>
          <div className="stat-value">{customers?.length || 0}</div>
          <div className="stat-sub">Customer database</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Bookings</div>
          <div className="stat-value">{pendingBookings.length}</div>
          <div className="stat-sub">Requires attention</div>
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="table-wrap" style={{ marginTop: "0" }}>
        <div className="table-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="table-title"><Package size={14} style={{ marginRight: 6 }} />Inventory Overview</div>
            {lowStockItems.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.65rem", background: "#fce4ec", color: "#b71c1c", padding: "2px 8px", fontWeight: 700, letterSpacing: "0.06em" }}>
                <AlertTriangle size={11} /> {lowStockItems.length} LOW STOCK
              </span>
            )}
          </div>
          <Link to="/inventory" className="tbl-btn" style={{ textDecoration: "none" }}>Manage Inventory</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", borderTop: "1px solid var(--a-border)" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderRight: "1px solid var(--a-border)" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Total Products</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--a-text)" }}>{(inventory || []).length}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Tracked items</div>
          </div>
          <div style={{ padding: "1.25rem 1.5rem", borderRight: "1px solid var(--a-border)" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Low Stock Alerts</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: lowStockItems.length > 0 ? "#b71c1c" : "var(--a-text)" }}>{lowStockItems.length}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Need reordering</div>
          </div>
          <div style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Stock Valuation</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#c9b99a" }}>Rs {inventoryValue.toLocaleString("en-IN")}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Current cost value</div>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--a-border)", background: "rgba(183,28,28,0.02)" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#b71c1c", marginBottom: "0.75rem", fontWeight: 700 }}>
              <AlertTriangle size={11} style={{ marginRight: 4 }} />Low Stock — Action Required
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {lowStockItems.slice(0, 8).map(item => (
                <div key={item.id} onClick={() => navigate("/inventory")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.75rem", background: "#fce4ec", border: "1px solid #ef9a9a", borderRadius: "2px" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#b71c1c" }}>{item.name}</span>
                  <span style={{ fontSize: "0.6" + "rem", background: "#b71c1c", color: "#fff", padding: "1px 5px", fontWeight: 700 }}>{item.stock_qty} left</span>
                </div>
              ))}
              {lowStockItems.length > 8 && (
                <Link to="/inventory" style={{ fontSize: "0.68rem", color: "#b71c1c", alignSelf: "center", textDecoration: "underline" }}>+{lowStockItems.length - 8} more</Link>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="analytics-grid">
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Recent Inquiries</div>
            <Link to="/bookings" className="btn-add" style={{ textDecoration: "none" }}>View All</Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings?.slice(0, 5).map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--a-muted)" }}>{b.phone}</div>
                  </td>
                  <td>{b.service || "—"}</td>
                  <td>
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                  </td>
                </tr>
              ))}
              {(!bookings || bookings.length === 0) && (
                <tr><td colSpan="3" style={{ textAlign: "center", padding: "2rem", color: "var(--a-faint)" }}>No recent bookings</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-title">Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link to="/billing" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Create Bill</Link>
            <Link to="/analytics" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>View Analytics</Link>
            <Link to="/imports" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Import Sales</Link>
            <Link to="/services" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Manage Services</Link>
            <button
              onClick={handleResetData}
              disabled={resetting}
              className="tbl-btn"
              style={{
                textAlign: "center",
                display: "block",
                padding: "0.8rem",
                color: "#b71c1c",
                borderColor: "#b71c1c",
                background: "transparent",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              {resetting ? "Resetting Database..." : "⚠️ Reset Database"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
