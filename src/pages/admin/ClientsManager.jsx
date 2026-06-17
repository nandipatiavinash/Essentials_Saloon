import { useMemo, useState } from "react";
import { Phone, Search, UserRound } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { useNavigate } from "react-router-dom";

export default function ClientsManager() {
  const { customers, invoices } = useAdmin();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (customers || []).filter((client) =>
      client.name?.toLowerCase().includes(term) || client.mobile?.includes(term)
    );
  }, [customers, search]);

  const selected = filtered.find((client) => client.id === selectedId) || filtered[0];
  const clientInvoices = (invoices || []).filter((invoice) => invoice.customer_id === selected?.id);
  const repeatClients = (customers || []).filter((client) => Number(client.visit_count || 0) > 1).length;

  return (
    <>
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
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Customer Database</div>
            <div className="search-inline">
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Phone or name" />
            </div>
          </div>
          <div className="client-list">
            {filtered.map((client) => (
              <button type="button" key={client.id} className={`client-row${client.id === selected?.id ? " active" : ""}`} onClick={() => setSelectedId(client.id)}>
                <span className="client-avatar"><UserRound size={17} /></span>
                <span>
                  <strong>{client.name}</strong>
                  <small><Phone size={12} /> {client.mobile}</small>
                </span>
                <span className="client-spend">Rs {Number(client.total_spend || 0).toLocaleString("en-IN")}</span>
              </button>
            ))}
            {!filtered.length && <div className="admin-empty compact">No customers found.</div>}
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
                        onClick={() => navigate(`/billing?inv=${invoice.id}`)}
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
      </div>
    </>
  );
}
