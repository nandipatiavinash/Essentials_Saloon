import { useMemo } from "react";
import { ArrowLeft, TrendingUp, Users, Scissors, Clock, Award, Calendar } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { format12HourTime } from "../../lib/api";
import { useNavigate, useParams } from "react-router-dom";

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { staff, attendance, invoices } = useAdmin();

  const member = useMemo(() => (staff || []).find(s => String(s.id) === String(id)), [staff, id]);

  const invoicesForStaff = useMemo(() => {
    if (!member) return [];
    return (invoices || []).filter(inv =>
      inv.status !== "void" && (
        inv.staff_name === member.name ||
        (inv.invoice_items || []).some(item => item.staff_name === member.name)
      )
    );
  }, [invoices, member]);

  const attendanceForStaff = useMemo(() => {
    if (!member) return [];
    return (attendance || [])
      .filter(a => a.staff_id === member.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, member]);

  const kpis = useMemo(() => {
    if (!member) return {};
    let netSales = 0;
    let servicesCount = 0;
    const clientSet = new Set();
    let tipsEarned = 0;

    invoicesForStaff.forEach(inv => {
      if (inv.staff_name === member.name) {
        tipsEarned += Number(inv.tip || 0);
        clientSet.add(inv.customer_id || inv.mobile);
      }
      (inv.invoice_items || []).forEach(item => {
        const staffMatch = item.staff_name === member.name || (!item.staff_name && inv.staff_name === member.name);
        if (staffMatch && item.item_type !== "membership") {
          netSales += Number(item.total || 0);
          servicesCount += Number(item.quantity || 1);
          clientSet.add(inv.customer_id || inv.mobile);
        }
      });
    });

    const daysPresent = attendanceForStaff.filter(a => a.status === "present" || a.status === "late").length;
    let totalHours = 0;
    attendanceForStaff.forEach(log => {
      if ((log.status === "present" || log.status === "late") && log.check_in && log.check_out) {
        const [inH, inM] = log.check_in.split(":").map(Number);
        const [outH, outM] = log.check_out.split(":").map(Number);
        if (!isNaN(inH) && !isNaN(outH)) {
          const diff = (outH * 60 + outM) - (inH * 60 + inM);
          if (diff > 0) totalHours += diff / 60;
        }
      }
    });

    // Top services this staff performed
    const svcMap = {};
    invoicesForStaff.forEach(inv => {
      (inv.invoice_items || []).forEach(item => {
        const staffMatch = item.staff_name === member.name || (!item.staff_name && inv.staff_name === member.name);
        if (staffMatch && item.item_type !== "membership") {
          svcMap[item.service_name] = (svcMap[item.service_name] || 0) + Number(item.quantity || 1);
        }
      });
    });
    const topServices = Object.entries(svcMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Monthly revenue trend
    const byMonth = {};
    invoicesForStaff.forEach(inv => {
      const month = (inv.billing_at || inv.created_at || "").slice(0, 7);
      if (!month) return;
      (inv.invoice_items || []).forEach(item => {
        const staffMatch = item.staff_name === member.name || (!item.staff_name && inv.staff_name === member.name);
        if (staffMatch && item.item_type !== "membership") byMonth[month] = (byMonth[month] || 0) + Number(item.total || 0);
      });
    });
    const monthlyTrend = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total: Math.round(total) }));

    return {
      netSales: Math.round(netSales),
      servicesCount,
      clientsCount: clientSet.size,
      tipsEarned: Math.round(tipsEarned),
      daysPresent,
      totalHours: Math.round(totalHours * 10) / 10,
      topServices,
      monthlyTrend,
    };
  }, [invoicesForStaff, attendanceForStaff, member]);

  if (!member) {
    return (
      <div className="table-wrap" style={{ padding: "3rem", textAlign: "center", color: "var(--a-muted)" }}>
        Staff member not found.
        <br />
        <button className="tbl-btn" style={{ marginTop: "1rem" }} onClick={() => navigate("/attendance")}>
          ← Back to Attendance
        </button>
      </div>
    );
  }

  const maxMonthly = Math.max(...(kpis.monthlyTrend?.map(m => m.total) || [1]), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <button className="tbl-btn" onClick={() => navigate("/attendance")} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--a-text)", letterSpacing: "-0.02em" }}>
            {member.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem" }}>
            <span className="badge badge-gold" style={{ padding: "2px 8px", letterSpacing: "0.06em" }}>{member.role}</span>
            <span className={`badge ${member.active ? "badge-active" : "badge-inactive"}`}>{member.active ? "Active" : "Inactive"}</span>
            {member.phone && <span style={{ fontSize: "0.7rem", color: "var(--a-muted)" }}>📱 {member.phone}</span>}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Net Sales</div>
          <div className="stat-value" style={{ color: "var(--a-text)" }}>Rs {(kpis.netSales || 0).toLocaleString("en-IN")}</div>
          <div className="stat-sub">All time revenue generated</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Services Done</div>
          <div className="stat-value">{kpis.servicesCount || 0}</div>
          <div className="stat-sub">Total services rendered</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Clients Served</div>
          <div className="stat-value">{kpis.clientsCount || 0}</div>
          <div className="stat-sub">Unique customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tips Earned</div>
          <div className="stat-value" style={{ color: "var(--a-text)" }}>Rs {(kpis.tipsEarned || 0).toLocaleString("en-IN")}</div>
          <div className="stat-sub">Total tips received</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Days Present</div>
          <div className="stat-value">{kpis.daysPresent || 0}</div>
          <div className="stat-sub">Attendance logged</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Hours Worked</div>
          <div className="stat-value">{kpis.totalHours || 0} <span style={{ fontSize: "0.7rem", fontWeight: 400 }}>hrs</span></div>
          <div className="stat-sub">Total working hours</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Top Services */}
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title"><Scissors size={14} style={{ marginRight: 6 }} />Top Services</div>
          </div>
          <div style={{ padding: "1.25rem" }}>
            {(kpis.topServices || []).length === 0 ? (
              <div style={{ color: "var(--a-muted)", fontSize: "0.75rem", textAlign: "center", padding: "1.5rem" }}>No services recorded</div>
            ) : (kpis.topServices || []).map((svc, i) => (
              <div key={svc.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: i < kpis.topServices.length - 1 ? "1px solid var(--a-border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(201,185,154,0.15)", color: "#c9b99a", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{svc.name}</span>
                </div>
                <span className="badge badge-gold" style={{ padding: "2px 8px" }}>{svc.count}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Revenue Trend */}
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title"><TrendingUp size={14} style={{ marginRight: 6 }} />Monthly Revenue Trend</div>
          </div>
          <div style={{ padding: "1.25rem" }}>
            {(kpis.monthlyTrend || []).length === 0 ? (
              <div style={{ color: "var(--a-muted)", fontSize: "0.75rem", textAlign: "center", padding: "1.5rem" }}>No data available</div>
            ) : (kpis.monthlyTrend || []).slice(-6).map(m => (
              <div key={m.month} style={{ marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", marginBottom: "0.2rem" }}>
                  <span style={{ color: "var(--a-muted)" }}>{m.month}</span>
                  <span style={{ fontWeight: 600, color: "var(--a-text)" }}>Rs {m.total.toLocaleString("en-IN")}</span>
                </div>
                <div style={{ height: "6px", background: "rgba(255,255,255,0.04)", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((m.total / maxMonthly) * 100)}%`, background: "linear-gradient(90deg, #c9b99a, #e8d5b5)", borderRadius: "2px", transition: "width 0.5s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title"><Award size={14} style={{ marginRight: 6 }} />Invoice History ({invoicesForStaff.length})</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice No.</th>
              <th>Client</th>
              <th>Services</th>
              <th style={{ textAlign: "right" }}>Net Amount</th>
              <th style={{ textAlign: "right" }}>Tips</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoicesForStaff.slice(0, 100).map(inv => {
              const netAmt = Number(inv.subtotal || 0) - Number(inv.discount || 0);
              const staffItems = (inv.invoice_items || []).filter(item =>
                item.staff_name === member.name || (!item.staff_name && inv.staff_name === member.name)
              );
              return (
                <tr key={inv.id}>
                  <td style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>
                    {inv.billing_at ? new Date(inv.billing_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: "0.72rem" }}>{inv.invoice_number}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: "0.78rem" }}>{inv.client_name}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{inv.mobile}</div>
                  </td>
                  <td style={{ fontSize: "0.7rem", maxWidth: "200px" }}>
                    {staffItems.length > 0
                      ? staffItems.map(item => item.service_name).join(", ")
                      : (inv.invoice_items || []).map(item => item.service_name).join(", ") || "—"}
                  </td>
                  <td style={{ textAlign: "right", fontSize: "0.78rem" }}>Rs {netAmt.toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", fontSize: "0.78rem", color: inv.tip > 0 ? "var(--a-text)" : "inherit" }}>
                    Rs {Number(inv.tip || 0).toLocaleString("en-IN")}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "var(--a-text)", fontSize: "0.82rem" }}>
                    Rs {Number(inv.total || 0).toLocaleString("en-IN")}
                  </td>
                </tr>
              );
            })}
            {!invoicesForStaff.length && (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>No invoices found for this staff member.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Attendance History */}
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title"><Calendar size={14} style={{ marginRight: 6 }} />Attendance History ({attendanceForStaff.length} records)</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Hours</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {attendanceForStaff.slice(0, 60).map(log => {
              let hours = "—";
              if ((log.status === "present" || log.status === "late") && log.check_in && log.check_out) {
                const [inH, inM] = log.check_in.split(":").map(Number);
                const [outH, outM] = log.check_out.split(":").map(Number);
                if (!isNaN(inH) && !isNaN(outH)) {
                  const diff = (outH * 60 + outM) - (inH * 60 + inM);
                  if (diff > 0) hours = (diff / 60).toFixed(1) + " hrs";
                }
              }
              const statusColors = { present: "#2e7d32", late: "#f57f17", absent: "#b71c1c", leave: "#1565c0" };
              return (
                <tr key={log.id || log.date}>
                  <td style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                    {new Date(log.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short" })}
                  </td>
                  <td>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.06em",
                      color: statusColors[log.status] || "#888",
                      background: (statusColors[log.status] || "#888") + "15",
                      border: "1px solid " + (statusColors[log.status] || "#888") + "40",
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.78rem" }}>
                    {log.check_in && log.status !== "absent" && log.status !== "leave"
                      ? format12HourTime(log.check_in) : "—"}
                  </td>
                  <td style={{ fontSize: "0.78rem" }}>
                    {log.check_out && log.status !== "absent" && log.status !== "leave"
                      ? format12HourTime(log.check_out) : "—"}
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--a-text)" }}>{hours}</td>
                  <td style={{ fontSize: "0.7rem", color: "var(--a-muted)" }}>{log.notes || "—"}</td>
                </tr>
              );
            })}
            {!attendanceForStaff.length && (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>No attendance records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
