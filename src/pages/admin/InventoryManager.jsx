import { useMemo, useState } from "react";
import { Search, Plus, Trash2, AlertTriangle, Package, DollarSign, Layers } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createInventoryItem, updateInventoryItem, deleteInventoryItem } from "../../lib/api";
import toast from "react-hot-toast";

export default function InventoryManager() {
  const { inventory, reload } = useAdmin();
  const [search, setSearch] = useState("");
  const [modalObj, setModalObj] = useState(null); // null | {} = add | {id...} = edit
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (inventory || []).filter((item) =>
      item.name?.toLowerCase().includes(term) || item.sku?.toLowerCase().includes(term) || item.category?.toLowerCase().includes(term)
    );
  }, [inventory, search]);

  const metrics = useMemo(() => {
    const list = inventory || [];
    const totalItems = list.length;
    const lowStockCount = list.filter(item => Number(item.stock_qty) <= Number(item.min_qty)).length;
    const stockVal = list.reduce((sum, item) => sum + (Number(item.stock_qty) * Number(item.unit_price)), 0);
    return { totalItems, lowStockCount, stockVal };
  }, [inventory]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: modalObj.name.trim(),
        category: modalObj.category || "General",
        sku: modalObj.sku || null,
        stock_qty: Number(modalObj.stock_qty || 0),
        min_qty: Number(modalObj.min_qty || 0),
        unit_price: Number(modalObj.unit_price || 0),
        supplier: modalObj.supplier || null,
        notes: modalObj.notes || null,
        updated_at: new Date().toISOString()
      };

      if (modalObj.id) {
        await updateInventoryItem(modalObj.id, payload);
        toast.success("Inventory item updated");
      } else {
        await createInventoryItem(payload);
        toast.success("New product added to inventory");
      }
      setModalObj(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save product details");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this product from inventory records?")) return;
    try {
      await deleteInventoryItem(id);
      toast.success("Item deleted");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete item");
    }
  };

  const adjustStock = async (item, amount) => {
    try {
      const newQty = Math.max(0, Number(item.stock_qty) + amount);
      await updateInventoryItem(item.id, { stock_qty: newQty, updated_at: new Date().toISOString() });
      toast.success(`Adjusted stock of ${item.name} to ${newQty}`);
      reload();
    } catch (err) {
      toast.error(err.message || "Adjustment failed");
    }
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Stock Items</div>
          <div className="stat-value">{metrics.totalItems}</div>
          <div className="stat-sub">Tracked products</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-value" style={{ color: metrics.lowStockCount > 0 ? "#b71c1c" : "inherit" }}>
            {metrics.lowStockCount}
          </div>
          <div className="stat-sub">Require reordering</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inventory Valuation</div>
          <div className="stat-value">Rs {metrics.stockVal.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Cost value of stock</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Product & Supply Inventory</div>
          <div className="table-actions">
            <input type="search" className="admin-search" placeholder="SKU or product name..." value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-add" onClick={() => setModalObj({ name: "", category: "Cosmetics", sku: "", stock_qty: 0, min_qty: 5, unit_price: 0 })}>
              <Plus size={14} style={{ marginRight: 6 }} /> Add Product
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Stock Level</th>
              <th>Unit Cost (₹)</th>
              <th>Supplier</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const isLow = Number(item.stock_qty) <= Number(item.min_qty);
              return (
                <tr key={item.id} style={{ background: isLow ? "rgba(183,28,28,0.03)" : "none" }}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#666" }}>
                    {item.sku || "—"}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.notes && <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{item.notes}</div>}
                  </td>
                  <td>
                    <span className="badge badge-gold" style={{ padding: "2px 6px" }}>{item.category || "General"}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button className="tbl-btn" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => adjustStock(item, -1)}>-</button>
                      <strong style={{ fontSize: "0.85rem", color: isLow ? "#b71c1c" : "inherit" }}>
                        {item.stock_qty}
                      </strong>
                      <button className="tbl-btn" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => adjustStock(item, 1)}>+</button>
                      {isLow && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "0.55rem", padding: "1px 5px", background: "#fce4ec", color: "#b71c1c", fontWeight: "bold", textTransform: "uppercase" }}>
                          <AlertTriangle size={10} /> Low
                        </span>
                      )}
                    </div>
                  </td>
                  <td>Rs {Number(item.unit_price || 0).toLocaleString("en-IN")}</td>
                  <td>{item.supplier || "—"}</td>
                  <td>
                    <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="tbl-btn" onClick={() => setModalObj(item)}>Edit</button>
                      <button className="tbl-btn danger" onClick={() => handleDelete(item.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                  No inventory products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalObj && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalObj(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{modalObj.id ? "Edit Product Details" : "Add Product to Inventory"}</div>
              <button className="modal-close" onClick={() => setModalObj(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="inventory-form" onSubmit={handleSave}>
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" value={modalObj.name || ""} onChange={e => setModalObj({ ...modalObj, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-input" value={modalObj.category || ""} onChange={e => setModalObj({ ...modalObj, category: e.target.value })}>
                      <option value="Hair Care">Hair Care (Shampoos/Sprays)</option>
                      <option value="Color & Bleach">Color & Bleach</option>
                      <option value="Skin Care">Skin Care (Creams/Face Wash)</option>
                      <option value="Equipment">Equipment (Scissors/Dryers)</option>
                      <option value="Cosmetics">Cosmetics & Makeup</option>
                      <option value="General">General Retail</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">SKU Code / Barcode</label>
                    <input className="form-input" value={modalObj.sku || ""} onChange={e => setModalObj({ ...modalObj, sku: e.target.value })} placeholder="e.g. SHA-800-01" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Stock Quantity *</label>
                    <input type="number" min="0" className="form-input" value={modalObj.stock_qty || 0} onChange={e => setModalObj({ ...modalObj, stock_qty: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Alert level (Reorder level)</label>
                    <input type="number" min="0" className="form-input" value={modalObj.min_qty || 0} onChange={e => setModalObj({ ...modalObj, min_qty: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Unit Price Cost (₹) *</label>
                    <input type="number" min="0" className="form-input" value={modalObj.unit_price || 0} onChange={e => setModalObj({ ...modalObj, unit_price: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Supplier Name</label>
                    <input className="form-input" value={modalObj.supplier || ""} onChange={e => setModalObj({ ...modalObj, supplier: e.target.value })} placeholder="Distributor name..." />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" rows="2" value={modalObj.notes || ""} onChange={e => setModalObj({ ...modalObj, notes: e.target.value })} placeholder="Shelf location, packaging sizes, etc."></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setModalObj(null)}>Cancel</button>
              <button type="submit" form="inventory-form" className="btn-add" disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
