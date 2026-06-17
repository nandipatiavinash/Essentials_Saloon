import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createGalleryItem, updateGalleryItem, deleteGalleryItem, uploadImage } from "../../lib/api";
import toast from "react-hot-toast";

export default function GalleryManager() {
  const { gallery, reload } = useAdmin();
  const [modalObj, setModalObj] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadImage(file);
      setModalObj(prev => ({ ...prev, url: url }));
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
          <div className="table-title">Gallery Management</div>
          <button className="btn-add" onClick={() => handleOpenModal({ url: "", caption: "", type: "style" })}>+ Add Photo</button>
        </div>
        <div className="gallery-admin-grid">
          {gallery?.map(g => (
            <div key={g.id} className="gallery-admin-item">
              <img src={g.url} alt={g.caption || "Gallery item"} className="gallery-admin-img" />
              <div className="gallery-admin-caption">{g.caption || "No caption"}</div>
              <div className="gallery-admin-btns">
                <button className="tbl-btn" style={{ flex: 1 }} onClick={() => handleOpenModal(g)}>Edit</button>
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
                  <label className="form-label">Photo Image *</label>
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    {modalObj.url ? (
                      <div style={{ position: "relative", width: "80px", height: "80px", border: "1px solid var(--a-border)", background: "#111" }}>
                        <img src={modalObj.url} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button type="button" onClick={() => setModalObj({ ...modalObj, url: "" })} style={{ position: "absolute", top: "-5px", right: "-5px", background: "#f44336", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Remove image">✕</button>
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
                      <input className="form-input" style={{ marginTop: "0.4rem" }} placeholder="https://example.com/image.jpg" value={modalObj.url || ""} onChange={e => setModalObj({ ...modalObj, url: e.target.value })} required />
                    )}
                  </div>
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
              </form>
            </div>
            <div className="modal-footer">
              <button className="tbl-btn" onClick={() => setModalObj(null)}>Cancel</button>
              <button type="submit" form="gallery-form" className="btn-add" disabled={loading || uploadingImg}>{loading ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
