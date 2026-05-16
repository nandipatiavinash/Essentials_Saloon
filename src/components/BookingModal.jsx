import { useState } from "react";
import { createBooking } from "../lib/api";
import toast from "react-hot-toast";

export default function BookingModal({ services, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", phone: "", service: "", date: "", time: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone is required"); return; }
    setLoading(true);
    try {
      await (onSubmit ? onSubmit(form) : createBooking(form));
      setDone(true);
    } catch (e) {
      toast.error(e.message || "Could not submit booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Reserve Your Appointment</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {done ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✓</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", color: "var(--white)", marginBottom: "0.5rem" }}>Booking Received</div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>We'll confirm via WhatsApp shortly.</div>
              <button className="btn-outline" style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", fontSize: "0.6rem" }} onClick={onClose}>Close</button>
            </div>
          ) : (
            <>
              <div className="form-row" style={{ marginBottom: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone *</label>
                  <input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Service</label>
                <select className="form-input" value={form.service} onChange={e => set("service", e.target.value)}>
                  <option value="">Select a service (optional)</option>
                  {services.filter(s => s.active).map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row" style={{ marginBottom: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Preferred Date</label>
                  <input type="date" className="form-input" value={form.date} min={new Date().toISOString().split("T")[0]} onChange={e => set("date", e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Preferred Time</label>
                  <input type="time" className="form-input" value={form.time} onChange={e => set("time", e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any special requests…" style={{ resize: "vertical" }} />
              </div>
            </>
          )}
        </div>
        {!done && (
          <div className="modal-footer">
            <button className="btn-outline" onClick={onClose} style={{ padding: "0.5rem 1rem", fontSize: "0.6rem" }}>Cancel</button>
            <button className="btn-gold" onClick={handleSubmit} disabled={loading} style={{ padding: "0.5rem 1rem", fontSize: "0.6rem" }}>
              {loading ? "Submitting…" : "Confirm Request"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
