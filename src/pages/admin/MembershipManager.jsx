import { useMemo, useState } from "react";
import { Search, UserRound, Award, Calendar } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { updateCustomerMembership } from "../../lib/api";
import toast from "react-hot-toast";

export default function MembershipManager() {
  const { customers, reload } = useAdmin();
  const [search, setSearch] = useState("");
  const [modalObj, setModalObj] = useState(null); // null or { customerId, name, is_member, membership_tier, membership_start, membership_end }
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (customers || []).filter((client) =>
      client.name?.toLowerCase().includes(term) || client.mobile?.includes(term)
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    const list = customers || [];
    const totalMembers = list.filter(c => c.is_member).length;
    const goldCount = list.filter(c => c.is_member && c.membership_tier === "Gold").length;
    const platCount = list.filter(c => c.is_member && c.membership_tier === "Platinum").length;
    const vvipCount = list.filter(c => c.is_member && c.membership_tier === "VVIP").length;
    return { totalMembers, goldCount, platCount, vvipCount };
  }, [customers]);

  const openManage = (client) => {
    // Default membership dates to today and one year from now
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const oneYearLater = nextYear.toISOString().slice(0, 10);

    setModalObj({
      customerId: client.id,
      name: client.name,
      mobile: client.mobile,
      is_member: !!client.is_member,
      membership_tier: client.membership_tier || "Gold",
      membership_start: client.membership_start || today,
      membership_end: client.membership_end || oneYearLater,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCustomerMembership(modalObj.customerId, {
        is_member: modalObj.is_member,
        membership_tier: modalObj.is_member ? modalObj.membership_tier : "Regular",
        membership_start: modalObj.is_member ? modalObj.membership_start : null,
        membership_end: modalObj.is_member ? modalObj.membership_end : null,
      });
      toast.success("Membership updated successfully");
      setModalObj(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update membership");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Members</div>
          <div className="stat-value">{stats.totalMembers}</div>
          <div className="stat-sub">Active Salon Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Gold Members</div>
          <div className="stat-value">{stats.goldCount}</div>
          <div className="stat-sub">Regular tier</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Platinum Members</div>
          <div className="stat-value">{stats.platCount}</div>
          <div className="stat-sub">Premium benefits</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">VVIP Members</div>
          <div className="stat-value">{stats.vvipCount}</div>
          <div className="stat-sub">Elite access</div>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Client Membership Registry</div>
          <div className="table-actions">
            <div className="search-inline" style={{ background: "var(--a-bg)", border: "1px solid var(--a-border)", padding: "0.4rem 0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or mobile..." style={{ border: "none", background: "none", outline: "none", fontSize: "0.75rem", fontFamily: "'Montserrat', sans-serif" }} />
            </div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Membership status</th>
              <th>Valid range</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client) => (
              <tr key={client.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", background: client.is_member ? "rgba(201,185,154,0.15)" : "#f0f0ec", color: client.is_member ? "#c9b99a" : "#999" }}>
                      <UserRound size={14} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{client.name}</div>
                      <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Spend: Rs {Number(client.total_spend || 0).toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                </td>
                <td>{client.mobile}</td>
                <td>
                  {client.is_member ? (
                    <span className="badge badge-gold" style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                      <Award size={10} /> {client.membership_tier}
                    </span>
                  ) : (
                    <span className="badge badge-inactive">None</span>
                  )}
                </td>
                <td>
                  {client.is_member && client.membership_start && client.membership_end ? (
                    <span style={{ fontSize: "0.7rem", color: "#666" }}>
                      {new Date(client.membership_start).toLocaleDateString("en-IN")} to {new Date(client.membership_end).toLocaleDateString("en-IN")}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                    <button className="tbl-btn" onClick={() => openManage(client)}>
                      Manage Membership
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                  No customer records found.
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
              <div className="modal-title">Manage Membership</div>
              <button className="modal-close" onClick={() => setModalObj(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="membership-form" onSubmit={handleSave}>
                <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #eee" }}>
                  <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>Client Profile</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#1a1a1a" }}>{modalObj.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#666" }}>📱 {modalObj.mobile}</div>
                </div>

                <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
                  <label className="toggle">
                    <input type="checkbox" checked={modalObj.is_member} onChange={(e) => setModalObj({ ...modalObj, is_member: e.target.checked })} />
                    <span className="toggle-slider"></span>
                  </label>
                  <label className="form-label" style={{ margin: 0, cursor: "pointer", fontWeight: "bold" }}>
                    Active Member (Apply Member Pricing)
                  </label>
                </div>

                {modalObj.is_member && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Membership Tier</label>
                      <select className="form-input" value={modalObj.membership_tier} onChange={(e) => setModalObj({ ...modalObj, membership_tier: e.target.value })}>
                        <option value="Gold">Gold Tier (Recommended)</option>
                        <option value="Platinum">Platinum Tier</option>
                        <option value="VVIP">VVIP Tier</option>
                      </select>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Start Date</label>
                        <input type="date" className="form-input" value={modalObj.membership_start} onChange={(e) => setModalObj({ ...modalObj, membership_start: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Expiration Date</label>
                        <input type="date" className="form-input" value={modalObj.membership_end} onChange={(e) => setModalObj({ ...modalObj, membership_end: e.target.value })} required />
                      </div>
                    </div>
                  </>
                )}
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setModalObj(null)}>Cancel</button>
              <button type="submit" form="membership-form" className="btn-add" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
