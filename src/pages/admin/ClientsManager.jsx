import { useMemo, useState, useEffect } from "react";
import { Phone, Search, UserRound, ArrowUpDown } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { supabase } from "../../lib/supabase";
import { fetchInvoiceDetails, generateAndSaveReviewToken } from "../../lib/api";
import { buildWhatsAppLink, formatInvoiceMessage } from "../../lib/whatsapp";
import toast from "react-hot-toast";

export default function ClientsManager() {
  const { customers, invoices, settings } = useAdmin();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  
  // --- TABS & SORTING STATE ---
  const [activeTab, setActiveTab] = useState("all"); // all | inactive
  const [sortOrder, setSortOrder] = useState("default"); // default | asc | desc
  const [inactiveData, setInactiveData] = useState([]);
  const [loadingInactive, setLoadingInactive] = useState(false);
  const [viewInvoiceData, setViewInvoiceData] = useState(null);

  // --- TAB 1: ALL CLIENTS FILTER & SORT ---
  const filteredAndSortedAll = useMemo(() => {
    const term = search.toLowerCase();
    let result = (customers || []).filter((client) =>
      client.name?.toLowerCase().includes(term) || client.mobile?.includes(term)
    );
    
    if (sortOrder === "asc") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortOrder === "desc") {
      result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }
    
    return result;
  }, [customers, search, sortOrder]);

  const selected = filteredAndSortedAll.find((client) => client.id === selectedId) || filteredAndSortedAll[0];
  const clientInvoices = (invoices || []).filter((invoice) => invoice.customer_id === selected?.id);
  const repeatClients = (customers || []).filter((client) => Number(client.visit_count || 0) > 1).length;

  // --- TAB 2: FETCH INACTIVE CLIENTS HISTORY (45+ Days) ---
  useEffect(() => {
    const fetchInactiveClientsData = async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 45);
      
      const inactiveList = (customers || []).filter(c => c.last_visit_at && new Date(c.last_visit_at) <= cutoff);
      if (inactiveList.length === 0) {
        setInactiveData([]);
        return;
      }
      
      setLoadingInactive(true);
      try {
        const ids = inactiveList.map(c => c.id);
        const mobiles = inactiveList.map(c => c.mobile).filter(Boolean);
        
        // Fetch latest invoices matching mobile numbers of inactive clients
        let invs = [];
        if (mobiles.length > 0) {
          const { data, error } = await supabase
            .from("invoices")
            .select("*, invoice_items(*)")
            .in("mobile", mobiles)
            .order("billing_at", { ascending: false });
          
          if (!error && data) {
            invs = data;
          }
        }
        
        // Build latest invoice mapping (matching by mobile or customer_id)
        const latestInvoiceMap = {};
        
        // 1. Populate from DB fetch results
        invs.forEach(inv => {
          if (inv.status !== "void") {
            if (inv.mobile && !latestInvoiceMap[inv.mobile]) {
              latestInvoiceMap[inv.mobile] = inv;
            }
            if (inv.customer_id && !latestInvoiceMap[inv.customer_id]) {
              latestInvoiceMap[inv.customer_id] = inv;
            }
          }
        });
        
        // 2. Fallback to preloaded invoices from context (in case of connection errors or limit)
        (invoices || []).forEach(inv => {
          if (inv.status !== "void") {
            if (inv.mobile && !latestInvoiceMap[inv.mobile]) {
              latestInvoiceMap[inv.mobile] = inv;
            }
            if (inv.customer_id && !latestInvoiceMap[inv.customer_id]) {
              latestInvoiceMap[inv.customer_id] = inv;
            }
          }
        });
        
        // Map inactive customers with their latest invoice info
        const mapped = inactiveList.map(client => {
          const lastInvoice = latestInvoiceMap[client.id] || latestInvoiceMap[client.mobile] || null;
          
          let stylist = "—";
          let lastBillValue = 0;
          let lastInvoiceId = null;
          
          if (lastInvoice) {
            lastBillValue = lastInvoice.total || 0;
            lastInvoiceId = lastInvoice.id;
            stylist = lastInvoice.staff_name || "—";
            
            if (lastInvoice.invoice_items && lastInvoice.invoice_items.length > 0) {
              const sortedItems = [...lastInvoice.invoice_items].sort(
                (a, b) => Number(b.total || 0) - Number(a.total || 0)
              );
              const highestItem = sortedItems.find(item => item.staff_name);
              if (highestItem) {
                stylist = highestItem.staff_name;
              }
            }
          }
          
          return {
            ...client,
            lastBillValue,
            stylist,
            lastInvoiceId
          };
        });
        
        setInactiveData(mapped);
      } catch (err) {
        console.error("Error fetching inactive clients:", err);
        toast.error("Failed to load inactive clients details");
      } finally {
        setLoadingInactive(false);
      }
    };

    if (activeTab === "inactive") {
      fetchInactiveClientsData();
    }
  }, [activeTab, customers, invoices]);

  // --- TAB 2: INACTIVE CLIENTS FILTER & SORT ---
  const filteredAndSortedInactive = useMemo(() => {
    const term = search.toLowerCase();
    let result = inactiveData.filter((client) =>
      client.name?.toLowerCase().includes(term) || client.mobile?.includes(term)
    );
    
    if (sortOrder === "asc") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortOrder === "desc") {
      result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    }
    
    return result;
  }, [inactiveData, search, sortOrder]);

  // --- POPUP VIEW INVOICE ACTION ---
  const handleViewInvoice = async (id) => {
    try {
      const details = await fetchInvoiceDetails(id);
      setViewInvoiceData(details);
    } catch (err) {
      toast.error(err.message || "Failed to load invoice details");
    }
  };

  // --- THERMAL PRINT HELPER ---
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

  return (
    <>
      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button className={`tbl-btn ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
          👥 All Clients
        </button>
        <button className={`tbl-btn ${activeTab === "inactive" ? "active" : ""}`} onClick={() => setActiveTab("inactive")}>
          ⏳ Last Visited 45 Days & More
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Clients</div>
          <div className="stat-value">{customers?.length || 0}</div>
          <div className="stat-sub">CRM records</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Repeat Clients</div>
          <div className="stat-value">{repeatClients}</div>
          <div className="stat-sub">More than one visit</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Spend</div>
          <div className="stat-value">Rs {(customers || []).reduce((sum, c) => sum + Number(c.total_spend || 0), 0).toLocaleString("en-IN")}</div>
          <div className="stat-sub">Tracked customer value</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Visits</div>
          <div className="stat-value">{customers?.length ? ((customers.reduce((sum, c) => sum + Number(c.visit_count || 0), 0)) / customers.length).toFixed(1) : "0"}</div>
          <div className="stat-sub">Per client</div>
        </div>
      </div>

      <div className="client-grid">
        {activeTab === "all" ? (
          <>
            {/* TAB 1: ALL CLIENTS VIEW */}
            <div className="table-wrap">
              <div className="table-header">
                <div className="table-title">Customer Database</div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    type="button"
                    className="tbl-btn"
                    onClick={() => {
                      setSortOrder(prev => {
                        if (prev === "default") return "asc";
                        if (prev === "asc") return "desc";
                        return "default";
                      });
                    }}
                    style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                    title="Toggle sorting (Default -> A-Z -> Z-A)"
                  >
                    <ArrowUpDown size={13} />
                    <span>
                      {sortOrder === "default" && "Sort: Default"}
                      {sortOrder === "asc" && "Sort: A-Z"}
                      {sortOrder === "desc" && "Sort: Z-A"}
                    </span>
                  </button>
                  <div className="search-inline">
                    <Search size={15} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Phone or name" />
                  </div>
                </div>
              </div>
              <div className="client-list">
                {filteredAndSortedAll.map((client) => (
                  <button type="button" key={client.id} className={`client-row${client.id === selected?.id ? " active" : ""}`} onClick={() => setSelectedId(client.id)}>
                    <span className="client-avatar"><UserRound size={17} /></span>
                    <span>
                      <strong>{client.name}</strong>
                      <small><Phone size={12} /> {client.mobile}</small>
                    </span>
                    <span className="client-spend">Rs {Number(client.total_spend || 0).toLocaleString("en-IN")}</span>
                  </button>
                ))}
                {!filteredAndSortedAll.length && <div className="admin-empty compact">No customers found.</div>}
              </div>
            </div>

            <div className="table-wrap">
              <div className="table-header">
                <div>
                  <div className="table-title">{selected?.name || "Client Profile"}</div>
                  <div className="pos-sub">{selected?.mobile || "Search or select a client"}</div>
                </div>
              </div>
              {selected ? (
                <div className="client-profile">
                  <div className="profile-metrics">
                    <div><span>Total Spend</span><strong>Rs {Number(selected.total_spend || 0).toLocaleString("en-IN")}</strong></div>
                    <div><span>Visits</span><strong>{selected.visit_count || 0}</strong></div>
                    <div><span>Membership</span><strong>{selected.is_member ? "Member" : "None"}</strong></div>
                  </div>

                  {selected.is_member && (
                    <div style={{ background: "rgba(201,185,154,0.08)", border: "1px solid rgba(201,185,154,0.3)", padding: "1rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888" }}>Membership Status</div>
                        <div style={{ fontSize: "1rem", fontWeight: "600", color: "#c9b99a" }}>★ Active Member</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888" }}>Valid Period</div>
                        <div style={{ fontSize: "0.72rem", color: "#555", fontWeight: "500" }}>
                          {selected.membership_start ? new Date(selected.membership_start).toLocaleDateString("en-IN") : "Start"} to {selected.membership_end ? new Date(selected.membership_end).toLocaleDateString("en-IN") : "Expiry"}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="analytics-card-title">Preferred Services</div>
                  <div className="pill-row">
                    {(selected.preferred_services || []).map((service) => <span className="soft-pill" key={service}>{service}</span>)}
                    {!(selected.preferred_services || []).length && <span className="soft-pill muted">Not enough history</span>}
                  </div>

                  <div className="analytics-card-title">Visit History</div>
                  <div className="timeline">
                    {clientInvoices.map((invoice) => (
                      <div className="timeline-item" key={invoice.id}>
                        <span></span>
                        <div>
                          <button
                            type="button"
                            style={{ fontWeight: 700, background: "none", border: "none", cursor: "pointer", color: "#c9b99a", padding: 0, fontSize: "0.82rem", textDecoration: "underline" }}
                            onClick={() => handleViewInvoice(invoice.id)}
                            title="Click to view / reprint this invoice"
                          >
                            {invoice.invoice_number}
                          </button>
                          <small>{new Date(invoice.billing_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })} · {invoice.payment_method}</small>
                        </div>
                        <b>Rs {invoice.total.toLocaleString("en-IN")}</b>
                      </div>
                    ))}
                    {!clientInvoices.length && <div className="admin-empty compact">No invoice timeline yet.</div>}
                  </div>
                  {selected.notes && <p className="client-notes">{selected.notes}</p>}
                </div>
              ) : (
                <div className="admin-empty">Client analytics will appear after billing starts.</div>
              )}
            </div>
          </>
        ) : (
          /* TAB 2: INACTIVE CLIENTS VIEW */
          <div className="table-wrap" style={{ gridColumn: "span 2" }}>
            <div className="table-header">
              <div className="table-title">Inactive Clients (Last Visited 45 Days & More)</div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  type="button"
                  className="tbl-btn"
                  onClick={() => {
                    setSortOrder(prev => {
                      if (prev === "default") return "asc";
                      if (prev === "asc") return "desc";
                      return "default";
                    });
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
                  title="Toggle sorting (Default -> A-Z -> Z-A)"
                >
                  <ArrowUpDown size={13} />
                  <span>
                    {sortOrder === "default" && "Sort: Default"}
                    {sortOrder === "asc" && "Sort: A-Z"}
                    {sortOrder === "desc" && "Sort: Z-A"}
                  </span>
                </button>
                <div className="search-inline">
                  <Search size={15} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Phone or name" />
                </div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Mobile Number</th>
                  <th>Last Visited Date</th>
                  <th style={{ textAlign: "right" }}>Last Bill Value</th>
                  <th>Stylist Handle</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingInactive ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                      Loading inactive clients history...
                    </td>
                  </tr>
                ) : filteredAndSortedInactive.map((client) => (
                  <tr key={client.id}>
                    <td style={{ fontWeight: 600 }}>{client.name}</td>
                    <td>{client.mobile}</td>
                    <td>
                      {client.last_visit_at ? new Date(client.last_visit_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      }) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "bold" }}>
                      {client.lastInvoiceId ? (
                        <button
                          type="button"
                          style={{ fontWeight: 700, background: "none", border: "none", cursor: "pointer", color: "#c9b99a", padding: 0, textDecoration: "underline" }}
                          onClick={() => handleViewInvoice(client.lastInvoiceId)}
                          title="Click to view receipt"
                        >
                          Rs {Number(client.lastBillValue).toLocaleString("en-IN")}
                        </button>
                      ) : "—"}
                    </td>
                    <td>{client.stylist}</td>
                    <td style={{ textAlign: "right" }}>
                      {client.lastInvoiceId ? (
                        <button
                          type="button"
                          className="tbl-btn"
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                          onClick={() => handleViewInvoice(client.lastInvoiceId)}
                        >
                          View Invoice
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>No invoice</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loadingInactive && !filteredAndSortedInactive.length && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                      No inactive clients found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Invoice Modal Overlay */}
      {viewInvoiceData && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setViewInvoiceData(null)}>
          <div className="modal" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <div className="modal-title">Receipt Details</div>
              <button type="button" className="modal-close" onClick={() => setViewInvoiceData(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: "1.5rem" }}>
              <div className="preview-card" style={{ border: "1px solid var(--a-border)", background: "#fff", padding: "1.5rem" }}>
                <div className="invoice-brand" style={{ fontSize: "1.4rem", textAlign: "center", color: "#000" }}>
                  {settings?.name || "Toni & Guy Essensuals"}
                </div>
                <div className="invoice-meta" style={{ textAlign: "center", marginBottom: "1rem", color: "#666" }}>
                  {viewInvoiceData.invoice.invoice_number}
                </div>
                
                <div style={{ fontSize: "0.75rem", borderTop: "1px solid var(--a-border)", borderBottom: "1px solid var(--a-border)", padding: "0.6rem 0", display: "flex", flexDirection: "column", gap: "0.3rem", color: "#333" }}>
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

                <div className="invoice-lines" style={{ padding: "1rem 0", minHeight: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", color: "#333" }}>
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

                <div className="invoice-totals" style={{ borderTop: "1px solid var(--a-border)", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.75rem", color: "#333" }}>
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
                    <strong>Rs {Number(viewInvoiceData.invoice.total).toLocaleString("en-IN")}</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="tbl-btn" 
                onClick={async () => {
                  const appBase = window.location.origin;
                  let token = viewInvoiceData.invoice.review_token;
                  
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
    </>
  );
}
