import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createOffer, updateOffer, deleteOffer } from "../../lib/api";
import toast from "react-hot-toast";

export default function OffersManager() {
  const { offers, reload } = useAdmin();
  const [modalObj, setModalObj] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (modalObj.id) {
        await updateOffer(modalObj.id, modalObj);
        toast.success("Offer updated");
      } else {
        await createOffer(modalObj);
        toast.success("Offer created");
      }
      setModalObj(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (o) => {
    try {
      await updateOffer(o.id, { active: !o.active });
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this offer?")) return;
    try {
      await deleteOffer(id);
      toast.success("Offer deleted");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Manage Offers</div>
          <button className="btn-add" onClick={() => setModalObj({ title: "", badge: "Special", price: "", active: true })}>+ New Offer</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Offer Title</th>
              <th>Badge</th>
              <th>Price Text</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {offers?.map(o => (
              <tr key={o.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{o.title}</div>
                  <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>{o.description?.substring(0, 50)}...</div>
                </td>
                <td>{o.badge}</td>
                <td>{o.price}</td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={o.active} onChange={() => handleToggle(o)} />
                    <span className="toggle-slider"></span>
                  </label>
                </td>
                <td>
                  <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                    <button className="tbl-btn" onClick={() => setModalObj(o)}>Edit</button>
                    <button className="tbl-btn danger" onClick={() => handleDelete(o.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {(!offers || offers.length === 0) && (
              <tr><td colSpan="5" style={{ textAlign: "center", padding: "3rem", color: "var(--a-faint)" }}>No offers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalObj && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalObj(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{modalObj.id ? "Edit Offer" : "New Offer"}</div>
              <button className="modal-close" onClick={() => setModalObj(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="offer-form" onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" value={modalObj.title || ""} onChange={e => setModalObj({ ...modalObj, title: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Badge Text</label>
                    <input className="form-input" placeholder="e.g. Bridal" value={modalObj.badge || ""} onChange={e => setModalObj({ ...modalObj, badge: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price Display Text</label>
                    <input className="form-input" placeholder="e.g. ₹4,999 or 20% Off" value={modalObj.price || ""} onChange={e => setModalObj({ ...modalObj, price: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" rows="3" value={modalObj.description || ""} onChange={e => setModalObj({ ...modalObj, description: e.target.value })}></textarea>
                </div>
                <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!modalObj.active} onChange={e => setModalObj({ ...modalObj, active: e.target.checked })} />
                    Active
                  </label>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="tbl-btn" onClick={() => setModalObj(null)}>Cancel</button>
              <button type="submit" form="offer-form" className="btn-add" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
