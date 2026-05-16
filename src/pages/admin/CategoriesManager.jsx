import { useState } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createCategory, updateCategory, deleteCategory } from "../../lib/api";
import toast from "react-hot-toast";

export default function CategoriesManager() {
  const { categories, reload } = useAdmin();
  const [modalObj, setModalObj] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (modalObj.id) {
        await updateCategory(modalObj.id, modalObj);
        toast.success("Category updated");
      } else {
        await createCategory(modalObj);
        toast.success("Category created");
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
    if (!window.confirm("Delete this category? This might break services using it.")) return;
    try {
      await deleteCategory(id);
      toast.success("Category deleted");
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Manage Categories</div>
          <button className="btn-add" onClick={() => setModalObj({ name: "", slug: "", icon: "✂️" })}>+ New Category</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Icon</th>
              <th>Name</th>
              <th>Slug</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories?.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: "1.2rem" }}>{c.icon}</td>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td style={{ color: "var(--a-muted)" }}>{c.slug}</td>
                <td>
                  <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                    <button className="tbl-btn" onClick={() => setModalObj(c)}>Edit</button>
                    <button className="tbl-btn danger" onClick={() => handleDelete(c.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalObj && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalObj(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{modalObj.id ? "Edit Category" : "New Category"}</div>
              <button className="modal-close" onClick={() => setModalObj(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="cat-form" onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={modalObj.name || ""} onChange={e => setModalObj({ ...modalObj, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug (lowercase, no spaces) *</label>
                  <input className="form-input" value={modalObj.slug || ""} onChange={e => setModalObj({ ...modalObj, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Icon (Emoji)</label>
                  <input className="form-input" value={modalObj.icon || ""} onChange={e => setModalObj({ ...modalObj, icon: e.target.value })} />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="tbl-btn" onClick={() => setModalObj(null)}>Cancel</button>
              <button type="submit" form="cat-form" className="btn-add" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
