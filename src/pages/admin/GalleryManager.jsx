import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createGalleryItem, updateGalleryItem, deleteGalleryItem } from "../../lib/api";
import toast from "react-hot-toast";

export default function GalleryManager() {
  const { gallery, reload } = useAdmin();
  const [modalObj, setModalObj] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (modalObj.id) {
        await updateGalleryItem(modalObj.id, modalObj);
        toast.success("Image updated");
      } else {
        await createGalleryItem(modalObj);
        toast.success("Image added");
      }
      setModalObj(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this image?")) return;
    try {
      await deleteGalleryItem(id);
      toast.success("Image deleted");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Gallery Management</div>
          <button className="btn-add" onClick={() => setModalObj({ url: "", caption: "", type: "style" })}>+ Add Photo</button>
        </div>
        <div className="gallery-admin-grid">
          {gallery?.map(g => (
            <div key={g.id} className="gallery-admin-item">
              <img src={g.url} alt={g.caption || "Gallery item"} className="gallery-admin-img" />
              <div className="gallery-admin-caption">{g.caption || "No caption"}</div>
              <div className="gallery-admin-btns">
                <button className="tbl-btn" style={{ flex: 1 }} onClick={() => setModalObj(g)}>Edit</button>
                <button className="tbl-btn danger" style={{ flex: 1 }} onClick={() => handleDelete(g.id)}>Del</button>
              </div>
            </div>
          ))}
          {(!gallery || gallery.length === 0) && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem", color: "var(--a-faint)" }}>
              No images in gallery
            </div>
          )}
        </div>
      </div>

      {modalObj && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalObj(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{modalObj.id ? "Edit Photo" : "Add Photo"}</div>
              <button className="modal-close" onClick={() => setModalObj(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="gallery-form" onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Image URL *</label>
                  <input className="form-input" type="url" value={modalObj.url || ""} onChange={e => setModalObj({ ...modalObj, url: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Caption</label>
                  <input className="form-input" value={modalObj.caption || ""} onChange={e => setModalObj({ ...modalObj, caption: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={modalObj.type || ""} onChange={e => setModalObj({ ...modalObj, type: e.target.value })}>
                    <option value="style">Hair / Style</option>
                    <option value="salon">Salon Interior</option>
                    <option value="product">Products</option>
                  </select>
                </div>
                {modalObj.url && (
                  <div style={{ marginTop: "1rem" }}>
                    <div className="form-label">Preview</div>
                    <img src={modalObj.url} alt="Preview" style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "4px" }} onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button className="tbl-btn" onClick={() => setModalObj(null)}>Cancel</button>
              <button type="submit" form="gallery-form" className="btn-add" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
