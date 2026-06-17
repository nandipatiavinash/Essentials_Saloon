import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createService, updateService, deleteService, patchService, uploadImage } from "../../lib/api";
import toast from "react-hot-toast";

export default function ServicesManager() {
  const { services, categories, reload } = useAdmin();
  const [modalObj, setModalObj] = useState(null); // null = closed, {} = new, {...} = edit
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const filtered = services?.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) || [];

  const handleOpenModal = (obj) => {
    setModalObj(obj);
    setUploadingImg(false);
    setShowUrlInput(false);
  };

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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadImage(file);
      setModalObj(prev => ({ ...prev, image: url }));
      toast.success("Image uploaded successfully");
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploadingImg(false);
    }
  };

  return (
    <>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Manage Services</div>
          <div className="table-actions">
            <input type="search" className="admin-search" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-add" onClick={() => handleOpenModal({ name: "", category: categories?.[0]?.slug || "", price_from: 0, active: true })}>+ New Service</button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Category</th>
              <th>Pricing</th>
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
                <td>
                  <div style={{ fontSize: "0.75rem" }}>Regular: ₹{s.price_from}</div>
                  {s.member_price != null && s.member_price > 0 && (
                    <div style={{ fontSize: "0.68rem", color: "var(--gold)" }}>Member: ₹{s.member_price}</div>
                  )}
                </td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={s.active} onChange={() => handleToggle(s)} />
                    <span className="toggle-slider"></span>
                  </label>
                </td>
                <td>
                  <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                    <button className="tbl-btn" onClick={() => handleOpenModal(s)}>Edit</button>
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
                    <label className="form-label">Regular Price (₹) *</label>
                    <input type="number" className="form-input" min="0" value={modalObj.price_from || 0} onChange={e => setModalObj({ ...modalObj, price_from: e.target.value })} required />
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
                  <label className="form-label">Service Image</label>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    {modalObj.image ? (
                      <div style={{ position: "relative", width: "80px", height: "80px", border: "1px solid var(--a-border)", background: "#111" }}>
                        <img src={modalObj.image} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button type="button" onClick={() => setModalObj({ ...modalObj, image: "" })} style={{ position: "absolute", top: "-5px", right: "-5px", background: "#f44336", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Remove image">✕</button>
                      </div>
                    ) : (
                      <div style={{ width: "80px", height: "80px", border: "1px dashed var(--a-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--a-muted)", fontSize: "0.6rem", textAlign: "center" }}>
                        No Image
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      {uploadingImg ? (
                        <span style={{ fontSize: "0.75rem", color: "var(--gold)" }}>Uploading image...</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          <label className="tbl-btn" style={{ cursor: "pointer", display: "inline-block", textAlign: "center", width: "fit-content" }}>
                            Upload File
                            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                          </label>
                          <span style={{ fontSize: "0.6rem", color: "var(--a-muted)" }}>Supported: JPG, PNG, WEBP. Max 5MB.</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: "0.5rem" }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--a-muted)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowUrlInput(!showUrlInput)}>
                      {showUrlInput ? "Hide URL Input" : "Edit Image URL Directly"}
                    </span>
                    {showUrlInput && (
                      <input className="form-input" style={{ marginTop: "0.4rem" }} placeholder="https://example.com/image.jpg" value={modalObj.image || ""} onChange={e => setModalObj({ ...modalObj, image: e.target.value })} />
                    )}
                  </div>
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
