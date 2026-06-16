import { useMemo, useState } from "react";
import { DollarSign, ShieldAlert, CheckCircle, Mail, PlusCircle, History } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { openCashRegister, updateCashRegisterExpenses, closeCashRegister, sendEodEmailReport } from "../../lib/api";
import toast from "react-hot-toast";

export default function CashRegisterManager() {
  const { invoices, staff, attendance, inventory, cashRegister, settings, reload } = useAdmin();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [closingCashInput, setClosingCashInput] = useState("");
  const [registerNotes, setRegisterNotes] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNotesInput, setExpenseNotesInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Find register row for the selected date
  const activeRegister = useMemo(() => {
    return (cashRegister || []).find(r => r.date === date);
  }, [cashRegister, date]);

  // Calculate today's sales from invoices
  const salesForDate = useMemo(() => {
    const list = (invoices || []).filter(inv => {
      if (!inv.billing_at) return false;
      const invDate = new Date(inv.billing_at).toISOString().slice(0, 10);
      return invDate === date && inv.status !== "void";
    });

    const breakdown = { Cash: 0, UPI: 0, Card: 0, "Bank Transfer": 0 };
    let totalRevenue = 0;
    list.forEach(inv => {
      const amt = Number(inv.total || 0);
      breakdown[inv.payment_method] = (breakdown[inv.payment_method] || 0) + amt;
      totalRevenue += amt;
    });

    return {
      count: list.length,
      revenue: totalRevenue,
      cash: breakdown.Cash,
      upi: breakdown.UPI,
      card: breakdown.Card,
      bankTransfer: breakdown["Bank Transfer"],
      invoiceList: list
    };
  }, [invoices, date]);

  // Calculate expected cash
  const expectedCash = useMemo(() => {
    if (!activeRegister) return 0;
    return Number(activeRegister.opening_cash || 0) + Number(salesForDate.cash) - Number(activeRegister.expenses || 0);
  }, [activeRegister, salesForDate]);

  const handleOpen = async () => {
    if (!openingCashInput || isNaN(openingCashInput)) {
      toast.error("Please enter a valid opening cash amount");
      return;
    }
    setSaving(true);
    try {
      await openCashRegister(date, Number(openingCashInput));
      toast.success("Cash register opened for " + date);
      setOpeningCashInput("");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to open register");
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!activeRegister) return;
    const amt = Number(expenseAmount);
    if (!expenseAmount || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive expense amount");
      return;
    }
    setSaving(true);
    try {
      const currentExpenses = Number(activeRegister.expenses || 0) + amt;
      const separator = activeRegister.expense_notes ? " | " : "";
      const currentNotes = (activeRegister.expense_notes || "") + separator + `${expenseNotesInput} (Rs ${amt})`;

      await updateCashRegisterExpenses(activeRegister.id, currentExpenses, currentNotes);
      toast.success("Expense logged!");
      setExpenseAmount("");
      setExpenseNotesInput("");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to log expense");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    if (!activeRegister) return;
    if (!closingCashInput || isNaN(closingCashInput)) {
      toast.error("Please enter a valid closing cash amount");
      return;
    }
    setSaving(true);
    try {
      await closeCashRegister(activeRegister.id, Number(closingCashInput), registerNotes);
      toast.success("Register closed for " + date);
      setClosingCashInput("");
      setRegisterNotes("");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to close register");
    } finally {
      setSaving(false);
    }
  };

  const handleSendEodEmail = async () => {
    if (!activeRegister) return;
    setSaving(true);
    try {
      // 1. Compile Sales Breakdown
      const salesText = `
SALES SUMMARY
-----------------------------
Total Invoices: ${salesForDate.count}
Total Revenue: Rs ${salesForDate.revenue.toLocaleString("en-IN")}
Payment Methods:
  - Cash Sales: Rs ${salesForDate.cash.toLocaleString("en-IN")}
  - UPI Sales: Rs ${salesForDate.upi.toLocaleString("en-IN")}
  - Card Sales: Rs ${salesForDate.card.toLocaleString("en-IN")}
  - Bank Transfer: Rs ${salesForDate.bankTransfer.toLocaleString("en-IN")}
`;

      // 2. Compile Cash Registry Reconciliation
      const registerText = `
CASH RECONCILIATION
-----------------------------
Opening Cash: Rs ${Number(activeRegister.opening_cash).toLocaleString("en-IN")}
Expenses (Daily payouts): Rs ${Number(activeRegister.expenses).toLocaleString("en-IN")}
  - Expense Notes: ${activeRegister.expense_notes || "None"}
Expected Cash in Drawer: Rs ${expectedCash.toLocaleString("en-IN")}
Actual Closing Cash: ${activeRegister.status === "closed" ? "Rs " + Number(activeRegister.closing_cash).toLocaleString("en-IN") : "Register still open"}
Discrepancy: ${activeRegister.status === "closed" ? "Rs " + (Number(activeRegister.closing_cash) - expectedCash).toLocaleString("en-IN") : "N/A"}
Notes: ${activeRegister.notes || "None"}
`;

      // 3. Compile Attendance
      const attendanceList = (attendance || []).filter(a => a.date === date);
      let attendanceText = `\nSTAFF ATTENDANCE\n-----------------------------\n`;
      if (attendanceList.length) {
        attendanceList.forEach(a => {
          const empName = staff.find(s => s.id === a.staff_id)?.name || "Unknown Staff";
          const checkin = a.check_in ? ` (In: ${a.check_in})` : "";
          attendanceText += `• ${empName}: ${a.status.toUpperCase()}${checkin}\n`;
        });
      } else {
        attendanceText += `No attendance logged today.\n`;
      }

      // 4. Compile Inventory Alerts
      const lowStock = (inventory || []).filter(item => Number(item.stock_qty) <= Number(item.min_qty));
      let inventoryText = `\nLOW STOCK WARNINGS\n-----------------------------\n`;
      if (lowStock.length) {
        lowStock.forEach(item => {
          inventoryText += `⚠️ ${item.name} (Qty: ${item.stock_qty} / Min: ${item.min_qty})\n`;
        });
      } else {
        inventoryText += `All inventory levels normal.\n`;
      }

      const emailTextBody = `
=========================================
TONI & GUY GORANTLA - EOD REPORT
Date: ${new Date(date).toLocaleDateString("en-IN")}
=========================================
${salesText}
${registerText}
${attendanceText}
${inventoryText}
-----------------------------------------
Report generated: ${new Date().toLocaleString("en-IN")}
Toni & Guy Gorantla, Guntur
`;

      const adminEmail = settings.email || "gorantla@essensualssalon.com";
      await sendEodEmailReport("", emailTextBody, adminEmail);
      toast.success("EOD Email compiled! Opening your mail client...");
    } catch (err) {
      toast.error(err.message || "Failed to compile EOD email");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="pos-grid">
        <div className="pos-panel">
          <div className="pos-header" style={{ borderBottom: "1px solid var(--a-border)", paddingBottom: "1.5rem" }}>
            <div>
              <div className="table-title">Cash Register Register</div>
              <div className="pos-sub">Daily drawer cash reconciliations</div>
            </div>
            <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ maxWidth: 160, padding: "0.5rem 1rem", fontSize: "0.75rem" }} />
          </div>

          {!activeRegister ? (
            // Register is Closed/Not Opened Yet
            <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", color: "#999", marginBottom: "1rem" }}>💵</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", marginBottom: "0.5rem", color: "#1a1a1a" }}>Register is Closed</h3>
              <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "1.5rem", maxWidth: 300, margin: "0 auto 1.5rem" }}>
                Enter the opening cash (entrance cash) to open the register for {new Date(date).toLocaleDateString("en-IN")}.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", maxWidth: 320, margin: "0 auto" }}>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Opening cash (₹)" 
                  value={openingCashInput} 
                  onChange={e => setOpeningCashInput(e.target.value)} 
                  style={{ flex: 1 }}
                />
                <button className="btn-add" onClick={handleOpen} disabled={saving}>
                  {saving ? "Opening..." : "Open Register"}
                </button>
              </div>
            </div>
          ) : (
            // Register is Open
            <div style={{ padding: "1rem 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: activeRegister.status === "open" ? "#2e7d32" : "#777" }}></span>
                  <span style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Register {activeRegister.status.toUpperCase()}
                  </span>
                </div>
                {activeRegister.status === "open" && (
                  <button className="tbl-btn" style={{ borderColor: "#2e7d32", color: "#2e7d32" }} disabled={true}>
                    Open Drawer
                  </button>
                )}
              </div>

              {/* Cash Register Metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
                <div style={{ border: "1px solid #e8e8e4", padding: "1rem" }}>
                  <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", letterSpacing: "0.1em" }}>Opening cash (Entrance)</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>Rs {Number(activeRegister.opening_cash).toLocaleString("en-IN")}</div>
                </div>
                <div style={{ border: "1px solid #e8e8e4", padding: "1rem" }}>
                  <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", letterSpacing: "0.1em" }}>Today's Cash Sales</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#2e7d32" }}>+ Rs {salesForDate.cash.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ border: "1px solid #e8e8e4", padding: "1rem" }}>
                  <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", letterSpacing: "0.1em" }}>Daily Expenses Payout</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#b71c1c" }}>- Rs {Number(activeRegister.expenses || 0).toLocaleString("en-IN")}</div>
                </div>
                <div style={{ border: "1px solid #e8e8e4", padding: "1rem", background: "rgba(201,185,154,0.05)" }}>
                  <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#c9b99a", letterSpacing: "0.1em", fontWeight: "600" }}>Expected Cash In Register</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#c9b99a" }}>Rs {expectedCash.toLocaleString("en-IN")}</div>
                </div>
              </div>

              {activeRegister.expense_notes && (
                <div style={{ marginBottom: "2rem", padding: "0.75rem", background: "#f8f8f6", borderLeft: "2px solid #b71c1c" }}>
                  <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", fontWeight: "bold", marginBottom: "0.25rem" }}>Daily Expense logs</div>
                  <div style={{ fontSize: "0.7rem", color: "#555" }}>{activeRegister.expense_notes}</div>
                </div>
              )}

              {activeRegister.status === "open" ? (
                // Open forms
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
                  {/* Log Payout / Expense Form */}
                  <form onSubmit={handleAddExpense} style={{ background: "#fcfcfa", padding: "1.25rem", border: "1px dashed var(--a-border)" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", color: "#b71c1c" }}>
                      Log Cash Payout / Daily Expense
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Expense Amount (₹)</label>
                        <input type="number" min="1" className="form-input" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="e.g. 150" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Expense Description</label>
                        <input type="text" className="form-input" value={expenseNotesInput} onChange={e => setExpenseNotesInput(e.target.value)} placeholder="e.g. tea snacks, water, sweeping" />
                      </div>
                    </div>
                    <button type="submit" className="tbl-btn danger" style={{ marginTop: "0.5rem", width: "100%" }} disabled={saving}>
                      Log Cash Withdrawal
                    </button>
                  </form>

                  {/* Close register form */}
                  <form onSubmit={handleClose} style={{ background: "#fafafa", padding: "1.5rem", border: "1px solid var(--a-border)" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" }}>
                      Close Cash Register Reconciliation
                    </div>
                    <div className="form-group">
                      <label className="form-label">Actual Closing Cash (Counted in Drawer) *</label>
                      <input type="number" min="0" className="form-input" value={closingCashInput} onChange={e => setClosingCashInput(e.target.value)} placeholder="Enter counted physical cash..." required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Daily Reconciliation Notes</label>
                      <textarea className="form-input" rows="2" value={registerNotes} onChange={e => setRegisterNotes(e.target.value)} placeholder="Notes on drawer count difference, if any..."></textarea>
                    </div>
                    <button type="submit" className="btn-add" style={{ width: "100%", background: "#0d0d0d", color: "#fff" }} disabled={saving}>
                      {saving ? "Closing..." : "Reconcile & Close Register"}
                    </button>
                  </form>
                </div>
              ) : (
                // Register is closed reconciliation summary
                <div style={{ padding: "1rem", border: "1px solid #2e7d32", background: "#e8f5e9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#2e7d32", fontWeight: "bold", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                    <CheckCircle size={14} /> Reconciled & Closed
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.75rem", color: "#333" }}>
                    <div>Counted Closing Cash: <strong>Rs {Number(activeRegister.closing_cash).toLocaleString("en-IN")}</strong></div>
                    <div>Difference: <strong style={{ color: Number(activeRegister.closing_cash) - expectedCash < 0 ? "#b71c1c" : "#2e7d32" }}>
                      Rs {(Number(activeRegister.closing_cash) - expectedCash).toLocaleString("en-IN")}
                    </strong></div>
                  </div>
                  {activeRegister.notes && (
                    <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", borderTop: "1px solid rgba(46,125,50,0.2)", paddingTop: "0.5rem", color: "#555" }}>
                      Notes: {activeRegister.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Invoice sales details for the day */}
        <aside className="invoice-preview">
          <div className="preview-card" style={{ background: "#fff", border: "1px solid #e8e8e4", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <div>
                <div className="table-title">EOD Sales Report</div>
                <div style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", marginTop: "0.2rem" }}>
                  {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              <button 
                className="tbl-btn" 
                onClick={handleSendEodEmail} 
                disabled={!activeRegister || saving}
                style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.65rem", padding: "0.4rem 0.8rem" }}
              >
                <Mail size={12} /> Email EOD
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem", background: "#f8f8f6", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                <span>UPI Transactions</span>
                <strong>Rs {salesForDate.upi.toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                <span>Card Payments</span>
                <strong>Rs {salesForDate.card.toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }}>
                <span>Bank Transfers</span>
                <strong>Rs {salesForDate.bankTransfer.toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
                <span>Non-Cash Revenue</span>
                <strong>Rs {(salesForDate.upi + salesForDate.card + salesForDate.bankTransfer).toLocaleString("en-IN")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", borderTop: "1px double #ccc", paddingTop: "0.5rem" }}>
                <span style={{ fontWeight: "bold" }}>Total Revenue ({salesForDate.count} bills)</span>
                <strong style={{ fontSize: "0.85rem", color: "#c9b99a" }}>Rs {salesForDate.revenue.toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <div style={{ fontSize: "0.65rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", marginBottom: "0.75rem" }}>
              Today's Invoices
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto" }}>
              {salesForDate.invoiceList.map(inv => (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", padding: "0.3rem 0", borderBottom: "1px solid #f0f0ec" }}>
                  <span>
                    <strong style={{ marginRight: 6 }}>{inv.invoice_number.slice(-5)}</strong>
                    {inv.client_name}
                  </span>
                  <span>
                    Rs {inv.total.toLocaleString("en-IN")} ({inv.payment_method})
                  </span>
                </div>
              ))}
              {!salesForDate.invoiceList.length && (
                <div style={{ fontSize: "0.65rem", color: "#bbb", textAlign: "center", padding: "1rem" }}>
                  No invoices billed today.
                </div>
              )}
            </div>
          </div>

          {/* Cash registers history */}
          <div className="table-wrap history-wrap no-print" style={{ marginTop: "1.5rem" }}>
            <div className="table-header">
              <div className="table-title" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <History size={14} /> Register History
              </div>
            </div>
            <div className="history-list" style={{ maxHeight: "180px", overflowY: "auto" }}>
              {(cashRegister || []).slice(0, 15).map(reg => (
                <button type="button" className="history-row" key={reg.id} onClick={() => setDate(reg.date)}>
                  <span>
                    <strong>{new Date(reg.date).toLocaleDateString("en-IN")}</strong>
                    {reg.status === "open" ? "Status: Open" : `Closed: Rs ${Number(reg.closing_cash).toLocaleString("en-IN")}`}
                  </span>
                  <span style={{ color: reg.status === "open" ? "#2e7d32" : "inherit" }}>
                    {reg.status === "open" ? "OPEN" : `Exp: Rs ${Number(reg.expenses).toLocaleString("en-IN")}`}
                  </span>
                </button>
              ))}
              {!cashRegister.length && (
                <div className="admin-empty compact">No register logs found.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
