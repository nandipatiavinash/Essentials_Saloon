import { useData } from "../../layouts/PublicLayout";
import { useState } from "react";
import { createBooking } from "../../lib/api";
import toast from "react-hot-toast";

export default function Contact() {
  const { settings } = useData();
  const [form, setForm] = useState({ name: "", phone: "", service: "", date: "", time: "", notes: "" });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.phone.trim()) return toast.error("Phone is required");
    setLoading(true);
    try {
      await createBooking(form);
      toast.success("Request sent! We'll confirm shortly.");
      setForm({ name: "", phone: "", service: "", date: "", time: "", notes: "" });
    } catch (err) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div style={{ marginBottom: "4rem", textAlign: "center" }}>
        <p className="section-label">Get in Touch</p>
        <h2 className="section-title">Visit the Salon</h2>
        <p className="section-sub" style={{ margin: "0 auto" }}>Experience the art of grooming in an environment of refined luxury.</p>
      </div>

      <div className="contact-grid">
        <div>
          {settings?.address && (
            <div className="contact-item">
              <div className="contact-icon">📍</div>
              <div>
                <div className="contact-label">Location</div>
                <div className="contact-val" style={{ whiteSpace: "pre-line" }}>{settings.address}</div>
              </div>
            </div>
          )}
          {settings?.hours && (
            <div className="contact-item">
              <div className="contact-icon">🕒</div>
              <div>
                <div className="contact-label">Opening Hours</div>
                <div className="contact-val" style={{ whiteSpace: "pre-line" }}>{settings.hours}</div>
              </div>
            </div>
          )}
          {settings?.phone && (
            <div className="contact-item">
              <div className="contact-icon">📞</div>
              <div>
                <div className="contact-label">Phone</div>
                <div className="contact-val">{settings.phone}</div>
              </div>
            </div>
          )}
          {settings?.email && (
            <div className="contact-item">
              <div className="contact-icon">✉️</div>
              <div>
                <div className="contact-label">Email</div>
                <div className="contact-val">{settings.email}</div>
              </div>
            </div>
          )}

          {settings?.whatsapp && (
            <a href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}?text=Hi,%20I%20would%20like%20to%20book%20an%20appointment.`} target="_blank" rel="noopener noreferrer" className="contact-whatsapp">
              WhatsApp Us
            </a>
          )}
        </div>

        <div>
          <form className="booking-form" onSubmit={handleSubmit}>
            <div className="form-title">Reserve Your Time</div>
            
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

            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label">Service Interested In</label>
              <input className="form-input" value={form.service} onChange={e => set("service", e.target.value)} placeholder="E.g. Haircut, Bridal Makeup" />
            </div>

            <div className="form-row" style={{ marginBottom: "1rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Preferred Date</label>
                <input type="date" className="form-input" min={new Date().toISOString().split("T")[0]} value={form.date} onChange={e => set("date", e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Preferred Time</label>
                <input type="time" className="form-input" value={form.time} onChange={e => set("time", e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <textarea className="form-input" rows="3" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any special requests or stylist preference..." style={{ resize: "vertical" }}></textarea>
            </div>

            <button type="submit" className="form-submit" disabled={loading}>
              {loading ? "Submitting..." : "Send Request"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
