import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Trash2, AlertTriangle, Package, DollarSign, Layers, ArrowLeftRight } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { createInventoryItem, updateInventoryItem, deleteInventoryItem, fetchStockTransfers, saveStockTransfer } from "../../lib/api";
import toast from "react-hot-toast";

export default function InventoryManager() {
  const { inventory, reload } = useAdmin();
  const [search, setSearch] = useState("");
  const [modalObj, setModalObj] = useState(null); // null | {} = add | {id...} = edit
  const [activeTab, setActiveTab] = useState("retail"); // retail | consumption | transfers
  const [saving, setSaving] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [transferModal, setTransferModal] = useState(null); // null | {} for adding transfer


  const getExpiryStatus = (expiryDateStr) => {
    if (!expiryDateStr) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const exp = new Date(expiryDateStr);
    exp.setHours(0,0,0,0);
    if (exp < today) return 'expired';
    const diffTime = exp.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return 'expiring_soon';
    return null;
  };

  const loadTransfers = async () => {
    setLoadingTransfers(true);
    try {
      const data = await fetchStockTransfers();
      setTransfers(data);
    } catch (err) {
      toast.error(err.message || "Failed to load stock transfers");
    } finally {
      setLoadingTransfers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "transfers") {
      loadTransfers();
    }
  }, [activeTab]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (activeTab === "transfers") {
      return (transfers || []).filter(t =>
        t.product_name?.toLowerCase().includes(term) ||
        t.destination?.toLowerCase().includes(term) ||
        t.transfer_type?.toLowerCase().includes(term)
      );
    }
    const list = (inventory || []).filter(item => (item.inventory_type || 'retail') === activeTab);
    return list.filter((item) =>
      item.name?.toLowerCase().includes(term) || item.category?.toLowerCase().includes(term)
    );
  }, [inventory, search, activeTab, transfers]);

  const metrics = useMemo(() => {
    if (activeTab === "transfers") {
      return { totalItems: 0, lowStockCount: 0, stockVal: 0 };
    }
    const list = (inventory || []).filter(item => (item.inventory_type || 'retail') === activeTab);
    const totalItems = list.length;
    const lowStockCount = list.filter(item => Number(item.stock_qty) <= Number(item.min_qty)).length;
    const stockVal = list.reduce((sum, item) => sum + (Number(item.stock_qty) * Number(item.unit_price)), 0);
    return { totalItems, lowStockCount, stockVal };
  }, [inventory, activeTab]);


  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: modalObj.name.trim(),
        category: modalObj.category || "General",
        inventory_type: modalObj.inventory_type || "retail",
        expiry_date: modalObj.expiry_date || null,
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

  const handleSaveTransfer = async (e) => {
    e.preventDefault();
    if (!transferModal.inventory_id) {
      toast.error("Please select a product");
      return;
    }
    const selectedProd = (inventory || []).find(p => p.id === transferModal.inventory_id);
    if (!selectedProd) return;

    setSaving(true);
    try {
      await saveStockTransfer({
        inventory_id: transferModal.inventory_id,
        product_name: selectedProd.name,
        quantity: Number(transferModal.quantity || 0),
        transfer_type: transferModal.transfer_type || "transfer_out",
        destination: transferModal.destination || null,
        origin: transferModal.origin || null,
        reason: transferModal.reason || null,
        reference: transferModal.reference || null,
        transferred_by: transferModal.transferred_by || null,
        date: transferModal.date || new Date().toISOString().slice(0, 10),
        notes: transferModal.notes || null,
      });

      toast.success("Stock transfer logged successfully!");
      setTransferModal(null);
      await Promise.all([loadTransfers(), reload()]);
    } catch (err) {
      toast.error(err.message || "Failed to log stock transfer");
    } finally {
      setSaving(false);
    }
  };

  const exportTransfersCSV = () => {
    if (!transfers.length) {
      toast.error("No transfers to export");
      return;
    }
    const headers = ["Date", "Product", "Quantity", "Type", "Destination", "Origin", "Reason", "Reference", "Transferred By", "Notes"];
    const rows = transfers.map(t => [
      t.date || "",
      t.product_name || "",
      t.quantity || 0,
      t.transfer_type || "",
      t.destination || "",
      t.origin || "",
      t.reason || "",
      t.reference || "",
      t.transferred_by || "",
      t.notes || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_transfers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{activeTab === "transfers" ? "Total Transfers" : "Total Stock Items"}</div>
          <div className="stat-value">{activeTab === "transfers" ? transfers.length : metrics.totalItems}</div>
          <div className="stat-sub">{activeTab === "transfers" ? "Transfer logs" : "Tracked products"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{activeTab === "transfers" ? "Transfers Out" : "Low Stock Alerts"}</div>
          <div className="stat-value" style={{ color: activeTab !== "transfers" && metrics.lowStockCount > 0 ? "#b71c1c" : "inherit" }}>
            {activeTab === "transfers" 
              ? transfers.filter(t => t.transfer_type === "transfer_out").length
              : metrics.lowStockCount}
          </div>
          <div className="stat-sub">{activeTab === "transfers" ? "Salon shipments" : "Require reordering"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{activeTab === "transfers" ? "Transfers In" : "Inventory Valuation"}</div>
          <div className="stat-value">
            {activeTab === "transfers" 
              ? transfers.filter(t => t.transfer_type === "transfer_in").length
              : `Rs ${metrics.stockVal.toLocaleString("en-IN")}`}
          </div>
          <div className="stat-sub">{activeTab === "transfers" ? "Incoming shipments" : "Cost value of stock"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button className={`tbl-btn ${activeTab === "retail" ? "active" : ""}`} onClick={() => setActiveTab("retail")}>
          <Package size={14} style={{ marginRight: 6 }} /> Retail Stock
        </button>
        <button className={`tbl-btn ${activeTab === "consumption" ? "active" : ""}`} onClick={() => setActiveTab("consumption")}>
          <Layers size={14} style={{ marginRight: 6 }} /> Salon Consumption Stock
        </button>
        <button className={`tbl-btn ${activeTab === "transfers" ? "active" : ""}`} onClick={() => setActiveTab("transfers")}>
          <ArrowLeftRight size={14} style={{ marginRight: 6 }} /> Stock Transfers
        </button>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">
            {activeTab === "retail" ? "Retail Inventory" : activeTab === "consumption" ? "Salon Consumption Inventory" : "Stock Transfers Log"}
          </div>
          <div className="table-actions">
            <input type="search" className="admin-search" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            {activeTab === "transfers" ? (
              <>
                <button className="tbl-btn" onClick={exportTransfersCSV} style={{ marginRight: "0.5rem" }}>
                  <Download size={14} style={{ marginRight: 6 }} /> Export CSV
                </button>
                <button className="btn-add" onClick={() => setTransferModal({ inventory_id: "", quantity: 1, transfer_type: "transfer_out", destination: "", origin: "", reason: "", reference: "", transferred_by: "", date: new Date().toISOString().slice(0, 10), notes: "" })}>
                  <Plus size={14} style={{ marginRight: 6 }} /> Log Transfer
                </button>
              </>
            ) : (
              <button className="btn-add" onClick={() => setModalObj({ name: "", category: "Cosmetics", inventory_type: activeTab, expiry_date: "", stock_qty: 0, min_qty: 5, unit_price: 0 })}>
                <Plus size={14} style={{ marginRight: 6 }} /> Add Product
              </button>
            )}
          </div>
        </div>

        {activeTab === "transfers" ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Type</th>
                <th>Origin / Destination</th>
                <th>Reason / Ref</th>
                <th>Transferred By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const colors = { transfer_out: "#b71c1c", transfer_in: "#2e7d32", adjustment: "#f57c00", write_off: "#777" };
                const labels = { transfer_out: "OUT", transfer_in: "IN", adjustment: "ADJ", write_off: "LOSS" };
                return (
                  <tr key={t.id}>
                    <td style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>{t.date}</td>
                    <td style={{ fontWeight: 600 }}>{t.product_name}</td>
                    <td style={{ fontWeight: "bold" }}>{t.quantity}</td>
                    <td>
                      <span className="badge" style={{ background: (colors[t.transfer_type] || "#888") + "15", color: colors[t.transfer_type] || "#888", border: "1px solid " + (colors[t.transfer_type] || "#888") + "40", padding: "2px 6px", fontSize: "0.6rem" }}>
                        {labels[t.transfer_type] || t.transfer_type}
                      </span>
                    </td>
                    <td>
                      {t.transfer_type === "transfer_in" ? `From: ${t.origin || "—"}` : `To: ${t.destination || "—"}`}
                    </td>
                    <td>
                      <div style={{ fontSize: "0.78rem" }}>{t.reason || "—"}</div>
                      {t.reference && <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>Ref: {t.reference}</div>}
                    </td>
                    <td>{t.transferred_by || "—"}</td>
                    <td style={{ fontSize: "0.7rem", color: "var(--a-muted)" }}>{t.notes || "—"}</td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                    {loadingTransfers ? "Loading transfers..." : "No transfer logs found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Stock Level</th>
                <th>Unit Cost (₹)</th>
                <th>Expiry Date</th>
                <th>Supplier</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isLow = Number(item.stock_qty) <= Number(item.min_qty);
                const expStatus = getExpiryStatus(item.expiry_date);
                
                let rowBg = "none";
                if (expStatus === 'expired') {
                  rowBg = "rgba(239,83,80,0.08)";
                } else if (expStatus === 'expiring_soon') {
                  rowBg = "rgba(255,238,88,0.12)";
                } else if (isLow) {
                  rowBg = "rgba(183,28,28,0.03)";
                }

                return (
                  <tr key={item.id} style={{ background: rowBg }}>
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
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span>{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>
                        {expStatus === 'expired' && (
                          <span style={{ fontSize: "0.55rem", fontWeight: "bold", color: "#d32f2f", background: "#ffebee", padding: "2px 4px", borderRadius: "2px", width: "fit-content" }}>
                            EXPIRED
                          </span>
                        )}
                        {expStatus === 'expiring_soon' && (
                          <span style={{ fontSize: "0.55rem", fontWeight: "bold", color: "#f57c00", background: "#fff3e0", padding: "2px 4px", borderRadius: "2px", width: "fit-content" }}>
                            EXPIRING SOON
                          </span>
                        )}
                      </div>
                    </td>
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
                    No inventory products found in this section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit/Add Product Modal */}
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
                    <select className="form-input" value={modalObj.category || "General"} onChange={e => setModalObj({ ...modalObj, category: e.target.value })}>
                      <option value="Hair Care">Hair Care (Shampoos/Sprays)</option>
                      <option value="Color & Bleach">Color & Bleach</option>
                      <option value="Skin Care">Skin Care (Creams/Face Wash)</option>
                      <option value="Equipment">Equipment (Scissors/Dryers)</option>
                      <option value="Cosmetics">Cosmetics & Makeup</option>
                      <option value="General">General Retail</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Inventory Stock Type *</label>
                    <select className="form-input" value={modalObj.inventory_type || "retail"} onChange={e => setModalObj({ ...modalObj, inventory_type: e.target.value })} required>
                      <option value="retail">Retail Stock</option>
                      <option value="consumption">Salon Consumption</option>
                    </select>
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
                    <label className="form-label">Expiry Date</label>
                    <input type="date" className="form-input" value={modalObj.expiry_date || ""} onChange={e => setModalObj({ ...modalObj, expiry_date: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
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

      {/* Log Stock Transfer Modal */}
      {transferModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTransferModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Log Stock Transfer / Adjustment</div>
              <button className="modal-close" onClick={() => setTransferModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="transfer-form" onSubmit={handleSaveTransfer}>
                <div className="form-group">
                  <label className="form-label">Select Product *</label>
                  <select className="form-input" value={transferModal.inventory_id} onChange={e => setTransferModal({ ...transferModal, inventory_id: e.target.value })} required>
                    <option value="" disabled>-- Select Product --</option>
                    {(inventory || []).map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Current Qty: {p.stock_qty})</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Transfer Type *</label>
                    <select className="form-input" value={transferModal.transfer_type} onChange={e => setTransferModal({ ...transferModal, transfer_type: e.target.value })} required>
                      <option value="transfer_out">Transfer Out (Ship to another salon)</option>
                      <option value="transfer_in">Transfer In (Receive from another salon)</option>
                      <option value="adjustment">Stock Count Adjustment (+/-)</option>
                      <option value="write_off">Write-off (Damaged / Expired)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity *</label>
                    <input type="number" step="any" className="form-input" value={transferModal.quantity} onChange={e => setTransferModal({ ...transferModal, quantity: e.target.value })} required />
                  </div>
                </div>

                <div className="form-row">
                  {transferModal.transfer_type === "transfer_in" ? (
                    <div className="form-group">
                      <label className="form-label">Origin (Sender) *</label>
                      <input className="form-input" value={transferModal.origin || ""} onChange={e => setTransferModal({ ...transferModal, origin: e.target.value })} placeholder="e.g. Guntur Salon, Supplier..." required />
                    </div>
                  ) : transferModal.transfer_type === "transfer_out" ? (
                    <div className="form-group">
                      <label className="form-label">Destination (Receiver) *</label>
                      <input className="form-input" value={transferModal.destination || ""} onChange={e => setTransferModal({ ...transferModal, destination: e.target.value })} placeholder="e.g. Gorantla-2 Salon, Customer..." required />
                    </div>
                  ) : null}
                  <div className="form-group">
                    <label className="form-label">Transfer Date *</label>
                    <input type="date" className="form-input" value={transferModal.date} onChange={e => setTransferModal({ ...transferModal, date: e.target.value })} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Reference Number (LR / Bill / DC)</label>
                    <input className="form-input" value={transferModal.reference || ""} onChange={e => setTransferModal({ ...transferModal, reference: e.target.value })} placeholder="e.g. LR-98231, DC-091" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Logged By</label>
                    <input className="form-input" value={transferModal.transferred_by || ""} onChange={e => setTransferModal({ ...transferModal, transferred_by: e.target.value })} placeholder="Your name" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Notes</label>
                  <textarea className="form-input" rows="2" value={transferModal.notes || ""} onChange={e => setTransferModal({ ...transferModal, notes: e.target.value })} placeholder="Why are we transferring this? Details..."></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setTransferModal(null)}>Cancel</button>
              <button type="submit" form="transfer-form" className="btn-add" disabled={saving}>{saving ? "Logging..." : "Log Transfer"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
