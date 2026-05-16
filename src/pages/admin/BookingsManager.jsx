import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { updateBookingStatus } from "../../lib/api";
import toast from "react-hot-toast";

export default function BookingsManager() {
  const { bookings, reload } = useAdmin();
  const [filter, setFilter] = useState("all"); // all, pending, confirmed, completed, cancelled

  const filtered = bookings?.filter(b => filter === "all" || b.status === filter) || [];

  const handleStatusChange = async (id, status) => {
    try {
      await updateBookingStatus(id, status);
      toast.success(`Booking marked as ${status}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="table-wrap">
      <div className="table-header">
        <div className="table-title">Inquiries & Bookings</div>
        <div className="table-actions">
          <select className="admin-search" value={filter} onChange={e => setFilter(e.target.value)} style={{ width: "auto" }}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date Received</th>
            <th>Customer</th>
            <th>Requested Service</th>
            <th>Preferred Slot</th>
            <th>Notes</th>
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(b => (
            <tr key={b.id}>
              <td>{formatDate(b.created_at)}</td>
              <td>
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--a-muted)" }}>
                  <a href={`tel:${b.phone}`} style={{ color: "inherit", textDecoration: "none" }}>{b.phone}</a>
                </div>
              </td>
              <td>{b.service || "—"}</td>
              <td>
                <div>{b.date ? formatDate(b.date) : "Any Day"}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--a-muted)" }}>{b.time || "Any Time"}</div>
              </td>
              <td>
                {b.notes ? <span title={b.notes}>{b.notes.substring(0, 20)}...</span> : "—"}
              </td>
              <td>
                <span className={`badge badge-${b.status}`}>{b.status}</span>
              </td>
              <td>
                <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                  <select
                    className="admin-search"
                    style={{ padding: "0.3rem", width: "auto" }}
                    value={b.status}
                    onChange={(e) => handleStatusChange(b.id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </td>
            </tr>
          ))}
          {(!filtered || filtered.length === 0) && (
            <tr><td colSpan="7" style={{ textAlign: "center", padding: "3rem", color: "var(--a-faint)" }}>No bookings found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
