import { useState, useMemo } from "react";
import { Star, Filter, Download, Search } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";

export default function ReviewsManager() {
  const { reviews } = useAdmin();
  const safeReviews = reviews || [];

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [starFilter, setStarFilter] = useState("all"); // "all" | "5" | "4" | "3" | "2" | "1"
  const [search, setSearch] = useState("");
  const [expandedComments, setExpandedComments] = useState({});

  // Filters
  const filtered = useMemo(() => {
    return safeReviews.filter(r => {
      // Month match
      if (month) {
        const rMonth = (r.reviewed_at || r.created_at || "").slice(0, 7);
        if (rMonth !== month) return false;
      }
      // Star match
      if (starFilter !== "all" && String(r.rating) !== starFilter) {
        return false;
      }
      // Search match
      if (search.trim()) {
        const term = search.toLowerCase();
        const clientName = (r.client_name || "").toLowerCase();
        const comment = (r.comment || "").toLowerCase();
        const staff = (r.staff_name || "").toLowerCase();
        if (!clientName.includes(term) && !comment.includes(term) && !staff.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [safeReviews, month, starFilter, search]);

  // Overall KPIs
  const stats = useMemo(() => {
    const total = filtered.length;
    if (total === 0) return { avg: 0, fiveStarCount: 0, fiveStarPct: 0, total };
    const sum = filtered.reduce((acc, r) => acc + Number(r.rating), 0);
    const avg = (sum / total).toFixed(1);
    const fiveStarCount = filtered.filter(r => Number(r.rating) === 5).length;
    const fiveStarPct = ((fiveStarCount / total) * 100).toFixed(0);
    return { avg, fiveStarCount, fiveStarPct, total };
  }, [filtered]);

  // Rating distribution for bar charts
  const dist = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    filtered.forEach(r => {
      const rat = Math.round(Number(r.rating));
      if (counts[rat] !== undefined) counts[rat]++;
    });
    return counts;
  }, [filtered]);

  // Average rating grouped by staff
  const staffAverages = useMemo(() => {
    const groups = {};
    filtered.forEach(r => {
      const name = r.staff_name || "Unassigned";
      if (!groups[name]) {
        groups[name] = { total: 0, sum: 0, latest: null };
      }
      groups[name].total++;
      groups[name].sum += Number(r.rating);
      const dateVal = r.reviewed_at || r.created_at || "";
      if (!groups[name].latest || dateVal > groups[name].latest) {
        groups[name].latest = dateVal;
      }
    });

    return Object.entries(groups).map(([name, g]) => ({
      name,
      total: g.total,
      avg: (g.sum / g.total).toFixed(1),
      latest: g.latest ? new Date(g.latest).toLocaleDateString("en-IN") : "—"
    })).sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  const toggleExpand = (id) => {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const exportCSV = () => {
    if (!filtered.length) {
      toast.error("No reviews to export");
      return;
    }
    const headers = ["Date", "Client Name", "Mobile", "Rating", "Comment", "Stylist", "Invoice Number", "Services"];
    const rows = filtered.map(r => [
      r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("en-IN") : "",
      r.client_name || "",
      r.mobile || "",
      r.rating || "",
      r.comment || "",
      r.staff_name || "",
      r.invoice_number || "",
      (r.service_names || []).join(" | ")
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customer_reviews_${month || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStars = (rating) => {
    const full = Math.round(Number(rating));
    return (
      <div style={{ display: "flex", gap: "2px", color: "var(--gold)" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>{i < full ? "★" : "☆"}</span>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* KPI stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Average Rating</div>
          <div className="stat-value" style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            ★ {stats.avg} <span style={{ fontSize: "1rem", color: "var(--a-muted)" }}>/ 5</span>
          </div>
          <div className="stat-sub">Based on {stats.total} feedback logs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">5-Star Feedback</div>
          <div className="stat-value">{stats.fiveStarPct}%</div>
          <div className="stat-sub">{stats.fiveStarCount} high satisfaction scores</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Submissions</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-sub">Filtered ratings</div>
        </div>
      </div>

      {/* Star distribution */}
      <div className="pos-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <div className="pos-panel" style={{ padding: "1.5rem" }}>
          <div className="table-title" style={{ marginBottom: "1rem" }}>Rating Distribution</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[5, 4, 3, 2, 1].map(stars => {
              const count = dist[stars] || 0;
              const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0;
              return (
                <div key={stars} style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.82rem" }}>
                  <div style={{ width: "65px", color: "var(--gold)", fontWeight: "bold" }}>
                    {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                  </div>
                  <div style={{ flex: 1, height: "8px", background: "rgba(0,0,0,0.03)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "var(--gold)", borderRadius: "4px" }}></div>
                  </div>
                  <div style={{ width: "40px", textAlign: "right", color: "var(--a-muted)" }}>
                    {count} ({pct}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff leaderboard */}
        <div className="pos-panel" style={{ padding: "1.5rem" }}>
          <div className="table-title" style={{ marginBottom: "1rem" }}>Stylist Satisfaction Scores</div>
          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--a-border)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0" }}>Stylist</th>
                  <th style={{ padding: "0.5rem 0", textAlign: "center" }}>Reviews</th>
                  <th style={{ padding: "0.5rem 0", textAlign: "right" }}>Average rating</th>
                </tr>
              </thead>
              <tbody>
                {staffAverages.map(s => (
                  <tr key={s.name} style={{ borderBottom: "1px dashed rgba(0,0,0,0.04)" }}>
                    <td style={{ padding: "0.55rem 0", fontWeight: 600 }}>{s.name}</td>
                    <td style={{ padding: "0.55rem 0", textAlign: "center", color: "var(--a-muted)" }}>{s.total}</td>
                    <td style={{ padding: "0.55rem 0", textAlign: "right", fontWeight: "bold", color: "var(--gold)" }}>
                      ★ {s.avg}
                    </td>
                  </tr>
                ))}
                {!staffAverages.length && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: "1.5rem", color: "var(--a-muted)" }}>
                      No staff satisfaction scores recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Main Reviews log list */}
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title">Customer Feedback Ledger</div>
          <div className="table-actions" style={{ display: "flex", gap: "0.5rem" }}>
            <input type="month" className="admin-search" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 140 }} />
            <select className="form-input" value={starFilter} onChange={e => setStarFilter(e.target.value)} style={{ width: 110, padding: "0.3rem" }}>
              <option value="all">All Stars</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Stars</option>
            </select>
            <div style={{ position: "relative" }}>
              <input type="search" className="admin-search" placeholder="Search customer, comment..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="tbl-btn" onClick={exportCSV}>
              <Download size={14} style={{ marginRight: 6 }} /> Export
            </button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Date</th>
              <th style={{ width: 150 }}>Client</th>
              <th style={{ width: 110 }}>Rating</th>
              <th>Comment / Feedback</th>
              <th style={{ width: 120 }}>Stylist</th>
              <th style={{ width: 110 }}>Invoice #</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const isExpanded = expandedComments[r.id];
              const commentText = r.comment || "—";
              const showExpandBtn = commentText.length > 80;
              const displayText = isExpanded ? commentText : commentText.slice(0, 80) + (showExpandBtn ? "..." : "");
              
              return (
                <tr key={r.id}>
                  <td style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>
                    {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.client_name || "Guest"}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{r.mobile || "—"}</div>
                  </td>
                  <td>{renderStars(r.rating)}</td>
                  <td>
                    <div style={{ fontSize: "0.82rem", whiteSpace: "pre-line" }}>{displayText}</div>
                    {showExpandBtn && (
                      <button type="button" onClick={() => toggleExpand(r.id)} style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", fontSize: "0.68rem", fontWeight: "bold", padding: 0, marginTop: "2px" }}>
                        {isExpanded ? "Show Less" : "Read Full"}
                      </button>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-gold" style={{ padding: "2px 6px" }}>{r.staff_name || "Unassigned"}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{r.invoice_number || "—"}</span>
                    {r.service_names && r.service_names.length > 0 && (
                      <div style={{ fontSize: "0.58rem", color: "var(--a-muted)" }}>
                        {r.service_names.slice(0, 2).join(", ")}{r.service_names.length > 2 ? "..." : ""}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                  No customer reviews recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
