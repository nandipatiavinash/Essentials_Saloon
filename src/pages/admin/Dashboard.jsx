import { useAdmin } from "../../layouts/AdminLayout";
import { Link, useNavigate } from "react-router-dom";
import { buildAnalytics, cleanDemographicData } from "../../lib/api";
import { AlertTriangle, Package } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";

export default function Dashboard() {
  const { services, bookings, offers, invoices, customers, inventory, reload } = useAdmin();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const [revenueModal, setRevenueModal] = useState(null); // null | 'today' | 'monthly'
  const [expandInvoices, setExpandInvoices] = useState(false);

  const getRevenueBreakdown = (range) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStr = todayStr.slice(0, 7);

    const rangeInvoices = (invoices || []).filter((inv) => {
      if (inv.status === "void" || !inv.billing_at) return false;
      const invDate = inv.billing_at.slice(0, 10);
      if (range === "today") {
        return invDate === todayStr;
      } else {
        return invDate.slice(0, 7) === monthStr;
      }
    });

    let servicesTotal = 0;
    let productsTotal = 0;
    let membershipsTotal = 0;
    let discountTotal = 0;
    let gstTotal = 0;
    let tipsTotal = 0;
    let grossTotal = 0;

    rangeInvoices.forEach((inv) => {
      discountTotal += Number(inv.discount || 0);
      gstTotal += Number(inv.tax || 0);
      tipsTotal += Number(inv.tip || 0);
      grossTotal += Number(inv.total || 0);

      (inv.invoice_items || []).forEach((item) => {
        const itemVal = Number(item.quantity || 1) * Number(item.price || 0);
        if (item.item_type === "product") {
          productsTotal += itemVal;
        } else if (item.item_type === "membership") {
          membershipsTotal += itemVal;
        } else {
          servicesTotal += itemVal;
        }
      });
    });

    return {
      invoices: rangeInvoices,
      services: servicesTotal,
      products: productsTotal,
      memberships: membershipsTotal,
      discount: discountTotal,
      gst: gstTotal,
      tips: tipsTotal,
      gross: grossTotal,
    };
  };

  const modalData = revenueModal ? getRevenueBreakdown(revenueModal) : null;
  const pendingBookings = bookings?.filter(b => b.status === "pending") || [];
  const analytics = buildAnalytics(invoices || []);

  // Inventory metrics
  const lowStockItems = (inventory || []).filter(item => Number(item.stock_qty) <= Number(item.min_qty));
  const inventoryValue = (inventory || []).reduce((sum, item) => sum + (Number(item.stock_qty) * Number(item.unit_price)), 0);

  const handleResetData = async () => {
    const confirmed = window.confirm(
      "WARNING: This will permanently erase all client profiles, bills/invoices, bookings, cash register reconciliation records, and staff attendance logs.\n\nService categories, service offerings, inventory configurations, and staff members will be preserved.\n\nAre you absolutely sure you want to proceed?"
    );
    if (!confirmed) return;

    setResetting(true);
    try {
      await cleanDemographicData();
      toast.success("Demographic & Transaction database reset successfully!");
      if (reload) await reload();
    } catch (err) {
      toast.error(err.message || "Failed to clear client data");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card" onClick={() => { setRevenueModal("today"); setExpandInvoices(false); }} style={{ cursor: "pointer" }}>
          <div className="stat-label">Today Revenue</div>
          <div className="stat-value">Rs {analytics.todayRevenue.toLocaleString("en-IN")}</div>
          <div className="stat-sub">Live billing total</div>
        </div>
        <div className="stat-card" onClick={() => { setRevenueModal("monthly"); setExpandInvoices(false); }} style={{ cursor: "pointer" }}>
          <div className="stat-label">Monthly Revenue</div>
          <div className="stat-value">Rs {analytics.monthlyRevenue.toLocaleString("en-IN")}</div>
          <div className="stat-sub">{analytics.billCount} invoices tracked</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clients</div>
          <div className="stat-value">{customers?.length || 0}</div>
          <div className="stat-sub">Customer database</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Bookings</div>
          <div className="stat-value">{pendingBookings.length}</div>
          <div className="stat-sub">Requires attention</div>
        </div>
      </div>

      {/* Inventory Summary */}
      <div className="table-wrap" style={{ marginTop: "0" }}>
        <div className="table-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div className="table-title"><Package size={14} style={{ marginRight: 6 }} />Inventory Overview</div>
            {lowStockItems.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.65rem", background: "#fce4ec", color: "#b71c1c", padding: "2px 8px", fontWeight: 700, letterSpacing: "0.06em" }}>
                <AlertTriangle size={11} /> {lowStockItems.length} LOW STOCK
              </span>
            )}
          </div>
          <Link to="/inventory" className="tbl-btn" style={{ textDecoration: "none" }}>Manage Inventory</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0", borderTop: "1px solid var(--a-border)" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderRight: "1px solid var(--a-border)" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Total Products</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--a-text)" }}>{(inventory || []).length}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Tracked items</div>
          </div>
          <div style={{ padding: "1.25rem 1.5rem", borderRight: "1px solid var(--a-border)" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Low Stock Alerts</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: lowStockItems.length > 0 ? "#b71c1c" : "var(--a-text)" }}>{lowStockItems.length}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Need reordering</div>
          </div>
          <div style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Stock Valuation</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--a-text)" }}>Rs {inventoryValue.toLocaleString("en-IN")}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Current cost value</div>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--a-border)", background: "rgba(183,28,28,0.02)" }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#b71c1c", marginBottom: "0.75rem", fontWeight: 700 }}>
              <AlertTriangle size={11} style={{ marginRight: 4 }} />Low Stock — Action Required
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {lowStockItems.slice(0, 8).map(item => (
                <div key={item.id} onClick={() => navigate("/inventory")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.75rem", background: "#fce4ec", border: "1px solid #ef9a9a", borderRadius: "2px" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#b71c1c" }}>{item.name}</span>
                  <span style={{ fontSize: "0.6" + "rem", background: "#b71c1c", color: "#fff", padding: "1px 5px", fontWeight: 700 }}>{item.stock_qty} left</span>
                </div>
              ))}
              {lowStockItems.length > 8 && (
                <Link to="/inventory" style={{ fontSize: "0.68rem", color: "#b71c1c", alignSelf: "center", textDecoration: "underline" }}>+{lowStockItems.length - 8} more</Link>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="analytics-grid">
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Recent Inquiries</div>
            <Link to="/bookings" className="btn-add" style={{ textDecoration: "none" }}>View All</Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Service</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings?.slice(0, 5).map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{b.name}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--a-muted)" }}>{b.phone}</div>
                  </td>
                  <td>{b.service || "—"}</td>
                  <td>
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                  </td>
                </tr>
              ))}
              {(!bookings || bookings.length === 0) && (
                <tr><td colSpan="3" style={{ textAlign: "center", padding: "2rem", color: "var(--a-faint)" }}>No recent bookings</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="analytics-card">
          <div className="analytics-card-title">Quick Actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link to="/billing" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Create Bill</Link>
            <Link to="/analytics" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>View Analytics</Link>
            <Link to="/services" className="tbl-btn" style={{ textAlign: "center", display: "block", textDecoration: "none", padding: "0.8rem" }}>Manage Services</Link>
            <button
              onClick={handleResetData}
              disabled={resetting}
              className="tbl-btn"
              style={{
                textAlign: "center",
                display: "block",
                padding: "0.8rem",
                color: "#b71c1c",
                borderColor: "#b71c1c",
                background: "transparent",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              {resetting ? "Resetting Database..." : "⚠️ Reset Database"}
            </button>
          </div>
        </div>
      </div>

      {revenueModal && modalData && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setRevenueModal(null)} style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: expandInvoices ? "800px" : "500px", width: "90%", transition: "max-width 0.3s ease" }}>
            <div className="modal-header">
              <div className="modal-title" style={{ textTransform: "capitalize" }}>
                {revenueModal} Revenue Details
              </div>
              <button className="modal-close" onClick={() => setRevenueModal(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxHeight: "80vh", overflowY: "auto" }}>
              {!expandInvoices ? (
                <>
                  {/* Financial Breakdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", background: "rgba(255,255,255,0.02)", padding: "1.25rem", border: "1px solid var(--a-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span style={{ color: "var(--a-muted)" }}>Services Net (Before GST):</span>
                      <strong>Rs {modalData.services.toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span style={{ color: "var(--a-muted)" }}>Retail Products:</span>
                      <strong>Rs {modalData.products.toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span style={{ color: "var(--a-muted)" }}>Memberships:</span>
                      <strong>Rs {modalData.memberships.toLocaleString("en-IN")}</strong>
                    </div>
                    {modalData.discount > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#b71c1c" }}>
                        <span>Discount Applied:</span>
                        <strong>-Rs {modalData.discount.toLocaleString("en-IN")}</strong>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span style={{ color: "var(--a-muted)" }}>GST Tax:</span>
                      <strong>Rs {modalData.gst.toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span style={{ color: "var(--a-muted)" }}>Tips Collected:</span>
                      <strong>Rs {modalData.tips.toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderTop: "1px dashed var(--a-border)", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
                      <span style={{ fontWeight: "bold", color: "var(--gold)" }}>Gross Revenue:</span>
                      <strong style={{ color: "var(--gold)", fontSize: "1rem" }}>Rs {modalData.gross.toLocaleString("en-IN")}</strong>
                    </div>
                  </div>

                  {/* Recent Invoices Preview */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-muted)" }}>
                        Recent Invoices ({modalData.invoices.length})
                      </div>
                      {modalData.invoices.length > 5 && (
                        <button 
                          className="tbl-btn" 
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem" }}
                          onClick={() => setExpandInvoices(true)}
                        >
                          Expand All
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {modalData.invoices.slice(0, 5).map((inv) => (
                        <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", padding: "0.4rem 0.6rem", background: "rgba(255,255,255,0.01)", border: "1px solid var(--a-border)" }}>
                          <span>
                            <strong style={{ marginRight: 6 }}>{inv.invoice_number}</strong>
                            {inv.client_name}
                          </span>
                          <strong>Rs {inv.total.toLocaleString("en-IN")}</strong>
                        </div>
                      ))}
                      {!modalData.invoices.length && (
                        <div style={{ fontSize: "0.7rem", color: "var(--a-faint)", textAlign: "center", padding: "1.5rem" }}>
                          No invoices recorded for this period.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Expanded All Invoices List */
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--a-muted)" }}>
                      All Invoices contributing to {revenueModal} revenue ({modalData.invoices.length})
                    </div>
                    <button 
                      className="tbl-btn" 
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.65rem" }}
                      onClick={() => setExpandInvoices(false)}
                    >
                      Show Summary
                    </button>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.72rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--a-border)", background: "rgba(255,255,255,0.02)" }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>Invoice #</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Client</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Date</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Payment</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalData.invoices.map((inv) => (
                          <tr key={inv.id} style={{ borderBottom: "1px solid var(--a-border)" }}>
                            <td style={{ padding: "8px", fontWeight: "600" }}>{inv.invoice_number}</td>
                            <td style={{ padding: "8px" }}>
                              <div>{inv.client_name}</div>
                              <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>{inv.mobile}</div>
                            </td>
                            <td style={{ padding: "8px" }}>{new Date(inv.billing_at).toLocaleDateString("en-IN")}</td>
                            <td style={{ padding: "8px" }}>{inv.payment_method}</td>
                            <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", color: "var(--gold)" }}>
                              Rs {inv.total.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn-add" onClick={() => setRevenueModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
