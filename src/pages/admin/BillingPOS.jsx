import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Plus, Printer, Search, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdmin } from "../../layouts/AdminLayout";
import { useSearchParams } from "react-router-dom";
import { calculateInvoiceTotals, fetchInvoiceDetails, findCustomerByPhone, saveInvoice, searchInvoices } from "../../lib/api";
import { buildWhatsAppLink, formatInvoiceMessage } from "../../lib/whatsapp";
import SearchableStaffDropdown from "../../components/SearchableStaffDropdown";

const emptyBill = () => ({
  client_name: "",
  mobile: "",
  customer_id: null,
  is_member: false,
  membership_tier: "Member",
  membership_id: "",
  membership_end: "",
  items: [],
  discount: 0,
  tip: 0,
  tax_enabled: true,
  tax_rate: 5,
  payment_method: "Cash",
  transaction_id: "",
  notes: "",
  staff_name: "",
  billing_at: new Date().toISOString().slice(0, 16),
});

export default function BillingPOS() {
  const { services, settings, staff, inventory, reload } = useAdmin();
  const [searchParams] = useSearchParams();
  const [bill, setBill] = useState(emptyBill);
  const [saving, setSaving] = useState(false);
  const [billSaved, setBillSaved] = useState(false); // true after a successful save
  const [invoice, setInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [addTab, setAddTab] = useState("services");

  const activeServices = useMemo(() => (services || []).filter((svc) => svc.active), [services]);
  const activeInventory = useMemo(() => (inventory || []).filter(item => Number(item.stock_qty) > 0), [inventory]);
  const totals = useMemo(() => calculateInvoiceTotals(bill), [bill]);

  // Use a ref so editInvoice (defined below) can be called from useEffect without hoisting issues
  const editInvoiceRef = useRef(null);

  useEffect(() => {
    loadHistory();
    // If ?inv=ID is in URL (from ClientsManager), load that invoice after mount
    const invId = searchParams.get("inv");
    if (invId && editInvoiceRef.current) editInvoiceRef.current(invId);
  }, []);

  const loadHistory = async (term = "") => {
    setLoadingHistory(true);
    try { setHistory(await searchInvoices(term)); }
    catch (err) { toast.error(err.message); }
    finally { setLoadingHistory(false); }
  };

  const getDaysRemaining = (endDateStr) => {
    if (!endDateStr) return 0;
    const end = new Date(endDateStr);
    const today = new Date();
    end.setHours(0,0,0,0); today.setHours(0,0,0,0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const lookupCustomer = async () => {
    if (!bill.mobile?.trim()) return;
    try {
      const customer = await findCustomerByPhone(bill.mobile);
      if (customer) {
        setBill((current) => {
          const updatedItems = current.items.map(item => {
            if (item.item_type === "product") return item;
            const svc = activeServices.find(s => String(s.id) === String(item.service_id));
            if (svc && customer.is_member && svc.member_price != null && svc.member_price > 0) {
              return { ...item, price: svc.member_price };
            }
            return item;
          });
          return {
            ...current,
            customer_id: customer.id,
            client_name: customer.name,
            mobile: customer.mobile,
            customer_notes: customer.notes || "",
            is_member: !!customer.is_member,
            membership_tier: customer.membership_tier || "Member",
            membership_id: customer.membership_id || "",
            membership_end: customer.membership_end || "",
            items: updatedItems,
          };
        });
        toast.success(`Client found: ${customer.name}${customer.is_member ? " (Member)" : ""}`);
      } else {
        toast.error("No client profile found for phone or ID.");
      }
    } catch (err) { toast.error(err.message); }
  };

  const addService = (serviceId) => {
    const service = activeServices.find((svc) => String(svc.id) === String(serviceId));
    if (!service) return;
    setBill((current) => {
      let price = Number(service.price_from || 0);
      if (current.is_member && service.member_price != null && service.member_price > 0) {
        price = Number(service.member_price);
      }
      return {
        ...current,
        items: [...current.items, {
          item_type: "service",
          service_id: service.id,
          service_name: service.name,
          quantity: 1,
          price,
          staff_name: current.staff_name || "",
        }],
      };
    });
  };

  const addProduct = (productId) => {
    const product = activeInventory.find(p => String(p.id) === String(productId));
    if (!product) return;
    setBill((current) => ({
      ...current,
      items: [...current.items, {
        item_type: "product",
        inventory_id: product.id,
        service_id: null,
        service_name: product.name,
        quantity: 1,
        price: Number(product.unit_price || 0),
        staff_name: current.staff_name || "",
      }],
    }));
  };

  const updateItem = (index, patch) => {
    setBill((current) => ({
      ...current,
      items: current.items.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  };

  const removeItem = (index) => {
    setBill((current) => ({ ...current, items: current.items.filter((_item, i) => i !== index) }));
  };

  const submitBill = async (e) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!bill.staff_name) { toast.error("Please select a main staff member"); return; }
    const missingItemStaff = bill.items.some(item => !item.staff_name);
    if (missingItemStaff) { toast.error("Please select a staff member for all items"); return; }
    setSaving(true);
    try {
      const saved = await saveInvoice({ ...bill, billing_at: new Date(bill.billing_at).toISOString() });
      setInvoice(saved);
      setInvoiceItems(bill.items.map((item) => ({ ...item, total: Number(item.quantity || 1) * Number(item.price || 0) })));
      // Update bill id/invoice_number but keep data visible
      setBill(prev => ({ ...prev, id: saved.id, invoice_number: saved.invoice_number }));
      setBillSaved(true);
      setAttemptedSubmit(false);
      toast.success(saved.invoice_number + " saved successfully!");
      await Promise.all([loadHistory(search), reload()]);
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  const startNewBill = () => {
    setBill(emptyBill());
    setInvoice(null);
    setInvoiceItems([]);
    setBillSaved(false);
    setAttemptedSubmit(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editInvoice = async (id) => {
    try {
      const details = await fetchInvoiceDetails(id);
      setBill({
        id: details.invoice.id,
        invoice_number: details.invoice.invoice_number,
        customer_id: details.invoice.customer_id,
        client_name: details.invoice.client_name,
        mobile: details.invoice.mobile,
        items: (details.items || []).map(item => ({ ...item, item_type: item.item_type || "service" })),
        discount: details.invoice.discount,
        tip: details.invoice.tip || 0,
        tax_enabled: Number(details.invoice.tax || 0) > 0,
        tax_rate: details.invoice.tax_rate || 0,
        payment_method: details.invoice.payment_method,
        transaction_id: details.invoice.transaction_id || "",
        notes: details.invoice.notes || "",
        staff_name: details.invoice.staff_name || "",
        is_member: details.invoice.customer?.is_member || false,
        membership_tier: details.invoice.customer?.membership_tier || "Member",
        membership_id: details.invoice.customer?.membership_id || "",
        membership_end: details.invoice.customer?.membership_end || "",
        billing_at: new Date(details.invoice.billing_at).toISOString().slice(0, 16),
      });
      setInvoice(details.invoice);
      setInvoiceItems((details.items || []).map(item => ({ ...item, total: Number(item.quantity || 1) * Number(item.price || 0) })));
      setBillSaved(true);
      setAttemptedSubmit(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { toast.error(err.message); }
  };
  // Assign to ref so useEffect (which runs before const hoisting) can call it
  editInvoiceRef.current = editInvoice;

  const printInvoice = () => setTimeout(() => window.print(), 100);

  const shareInvoice = () => {
    if (!invoice) {
      toast.error("Please save the bill first before sharing on WhatsApp.");
      return;
    }
    const invData = { ...invoice, is_member: bill.is_member, membership_tier: bill.membership_tier };
    const url = buildWhatsAppLink(invoice.mobile, formatInvoiceMessage(invData, invoiceItems, settings));
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      navigator.clipboard?.writeText(url).then(() => {
        toast.success("WhatsApp popup blocked — link copied to clipboard! Paste it in your browser.");
      }).catch(() => toast.error("Please allow popups for WhatsApp to open."));
    }
  };

  return (
    <div className="pos-grid">
      <form className="pos-panel" onSubmit={submitBill}>
        <div className="pos-header">
          <div>
            <div className="table-title">
              {billSaved ? `👁️ View Invoice: ${bill.invoice_number || ""}` : bill.id ? "Edit Invoice" : "New Billing"}
            </div>
            <div className="pos-sub">
              {billSaved ? "Viewing invoice details. Start a new bill to make changes." : "Fast multi-service/product checkout"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {billSaved && (
              <button type="button" className="btn-add" style={{ background: "var(--a-bg)", color: "var(--a-text)", border: "1px solid var(--a-border)" }} onClick={startNewBill}>
                + New Bill
              </button>
            )}
            {!billSaved && (
              <button className="btn-add" disabled={saving}>{saving ? "Saving..." : "Save Bill"}</button>
            )}
          </div>
        </div>

        {/* Saved banner with quick actions */}
        {billSaved && (
          <div style={{ margin: "0 0 1rem", padding: "1rem 1.25rem", background: "rgba(46,125,50,0.06)", border: "1px solid rgba(46,125,50,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.1rem" }}>✅</span>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2e7d32" }}>Bill Saved Successfully</div>
                <div style={{ fontSize: "0.68rem", color: "#666" }}>{bill.client_name} · {bill.invoice_number}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="tbl-btn" onClick={printInvoice}><Printer size={13} /> Print</button>
              <button type="button" className="tbl-btn" onClick={shareInvoice}><Send size={13} /> WhatsApp</button>
              <button type="button" className="btn-add" onClick={startNewBill}>+ New Bill</button>
            </div>
          </div>
        )}

        <fieldset disabled={billSaved} style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="pos-section">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Client Name</label>
                <input className="form-input pos-input" value={bill.client_name} onChange={(e) => setBill({ ...bill, client_name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile or Membership ID</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input className="form-input pos-input" value={bill.mobile} onChange={(e) => setBill({ ...bill, mobile: e.target.value })} placeholder="Phone or MEM-YYYY-XXXXX" required />
                  <button type="button" className="tbl-btn" onClick={lookupCustomer} style={{ flexShrink: 0 }}>Check Membership</button>
                </div>
              </div>
            </div>
            {bill.is_member && (
              <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "rgba(201,185,154,0.08)", border: "1px solid rgba(201,185,154,0.3)", color: "#c9b99a", fontSize: "0.72rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>★ Active Member</strong>
                  {bill.membership_id && <span style={{ marginLeft: "10px", opacity: 0.8 }}>ID: {bill.membership_id}</span>}
                </div>
                {bill.membership_end && (
                  <div>Expires: {new Date(bill.membership_end).toLocaleDateString("en-IN")} <span style={{ marginLeft: "8px", fontWeight: "bold" }}>({getDaysRemaining(bill.membership_end)} days left)</span></div>
                )}
              </div>
            )}
            <div className="form-row" style={{ marginTop: "1rem" }}>
              <div className="form-group" style={{ zIndex: 10 }}>
                <label className="form-label">Staff Name</label>
                <SearchableStaffDropdown staffList={staff} value={bill.staff_name} onChange={(val) => setBill({ ...bill, staff_name: val })} placeholder="Select Staff" isInvalid={attemptedSubmit && !bill.staff_name} />
              </div>
              <div className="form-group">
                <label className="form-label">Billing Date/Time</label>
                <input type="datetime-local" className="form-input" value={bill.billing_at} onChange={(e) => setBill({ ...bill, billing_at: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="pos-section">
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <button type="button" className={`tbl-btn${addTab === "services" ? " active" : ""}`} onClick={() => setAddTab("services")}>✂️ Services</button>
              <button type="button" className={`tbl-btn${addTab === "products" ? " active" : ""}`} onClick={() => setAddTab("products")}>📦 Products ({activeInventory.length} in stock)</button>
            </div>

            {addTab === "services" && (
              <div className="service-picker">
                <select className="form-input" defaultValue="" onChange={(e) => { addService(e.target.value); e.target.value = ""; }}>
                  <option value="" disabled>Select service to add</option>
                  {activeServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.name} — Rs {svc.price_from}{bill.is_member && svc.member_price ? ` (Member: Rs ${svc.member_price})` : ""}
                    </option>
                  ))}
                </select>
                <button type="button" className="tbl-btn" onClick={() => addService(activeServices[0]?.id)}><Plus size={14} /> Quick add</button>
              </div>
            )}

            {addTab === "products" && (
              <div className="service-picker">
                <select className="form-input" defaultValue="" onChange={(e) => { addProduct(e.target.value); e.target.value = ""; }}>
                  <option value="" disabled>Select product to sell</option>
                  {activeInventory.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — Rs {p.unit_price} (Stock: {p.stock_qty})</option>
                  ))}
                </select>
                {activeInventory.length === 0 && <span style={{ fontSize: "0.72rem", color: "#b71c1c", alignSelf: "center" }}>No products in stock</span>}
              </div>
            )}

            <div className="pos-items">
              {bill.items.map((item, index) => (
                <div className="pos-item" key={`${item.service_id || item.inventory_id}-${index}`} style={{ overflow: "visible" }}>
                  <div>
                    <div className="pos-item-name">
                      {item.item_type === "product" && (
                        <span style={{ fontSize: "0.55rem", background: "rgba(201,185,154,0.2)", color: "#c9b99a", padding: "1px 5px", marginRight: "5px", fontWeight: 700, letterSpacing: "0.05em" }}>PRODUCT</span>
                      )}
                      {item.service_name}
                    </div>
                    <div style={{ marginTop: "0.25rem", width: "160px" }}>
                      <SearchableStaffDropdown staffList={staff} value={item.staff_name} onChange={(val) => updateItem(index, { staff_name: val })} placeholder="Select Staff" isInvalid={attemptedSubmit && !item.staff_name} />
                    </div>
                  </div>
                  <input className="mini-input qty" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} />
                  <input className="mini-input price" type="number" min="0" value={item.price} onChange={(e) => updateItem(index, { price: e.target.value })} />
                  <div className="pos-line-total">Rs {(Number(item.quantity || 1) * Number(item.price || 0)).toLocaleString("en-IN")}</div>
                  <button type="button" className="icon-btn danger" onClick={() => removeItem(index)} aria-label="Remove item"><Trash2 size={16} /></button>
                </div>
              ))}
              {!bill.items.length && <div className="admin-empty compact">Add services or products to begin a bill.</div>}
            </div>
          </div>

          <div className="pos-section">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Discount</label>
                <input type="number" min="0" className="form-input" value={bill.discount} onChange={(e) => setBill({ ...bill, discount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Tip Amount</label>
                <input type="number" min="0" className="form-input" value={bill.tip} onChange={(e) => setBill({ ...bill, tip: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">GST / Tax</label>
                <div className="tax-row">
                  <label className="toggle"><input type="checkbox" checked={bill.tax_enabled} onChange={(e) => setBill({ ...bill, tax_enabled: e.target.checked })} /><span className="toggle-slider"></span></label>
                  <input type="number" min="0" className="form-input" value={bill.tax_rate} onChange={(e) => setBill({ ...bill, tax_rate: e.target.value })} disabled={!bill.tax_enabled} />
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-input" value={bill.payment_method} onChange={(e) => setBill({ ...bill, payment_method: e.target.value })}>
                  <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transaction ID</label>
                <input className="form-input" value={bill.transaction_id} onChange={(e) => setBill({ ...bill, transaction_id: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows="2" value={bill.notes} onChange={(e) => setBill({ ...bill, notes: e.target.value })}></textarea>
            </div>
          </div>
        </fieldset>
      </form>

      <aside className="invoice-preview">
        <div className="preview-card printable">
          <div className="invoice-brand">{settings?.name || "Toni & Guy Essensuals Gorantla"}</div>
          <div className="invoice-meta">{invoice?.invoice_number || "Draft invoice"}</div>
          <div className="invoice-client">
            <div>
              {bill.client_name || invoice?.client_name || "Client"}
              {bill.is_member && (
                <span style={{ marginLeft: "8px", background: "#c9b99a", color: "#0d0d0d", fontSize: "0.55rem", padding: "2px 6px", fontWeight: "bold", borderRadius: "2px", textTransform: "uppercase" }}>★ Member</span>
              )}
            </div>
            <span>{bill.mobile || invoice?.mobile || ""}</span>
          </div>
          <div className="invoice-lines">
            {bill.items.map((item, index) => (
              <div className="invoice-line" key={index}>
                <span>
                  {item.item_type === "product" && <span style={{ fontSize: "0.55rem", opacity: 0.7, marginRight: 3 }}>[PKT]</span>}
                  {item.service_name} x{item.quantity}
                </span>
                <strong>Rs {(Number(item.quantity || 1) * Number(item.price || 0)).toLocaleString("en-IN")}</strong>
              </div>
            ))}
          </div>
          <div className="invoice-totals">
            {totals.serviceSubtotal > 0 && <div><span>Services</span><strong>Rs {totals.serviceSubtotal.toLocaleString("en-IN")}</strong></div>}
            {totals.productSubtotal > 0 && <div><span>Products <span style={{ fontSize: "0.6rem", opacity: 0.6 }}>(GST exempt)</span></span><strong>Rs {totals.productSubtotal.toLocaleString("en-IN")}</strong></div>}
            {totals.discount > 0 && <div><span>Discount</span><strong>-Rs {totals.discount.toLocaleString("en-IN")}</strong></div>}
            {totals.serviceSubtotal > 0 && <div><span>Net Services (Before GST)</span><strong>Rs {totals.taxable.toLocaleString("en-IN")}</strong></div>}
            <div><span>GST ({bill.tax_enabled ? bill.tax_rate : 0}%) <span style={{ fontSize: "0.6rem", opacity: 0.6 }}>on services</span></span><strong>Rs {totals.tax.toLocaleString("en-IN")}</strong></div>
            {totals.tip > 0 && <div><span>Tip</span><strong>Rs {totals.tip.toLocaleString("en-IN")}</strong></div>}
            <div className="grand"><span>Grand Total</span><strong>Rs {totals.total.toLocaleString("en-IN")}</strong></div>
          </div>

          <div className="invoice-actions no-print">
            <button type="button" className="tbl-btn" onClick={printInvoice}><Printer size={14} /> Print</button>
            <button type="button" className="tbl-btn" onClick={shareInvoice} title={!invoice ? "Save the bill first" : "Share via WhatsApp"}>
              <Send size={14} /> {invoice ? "WhatsApp" : "WhatsApp (Save first)"}
            </button>
          </div>
        </div>

        <div className="table-wrap history-wrap no-print">
          <div className="table-header">
            <div className="table-title">Invoice History</div>
            <div className="search-inline">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadHistory(search)} placeholder="Search bills" />
            </div>
          </div>
          <div className="history-list">
            {history.map((row) => (
              <button type="button" className="history-row" key={row.id} onClick={() => editInvoice(row.id)}>
                <span><strong>{row.invoice_number}</strong> {row.client_name}</span>
                <span>Rs {row.total.toLocaleString("en-IN")} <Eye size={14} /></span>
              </button>
            ))}
            {loadingHistory && <div className="admin-empty compact">Loading invoices...</div>}
            {!loadingHistory && !history.length && <div className="admin-empty compact">No invoices found.</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}
