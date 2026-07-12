import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Plus, Printer, Search, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAdmin } from "../../layouts/AdminLayout";
import { useSearchParams } from "react-router-dom";
import { calculateInvoiceTotals, deleteInvoice, fetchInvoiceDetails, findCustomerByPhone, saveInvoice, searchInvoices, saveTipSplits, generateAndSaveReviewToken } from "../../lib/api";
import { buildWhatsAppLink, formatInvoiceMessage } from "../../lib/whatsapp";
import SearchableStaffDropdown from "../../components/SearchableStaffDropdown";
import SearchableServiceDropdown from "../../components/SearchableServiceDropdown";


const emptyBill = () => ({
  client_name: "",
  mobile: "",
  customer_id: null,
  is_member: false,
  membership_tier: "Member",
  membership_id: "",
  membership_end: "",
  is_member_signup: false,
  items: [],
  discount: 0,
  tip: 0,
  tip_splits: [],   // [{ staff_name, staff_id, tip_amount }]
  tax_enabled: true,
  tax_rate: 5,
  payment_method: "Cash",
  hybrid_cash: 0,
  hybrid_upi: 0,
  transaction_id: "",
  notes: "",
  staff_name: "",
  billing_at: new Date().toISOString().slice(0, 10),
});


export default function BillingPOS() {
  const { services, settings, staff, attendance, inventory, reload } = useAdmin();
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
  const [viewInvoiceData, setViewInvoiceData] = useState(null);
  const [allTimeSearch, setAllTimeSearch] = useState("");
  const [allTimeResults, setAllTimeResults] = useState([]);
  const [loadingAllTime, setLoadingAllTime] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [customItemModal, setCustomItemModal] = useState(null); // null | { item_type, name, price, quantity, staff_name }



  const activeServices = useMemo(() => (services || []).filter((svc) => svc.active), [services]);
  const activeInventory = useMemo(() => (inventory || []).filter(item => Number(item.stock_qty) > 0), [inventory]);
  const totals = useMemo(() => calculateInvoiceTotals(bill), [bill]);

  const presentStaff = useMemo(() => {
    return (staff || []).filter(s => s.active);
  }, [staff]);

  useEffect(() => {
    if (bill.payment_method === "Cash + UPI") {
      setBill((prev) => {
        const cash = Number(prev.hybrid_cash || 0);
        const total = totals.total;
        const upi = Math.max(0, total - cash);
        return {
          ...prev,
          hybrid_cash: cash > total ? total : cash,
          hybrid_upi: upi
        };
      });
    }
  }, [totals.total, bill.payment_method]);

  // Use a ref so handleViewInvoice (defined below) can be called from useEffect without hoisting issues
  const handleViewInvoiceRef = useRef(null);

  useEffect(() => {
    loadHistory();
    // If ?inv=ID is in URL (from ClientsManager), view that invoice after mount
    const invId = searchParams.get("inv");
    if (invId && handleViewInvoiceRef.current) handleViewInvoiceRef.current(invId);
  }, []);

  const loadHistory = async (term = "") => {
    setLoadingHistory(true);
    try {
      const allInvoices = await searchInvoices(term);
      const todayStr = new Date().toDateString();
      const todaysInvoices = allInvoices.filter(inv => {
        return new Date(inv.billing_at).toDateString() === todayStr;
      });
      setHistory(todaysInvoices);
    }
    catch (err) { toast.error(err.message); }
    finally { setLoadingHistory(false); }
  };

  const handleAllTimeSearch = async (term) => {
    if (!term.trim()) {
      setAllTimeResults([]);
      return;
    }
    setLoadingAllTime(true);
    try {
      const results = await searchInvoices(term);
      setAllTimeResults(results);
    } catch (err) {
      toast.error(err.message || "Failed to search invoices");
    } finally {
      setLoadingAllTime(false);
    }
  };

  const safeParseDate = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === "string" && dateStr.includes("/")) {
      const parts = dateStr.split("/");
      if (parts.length === 3) {
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (parts[2].length === 2) {
          year += 2000;
        }
        return new Date(year, month, day);
      }
    }
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      return new Date();
    }
    if (parsed.getFullYear() < 100) {
      parsed.setFullYear(parsed.getFullYear() + 2000);
    }
    return parsed;
  };

  const getDaysRemaining = (endDateStr) => {
    if (!endDateStr) return 0;
    const end = safeParseDate(endDateStr);
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
      
      const existingIndex = current.items.findIndex(
        (item) => item.item_type === "service" && String(item.service_id) === String(service.id)
      );

      let newItems;
      if (existingIndex > -1) {
        newItems = current.items.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: Number(item.quantity || 1) + 1 } : item
        );
      } else {
        newItems = [
          ...current.items,
          {
            item_type: "service",
            service_id: service.id,
            service_name: service.name,
            quantity: 1,
            price,
            tax_inclusive: service.tax_inclusive !== false,
            staff_name: current.staff_name || "",
          }
        ];
      }

      return {
        ...current,
        items: newItems,
      };
    });
  };

  const addProduct = (productId) => {
    const product = activeInventory.find(p => String(p.id) === String(productId));
    if (!product) return;
    setBill((current) => {
      const existingIndex = current.items.findIndex(
        (item) => item.item_type === "product" && String(item.inventory_id) === String(product.id)
      );

      let newItems;
      if (existingIndex > -1) {
        newItems = current.items.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: Number(item.quantity || 1) + 1 } : item
        );
      } else {
        newItems = [
          ...current.items,
          {
            item_type: "product",
            inventory_id: product.id,
            service_id: null,
            service_name: product.name,
            quantity: 1,
            price: Number(product.unit_price || 0),
            staff_name: current.staff_name || "",
          }
        ];
      }

      return {
        ...current,
        items: newItems,
      };
    });
  };

  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (!customItemModal.name) {
      toast.error("Please enter a name for the custom item");
      return;
    }
    const price = Number(customItemModal.price);
    if (isNaN(price) || price < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    const qty = Number(customItemModal.quantity || 1);

    setBill((current) => {
      const newItem = {
        item_type: customItemModal.item_type,
        service_id: null,
        inventory_id: null,
        service_name: customItemModal.name,
        quantity: qty,
        price,
        tax_inclusive: true,
        staff_name: customItemModal.staff_name || current.staff_name || "",
      };
      return {
        ...current,
        items: [...current.items, newItem]
      };
    });

    toast.success(`Custom ${customItemModal.item_type} added!`);
    setCustomItemModal(null);
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
    const missingItemStaff = bill.items.some(item => !item.staff_name);
    if (missingItemStaff) { toast.error("Please select a staff member for all items"); return; }

    // Validate tip splits if multi-staff and tip > 0
    const uniqueStaffNames = [...new Set((bill.items || []).map(i => i.staff_name).filter(Boolean))];
    const totalTip = Number(bill.tip || 0);
    if (uniqueStaffNames.length >= 2 && totalTip > 0) {
      const splitTotal = (bill.tip_splits || []).reduce((s, ts) => s + Number(ts.tip_amount || 0), 0);
      if (Math.abs(splitTotal - totalTip) > 0.01) {
        toast.error(`Tip splits must add up to Rs ${totalTip}. Currently: Rs ${splitTotal}`);
        return;
      }
    }

    setSaving(true);
    try {
      let transactionId = bill.transaction_id || null;
      if (bill.payment_method === "Cash + UPI") {
        transactionId = `cash:${bill.hybrid_cash || 0}|upi:${bill.hybrid_upi || 0}`;
      }
      const saved = await saveInvoice({
        ...bill,
        staff_name: bill.items[0]?.staff_name || null,
        transaction_id: transactionId,
        billing_at: bill.billing_at
          ? new Date(bill.billing_at + "T12:00:00+05:30").toISOString()
          : new Date().toISOString()
      });

      // Save tip splits for multi-staff bills
      const splitsToSave = uniqueStaffNames.length >= 2 && totalTip > 0
        ? (bill.tip_splits || []).filter(ts => Number(ts.tip_amount) > 0)
        : uniqueStaffNames.length === 1 && totalTip > 0
          ? [{ staff_name: uniqueStaffNames[0], staff_id: null, tip_amount: totalTip }]
          : [];
      if (splitsToSave.length > 0) {
        try { await saveTipSplits(saved.id, splitsToSave); } catch (_) { /* non-critical */ }
      }

      // Generate review token (non-critical, don't block save)
      let reviewToken = null;
      try { reviewToken = await generateAndSaveReviewToken(saved.id); } catch (_) { /* ignore */ }

      setInvoice({ ...saved, review_token: reviewToken });
      setInvoiceItems(bill.items.map((item) => ({ ...item, total: Number(item.quantity || 1) * Number(item.price || 0) })));
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
    setCashReceived("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrintThermal = (invoiceData, itemsData) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Failed to open print window. Please allow popups.");
      return;
    }

    const salonName = settings?.name || "Toni & Guy Essensuals";
    const logoSub = "Gorantla, Guntur";
    const phone = "+91 91002 92525";

    const html = `
      <html>
        <head>
          <title>Receipt - ${invoiceData.invoice_number}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              width: 72mm;
              margin: 0 auto;
              padding: 2mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .bold { font-weight: bold; }
            .divider {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .header-title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 2px;
              text-transform: uppercase;
            }
            .header-sub {
              font-size: 10px;
              margin-bottom: 4px;
            }
            .meta-table, .items-table, .totals-table {
              width: 100%;
              border-collapse: collapse;
            }
            .meta-table td, .items-table td, .totals-table td {
              padding: 2px 0;
              font-size: 11px;
            }
            .items-table th {
              text-align: left;
              font-size: 11px;
              padding: 4px 0;
              border-bottom: 1px dashed #000;
            }
            .totals-table {
              margin-top: 5px;
            }
            .totals-table td {
              padding: 1px 0;
            }
            .totals-table .grand-total {
              font-size: 13px;
              font-weight: bold;
              border-top: 1px dashed #000;
              padding-top: 4px;
            }
            .footer-msg {
              margin-top: 15px;
              font-size: 10px;
            }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; margin-bottom: 10px; padding: 10px; background: #f5f5f0; border-bottom: 1px solid #ccc;">
            <button onclick="window.print()" style="padding: 6px 12px; font-weight: bold; cursor: pointer;">Print Receipt</button>
            <button onclick="window.close()" style="padding: 6px 12px; margin-left: 10px; cursor: pointer;">Close Window</button>
          </div>

          <div class="text-center">
            <div class="header-title">${salonName}</div>
            <div class="header-sub">${logoSub}</div>
            <div class="header-sub">Ph: ${phone}</div>
          </div>
          
          <div class="divider"></div>
          
          <table class="meta-table">
            <tr><td><b>Date:</b> ${new Date(invoiceData.billing_at).toLocaleString("en-IN")}</td></tr>
            <tr><td><b>Invoice #:</b> ${invoiceData.invoice_number}</td></tr>
            <tr><td><b>Name:</b> ${invoiceData.client_name}</td></tr>
            <tr><td><b>Mobile:</b> ${invoiceData.mobile}</td></tr>
            ${invoiceData.payment_method ? `<tr><td><b>Payment:</b> ${
              invoiceData.payment_method === "Cash + UPI" && invoiceData.transaction_id?.includes("cash:") ? (
                (() => {
                  const parts = invoiceData.transaction_id.split("|");
                  let c = 0, u = 0;
                  parts.forEach(p => {
                    if (p.startsWith("cash:")) c = p.replace("cash:", "");
                    if (p.startsWith("upi:")) u = p.replace("upi:", "");
                  });
                  return `Cash + UPI (Cash: Rs ${c}, UPI: Rs ${u})`;
                })()
              ) : invoiceData.payment_method
            }</td></tr>` : ""}
          </table>
          
          <div class="divider"></div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Item / Service</th>
                <th style="text-align: center; width: 30px;">Qty</th>
                <th style="text-align: right; width: 70px;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsData.map(item => `
                <tr>
                  <td>
                    ${item.item_type === "product" ? "[PKT] " : ""}${item.service_name}
                  </td>
                  <td style="text-align: center; vertical-align: top;">${item.quantity}</td>
                  <td style="text-align: right; vertical-align: top;">Rs ${Number((item.item_type === "service" && item.tax_inclusive !== false ? (item.price / 1.05) : item.price) * item.quantity).toFixed(2)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <div class="divider"></div>
          
          <table class="totals-table">
            ${invoiceData.subtotal ? `<tr><td>Subtotal</td><td class="text-right">Rs ${Number(invoiceData.subtotal).toFixed(2)}</td></tr>` : ""}
            ${invoiceData.discount ? `<tr><td>Discount</td><td class="text-right">-Rs ${Number(invoiceData.discount).toFixed(2)}</td></tr>` : ""}
            ${invoiceData.tax ? `<tr><td>GST (${invoiceData.tax_rate || 5}%)</td><td class="text-right">Rs ${Number(invoiceData.tax).toFixed(2)}</td></tr>` : ""}
            ${invoiceData.tip ? `<tr><td>Stylist Tip</td><td class="text-right">Rs ${Number(invoiceData.tip).toFixed(2)}</td></tr>` : ""}
            ${(() => {
              const sub = Number(invoiceData.subtotal || 0);
              const disc = Number(invoiceData.discount || 0);
              const tax = Number(invoiceData.tax || 0);
              const tip = Number(invoiceData.tip || 0);
              const tot = Number(invoiceData.total || 0);
              const roundOff = tot - (sub - disc + tax + tip);
              return Math.abs(roundOff) > 0.01 ? `<tr><td>Round Off</td><td class="text-right">${roundOff > 0 ? "+" : ""}Rs ${roundOff.toFixed(2)}</td></tr>` : "";
            })()}
            <tr class="grand-total">
              <td class="bold">GRAND TOTAL</td>
              <td class="text-right bold">Rs ${Number(invoiceData.total).toFixed(2)}</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <div class="text-center footer-msg">
            <b>Thank you for visiting us!</b><br/>
            Follow us on Instagram<br/>
            @toniandguy_essensual_gorantla
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 800);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleViewInvoice = async (id) => {
    try {
      const details = await fetchInvoiceDetails(id);
      setViewInvoiceData(details);
    } catch (err) {
      toast.error(err.message || "Failed to load invoice details");
    }
  };
  // Assign to ref so useEffect (which runs before const hoisting) can call it
  handleViewInvoiceRef.current = handleViewInvoice;

  const handleEditInvoice = (invoiceData, itemsData) => {
    const invoiceDate = new Date(invoiceData.billing_at);
    const today = new Date();
    if (invoiceDate.toDateString() !== today.toDateString()) {
      toast.error("Only today's invoices can be edited.");
      return;
    }

    const loadedItems = itemsData.map(item => ({
      service_id: item.service_id,
      inventory_id: item.inventory_id,
      service_name: item.service_name,
      item_type: item.item_type || "service",
      quantity: item.quantity,
      price: item.price,
      tax_inclusive: item.tax_inclusive !== false,
      staff_name: item.staff_name
    }));
    
    const subtotal = loadedItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountPct = subtotal > 0 ? Math.round((Number(invoiceData.discount || 0) / subtotal) * 100) : 0;

    setBill({
      id: invoiceData.id,
      invoice_number: invoiceData.invoice_number,
      customer_id: invoiceData.customer_id,
      client_name: invoiceData.client_name,
      mobile: invoiceData.mobile,
      customer_notes: invoiceData.customer?.notes || "",
      is_member: !!invoiceData.customer?.is_member,
      membership_tier: invoiceData.customer?.membership_tier || "Member",
      membership_id: invoiceData.customer?.membership_id || "",
      membership_end: invoiceData.customer?.membership_end || "",
      staff_name: invoiceData.staff_name,
      billing_at: new Date(invoiceData.billing_at).toISOString().slice(0, 10),
      discount: String(discountPct),
      tip: String(invoiceData.tip || 0),
      tax_enabled: Number(invoiceData.tax_rate || 0) > 0,
      tax_rate: Number(invoiceData.tax_rate || 5),
      payment_method: invoiceData.payment_method || "Cash",
      transaction_id: invoiceData.transaction_id || "",
      notes: invoiceData.notes || "",
      items: loadedItems
    });
    setCashReceived("");
    setBillSaved(false);
    setViewInvoiceData(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success(`Loaded invoice ${invoiceData.invoice_number} for editing.`);
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm("Are you sure you want to delete/void this invoice? This action cannot be undone.")) return;
    try {
      await deleteInvoice(invoiceId);
      toast.success("Invoice deleted successfully");
      setViewInvoiceData(null);
      loadHistory(search);
      if (reload) reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete invoice");
    }
  };

  const printInvoice = () => {
    if (invoice) {
      handlePrintThermal(invoice, invoiceItems);
    } else {
      toast.error("Please save the bill first before printing.");
    }
  };

  const shareInvoice = () => {
    if (!invoice) {
      toast.error("Please save the bill first before sharing on WhatsApp.");
      return;
    }
    const appBase = window.location.origin;
    const reviewUrl = invoice.review_token
      ? `${appBase}/review?token=${invoice.review_token}`
      : null;
    const invData = { ...invoice, is_member: bill.is_member, membership_tier: bill.membership_tier };
    const url = buildWhatsAppLink(invoice.mobile, formatInvoiceMessage(invData, invoiceItems, settings, reviewUrl));
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
            {bill.is_member ? (
              <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "rgba(201,185,154,0.08)", border: "1px solid rgba(201,185,154,0.3)", color: "#c9b99a", fontSize: "0.72rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>★ Active Member</strong>
                  {bill.membership_id && <span style={{ marginLeft: "10px", opacity: 0.8 }}>ID: {bill.membership_id}</span>}
                </div>
                {bill.membership_end && (
                  <div>Expires: {safeParseDate(bill.membership_end).toLocaleDateString("en-IN")} <span style={{ marginLeft: "8px", fontWeight: "bold" }}>({getDaysRemaining(bill.membership_end)} days left)</span></div>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input 
                  type="checkbox" 
                  id="add-membership-toggle" 
                  checked={bill.is_member_signup || false} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setBill((current) => {
                      let updatedItems = current.items.map(item => {
                        if (item.item_type === "product" || item.item_type === "membership") return item;
                        const svc = activeServices.find(s => String(s.id) === String(item.service_id));
                        if (svc && checked && svc.member_price != null && svc.member_price > 0) {
                          return { ...item, price: svc.member_price };
                        }
                        if (svc && !checked) {
                          return { ...item, price: Number(svc.price_from || 0) };
                        }
                        return item;
                      });

                      if (checked) {
                        const hasMem = updatedItems.some(item => item.item_type === "membership");
                        if (!hasMem) {
                          updatedItems = [
                            ...updatedItems,
                            {
                              item_type: "membership",
                              service_name: "Membership Signup",
                              quantity: 1,
                              price: 100,
                              staff_name: current.staff_name || "",
                            }
                          ];
                        }
                      } else {
                        updatedItems = updatedItems.filter(item => item.item_type !== "membership");
                      }

                      return {
                        ...current,
                        is_member: checked,
                        is_member_signup: checked,
                        membership_tier: checked ? "Member" : "Regular",
                        items: updatedItems,
                      };
                    });
                  }}
                  style={{ accentColor: "var(--gold)", width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label htmlFor="add-membership-toggle" style={{ fontSize: "0.75rem", color: "var(--gold)", cursor: "pointer", fontWeight: 600 }}>
                  ★ Add Membership directly (Apply member pricing immediately)
                </label>
              </div>
            )}
            <div className="form-row" style={{ marginTop: "1rem" }}>
              <div className="form-group">
                <label className="form-label">Billing Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={bill.billing_at}
                  onChange={(e) => setBill({ ...bill, billing_at: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="pos-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="button" className={`tbl-btn${addTab === "services" ? " active" : ""}`} onClick={() => setAddTab("services")}>✂️ Services</button>
                <button type="button" className={`tbl-btn${addTab === "products" ? " active" : ""}`} onClick={() => setAddTab("products")}>📦 Products ({activeInventory.length} in stock)</button>
              </div>
              <button type="button" className="btn-add" disabled={billSaved} onClick={() => setCustomItemModal({ item_type: "service", name: "", price: "", quantity: 1, staff_name: bill.items[0]?.staff_name || "" })} style={{ fontSize: "0.72rem", padding: "0.4rem 0.8rem" }}>
                ✨ Add Custom Item
              </button>
            </div>


            {addTab === "services" && (
              <div className="service-picker" style={{ width: "100%", display: "block" }}>
                <SearchableServiceDropdown 
                  servicesList={activeServices} 
                  value={""} 
                  onChange={addService} 
                  disabled={billSaved} 
                  isMember={bill.is_member} 
                />
              </div>
            )}

            {addTab === "products" && (
              <div className="service-picker">
                <select 
                  className="form-input" 
                  value="" 
                  onChange={(e) => { 
                    if (e.target.value) {
                      addProduct(e.target.value); 
                    }
                  }}
                  disabled={billSaved}
                >
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
                      <SearchableStaffDropdown staffList={presentStaff} value={item.staff_name} onChange={(val) => updateItem(index, { staff_name: val })} placeholder="Select Staff" isInvalid={attemptedSubmit && !item.staff_name} />
                    </div>
                    {item.item_type === "service" && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", marginTop: "0.4rem", fontSize: "0.72rem", cursor: "pointer", color: "var(--gold)", userSelect: "none" }}>
                        <input 
                          type="checkbox" 
                          checked={item.tax_inclusive !== false} 
                          onChange={(e) => updateItem(index, { tax_inclusive: e.target.checked })} 
                          style={{ width: "13px", height: "13px", cursor: "pointer", accentColor: "var(--gold)" }} 
                        />
                        GST Inclusive
                      </label>
                    )}
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
                <label className="form-label">Discount (%)</label>
                <input type="number" min="0" max="100" className="form-input" value={bill.discount} onChange={(e) => {
                  let val = e.target.value;
                  if (val !== "") {
                    val = String(Math.min(100, Math.max(0, Number(val))));
                  }
                  setBill({ ...bill, discount: val });
                }} />
              </div>
              <div className="form-group">
                <label className="form-label">Tip Amount</label>
                <input type="number" min="0" className="form-input" value={bill.tip} onChange={(e) => {
                  const newTip = Number(e.target.value) || 0;
                  setBill(prev => {
                    // Re-distribute tip evenly across staff if splits exist
                    const uniqueStaff = [...new Set((prev.items || []).map(i => i.staff_name).filter(Boolean))];
                    const newSplits = uniqueStaff.length >= 2
                      ? uniqueStaff.map((name, idx) => ({
                          staff_name: name,
                          staff_id: null,
                          tip_amount: idx === 0 ? newTip - Math.floor(newTip / uniqueStaff.length) * (uniqueStaff.length - 1) : Math.floor(newTip / uniqueStaff.length),
                        }))
                      : prev.tip_splits;
                    return { ...prev, tip: e.target.value, tip_splits: newSplits };
                  });
                }} />
              </div>
              <div className="form-group">
                <label className="form-label">GST / Tax</label>
                <div className="tax-row">
                  <label className="toggle"><input type="checkbox" checked={bill.tax_enabled} onChange={(e) => setBill({ ...bill, tax_enabled: e.target.checked })} /><span className="toggle-slider"></span></label>
                  <input type="number" min="0" className="form-input" value={bill.tax_rate} onChange={(e) => setBill({ ...bill, tax_rate: e.target.value })} disabled={!bill.tax_enabled} />
                </div>
              </div>
            </div>
            {/* Tip Split Panel — appears when 2+ staff on bill and tip > 0 */}
            {(() => {
              const uniqueStaff = [...new Set((bill.items || []).map(i => i.staff_name).filter(Boolean))];
              const totalTip = Number(bill.tip || 0);
              if (uniqueStaff.length < 2 || totalTip <= 0) return null;
              const splits = bill.tip_splits || [];
              const distributed = splits.reduce((s, ts) => s + Number(ts.tip_amount || 0), 0);
              const isBalanced = Math.abs(distributed - totalTip) < 0.01;
              return (
                <div style={{ margin: "0.75rem 0", padding: "1rem", background: "rgba(201,185,154,0.06)", border: `1px solid ${isBalanced ? "rgba(46,125,50,0.3)" : "rgba(201,185,154,0.3)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--gold)" }}>
                      💡 Tip Distribution
                    </div>
                    <button type="button" className="tbl-btn" style={{ fontSize: "0.65rem" }} onClick={() => {
                      const perStaff = Math.floor(totalTip / uniqueStaff.length);
                      const newSplits = uniqueStaff.map((name, idx) => ({
                        staff_name: name,
                        staff_id: null,
                        tip_amount: idx === 0 ? totalTip - perStaff * (uniqueStaff.length - 1) : perStaff,
                      }));
                      setBill(prev => ({ ...prev, tip_splits: newSplits }));
                    }}>
                      Auto-Split Equally
                    </button>
                  </div>
                  {uniqueStaff.map((staffName) => {
                    const split = splits.find(s => s.staff_name === staffName);
                    const splitAmt = split ? split.tip_amount : 0;
                    const serviceCount = (bill.items || []).filter(i => i.staff_name === staffName).length;
                    return (
                      <div key={staffName} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                        <span style={{ flex: 1, fontSize: "0.78rem", fontWeight: 600 }}>{staffName}</span>
                        <span style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{serviceCount} service{serviceCount !== 1 ? "s" : ""}</span>
                        <input
                          type="number"
                          min="0"
                          max={totalTip}
                          className="form-input"
                          style={{ width: "100px" }}
                          value={splitAmt}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0;
                            setBill(prev => {
                              const prevSplits = prev.tip_splits || [];
                              const idx = prevSplits.findIndex(s => s.staff_name === staffName);
                              const newSplits = idx >= 0
                                ? prevSplits.map((s, i) => i === idx ? { ...s, tip_amount: val } : s)
                                : [...prevSplits, { staff_name: staffName, staff_id: null, tip_amount: val }];
                              return { ...prev, tip_splits: newSplits };
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                  <div style={{ fontSize: "0.72rem", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--a-border)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--a-muted)" }}>Distributed:</span>
                    <span style={{ fontWeight: 700, color: isBalanced ? "#2e7d32" : "#b71c1c" }}>
                      Rs {distributed} / Rs {totalTip} {isBalanced ? "✓" : "⚠ Must match"}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select 
                  className="form-input" 
                  value={bill.payment_method} 
                  onChange={(e) => {
                    const method = e.target.value;
                    setCashReceived("");
                    setBill((prev) => {
                      const updated = { ...prev, payment_method: method };
                      if (method === "Cash + UPI") {
                        updated.hybrid_cash = totals.total;
                        updated.hybrid_upi = 0;
                      }
                      return updated;
                    });
                  }}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Cash + UPI">Cash + UPI</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transaction ID</label>
                <input 
                  className="form-input" 
                  value={bill.transaction_id} 
                  onChange={(e) => setBill({ ...bill, transaction_id: e.target.value })} 
                  disabled={bill.payment_method === "Cash + UPI"}
                  placeholder={bill.payment_method === "Cash + UPI" ? "Managed by split inputs" : "Txn / Ref number"}
                />
              </div>
            </div>
            {bill.payment_method === "Cash + UPI" && (
              <div className="form-row" style={{ marginTop: "0.5rem", background: "rgba(255,255,255,0.02)", padding: "1rem", border: "1px solid var(--a-border)", display: "flex", gap: "1rem" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" style={{ color: "var(--gold)" }}>Cash Portion (Rs)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max={totals.total}
                    className="form-input" 
                    value={bill.hybrid_cash || 0} 
                    onChange={(e) => {
                      const cashVal = Math.min(totals.total, Math.max(0, Number(e.target.value) || 0));
                      setBill(prev => ({
                        ...prev,
                        hybrid_cash: cashVal,
                        hybrid_upi: Math.max(0, totals.total - cashVal)
                      }));
                    }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" style={{ color: "var(--gold)" }}>UPI Portion (Rs)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max={totals.total}
                    className="form-input" 
                    value={bill.hybrid_upi || 0} 
                    onChange={(e) => {
                      const upiVal = Math.min(totals.total, Math.max(0, Number(e.target.value) || 0));
                      setBill(prev => ({
                        ...prev,
                        hybrid_upi: upiVal,
                        hybrid_cash: Math.max(0, totals.total - upiVal)
                      }));
                    }}
                  />
                </div>
              </div>
            )}
            {(bill.payment_method === "Cash" || bill.payment_method === "Cash + UPI") && (
              <div className="form-row" style={{ marginTop: "1.25rem", background: "rgba(201,185,154,0.04)", padding: "1.25rem", border: "1px dashed var(--a-gold, #c9b99a)", display: "flex", gap: "1rem", flexDirection: "column" }}>
                <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-gold, #c9b99a)", fontWeight: 600 }}>💵 Cash Change Calculator</div>
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", width: "100%" }}>
                  <div className="form-group" style={{ flex: 1, minWidth: "150px" }}>
                    <label className="form-label">Cash Received (Rs)</label>
                    <input 
                      type="number" 
                      min="0"
                      className="form-input" 
                      placeholder="e.g. 500, 1000, 2000"
                      value={cashReceived} 
                      onChange={(e) => setCashReceived(e.target.value)} 
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: "150px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <span className="form-label">Change to Return</span>
                    <strong style={{ fontSize: "1.25rem", color: (Number(cashReceived || 0) - (bill.payment_method === "Cash" ? totals.total : (bill.hybrid_cash || 0))) > 0 ? "var(--a-green, #2e7d32)" : "var(--a-text)" }}>
                      Rs {Math.max(0, Number(cashReceived || 0) - (bill.payment_method === "Cash" ? totals.total : (bill.hybrid_cash || 0))).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>
            )}
            <div className="form-group" style={{ marginTop: "1.25rem" }}>
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
                <strong>Rs {Number((item.item_type === "service" && item.tax_inclusive !== false ? (item.price / 1.05) : item.price) * (item.quantity || 1)).toLocaleString("en-IN")}</strong>
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
            {totals.roundOff !== 0 && (
              <div>
                <span>Round Off</span>
                <strong>{totals.roundOff > 0 ? "+" : ""}Rs {totals.roundOff.toFixed(2)}</strong>
              </div>
            )}
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
              <button type="button" className="history-row" key={row.id} onClick={() => handleViewInvoice(row.id)}>
                <span><strong>{row.invoice_number}</strong> {row.client_name}</span>
                <span>Rs {row.total.toLocaleString("en-IN")} <Eye size={14} /></span>
              </button>
            ))}
            {loadingHistory && <div className="admin-empty compact">Loading invoices...</div>}
            {!loadingHistory && !history.length && <div className="admin-empty compact">No invoices found.</div>}
          </div>
        </div>

        <div className="table-wrap history-wrap no-print" style={{ marginTop: "1rem" }}>
          <div className="table-header">
            <div className="table-title">Search Invoices (All-Time)</div>
            <div className="search-inline">
              <Search size={15} />
              <input 
                value={allTimeSearch} 
                onChange={(e) => setAllTimeSearch(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && handleAllTimeSearch(allTimeSearch)} 
                placeholder="Invoice # or Mobile..." 
              />
            </div>
          </div>
          <div className="history-list" style={{ maxHeight: "250px" }}>
            {allTimeResults.map((row) => (
              <button type="button" className="history-row" key={row.id} onClick={() => handleViewInvoice(row.id)}>
                <span><strong>{row.invoice_number}</strong> {row.client_name}</span>
                <span>Rs {row.total.toLocaleString("en-IN")} <Eye size={14} /></span>
              </button>
            ))}
            {loadingAllTime && <div className="admin-empty compact">Searching invoices...</div>}
            {!loadingAllTime && !allTimeResults.length && allTimeSearch && <div className="admin-empty compact">No matching invoices.</div>}
            {!allTimeSearch && <div className="admin-empty compact" style={{ color: "#aaa" }}>Enter invoice number or phone to search.</div>}
          </div>
        </div>
      </aside>

      {/* View Invoice Modal Overlay */}
      {viewInvoiceData && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <div className="modal-title">Receipt Details</div>
              <button type="button" className="modal-close" onClick={() => setViewInvoiceData(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: "1.5rem" }}>
              <div className="preview-card" style={{ border: "1px solid var(--a-border)", background: "#fff", padding: "1.5rem" }}>
                <div className="invoice-brand" style={{ fontSize: "1.4rem", textAlign: "center" }}>
                  {settings?.name || "Toni & Guy Essensuals"}
                </div>
                <div className="invoice-meta" style={{ textAlign: "center", marginBottom: "1rem" }}>
                  {viewInvoiceData.invoice.invoice_number}
                </div>
                
                <div style={{ fontSize: "0.75rem", borderTop: "1px solid var(--a-border)", borderBottom: "1px solid var(--a-border)", padding: "0.6rem 0", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#666" }}>Date:</span>
                    <strong>{new Date(viewInvoiceData.invoice.billing_at).toLocaleString("en-IN")}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#666" }}>Client:</span>
                    <strong>{viewInvoiceData.invoice.client_name} ({viewInvoiceData.invoice.mobile})</strong>
                  </div>

                  {viewInvoiceData.invoice.payment_method && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#666" }}>Payment Method:</span>
                      <strong>
                        {viewInvoiceData.invoice.payment_method === "Cash + UPI" && viewInvoiceData.invoice.transaction_id?.includes("cash:") ? (
                          (() => {
                            const parts = viewInvoiceData.invoice.transaction_id.split("|");
                            let c = 0, u = 0;
                            parts.forEach(p => {
                              if (p.startsWith("cash:")) c = p.replace("cash:", "");
                              if (p.startsWith("upi:")) u = p.replace("upi:", "");
                            });
                            return `Cash + UPI (Cash: Rs ${c}, UPI: Rs ${u})`;
                          })()
                        ) : viewInvoiceData.invoice.payment_method}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="invoice-lines" style={{ padding: "1rem 0", minHeight: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {viewInvoiceData.items.map((item, index) => (
                    <div className="invoice-line" key={index} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span>
                        {item.item_type === "product" && <span style={{ opacity: 0.6, marginRight: 4 }}>[PKT]</span>}
                        {item.service_name} x{item.quantity}
                        {item.staff_name && <small style={{ display: "block", color: "#888", fontSize: "0.65rem" }}>({item.staff_name})</small>}
                      </span>
                      <strong>Rs {Number((item.item_type === "service" && item.tax_inclusive !== false ? (item.price / 1.05) : item.price) * item.quantity).toLocaleString("en-IN")}</strong>
                    </div>
                  ))}
                </div>

                <div className="invoice-totals" style={{ borderTop: "1px solid var(--a-border)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.75rem" }}>
                  {Number(viewInvoiceData.invoice.subtotal || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Subtotal</span>
                      <strong>Rs {Number(viewInvoiceData.invoice.subtotal).toLocaleString("en-IN")}</strong>
                    </div>
                  )}
                  {Number(viewInvoiceData.invoice.discount || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Discount</span>
                      <strong>-Rs {Number(viewInvoiceData.invoice.discount).toLocaleString("en-IN")}</strong>
                    </div>
                  )}
                  {Number(viewInvoiceData.invoice.tax || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>GST ({viewInvoiceData.invoice.tax_rate || 5}%)</span>
                      <strong>Rs {Number(viewInvoiceData.invoice.tax).toLocaleString("en-IN")}</strong>
                    </div>
                  )}
                  {Number(viewInvoiceData.invoice.tip || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Stylist Tip</span>
                      <strong>Rs {Number(viewInvoiceData.invoice.tip).toLocaleString("en-IN")}</strong>
                    </div>
                  )}
                  {(() => {
                    const sub = Number(viewInvoiceData.invoice.subtotal || 0);
                    const disc = Number(viewInvoiceData.invoice.discount || 0);
                    const tax = Number(viewInvoiceData.invoice.tax || 0);
                    const tip = Number(viewInvoiceData.invoice.tip || 0);
                    const tot = Number(viewInvoiceData.invoice.total || 0);
                    const roundOff = tot - (sub - disc + tax + tip);
                    return Math.abs(roundOff) > 0.01 ? (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Round Off</span>
                        <strong>{roundOff > 0 ? "+" : ""}Rs {roundOff.toFixed(2)}</strong>
                      </div>
                    ) : null;
                  })()}
                  <div className="grand" style={{ borderTop: "1px solid var(--a-border)", paddingTop: "0.5rem", marginTop: "0.2rem", fontSize: "0.95rem", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: "bold" }}>Grand Total</span>
                    <strong style={{ color: "var(--a-text)" }}>Rs {Number(viewInvoiceData.invoice.total).toLocaleString("en-IN")}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {new Date(viewInvoiceData.invoice.billing_at).toDateString() === new Date().toDateString() && (
                <>
                  <button 
                    type="button" 
                    className="tbl-btn" 
                    style={{ background: "rgba(201,185,154,0.15)", border: "1px solid var(--gold)", color: "var(--gold)", fontWeight: "bold" }}
                    onClick={() => handleEditInvoice(viewInvoiceData.invoice, viewInvoiceData.items)}
                  >
                    Edit Invoice
                  </button>
                  <button 
                    type="button" 
                    className="tbl-btn danger" 
                    style={{ background: "rgba(211, 47, 47, 0.1)", border: "1px solid #d32f2f", color: "#d32f2f", fontWeight: "bold" }}
                    onClick={() => handleDeleteInvoice(viewInvoiceData.invoice.id)}
                  >
                    Delete Invoice
                  </button>
                </>
              )}
              <button 
                type="button" 
                className="tbl-btn" 
                onClick={async () => {
                  const appBase = window.location.origin;
                  let token = viewInvoiceData.invoice.review_token;
                  
                  // Open a blank tab synchronously to prevent popup blocker
                  const newWindow = window.open("", "_blank");
                  
                  try {
                    if (!token) {
                      token = await generateAndSaveReviewToken(viewInvoiceData.invoice.id);
                      viewInvoiceData.invoice.review_token = token;
                    }
                    const reviewUrl = token ? `${appBase}/review?token=${token}` : `${appBase}/review`;
                    const invData = { ...viewInvoiceData.invoice, is_member: !!viewInvoiceData.invoice.customer?.is_member };
                    const url = buildWhatsAppLink(viewInvoiceData.invoice.mobile, formatInvoiceMessage(invData, viewInvoiceData.items, settings, reviewUrl));
                    
                    if (newWindow) {
                      newWindow.location.href = url;
                    }
                  } catch (err) {
                    console.error("Failed to share WhatsApp review link", err);
                    if (newWindow) newWindow.close();
                    toast.error("Failed to generate unique review link.");
                  }
                }}
              >
                Share WhatsApp
              </button>
              <button 
                type="button" 
                className="tbl-btn" 
                onClick={() => handlePrintThermal(viewInvoiceData.invoice, viewInvoiceData.items)}
              >
                Print Receipt
              </button>
              <button type="button" className="btn-add" onClick={() => setViewInvoiceData(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Item Modal */}
      {customItemModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCustomItemModal(null)}>
          <div className="modal" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <div className="modal-title">Add Custom Non-Existing Item</div>
              <button className="modal-close" onClick={() => setCustomItemModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="custom-item-form" onSubmit={handleAddCustomItem}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Item Type *</label>
                  <select 
                    className="form-input" 
                    value={customItemModal.item_type} 
                    onChange={e => setCustomItemModal({ ...customItemModal, item_type: e.target.value })}
                    required
                  >
                    <option value="service">✂️ Service (e.g. Special Haircut)</option>
                    <option value="product">📦 Retail Product (e.g. Specific Shampoo)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Name / Description *</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={customItemModal.name} 
                    onChange={e => setCustomItemModal({ ...customItemModal, name: e.target.value })} 
                    placeholder="Enter custom service or product name" 
                    required 
                  />
                </div>

                <div className="form-row" style={{ marginBottom: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Price (₹) *</label>
                    <input 
                      type="number" 
                      min="0" 
                      className="form-input" 
                      value={customItemModal.price} 
                      onChange={e => setCustomItemModal({ ...customItemModal, price: e.target.value })} 
                      placeholder="e.g. 500" 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input 
                      type="number" 
                      min="1" 
                      className="form-input" 
                      value={customItemModal.quantity} 
                      onChange={e => setCustomItemModal({ ...customItemModal, quantity: Number(e.target.value) || 1 })} 
                      required 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: "0.5rem" }}>
                  <label className="form-label">Staff Served</label>
                  <SearchableStaffDropdown 
                    staffList={presentStaff} 
                    value={customItemModal.staff_name} 
                    onChange={(val) => setCustomItemModal({ ...customItemModal, staff_name: val })} 
                    placeholder="Select Staff" 
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setCustomItemModal(null)}>Cancel</button>
              <button type="submit" form="custom-item-form" className="btn-add">Add to Bill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
