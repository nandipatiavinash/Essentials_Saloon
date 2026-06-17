import { useMemo, useState } from "react";
import { Search, UserRound, Award, Calendar } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { updateCustomerMembership, createCustomer } from "../../lib/api";
import toast from "react-hot-toast";

export default function MembershipManager() {
  const { customers, reload } = useAdmin();
  const [search, setSearch] = useState("");
  const [modalObj, setModalObj] = useState(null); // null or { customerId, name, mobile, is_member, membership_tier, membership_start, membership_end, membership_id, isNew }
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (customers || []).filter((client) =>
      client.name?.toLowerCase().includes(term) || client.mobile?.includes(term)
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    const list = customers || [];
    const activeMembers = list.filter(c => {
      if (!c.is_member || !c.membership_end) return false;
      const end = new Date(c.membership_end);
      end.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      return end.getTime() >= today.getTime();
    }).length;

    const expiredMembers = list.filter(c => {
      if (!c.is_member || !c.membership_end) return false;
      const end = new Date(c.membership_end);
      end.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      return end.getTime() < today.getTime();
    }).length;

    const nonMembers = list.filter(c => !c.is_member).length;
    const totalClients = list.length;
    return { totalMembers: activeMembers, expiredMembers, nonMembers, totalClients };
  }, [customers]);

  const getDaysRemaining = (endDateStr) => {
    if (!endDateStr) return 0;
    const end = new Date(endDateStr);
    const today = new Date();
    end.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const openManage = (client) => {
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const oneYearLater = nextYear.toISOString().slice(0, 10);

    setModalObj({
      customerId: client.id,
      name: client.name,
      mobile: client.mobile,
      is_member: !!client.is_member,
      membership_id: client.membership_id || "",
      membership_tier: client.membership_tier || "Member",
      membership_start: client.membership_start || today,
      membership_end: client.membership_end || oneYearLater,
      isNew: false,
    });
  };

  const openNewMember = () => {
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const oneYearLater = nextYear.toISOString().slice(0, 10);

    setModalObj({
      customerId: null,
      name: "",
      mobile: "",
      is_member: true,
      membership_id: "",
      membership_tier: "Member",
      membership_start: today,
      membership_end: oneYearLater,
      isNew: true,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let mId = modalObj.membership_id;
      if (modalObj.is_member && !mId) {
        const year = new Date(modalObj.membership_start).getFullYear() || new Date().getFullYear();
        const rand = Math.floor(10000 + Math.random() * 90000);
        mId = `MEM-${year}-${rand}`;
      }

      const payload = {
        name: modalObj.name,
        mobile: modalObj.mobile,
        is_member: modalObj.is_member,
        membership_id: modalObj.is_member ? mId : null,
        membership_tier: modalObj.is_member ? modalObj.membership_tier : "Regular",
        membership_start: modalObj.is_member ? modalObj.membership_start : null,
        membership_end: modalObj.is_member ? modalObj.membership_end : null,
      };

      if (modalObj.isNew) {
        if (!modalObj.name.trim() || !modalObj.mobile.trim()) {
          throw new Error("Client name and mobile are required");
        }
        await createCustomer(payload);
        toast.success("Member profile created successfully");
      } else {
        await updateCustomerMembership(modalObj.customerId, payload);
        toast.success("Membership updated successfully");
      }
      setModalObj(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Active Members</div>
          <div className="stat-value">{stats.totalMembers}</div>
          <div className="stat-sub">Valid memberships</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expired Memberships</div>
          <div className="stat-value">{stats.expiredMembers}</div>
          <div className="stat-sub">Needs renewal</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Non-Members</div>
          <div className="stat-value">{stats.nonMembers}</div>
          <div className="stat-sub">Regular salon pricing</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Salon Clients</div>
          <div className="stat-value">{stats.totalClients}</div>
          <div className="stat-sub">Client database size</div>
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
            <button className="btn-add" onClick={openNewMember}>+ Add Member</button>
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
            {filtered.map((client) => {
              const daysLeft = getDaysRemaining(client.membership_end);
              return (
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
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <span className={daysLeft >= 0 ? "badge badge-gold" : "badge badge-inactive"} style={{ display: "inline-flex", alignItems: "center", gap: "3px", width: "fit-content" }}>
                          <Award size={10} /> Member
                        </span>
                        {client.membership_id && (
                          <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>ID: {client.membership_id}</div>
                        )}
                      </div>
                    ) : (
                      <span className="badge badge-inactive">None</span>
                    )}
                  </td>
                  <td>
                    {client.is_member && client.membership_start && client.membership_end ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: "0.7rem", color: "#666" }}>
                          {new Date(client.membership_start).toLocaleDateString("en-IN")} to {new Date(client.membership_end).toLocaleDateString("en-IN")}
                        </span>
                        {daysLeft >= 0 ? (
                          <span style={{ fontSize: "0.65rem", color: "#2e7d32", fontWeight: 500 }}>
                            {daysLeft} days remaining
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.65rem", color: "#d32f2f", fontWeight: 500 }}>
                            Expired {Math.abs(daysLeft)} days ago
                          </span>
                        )}
                      </div>
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
              );
            })}
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
              <div className="modal-title">{modalObj.isNew ? "New Member Creation" : "Manage Membership"}</div>
              <button className="modal-close" onClick={() => setModalObj(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="membership-form" onSubmit={handleSave}>
                {modalObj.isNew ? (
                  <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #eee" }}>
                    <div className="form-group">
                      <label className="form-label">Client Name *</label>
                      <input className="form-input" value={modalObj.name} onChange={(e) => setModalObj({ ...modalObj, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile Number *</label>
                      <input className="form-input" value={modalObj.mobile} onChange={(e) => setModalObj({ ...modalObj, mobile: e.target.value })} placeholder="e.g. 9876543210" required />
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #eee" }}>
                    <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#999" }}>Client Profile</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#1a1a1a" }}>{modalObj.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>📱 {modalObj.mobile}</div>
                  </div>
                )}

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

                    {!modalObj.isNew && (
                      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                        <button type="button" className="tbl-btn" style={{ flex: 1 }} onClick={() => {
                          const today = new Date().toISOString().slice(0, 10);
                          const nextYear = new Date();
                          nextYear.setFullYear(nextYear.getFullYear() + 1);
                          const oneYearLater = nextYear.toISOString().slice(0, 10);
                          setModalObj({ ...modalObj, membership_start: today, membership_end: oneYearLater });
                          toast.success("Dates set to 1 year renewal (Save to apply)");
                        }}>Renew (1 Year)</button>
                        <button type="button" className="tbl-btn danger" style={{ flex: 1 }} onClick={() => {
                          setModalObj({ ...modalObj, is_member: false });
                          toast.success("Deactivated membership (Save to apply)");
                        }}>Deactivate</button>
                      </div>
                    )}
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
