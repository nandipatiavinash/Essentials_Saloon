import { useState, useEffect } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { saveSettings } from "../../lib/api";
import toast from "react-hot-toast";

export default function Settings() {
  const { settings, reload } = useAdmin();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", hours: "", whatsapp: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        name: settings.name || "",
        phone: settings.phone || "",
        email: settings.email || "",
        address: settings.address || "",
        hours: settings.hours || "",
        whatsapp: settings.whatsapp || ""
      });
    }
  }, [settings]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await saveSettings(form);
      toast.success("Settings saved successfully");
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 className="topbar-title" style={{ marginBottom: "1.5rem" }}>Salon Settings</h2>

      <form onSubmit={handleSave} className="table-wrap" style={{ padding: "2rem" }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Salon Name</label>
            <input className="form-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Essensuals Chennai" />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="hello@essensuals.com" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Phone Number (Display)</label>
            <input className="form-input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="form-label">WhatsApp Number</label>
            <input className="form-input" value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="+919876543210" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Full Address</label>
          <textarea className="form-input" rows="3" value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Luxury Avenue, Chennai"></textarea>
        </div>

        <div className="form-group">
          <label className="form-label">Opening Hours</label>
          <textarea className="form-input" rows="2" value={form.hours} onChange={e => set("hours", e.target.value)} placeholder="Mon - Sun: 10:00 AM - 9:00 PM"></textarea>
        </div>

        <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--a-border)", display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn-add" disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
