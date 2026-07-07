import { useState, useMemo, useEffect } from "react";
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Eye, X, Check, AlertTriangle, ArrowRight, DollarSign } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { 
  updateStaff, 
  createStaff, 
  deleteStaff, 
  saveStaffPayment, 
  saveStaffAdvance, 
  deleteStaffAdvance, 
  markSalaryPaid 
} from "../../lib/api";

export default function StaffManager() {
  const { staff, attendance, invoices, tipSplits, staffPayments, staffAdvances, reload } = useAdmin();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("directory"); // directory | performance | payroll

  // --- MODALS STATE ---
  const [staffModal, setStaffModal] = useState(null); // null | { name, role, phone, base_salary, upi_id, bank_account, joining_date, active }
  const [payoutModal, setPayoutModal] = useState(null); // null | { paymentId, staffId, workMonth, netPayable, staffName, paymentMethod, notes, paymentDate }
  const [saving, setSaving] = useState(false);

  // --- TAB 2 (PERFORMANCE) FILTERS ---
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [perfFilterMode, setPerfFilterMode] = useState("month"); // month | range
  const [perfMonth, setPerfMonth] = useState(currentMonthStr);
  const [perfStart, setPerfStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [perfEnd, setPerfEnd] = useState(new Date().toISOString().slice(0, 10));
  const [selectedPerformanceStaff, setSelectedPerformanceStaff] = useState(null); // for showing sub-list of invoices

  // --- TAB 3 (PAYROLL) FILTERS ---
  const [payrollMonth, setPayrollMonth] = useState(currentMonthStr);
  const [scheduledDateInput, setScheduledDateInput] = useState(() => {
    const d = new Date();
    // Default to 5th of next month
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 5);
    return nextMonth.toISOString().slice(0, 10);
  });

  // Helpers
  const formatMonthLabel = (ym) => {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  const adjustMonth = (ym, delta) => {
    const [y, m] = ym.split("-").map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, "0");
    return `${newY}-${newM}`;
  };


  // ==========================================
  // TAB 1: DIRECTORY ACTIONS
  // ==========================================
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: staffModal.name.trim(),
        role: staffModal.role,
        phone: staffModal.phone || null,
        base_salary: Number(staffModal.base_salary || 0),
        upi_id: staffModal.upi_id || null,
        bank_account: staffModal.bank_account || null,
        joining_date: staffModal.joining_date || null,
        active: staffModal.active !== false,
        updated_at: new Date().toISOString()
      };

      if (staffModal.id) {
        await updateStaff(staffModal.id, payload);
        toast.success("Staff profile updated");
      } else {
        await createStaff(payload);
        toast.success("New staff profile created");
      }
      setStaffModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save staff details");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm("Are you sure you want to remove this staff profile? This cannot be undone.")) return;
    try {
      await deleteStaff(id);
      toast.success("Staff profile deleted");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete staff");
    }
  };

  // ==========================================
  // TAB 2: PERFORMANCE COMPUTATIONS
  // ==========================================
  const performanceData = useMemo(() => {
    const list = staff || [];
    // Date checks
    const isInPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      if (perfFilterMode === "month") {
        return d.slice(0, 7) === perfMonth;
      } else {
        return d >= perfStart && d <= perfEnd;
      }
    };

    return list.map(s => {
      // Days present
      const staffAtt = (attendance || []).filter(a => a.staff_id === s.id && isInPeriod(a.date));
      const presentCount = staffAtt.filter(a => a.status === "present" || a.status === "late").length;
      
      // Hours worked
      let totalMins = 0;
      staffAtt.forEach(a => {
        if ((a.status === "present" || a.status === "late") && a.check_in && a.check_out) {
          const [inH, inM] = a.check_in.split(":").map(Number);
          const [outH, outM] = a.check_out.split(":").map(Number);
          const diff = (outH * 60 + outM) - (inH * 60 + inM);
          if (diff > 0) totalMins += diff;
        }
      });
      const hoursWorked = (totalMins / 60).toFixed(1);

      // Invoices in period served by this staff
      const staffInvoices = (invoices || []).filter(inv => {
        if (inv.status === "void" || !isInPeriod(inv.billing_at)) return false;
        // Served as main staff or line-item staff
        const hasMain = inv.staff_name === s.name;
        const hasLine = (inv.invoice_items || []).some(item => item.staff_name === s.name);
        return hasMain || hasLine;
      });

      const uniqueClients = new Set(staffInvoices.map(inv => inv.customer_id)).size;

      // Net sales (share of service items served by this staff)
      let netSales = 0;
      staffInvoices.forEach(inv => {
        (inv.invoice_items || []).forEach(item => {
          const itemStaff = item.staff_name || inv.staff_name;
          if (itemStaff === s.name) {
            // Net price (GST excluded if inclusive)
            const price = item.item_type === "service" && item.tax_inclusive !== false ? (Number(item.price || 0) / 1.05) : Number(item.price || 0);
            netSales += price * Number(item.quantity || 1);
          }
        });
      });

      // Tips from splits
      const staffTips = (tipSplits || []).filter(ts => ts.staff_name === s.name && (
        // Find matching invoice to verify date
        (invoices || []).some(inv => inv.id === ts.invoice_id && isInPeriod(inv.billing_at))
      ));
      const totalTips = staffTips.reduce((acc, t) => acc + Number(t.tip_amount || 0), 0);

      return {
        ...s,
        presentCount,
        hoursWorked,
        servicesCount: staffInvoices.length,
        uniqueClients,
        netSales: Math.round(netSales),
        totalTips
      };
    });
  }, [staff, attendance, invoices, tipSplits, perfFilterMode, perfMonth, perfStart, perfEnd]);

  // Performance staff sub-ledger
  const staffPerformanceInvoices = useMemo(() => {
    if (!selectedPerformanceStaff) return [];
    const sName = selectedPerformanceStaff.name;
    const isInPeriod = (dateStr) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      if (perfFilterMode === "month") {
        return d.slice(0, 7) === perfMonth;
      } else {
        return d >= perfStart && d <= perfEnd;
      }
    };
    return (invoices || []).filter(inv => {
      if (inv.status === "void" || !isInPeriod(inv.billing_at)) return false;
      const hasMain = inv.staff_name === sName;
      const hasLine = (inv.invoice_items || []).some(item => item.staff_name === sName);
      return hasMain || hasLine;
    });
  }, [selectedPerformanceStaff, invoices, perfFilterMode, perfMonth, perfStart, perfEnd]);



  const handleGenerateWorksheet = async () => {
    setSaving(true);
    try {
      // Loop through all active staff and generate unpaid staff_payment row if not exists
      const activeStaff = (staff || []).filter(s => s.active);
      let count = 0;
      let updatedCount = 0;
      for (const s of activeStaff) {
        // Compute tips for this staff in the month
        const monthTips = (tipSplits || []).filter(ts => ts.staff_name === s.name && (
          (invoices || []).some(inv => inv.id === ts.invoice_id && (inv.billing_at || "").slice(0, 7) === payrollMonth)
        ));
        const computedTips = monthTips.reduce((acc, t) => acc + Number(t.tip_amount || 0), 0);

        // Compute pending advances for this month
        const monthAdvances = (staffAdvances || []).filter(a => a.staff_id === s.id && a.work_month === payrollMonth && a.status === "pending");
        const computedAdvances = monthAdvances.reduce((acc, a) => acc + Number(a.amount || 0), 0);

        const net = Number(s.base_salary || 0) + computedTips - computedAdvances;

        const existingPayment = (staffPayments || []).find(p => p.staff_id === s.id && p.work_month === payrollMonth);

        if (!existingPayment) {
          await saveStaffPayment({
            staff_id: s.id,
            work_month: payrollMonth,
            base_salary: s.base_salary,
            tips_earned: computedTips,
            incentives: 0,
            advances_deducted: computedAdvances,
            other_deductions: 0,
            net_payable: net,
            scheduled_payment_date: scheduledDateInput,
            status: "unpaid",
            notes: ""
          });
          count++;
        } else if (existingPayment.status === "unpaid") {
          // Re-sync unpaid payment rows with current directory settings & transactions
          await saveStaffPayment({
            ...existingPayment,
            base_salary: s.base_salary,
            tips_earned: computedTips,
            advances_deducted: computedAdvances,
            net_payable: Number(s.base_salary || 0) + computedTips + Number(existingPayment.incentives || 0) - computedAdvances - Number(existingPayment.other_deductions || 0),
            scheduled_payment_date: scheduledDateInput || existingPayment.scheduled_payment_date
          });
          updatedCount++;
        }
      }
      toast.success(`Worksheet generated! Created ${count} and synced ${updatedCount} records.`);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to generate worksheet");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaymentRow = async (pay) => {
    try {
      await saveStaffPayment(pay);
      toast.success("Worksheet row saved");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save row");
    }
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await markSalaryPaid(
        payoutModal.paymentId,
        payoutModal.staffId,
        payoutModal.workMonth,
        payoutModal.paymentDate,
        payoutModal.netPayable,
        payoutModal.staffName,
        payoutModal.paymentMethod
      );
      toast.success(`Salary marked as PAID for ${payoutModal.staffName}`);
      setPayoutModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to mark paid");
    } finally {
      setSaving(false);
    }
  };

  // Compute filtered advances
  const filteredAdvances = useMemo(() => {
    return (staffAdvances || []).filter(a => a.work_month === payrollMonth);
  }, [staffAdvances, payrollMonth]);

  // Compute monthly worksheet records
  const worksheetRecords = useMemo(() => {
    const list = (staffPayments || []).filter(p => p.work_month === payrollMonth);
    // Include staff name
    return list.map(p => {
      const s = (staff || []).find(st => st.id === p.staff_id);
      return {
        ...p,
        staffName: s ? s.name : "Unknown staff"
      };
    });
  }, [staffPayments, payrollMonth, staff]);

  return (
    <>
      {/* Tab Switcher */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button className={`tbl-btn ${activeTab === "directory" ? "active" : ""}`} onClick={() => setActiveTab("directory")}>
          👥 Staff Directory
        </button>
        <button className={`tbl-btn ${activeTab === "performance" ? "active" : ""}`} onClick={() => setActiveTab("performance")}>
          ⭐ Staff Performance
        </button>
        <button className={`tbl-btn ${activeTab === "payroll" ? "active" : ""}`} onClick={() => setActiveTab("payroll")}>
          💵 Salaries & Payroll
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: DIRECTORY */}
      {/* ================================================================= */}
      {activeTab === "directory" && (
        <div className="table-wrap">
          <div className="table-header">
            <div className="table-title">Stylist & Employee Directory</div>
            <div className="table-actions">
              <button className="btn-add" onClick={() => setStaffModal({ name: "", role: "Stylist", phone: "", base_salary: 15000, upi_id: "", bank_account: "", joining_date: new Date().toISOString().slice(0, 10), active: true })}>
                <Plus size={14} style={{ marginRight: 6 }} /> Add Staff Profile
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Role / Designation</th>
                <th>Phone Number</th>
                <th>Base Salary (₹)</th>
                <th>Active Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(staff || []).map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    {s.joining_date && <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>Joined: {new Date(s.joining_date).toLocaleDateString("en-IN")}</div>}
                  </td>
                  <td>
                    <span className="badge badge-gold" style={{ padding: "2px 6px" }}>{s.role}</span>
                  </td>
                  <td>{s.phone || "—"}</td>
                  <td style={{ fontWeight: "bold" }}>Rs {Number(s.base_salary || 0).toLocaleString("en-IN")}</td>
                  <td>
                    <span style={{ fontSize: "0.68rem", fontWeight: "bold", color: s.active ? "#2e7d32" : "#777" }}>
                      ● {s.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="tbl-actions" style={{ justifyContent: "flex-end" }}>
                      <button className="tbl-btn" onClick={() => navigate(`/staff/${s.id}`)}>
                        <Eye size={12} style={{ marginRight: 4 }} /> Profile
                      </button>
                      <button className="tbl-btn" onClick={() => setStaffModal(s)}>Edit</button>
                      <button className="tbl-btn danger" onClick={() => handleDeleteStaff(s.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!(staff || []).length && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                    No staff records found. Add staff to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: PERFORMANCE */}
      {/* ================================================================= */}
      {activeTab === "performance" && (
        <>
          <div className="table-wrap">
            <div className="table-header">
              <div className="table-title">Performance Analytics</div>
              <div className="table-actions" style={{ display: "flex", gap: "0.5rem" }}>
                <div style={{ display: "flex", background: "rgba(0,0,0,0.03)", padding: "2px", borderRadius: "4px" }}>
                  <button type="button" className={`tbl-btn ${perfFilterMode === "month" ? "active" : ""}`} onClick={() => setPerfFilterMode("month")} style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}>Month</button>
                  <button type="button" className={`tbl-btn ${perfFilterMode === "range" ? "active" : ""}`} onClick={() => setPerfFilterMode("range")} style={{ padding: "0.25rem 0.5rem", fontSize: "0.7rem" }}>Custom Range</button>
                </div>
                {perfFilterMode === "month" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button type="button" className="tbl-btn" onClick={() => setPerfMonth(adjustMonth(perfMonth, -1))}><ChevronLeft size={14} /></button>
                    <span style={{ fontSize: "0.82rem", fontWeight: "bold", minWidth: 100, textAlign: "center" }}>{formatMonthLabel(perfMonth)}</span>
                    <button type="button" className="tbl-btn" onClick={() => setPerfMonth(adjustMonth(perfMonth, 1))}><ChevronRight size={14} /></button>
                  </div>

                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <input type="date" className="form-input" value={perfStart} onChange={e => setPerfStart(e.target.value)} style={{ padding: "0.25rem", width: 110, fontSize: "0.75rem" }} />
                    <span style={{ color: "#aaa" }}>to</span>
                    <input type="date" className="form-input" value={perfEnd} onChange={e => setPerfEnd(e.target.value)} style={{ padding: "0.25rem", width: 110, fontSize: "0.75rem" }} />
                  </div>
                )}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Stylist Name</th>
                  <th>Designation</th>
                  <th style={{ textAlign: "center" }}>Days Present</th>
                  <th style={{ textAlign: "center" }}>Hours Logged</th>
                  <th style={{ textAlign: "center" }}>Services Rendered</th>
                  <th style={{ textAlign: "center" }}>Unique Clients</th>
                  <th style={{ textAlign: "right" }}>Net Sales Volume</th>
                  <th style={{ textAlign: "right" }}>Tips Earned</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map(s => (
                  <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/staff/${s.id}`)}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.role}</td>
                    <td style={{ textAlign: "center", fontWeight: "bold" }}>{s.presentCount}</td>
                    <td style={{ textAlign: "center" }}>{s.hoursWorked} hrs</td>
                    <td style={{ textAlign: "center" }}>{s.servicesCount}</td>
                    <td style={{ textAlign: "center" }}>{s.uniqueClients}</td>
                    <td style={{ textAlign: "right", fontWeight: "bold" }}>Rs {s.netSales.toLocaleString("en-IN")}</td>
                    <td style={{ textAlign: "right", color: s.totalTips > 0 ? "var(--gold)" : "inherit" }}>Rs {s.totalTips.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* TAB 3: PAYROLL */}
      {/* ================================================================= */}
      {activeTab === "payroll" && (
        <>
          {/* Payroll Setup & Monthly worksheet header */}
          <div className="pos-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Salary Work Month</label>
                  <input type="month" className="form-input" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} style={{ width: 160 }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Scheduled Payout Date</label>
                  <input type="date" className="form-input" value={scheduledDateInput} onChange={e => setScheduledDateInput(e.target.value)} style={{ width: 150 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn-add" onClick={handleGenerateWorksheet} disabled={saving}>
                  {saving ? "Generating..." : "Generate Month Worksheet"}
                </button>
              </div>
            </div>
          </div>

          {/* Salary Payout Worksheet */}
          <div className="table-wrap">
            <div className="table-header">
              <div className="table-title">Salary Payout Worksheet ({formatMonthLabel(payrollMonth)})</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th style={{ width: 110 }}>Base Salary (₹)</th>
                  <th style={{ width: 80, textAlign: "center" }}>Days Present</th>
                  <th style={{ width: 100 }}>Tips Earned (₹)</th>
                  <th style={{ width: 100 }}>Incentives (₹)</th>
                  <th style={{ width: 110 }}>Advances (₹)</th>
                  <th style={{ width: 120 }}>Other Deductions (₹)</th>
                  <th style={{ width: 110, textAlign: "right" }}>Net Payable</th>
                  <th style={{ width: 130 }}>Scheduled Pay</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {worksheetRecords.map(p => {
                  const unpaid = p.status === "unpaid";
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.staffName}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: "0.2rem", fontSize: "0.78rem", width: "100%" }}
                          value={p.base_salary}
                          disabled={!unpaid}
                          onChange={(e) => {
                            const base = Number(e.target.value) || 0;
                            const net = base + Number(p.tips_earned) + Number(p.incentives) - Number(p.advances_deducted) - Number(p.other_deductions);
                            handleSavePaymentRow({ ...p, base_salary: base, net_payable: net });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: "0.2rem", fontSize: "0.78rem", width: "100%", textAlign: "center" }}
                          value={p.days_present || 0}
                          disabled={!unpaid}
                          onChange={(e) => {
                            const dp = Number(e.target.value) || 0;
                            handleSavePaymentRow({ ...p, days_present: dp });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: "0.2rem", fontSize: "0.78rem", width: "100%" }}
                          value={p.tips_earned || 0}
                          disabled={!unpaid}
                          onChange={(e) => {
                            const tips = Number(e.target.value) || 0;
                            const net = Number(p.base_salary) + tips + Number(p.incentives) - Number(p.advances_deducted) - Number(p.other_deductions);
                            handleSavePaymentRow({ ...p, tips_earned: tips, net_payable: net });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-input"
                          style={{ padding: "0.2rem", fontSize: "0.78rem", width: "100%" }}
                          value={p.incentives}
                          disabled={!unpaid}
                          onChange={(e) => {
                            const inc = Number(e.target.value) || 0;
                            const net = Number(p.base_salary) + Number(p.tips_earned) + inc - Number(p.advances_deducted) - Number(p.other_deductions);
                            handleSavePaymentRow({ ...p, incentives: inc, net_payable: net });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: "0.2rem", fontSize: "0.78rem", width: "100%" }}
                          value={p.advances_deducted || 0}
                          disabled={!unpaid}
                          onChange={(e) => {
                            const adv = Number(e.target.value) || 0;
                            const net = Number(p.base_salary) + Number(p.tips_earned) + Number(p.incentives) - adv - Number(p.other_deductions || 0);
                            handleSavePaymentRow({ ...p, advances_deducted: adv, net_payable: net });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="form-input"
                          style={{ padding: "0.2rem", fontSize: "0.78rem", width: "100%" }}
                          value={p.other_deductions || 0}
                          disabled={!unpaid}
                          placeholder="Other ded."
                          onChange={(e) => {
                            const ded = Number(e.target.value) || 0;
                            const net = Number(p.base_salary) + Number(p.tips_earned) + Number(p.incentives) - Number(p.advances_deducted) - ded;
                            handleSavePaymentRow({ ...p, other_deductions: ded, net_payable: net });
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "0.85rem" }}>
                        Rs {Number(p.net_payable).toLocaleString("en-IN")}
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-input"
                          style={{ padding: "0.15rem", fontSize: "0.75rem", width: 110 }}
                          value={p.scheduled_payment_date || ""}
                          disabled={!unpaid}
                          onChange={(e) => {
                            handleSavePaymentRow({ ...p, scheduled_payment_date: e.target.value });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: "0.2rem", fontSize: "0.75rem", width: 120 }}
                          value={p.notes || ""}
                          disabled={!unpaid}
                          placeholder="Add notes..."
                          onChange={(e) => {
                            handleSavePaymentRow({ ...p, notes: e.target.value });
                          }}
                        />
                      </td>
                      <td>
                        <span className="badge" style={{ background: unpaid ? "rgba(183,28,28,0.08)" : "rgba(46,125,50,0.08)", color: unpaid ? "#b71c1c" : "#2e7d32", padding: "2px 6px" }}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {unpaid ? (
                          <button className="btn-add" style={{ padding: "0.25rem 0.6rem", fontSize: "0.7rem", background: "#2e7d32" }} onClick={() => setPayoutModal({ paymentId: p.id, staffId: p.staff_id, workMonth: p.work_month, netPayable: p.net_payable, staffName: p.staffName, paymentMethod: "Cash", notes: p.notes, paymentDate: new Date().toISOString().slice(0, 10) })}>
                            Mark Paid
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>Paid on {p.payment_date}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!worksheetRecords.length && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                      Worksheet not generated yet. Click "Generate Month Worksheet" above to pull employee figures.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* MODALS */}
      {/* ================================================================= */}

      {/* Tab 1: Staff Modal */}
      {staffModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStaffModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{staffModal.id ? "Edit Employee Profile" : "Add Employee Profile"}</div>
              <button className="modal-close" onClick={() => setStaffModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="staff-form" onSubmit={handleSaveStaff}>
                <div className="form-group">
                  <label className="form-label">Stylist / Staff Name *</label>
                  <input className="form-input" value={staffModal.name || ""} onChange={e => setStaffModal({ ...staffModal, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role Designation *</label>
                    <select className="form-input" value={staffModal.role} onChange={e => setStaffModal({ ...staffModal, role: e.target.value })} required>
                      <option value="Senior Stylist">Senior Stylist</option>
                      <option value="Stylist">Stylist</option>
                      <option value="Hair Stylist">Hair Stylist</option>
                      <option value="Assistant Stylist">Assistant Stylist</option>
                      <option value="Receptionist">Receptionist</option>
                      <option value="Manager">Manager</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" value={staffModal.phone || ""} onChange={e => setStaffModal({ ...staffModal, phone: e.target.value })} placeholder="10 digit number" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Base Monthly Salary (₹) *</label>
                    <input type="number" min="0" className="form-input" value={staffModal.base_salary} onChange={e => setStaffModal({ ...staffModal, base_salary: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Joining Date</label>
                    <input type="date" className="form-input" value={staffModal.joining_date || ""} onChange={e => setStaffModal({ ...staffModal, joining_date: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">UPI ID for payouts</label>
                    <input className="form-input" value={staffModal.upi_id || ""} onChange={e => setStaffModal({ ...staffModal, upi_id: e.target.value })} placeholder="e.g. employee@upi" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bank Account details</label>
                    <input className="form-input" value={staffModal.bank_account || ""} onChange={e => setStaffModal({ ...staffModal, bank_account: e.target.value })} placeholder="A/C No, IFSC, Bank name" />
                  </div>
                </div>

                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input type="checkbox" id="staff-active" checked={staffModal.active !== false} onChange={e => setStaffModal({ ...staffModal, active: e.target.checked })} style={{ width: 16, height: 16 }} />
                  <label htmlFor="staff-active" style={{ fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>Active employee (shows up in POS and schedules)</label>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setStaffModal(null)}>Cancel</button>
              <button type="submit" form="staff-form" className="btn-add" disabled={saving}>{saving ? "Saving..." : "Save Employee"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Mark Paid Payout Modal */}
      {payoutModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayoutModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Record Salary Payout — {payoutModal.staffName}</div>
              <button className="modal-close" onClick={() => setPayoutModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="payout-form" onSubmit={handleMarkPaid}>
                <div style={{ background: "rgba(46,125,50,0.06)", border: "1px solid rgba(46,125,50,0.2)", padding: "1rem", borderRadius: "4px", marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "var(--a-muted)" }}>Confirm Net Payout Amount</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2e7d32" }}>
                    Rs {Number(payoutModal.netPayable).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#666", marginTop: "0.25rem" }}>
                    This includes tips and has all advances deducted for month {formatMonthLabel(payoutModal.workMonth)}.
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Method *</label>
                    <select className="form-input" value={payoutModal.paymentMethod} onChange={e => setPayoutModal({ ...payoutModal, paymentMethod: e.target.value })} required>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / Digital</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Date *</label>
                    <input type="date" className="form-input" value={payoutModal.paymentDate} onChange={e => setPayoutModal({ ...payoutModal, paymentDate: e.target.value })} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Transaction Notes / Reference</label>
                  <textarea className="form-input" rows="2" value={payoutModal.notes || ""} onChange={e => setPayoutModal({ ...payoutModal, notes: e.target.value })} placeholder="Reference number or memo..."></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setPayoutModal(null)}>Cancel</button>
              <button type="submit" form="payout-form" className="btn-add" disabled={saving} style={{ background: "#2e7d32" }}>
                {saving ? "Recording..." : "Reconcile & Payout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
