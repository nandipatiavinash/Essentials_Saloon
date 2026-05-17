import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Printer, Search, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdmin } from "../../layouts/AdminLayout";
import { calculateInvoiceTotals, fetchInvoiceDetails, findCustomerByPhone, saveInvoice, searchInvoices } from "../../lib/api";
import { buildWhatsAppLink, formatInvoiceMessage } from "../../lib/whatsapp";

const emptyBill = () => ({
  client_name: "",
  mobile: "",
  customer_id: null,
  items: [],
  discount: 0,
  tax_enabled: false,
  tax_rate: 18,
  payment_method: "Cash",
  transaction_id: "",
  notes: "",
  staff_name: "",
  billing_at: new Date().toISOString().slice(0, 16),
});

export default function BillingPOS() {
  const { services, settings, reload } = useAdmin();
  const [bill, setBill] = useState(emptyBill);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  const activeServices = useMemo(() => (services || []).filter((svc) => svc.active), [services]);
  const totals = useMemo(() => calculateInvoiceTotals(bill), [bill]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async (term = "") => {
    setLoadingHistory(true);
    try {
      setHistory(await searchInvoices(term));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  const lookupCustomer = async () => {
    if (bill.mobile.replace(/\D/g, "").length < 8) return;
    try {
      const customer = await findCustomerByPhone(bill.mobile);
      if (customer) {
        setBill((current) => ({
          ...current,
          customer_id: customer.id,
          client_name: current.client_name || customer.name,
          mobile: customer.mobile,
          customer_notes: customer.notes || "",
        }));
        toast.success(`Returning client: ${customer.visit_count} visits`);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addService = (serviceId) => {
    const service = activeServices.find((svc) => String(svc.id) === String(serviceId));
    if (!service) return;
    setBill((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          service_id: service.id,
          service_name: service.name,
          quantity: 1,
          price: Number(service.price_from || 0),
          staff_name: current.staff_name || "",
        },
      ],
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
    setSaving(true);
    try {
      const saved = await saveInvoice({ ...bill, billing_at: new Date(bill.billing_at).toISOString() });
      setInvoice(saved);
      setInvoiceItems(bill.items.map((item) => ({ ...item, total: Number(item.quantity || 1) * Number(item.price || 0) })));
      toast.success(saved.id === bill.id ? "Invoice updated" : "Invoice saved");
      setBill(emptyBill());
      await Promise.all([loadHistory(search), reload()]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
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
        items: details.items,
        discount: details.invoice.discount,
        tax_enabled: Number(details.invoice.tax || 0) > 0,
        tax_rate: details.invoice.tax_rate || 0,
        payment_method: details.invoice.payment_method,
        transaction_id: details.invoice.transaction_id || "",
        notes: details.invoice.notes || "",
        staff_name: details.invoice.staff_name || "",
        billing_at: new Date(details.invoice.billing_at).toISOString().slice(0, 16),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const printInvoice = () => window.print();

  const shareInvoice = () => {
    if (!invoice) return;
    window.open(buildWhatsAppLink(invoice.mobile, formatInvoiceMessage(invoice, invoiceItems, settings)), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="pos-grid">
      <form className="pos-panel" onSubmit={submitBill}>
        <div className="pos-header">
          <div>
            <div className="table-title">{bill.id ? "Edit Invoice" : "New Billing"}</div>
            <div className="pos-sub">Fast multi-service salon checkout</div>
          </div>
          <button className="btn-add" disabled={saving}>{saving ? "Saving..." : "Save Bill"}</button>
        </div>

        <div className="pos-section">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client Name</label>
              <input className="form-input pos-input" value={bill.client_name} onChange={(e) => setBill({ ...bill, client_name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input className="form-input pos-input" value={bill.mobile} onBlur={lookupCustomer} onChange={(e) => setBill({ ...bill, mobile: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Staff Name</label>
              <input className="form-input" value={bill.staff_name} onChange={(e) => setBill({ ...bill, staff_name: e.target.value })} placeholder="Future operator tracking" />
            </div>
            <div className="form-group">
              <label className="form-label">Billing Date/Time</label>
              <input type="datetime-local" className="form-input" value={bill.billing_at} onChange={(e) => setBill({ ...bill, billing_at: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="pos-section">
          <div className="service-picker">
            <select className="form-input" defaultValue="" onChange={(e) => { addService(e.target.value); e.target.value = ""; }}>
              <option value="" disabled>Select service to add</option>
              {activeServices.map((svc) => <option key={svc.id} value={svc.id}>{svc.name} - Rs {svc.price_from}</option>)}
            </select>
            <button type="button" className="tbl-btn" onClick={() => addService(activeServices[0]?.id)}><Plus size={14} /> Quick add</button>
          </div>

          <div className="pos-items">
            {bill.items.map((item, index) => (
              <div className="pos-item" key={`${item.service_id}-${index}`}>
                <div>
                  <div className="pos-item-name">{item.service_name}</div>
                  <input className="mini-input" value={item.staff_name || ""} onChange={(e) => updateItem(index, { staff_name: e.target.value })} placeholder="Staff" />
                </div>
                <input className="mini-input qty" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} />
                <input className="mini-input price" type="number" min="0" value={item.price} onChange={(e) => updateItem(index, { price: e.target.value })} />
                <div className="pos-line-total">Rs {(Number(item.quantity || 1) * Number(item.price || 0)).toLocaleString("en-IN")}</div>
                <button type="button" className="icon-btn danger" onClick={() => removeItem(index)} aria-label="Remove service"><Trash2 size={16} /></button>
              </div>
            ))}
            {!bill.items.length && <div className="admin-empty compact">Add services from your database to begin a bill.</div>}
          </div>
        </div>

        <div className="pos-section">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Discount</label>
              <input type="number" min="0" className="form-input" value={bill.discount} onChange={(e) => setBill({ ...bill, discount: e.target.value })} />
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
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Bank Transfer</option>
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
      </form>

      <aside className="invoice-preview">
        <div className="preview-card printable">
          <div className="invoice-brand">{settings?.name || "Essensuals"}</div>
          <div className="invoice-meta">{invoice?.invoice_number || "Draft invoice"}</div>
          <div className="invoice-client">{bill.client_name || invoice?.client_name || "Client"}<span>{bill.mobile || invoice?.mobile || ""}</span></div>
          <div className="invoice-lines">
            {bill.items.map((item, index) => (
              <div className="invoice-line" key={index}>
                <span>{item.service_name} x{item.quantity}</span>
                <strong>Rs {(Number(item.quantity || 1) * Number(item.price || 0)).toLocaleString("en-IN")}</strong>
              </div>
            ))}
          </div>
          <div className="invoice-totals">
            <div><span>Subtotal</span><strong>Rs {totals.subtotal.toLocaleString("en-IN")}</strong></div>
            <div><span>Discount</span><strong>Rs {totals.discount.toLocaleString("en-IN")}</strong></div>
            <div><span>Tax</span><strong>Rs {totals.tax.toLocaleString("en-IN")}</strong></div>
            <div className="grand"><span>Total</span><strong>Rs {totals.total.toLocaleString("en-IN")}</strong></div>
          </div>
          <div className="invoice-actions no-print">
            <button type="button" className="tbl-btn" onClick={printInvoice}><Printer size={14} /> Print</button>
            <button type="button" className="tbl-btn" disabled={!invoice} onClick={shareInvoice}><Send size={14} /> WhatsApp</button>
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
                <span><strong>{row.invoice_number}</strong>{row.client_name}</span>
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
