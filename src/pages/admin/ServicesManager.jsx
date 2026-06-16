import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createService, updateService, deleteService, patchService } from "../../lib/api";
import toast from "react-hot-toast";

export default function ServicesManager() {
  const { services, categories, reload } = useAdmin();
  const [modalObj, setModalObj] = useState(null); // null = closed, {} = new, {...} = edit
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = services?.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) || [];

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (modalObj.id) {
        await updateService(modalObj.id, modalObj);
        toast.success("Service updated");
      } else {
        await createService(modalObj);
        toast.success("Service created");
      }
      setModalObj(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (s) => {
    try {
      await patchService(s.id, { active: !s.active });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this service?")) return;
    try {
      await deleteService(id);
      toast.success("Service deleted");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Manage Services</div>
          <div className="table-actions">
            <input type="search" className="admin-search" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-add" onClick={() => setModalObj({ name: "", category: categories?.[0]?.slug || "", price_from: 0, active: true })}>+ New Service</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>{s.duration || "—"}</div>
                </td>
                <td>{categories?.find(c => c.slug === s.category)?.name || s.category}</td>
                <td>₹{s.price_from} {s.price_to ? ` - ₹${s.price_to}` : ""} {s.member_price != null && s.member_price > 0 ? ` (M: ₹${s.member_price})` : ""}</td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={s.active} onChange={() => handleToggle(s)} />
                    <span className="toggle-slider"></span>
                  </label>
                </td>
                <td>
                  <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                    <button className="tbl-btn" onClick={() => setModalObj(s)}>Edit</button>
                    <button className="tbl-btn danger" onClick={() => handleDelete(s.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "var(--a-faint)" }}>No services found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalObj && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalObj(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{modalObj.id ? "Edit Service" : "New Service"}</div>
              <button className="modal-close" onClick={() => setModalObj(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="svc-form" onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={modalObj.name || ""} onChange={e => setModalObj({ ...modalObj, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-input" value={modalObj.category || ""} onChange={e => setModalObj({ ...modalObj, category: e.target.value })} required>
                      {categories?.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration</label>
                    <input className="form-input" placeholder="e.g. 45 mins" value={modalObj.duration || ""} onChange={e => setModalObj({ ...modalObj, duration: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Price From (₹) *</label>
                    <input type="number" className="form-input" min="0" value={modalObj.price_from || 0} onChange={e => setModalObj({ ...modalObj, price_from: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price To (₹)</label>
                    <input type="number" className="form-input" min="0" value={modalObj.price_to || ""} onChange={e => setModalObj({ ...modalObj, price_to: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Member Price (₹)</label>
                    <input type="number" className="form-input" min="0" value={modalObj.member_price || ""} onChange={e => setModalObj({ ...modalObj, member_price: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows="3" value={modalObj.description || ""} onChange={e => setModalObj({ ...modalObj, description: e.target.value })}></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label">Image URL</label>
                  <input className="form-input" value={modalObj.image || ""} onChange={e => setModalObj({ ...modalObj, image: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!modalObj.active} onChange={e => setModalObj({ ...modalObj, active: e.target.checked })} />
                    Active
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!modalObj.featured} onChange={e => setModalObj({ ...modalObj, featured: e.target.checked })} />
                    Featured
                  </label>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="tbl-btn" onClick={() => setModalObj(null)}>Cancel</button>
              <button type="submit" form="svc-form" className="btn-add" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
