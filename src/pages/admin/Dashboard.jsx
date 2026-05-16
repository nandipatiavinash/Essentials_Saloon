import { useAdmin } from "../../layouts/AdminLayout";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { services, bookings, gallery, offers } = useAdmin();

  const pendingBookings = bookings?.filter(b => b.status === "pending") || [];
  const revenueToday = 0; // Mock or calculate from completed bookings if prices exist

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Pending Bookings</div>
          <div className="stat-value">{pendingBookings.length}</div>
          <div className="stat-sub">Requires attention</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Services</div>
          <div className="stat-value">{services?.filter(s => s.active).length || 0}</div>
          <div className="stat-sub">Out of {services?.length || 0} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Offers</div>
          <div className="stat-value">{offers?.length || 0}</div>
          <div className="stat-sub">Live on site</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Gallery Items</div>
          <div className="stat-value">{gallery?.length || 0}</div>
          <div className="stat-sub">Published photos</div>
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
            <Link to="/services" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Manage Services</Link>
            <Link to="/gallery" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Upload to Gallery</Link>
            <Link to="/offers" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Update Offers</Link>
            <Link to="/settings" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Salon Settings</Link>
          </div>
        </div>
      </div>
    </>
  );
}
