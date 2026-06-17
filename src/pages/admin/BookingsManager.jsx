import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { updateBookingStatus, updateBooking, format12HourTime } from "../../lib/api";
import SearchableStaffDropdown from "../../components/SearchableStaffDropdown";
import toast from "react-hot-toast";
import { Calendar, CheckSquare, XCircle, Clock, Edit2 } from "lucide-react";

export default function BookingsManager() {
  const { bookings, staff, reload } = useAdmin();
  const [activeTab, setActiveTab] = useState("pending"); // pending, confirmed, completed, cancelled
  const [editModal, setEditModal] = useState(null); // null or booking object
  const [saving, setSaving] = useState(false);

  const filtered = bookings?.filter(b => b.status === activeTab) || [];

  const handleStatusChange = async (id, status) => {
    try {
      await updateBookingStatus(id, status);
      toast.success(`Booking marked as ${status}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveBooking = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateBooking(editModal.id, {
        status: editModal.status,
        follow_up_date: editModal.follow_up_date || null,
        follow_up_notes: editModal.follow_up_notes || null,
        assigned_staff: editModal.assigned_staff || null,
      });
      toast.success("Booking details updated");
      setEditModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Badge counts
  const counts = {
    pending: bookings?.filter(b => b.status === "pending").length || 0,
    confirmed: bookings?.filter(b => b.status === "confirmed").length || 0,
    completed: bookings?.filter(b => b.status === "completed").length || 0,
    cancelled: bookings?.filter(b => b.status === "cancelled").length || 0,
  };

  return (
    <>
      {/* Tabs */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <button 
          className={`tbl-btn ${activeTab === "pending" ? "active" : ""}`} 
          onClick={() => setActiveTab("pending")}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Calendar size={14} /> Open ({counts.pending})
        </button>
        <button 
          className={`tbl-btn ${activeTab === "confirmed" ? "active" : ""}`} 
          onClick={() => setActiveTab("confirmed")}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <Clock size={14} /> Pending / Follow-up ({counts.confirmed})
        </button>
        <button 
          className={`tbl-btn ${activeTab === "completed" ? "active" : ""}`} 
          onClick={() => setActiveTab("completed")}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <CheckSquare size={14} /> Closed ({counts.completed})
        </button>
        <button 
          className={`tbl-btn ${activeTab === "cancelled" ? "active" : ""}`} 
          onClick={() => setActiveTab("cancelled")}
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <XCircle size={14} /> Cancelled ({counts.cancelled})
        </button>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">
            {activeTab === "pending" && "Open Inquiries"}
            {activeTab === "confirmed" && "Pending & Follow-up Bookings"}
            {activeTab === "completed" && "Closed Bookings"}
            {activeTab === "cancelled" && "Cancelled Inquiries"}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date Received</th>
              <th>Customer</th>
              <th>Requested Service</th>
              <th>Preferred Slot</th>
              <th>Assigned Staff</th>
              <th>Follow-up Details</th>
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
                  <div style={{ fontSize: "0.68rem", color: "var(--a-muted)" }}>
                    {b.time ? format12HourTime(b.time) : "Any Time"}
                  </div>
                </td>
                <td>
                  {b.assigned_staff ? (
                    <span className="badge badge-gold" style={{ padding: "2px 6px" }}>{b.assigned_staff}</span>
                  ) : "—"}
                </td>
                <td>
                  {b.follow_up_date && (
                    <div style={{ fontSize: "0.7rem", fontWeight: "600", color: "#c9b99a" }}>
                      Next: {formatDate(b.follow_up_date)}
                    </div>
                  )}
                  {b.follow_up_notes && (
                    <div style={{ fontSize: "0.65rem", color: "#888", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.follow_up_notes}>
                      Notes: {b.follow_up_notes}
                    </div>
                  )}
                  {!b.follow_up_date && !b.follow_up_notes && <span style={{ color: "#444" }}>—</span>}
                </td>
                <td>
                  <div className="tbl-actions" style={{ justifyContent: "flex-end", gap: "0.5rem" }}>
                    <button className="tbl-btn" onClick={() => setEditModal(b)}>
                      <Edit2 size={12} style={{ marginRight: 4 }} /> Edit
                    </button>
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

      {editModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Edit Booking & Follow-up Details</div>
              <button className="modal-close" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="edit-booking-form" onSubmit={handleSaveBooking}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Client Name</label>
                    <input className="form-input" value={editModal.name} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status Designation *</label>
                    <select 
                      className="form-input" 
                      value={editModal.status} 
                      onChange={e => setEditModal({ ...editModal, status: e.target.value })}
                      required
                    >
                      <option value="pending">Open (Pending)</option>
                      <option value="confirmed">Pending / Follow-up (Confirmed)</option>
                      <option value="completed">Closed (Completed)</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: "1rem" }}>
                  <div className="form-group" style={{ zIndex: 10 }}>
                    <label className="form-label">Assigned Stylist</label>
                    <SearchableStaffDropdown
                      staffList={staff}
                      value={editModal.assigned_staff || ""}
                      onChange={(val) => setEditModal({ ...editModal, assigned_staff: val })}
                      placeholder="Select Staff"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Follow-up Date</label>
                    <input 
                      type="date" 
                      className="form-input" 
                      value={editModal.follow_up_date || ""} 
                      onChange={e => setEditModal({ ...editModal, follow_up_date: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: "1rem" }}>
                  <label className="form-label">Follow-up / Conversation Notes</label>
                  <textarea 
                    className="form-input" 
                    rows="3" 
                    value={editModal.follow_up_notes || ""} 
                    onChange={e => setEditModal({ ...editModal, follow_up_notes: e.target.value })} 
                    placeholder="Enter notes about follow-up calls, client requests, etc."
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="submit" form="edit-booking-form" className="btn-add" disabled={saving}>{saving ? "Saving..." : "Save Details"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
