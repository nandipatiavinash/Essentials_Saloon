import { useAdmin } from "../../layouts/AdminLayout";
import { Link } from "react-router-dom";
import { buildAnalytics } from "../../lib/api";

export default function Dashboard() {
  const { services, bookings, gallery, offers, invoices, customers } = useAdmin();

  const pendingBookings = bookings?.filter(b => b.status === "pending") || [];
  const analytics = buildAnalytics(invoices || []);

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
          </div>
        </div>
      </div>
    </>
  );
}
