import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, X, Download, TrendingUp, TrendingDown, DollarSign, PieChart, AlertTriangle, Mail, CheckCircle, History, Edit2 } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import toast from "react-hot-toast";
import { 
  openCashRegister, 
  updateCashRegisterExpenses, 
  closeCashRegister, 
  reopenCashRegister,
  sendEodEmailReport, 
  saveExpense, 
  deleteExpense, 
  saveExpenseCategory, 
  deleteExpenseCategory,
  saveStaffAdvance,
  saveFixedExpense,
  deleteFixedExpense,
  saveFixedExpensePayment
} from "../../lib/api";

export default function FinanceManager() {
  const { invoices, staff, attendance, inventory, cashRegister, expenses, expenseCategories, settings, reload, fixedExpenses, fixedExpensePayments } = useAdmin();

  const [activeTab, setActiveTab] = useState("register"); // register | fixed_expenses | pl

  // --- GENERAL STATE ---
  const [saving, setSaving] = useState(false);

  // ==========================================
  // TAB 1: CASH REGISTER STATE & LOGIC
  // ==========================================
  const [regDate, setRegDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [closingCashInput, setClosingCashInput] = useState("");
  const [registerNotes, setRegisterNotes] = useState("");
  const [cashRegisterExpenseAmount, setCashRegisterExpenseAmount] = useState("");
  const [cashRegisterExpenseNotesInput, setCashRegisterExpenseNotesInput] = useState("");
  const [cashRegisterExpenseCategory, setCashRegisterExpenseCategory] = useState("Other");
  const [cashRegisterExpenseStaffId, setCashRegisterExpenseStaffId] = useState("");
  
  const [editingExpense, setEditingExpense] = useState(null); // null | expense

  const isTodayOrYesterday = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date();
    const formatYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    const todayYMD = formatYMD(today);
    
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayYMD = formatYMD(yesterday);
    
    const targetYMD = dateStr.slice(0, 10);
    return targetYMD === todayYMD || targetYMD === yesterdayYMD;
  };

  const activeRegister = useMemo(() => {
    return (cashRegister || []).find(r => r.date === regDate);
  }, [cashRegister, regDate]);


  const salesForDate = useMemo(() => {
    const list = (invoices || []).filter(inv => {
      if (!inv.billing_at) return false;
      const invDate = new Date(inv.billing_at).toISOString().slice(0, 10);
      return invDate === regDate && inv.status !== "void";
    });

    const breakdown = { Cash: 0, UPI: 0, Card: 0 };
    let totalRevenue = 0;
    list.forEach(inv => {
      const amt = Number(inv.total || 0);
      const payment = inv.payment_method || "Unknown";
      
      if (payment === "Cash + UPI" && inv.transaction_id && inv.transaction_id.includes("cash:")) {
        const parts = inv.transaction_id.split("|");
        let cashAmt = 0;
        let upiAmt = 0;
        parts.forEach(p => {
          if (p.startsWith("cash:")) cashAmt = Number(p.replace("cash:", "")) || 0;
          if (p.startsWith("upi:")) upiAmt = Number(p.replace("upi:", "")) || 0;
        });
        breakdown["Cash"] = (breakdown["Cash"] || 0) + cashAmt;
        breakdown["UPI"] = (breakdown["UPI"] || 0) + upiAmt;
      } else {
        if (payment !== "Bank Transfer") {
          breakdown[payment] = (breakdown[payment] || 0) + amt;
        }
      }
      totalRevenue += amt;
    });

    return {
      count: list.length,
      revenue: totalRevenue,
      cash: breakdown.Cash || 0,
      upi: breakdown.UPI || 0,
      card: breakdown.Card || 0,
      invoiceList: list
    };
  }, [invoices, regDate]);

  const dailyCashExpensesList = useMemo(() => {
    return (expenses || []).filter(e => e.date === regDate && e.payment_method === "Cash");
  }, [expenses, regDate]);

  const expectedCash = useMemo(() => {
    if (!activeRegister) return 0;
    const totalCashExpenses = dailyCashExpensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return Number(activeRegister.opening_cash || 0) + Number(salesForDate.cash) - totalCashExpenses;
  }, [activeRegister, salesForDate, dailyCashExpensesList]);

  const expenseItems = useMemo(() => {
    if (!activeRegister?.expense_notes) return [];
    return activeRegister.expense_notes.split(/\s*\|\s*/).filter(Boolean);
  }, [activeRegister?.expense_notes]);


  const parseExpense = (item) => {
    const match = item.match(/(.*?)\s*\(Rs\s*(\d+(?:\.\d+)?)\)/i);
    if (match) {
      return {
        desc: match[1].trim(),
        amount: Number(match[2]),
      };
    }
    return { desc: item.trim(), amount: null };
  };

  const handleOpenRegister = async () => {
    if (!isTodayOrYesterday(regDate)) {
      toast.error("Registers can only be opened or managed for today or yesterday.");
      return;
    }
    if (!openingCashInput || isNaN(openingCashInput)) {
      toast.error("Please enter a valid opening cash amount");
      return;
    }
    setSaving(true);
    try {
      await openCashRegister(regDate, Number(openingCashInput));
      toast.success("Cash register opened for " + regDate);
      setOpeningCashInput("");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to open register");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRegisterExpense = async (e) => {
    e.preventDefault();
    if (!isTodayOrYesterday(regDate)) {
      toast.error("Register payouts can only be logged for today or yesterday.");
      return;
    }
    if (!activeRegister) return;
    const amt = Number(cashRegisterExpenseAmount);
    if (!cashRegisterExpenseAmount || isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive expense amount");
      return;
    }
    if (cashRegisterExpenseCategory === "Staff Advance" && !cashRegisterExpenseStaffId) {
      toast.error("Please select a staff member for the advance payout");
      return;
    }

    setSaving(true);
    try {
      const currentExpenses = Number(activeRegister.expenses || 0) + amt;
      const separator = activeRegister.expense_notes ? " | " : "";
      const label = cashRegisterExpenseCategory === "Staff Advance" 
        ? "Staff Advance" 
        : cashRegisterExpenseCategory;
      const currentNotes = (activeRegister.expense_notes || "") + separator + `${label}: ${cashRegisterExpenseNotesInput || "Payout"} (Rs ${amt})`;

      await updateCashRegisterExpenses(activeRegister.id, currentExpenses, currentNotes);
      
      if (cashRegisterExpenseCategory === "Staff Advance") {
        const emp = (staff || []).find(st => st.id === cashRegisterExpenseStaffId);
        await saveStaffAdvance({
          staff_id: cashRegisterExpenseStaffId,
          staff_name: emp ? emp.name : "Staff",
          amount: amt,
          date: regDate,
          work_month: regDate.slice(0, 7),
          notes: cashRegisterExpenseNotesInput || "Register Payout Staff Advance"
        });
      } else {
        await saveExpense({
          category: cashRegisterExpenseCategory,
          description: `Register Payout: ${cashRegisterExpenseNotesInput || "Cash Drawer Payout"}`,
          amount: amt,
          date: regDate,
          payment_method: "Cash"
        });
      }

      toast.success("Expense logged in register and sync'd successfully!");
      setCashRegisterExpenseAmount("");
      setCashRegisterExpenseNotesInput("");
      setCashRegisterExpenseStaffId("");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to log expense");
    } finally {
      setSaving(false);
    }
  };


  const handleCloseRegister = async (e) => {
    e.preventDefault();
    if (!isTodayOrYesterday(regDate)) {
      toast.error("Registers can only be closed for today or yesterday.");
      return;
    }
    if (!activeRegister) return;
    if (!closingCashInput || isNaN(closingCashInput)) {
      toast.error("Please enter a valid closing cash amount");
      return;
    }
    setSaving(true);
    try {
      await closeCashRegister(activeRegister.id, Number(closingCashInput), registerNotes);
      toast.success("Register closed for " + regDate);
      setClosingCashInput("");
      setRegisterNotes("");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to close register");
    } finally {
      setSaving(false);
    }
  };

  const handleReopenRegister = async () => {
    if (!isTodayOrYesterday(regDate)) {
      toast.error("Registers can only be reopened or managed for today or yesterday.");
      return;
    }
    if (!window.confirm("Are you sure you want to re-open this cash register?")) return;
    setSaving(true);
    try {
      await reopenCashRegister(activeRegister.id);
      toast.success("Cash register reopened successfully!");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to reopen register");
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
---------------------------------------------
Total Invoices:  ${salesForDate.count}
Total Revenue:   Rs ${salesForDate.revenue.toLocaleString("en-IN")}
Payment Methods:
  - Cash Sales:  Rs ${salesForDate.cash.toLocaleString("en-IN")}
  - UPI Sales:   Rs ${salesForDate.upi.toLocaleString("en-IN")}
  - Card Sales:  Rs ${salesForDate.card.toLocaleString("en-IN")}
`;

      // 1b. Compile Tabular Invoice List
      const invoiceList = salesForDate.invoiceList || [];
      let invoicesTableText = `\nCLIENT BILLING RECORDS (TODAY)\n`;
      invoicesTableText += `-----------------------------------------------------------------------\n`;
      invoicesTableText += `| Client Name     | Services Rendered             | Total Bill (Rs)   |\n`;
      invoicesTableText += `-----------------------------------------------------------------------\n`;
      if (invoiceList.length) {
        invoiceList.forEach(inv => {
          const clientName = (inv.client_name || "Walk-in").padEnd(15).slice(0, 15);
          const itemNames = (inv.invoice_items || inv.items || []).map(i => i.service_name).join(", ") || "Service";
          const services = itemNames.padEnd(29).slice(0, 29);
          const amount = String(Number(inv.total || 0).toFixed(2)).padStart(17).slice(0, 17);
          invoicesTableText += `| ${clientName} | ${services} | ${amount} |\n`;
        });
      } else {
        invoicesTableText += `| No transactions recorded today.                                     |\n`;
      }
      invoicesTableText += `-----------------------------------------------------------------------\n`;

      // 2. Compile Cash Registry Reconciliation
      const totalCashExpenses = dailyCashExpensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const cashExpensesNotes = dailyCashExpensesList.map(e => `${e.description} (${e.category}): Rs ${e.amount}`).join(" | ") || "None";
      const registerText = `
CASH DRAWER RECONCILIATION
---------------------------------------------
Opening Cash:    Rs ${Number(activeRegister.opening_cash).toLocaleString("en-IN")}
Cash Expenses:   Rs ${totalCashExpenses.toLocaleString("en-IN")}
  - Notes:       ${cashExpensesNotes}
Expected Cash:   Rs ${expectedCash.toLocaleString("en-IN")}
Actual Cash:     ${activeRegister.status === "closed" ? "Rs " + Number(activeRegister.closing_cash).toLocaleString("en-IN") : "Drawer Still Open"}
Discrepancy:     ${activeRegister.status === "closed" ? "Rs " + (Number(activeRegister.closing_cash) - expectedCash).toLocaleString("en-IN") : "N/A"}
Drawer Notes:    ${activeRegister.notes || "None"}
`;


      const emailTextBody = `
=======================================================================
TONI & GUY ESSENSUALS GORANTLA - EOD REPORT
Date: ${new Date(regDate).toLocaleDateString("en-IN")}
=======================================================================
${salesText}
${invoicesTableText}
${registerText}
-----------------------------------------------------------------------
Report generated: ${new Date().toLocaleString("en-IN")}
=======================================================================
`;
      const adminEmail = settings?.email || "gorantla@essensualssalon.com";
      await sendEodEmailReport("", emailTextBody, adminEmail);
      toast.success("EOD Email compiled and sent!");
    } catch (err) {
      toast.error(err.message || "Failed to compile EOD email");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // ==========================================
  // TAB 2: FIXED EXPENSES STATE & ACTIONS
  // ==========================================
  const [fxMonth, setFxMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [fxModal, setFxModal] = useState(null); // null | { name, category, amount, due_day, notes, active, id? }
  const [fxSaving, setFxSaving] = useState(false);

  const FX_CATEGORIES = ["Rent", "Electricity", "Water", "Internet", "Staff Room", "Laundry", "Maintenance", "Insurance", "Other"];

  const handleSaveFixedExpense = async (e) => {
    e.preventDefault();
    if (!fxModal.name) { toast.error("Enter expense name"); return; }
    if (!fxModal.amount || Number(fxModal.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    setFxSaving(true);
    try {
      await saveFixedExpense({
        id: fxModal.id,
        name: fxModal.name,
        category: fxModal.category || "Rent",
        amount: Number(fxModal.amount),
        due_day: Number(fxModal.due_day) || 1,
        notes: fxModal.notes || null,
        active: fxModal.active !== false
      });
      toast.success(fxModal.id ? "Fixed expense updated!" : "Fixed expense added!");
      setFxModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setFxSaving(false);
    }
  };

  const handleDeleteFixedExpense = async (id) => {
    if (!window.confirm("Delete this fixed expense? All payment history will also be removed.")) return;
    try {
      await deleteFixedExpense(id);
      toast.success("Fixed expense deleted");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleTogglePayment = async (fxId, currentStatus) => {
    const newStatus = currentStatus === "paid" ? "unpaid" : "paid";
    try {
      await saveFixedExpensePayment({
        fixed_expense_id: fxId,
        work_month: fxMonth,
        status: newStatus,
        paid_date: newStatus === "paid" ? new Date().toISOString().slice(0, 10) : null
      });
      toast.success(newStatus === "paid" ? "Marked as Paid ✓" : "Marked as Unpaid");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Payment lookup for selected month
  const fxPaymentMap = useMemo(() => {
    const map = {};
    (fixedExpensePayments || []).filter(p => p.work_month === fxMonth).forEach(p => {
      map[p.fixed_expense_id] = p;
    });
    return map;
  }, [fixedExpensePayments, fxMonth]);

  const fxSummary = useMemo(() => {
    const active = (fixedExpenses || []).filter(f => f.active !== false);
    const total = active.reduce((s, f) => s + Number(f.amount || 0), 0);
    const paid = active.filter(f => fxPaymentMap[f.id]?.status === "paid").reduce((s, f) => s + Number(f.amount || 0), 0);
    return { total, paid, unpaid: total - paid, count: active.length };
  }, [fixedExpenses, fxPaymentMap]);


  // ==========================================
  // TAB 3: PROFIT & LOSS COMPUTATIONS
  // ==========================================
  const [plMonth, setPlMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const plStats = useMemo(() => {
    // 1. Gross Revenue
    const monthInvoices = (invoices || []).filter(inv => 
      inv.status !== "void" && (inv.billing_at || "").slice(0, 7) === plMonth
    );
    const revenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

    // 2. Monthly Expenses
    const monthExpenses = (expenses || []).filter(e => 
      (e.date || "").slice(0, 7) === plMonth
    );
    const ledgerSum = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const legacyRegSum = (cashRegister || []).filter(reg => {
      if ((reg.date || "").slice(0, 7) !== plMonth) return false;
      const hasSync = (expenses || []).some(e => e.date === reg.date && e.description && e.description.startsWith("Register Payout:"));
      return !hasSync;
    }).reduce((sum, reg) => sum + Number(reg.expenses || 0), 0);

    const totalExpenses = ledgerSum + legacyRegSum;

    // 3. Profit Margin
    const netProfit = revenue - totalExpenses;
    const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

    // 4. Fixed Costs
    const fixedCategories = new Set(
      (expenseCategories || []).filter(c => c.is_fixed).map(c => c.name)
    );
    const fixedCosts = monthExpenses
      .filter(e => fixedCategories.has(e.category))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      revenue,
      totalExpenses,
      netProfit,
      margin,
      fixedCosts,
      monthExpenses,
      legacyRegSum
    };
  }, [invoices, expenses, cashRegister, expenseCategories, plMonth]);


  // Group monthly expenses by category for pie/donut table
  const plCategoryBreakdown = useMemo(() => {
    const groups = {};
    plStats.monthExpenses.forEach(e => {
      groups[e.category] = (groups[e.category] || 0) + Number(e.amount || 0);
    });

    if (plStats.legacyRegSum && plStats.legacyRegSum > 0) {
      groups["Other"] = (groups["Other"] || 0) + plStats.legacyRegSum;
    }

    const categoriesMap = {};
    (expenseCategories || []).forEach(c => {
      categoriesMap[c.name] = c;
    });

    return Object.entries(groups).map(([cat, amt]) => {
      const meta = categoriesMap[cat];
      return {
        category: cat,
        icon: meta ? meta.icon : "💳",
        amount: amt,
        isFixed: meta ? meta.is_fixed : false,
        pct: plStats.totalExpenses > 0 ? ((amt / plStats.totalExpenses) * 100).toFixed(1) : "0.0"
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [plStats.monthExpenses, plStats.totalExpenses, plStats.legacyRegSum, expenseCategories]);


  // Monthly Revenue vs Expenses Trend (div bars)
  const monthlyTrends = useMemo(() => {
    // Generate list of last 6 months
    const trendList = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = monthDate.toISOString().slice(0, 7); // YYYY-MM
      const label = monthDate.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      
      // Calc rev
      const rev = (invoices || [])
        .filter(inv => inv.status !== "void" && (inv.billing_at || "").slice(0, 7) === key)
        .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
        
      // Calc exp
      const ledgerExp = (expenses || [])
        .filter(e => (e.date || "").slice(0, 7) === key)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const legacyRegExp = (cashRegister || [])
        .filter(reg => (reg.date || "").slice(0, 7) === key)
        .filter(reg => {
          const hasSync = (expenses || []).some(e => e.date === reg.date && e.description && e.description.startsWith("Register Payout:"));
          return !hasSync;
        })
        .reduce((sum, reg) => sum + Number(reg.expenses || 0), 0);

      const exp = ledgerExp + legacyRegExp;

      trendList.push({ key, label, revenue: rev, expenses: exp, net: rev - exp });
    }
    return trendList;
  }, [invoices, expenses, cashRegister]);


  const maxTrendValue = useMemo(() => {
    let max = 10000;
    monthlyTrends.forEach(t => {
      if (t.revenue > max) max = t.revenue;
      if (t.expenses > max) max = t.expenses;
    });
    return max;
  }, [monthlyTrends]);

  return (
    <>
      {/* Tabs Switcher */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button className={`tbl-btn ${activeTab === "register" ? "active" : ""}`} onClick={() => setActiveTab("register")}>
          💵 Cash Drawer
        </button>
        <button className={`tbl-btn ${activeTab === "fixed_expenses" ? "active" : ""}`} onClick={() => setActiveTab("fixed_expenses")}>
          📌 Fixed Expenses
        </button>
        <button className={`tbl-btn ${activeTab === "pl" ? "active" : ""}`} onClick={() => setActiveTab("pl")}>
          📊 Profit & Loss
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: CASH REGISTER */}
      {/* ================================================================= */}
      {activeTab === "register" && (
        <div className="pos-grid">
          <div className="pos-panel">
            <div className="pos-header" style={{ borderBottom: "1px solid var(--a-border)", paddingBottom: "1.5rem" }}>
              <div>
                <div className="table-title">Cash Register drawer</div>
                <div className="pos-sub">Reconcile opening cash, cash sales, and daily expenses</div>
              </div>
              <input type="date" className="form-input" value={regDate} onChange={e => setRegDate(e.target.value)} style={{ maxWidth: 160, padding: "0.5rem 1rem", fontSize: "0.75rem" }} />
            </div>

            {!activeRegister ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", color: "#999", marginBottom: "1rem" }}>💵</div>
                <h3 style={{ fontFamily: "serif", fontSize: "1.5rem", marginBottom: "0.5rem", color: "#1a1a1a" }}>Register is Closed</h3>
                <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "1.5rem", maxWidth: 300, margin: "0 auto 1.5rem" }}>
                  Enter the opening cash (entrance cash) to open the register drawer for {new Date(regDate).toLocaleDateString("en-IN")}.
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
                  <button className="btn-add" onClick={handleOpenRegister} disabled={saving}>
                    {saving ? "Opening..." : "Open Register"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "1rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: activeRegister.status === "open" ? "#2e7d32" : "#777" }}></span>
                    <span style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Register {activeRegister.status.toUpperCase()}
                    </span>
                  </div>
                </div>

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
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#b71c1c" }}>- Rs {dailyCashExpensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0).toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ border: "1px solid #e8e8e4", padding: "1rem", background: "rgba(201,185,154,0.05)" }}>
                    <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "var(--a-muted)", letterSpacing: "0.1em", fontWeight: "600" }}>Expected Cash In Register</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--a-text)" }}>Rs {expectedCash.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                {dailyCashExpensesList.length > 0 && (
                  <div style={{ marginBottom: "2rem" }}>
                    <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", fontWeight: "bold", marginBottom: "0.5rem" }}>Daily Cash Expense logs</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {dailyCashExpensesList.map((item) => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e8e8e4", padding: "1rem", borderRadius: "4px", borderLeft: "4px solid #b71c1c" }}>
                          <div>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#333" }}>{item.description}</span>
                            <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Category: {item.category}</div>
                          </div>
                          <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#b71c1c" }}>
                            ₹{Number(item.amount || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                {activeRegister.status === "open" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
                    <form onSubmit={handleAddRegisterExpense} style={{ background: "#fcfcfa", padding: "1.25rem", border: "1px dashed var(--a-border)" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", color: "#b71c1c" }}>
                        Log Cash Payout / Daily Expense
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Expense Category *</label>
                          <select 
                            className="form-input" 
                            value={cashRegisterExpenseCategory} 
                            onChange={e => {
                              setCashRegisterExpenseCategory(e.target.value);
                              if (e.target.value !== "Staff Advance") setCashRegisterExpenseStaffId("");
                            }}
                          >
                            <option value="Other">Other</option>
                            <option value="Staff Advance">Staff Advance</option>
                            {(expenseCategories || [])
                              .filter(c => c.name !== "Other" && c.name !== "Staff Advance")
                              .map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                              ))
                            }
                          </select>
                        </div>
                        {cashRegisterExpenseCategory === "Staff Advance" && (
                          <div className="form-group">
                            <label className="form-label">Staff Member *</label>
                            <select 
                              className="form-input" 
                              value={cashRegisterExpenseStaffId} 
                              onChange={e => setCashRegisterExpenseStaffId(e.target.value)}
                              required
                            >
                              <option value="" disabled>-- Select Employee --</option>
                              {(staff || []).filter(s => s.active).map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Expense Amount (₹) *</label>
                          <input type="number" min="1" className="form-input" value={cashRegisterExpenseAmount} onChange={e => setCashRegisterExpenseAmount(e.target.value)} placeholder="e.g. 150" required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Expense Description / Notes</label>
                          <input type="text" className="form-input" value={cashRegisterExpenseNotesInput} onChange={e => setCashRegisterExpenseNotesInput(e.target.value)} placeholder="e.g. sweep materials, laundry, tea..." />
                        </div>
                      </div>
                      <button type="submit" className="tbl-btn danger" style={{ marginTop: "0.5rem", width: "100%" }} disabled={saving}>
                        Log Cash Withdrawal
                      </button>
                    </form>

                    <form onSubmit={handleCloseRegister} style={{ background: "#fafafa", padding: "1.5rem", border: "1px solid var(--a-border)" }}>
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
                      <button type="submit" className="btn-add" style={{ width: "100%", background: "#000", color: "#fff" }} disabled={saving}>
                        {saving ? "Closing..." : "Reconcile & Close Register"}
                      </button>
                    </form>
                  </div>
                ) : (
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
                    <button 
                      type="button" 
                      className="tbl-btn" 
                      style={{ marginTop: "1rem", width: "100%", border: "1px solid #2e7d32", color: "#2e7d32", background: "none", fontWeight: "bold" }}
                      disabled={saving}
                      onClick={handleReopenRegister}
                    >
                      🔓 Re-open Register
                    </button>

                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar daily invoices */}
          <aside className="invoice-preview">
            <div className="preview-card" style={{ background: "#fff", border: "1px solid #e8e8e4", padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div className="table-title">Daily Sales Report</div>
                  <div style={{ fontSize: "0.6rem", color: "#999", textTransform: "uppercase", marginTop: "0.2rem" }}>
                    {new Date(regDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <button className="tbl-btn" onClick={handleSendEodEmail} disabled={!activeRegister || saving} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.65rem", padding: "0.4rem 0.8rem" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
                  <span>Non-Cash Revenue</span>
                  <strong>Rs {(salesForDate.upi + salesForDate.card).toLocaleString("en-IN")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", borderTop: "1px double #ccc", paddingTop: "0.5rem" }}>
                  <span style={{ fontWeight: "bold" }}>Total Revenue ({salesForDate.count} bills)</span>
                  <strong style={{ fontSize: "0.85rem", color: "var(--a-text)" }}>Rs {salesForDate.revenue.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              <div style={{ fontSize: "0.65rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", marginBottom: "0.75rem" }}>
                Today's Invoices
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }}>
                {salesForDate.invoiceList.map(inv => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e8e8e4", padding: "0.75rem 1rem", borderRadius: "4px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1a1a1a" }}>{inv.client_name}</span>
                      <span style={{ fontSize: "0.65rem", color: "#666" }}>
                        <strong style={{ color: "var(--gold)" }}>{inv.invoice_number}</strong> · {inv.payment_method}
                      </span>
                    </div>
                    <span style={{ fontSize: "1rem", fontWeight: "bold", color: "#2e7d32" }}>
                      ₹{inv.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
                {!salesForDate.invoiceList.length && (
                  <div style={{ fontSize: "0.65rem", color: "#bbb", textAlign: "center", padding: "1.5rem" }}>
                    No invoices billed today.
                  </div>
                )}
              </div>
            </div>

            {/* Cash register history log list */}
            <div className="table-wrap history-wrap no-print" style={{ marginTop: "1.5rem" }}>
              <div className="table-header">
                <div className="table-title" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <History size={14} /> Register History
                </div>
              </div>
              <div className="history-list" style={{ maxHeight: "180px", overflowY: "auto" }}>
                {(cashRegister || []).slice(0, 15).map(reg => (
                  <button type="button" className="history-row" key={reg.id} onClick={() => setRegDate(reg.date)} style={{ width: "100%", padding: "0.5rem", border: "none", borderBottom: "1px solid #eee", background: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span>
                      <strong>{new Date(reg.date).toLocaleDateString("en-IN")}</strong>
                      {reg.status === "open" ? " (Open)" : ` (Closed: ₹${reg.closing_cash})`}
                    </span>
                    <span style={{ color: reg.status === "open" ? "#2e7d32" : "inherit" }}>
                      {reg.status === "open" ? "OPEN" : `Exp: ₹${reg.expenses}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: FIXED EXPENSES */}
      {/* ================================================================= */}
      {activeTab === "fixed_expenses" && (
        <>
          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="pos-panel" style={{ padding: "1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Total Monthly Fixed</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>₹{fxSummary.total.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{fxSummary.count} recurring expenses</div>
            </div>
            <div className="pos-panel" style={{ padding: "1.25rem", textAlign: "center", borderLeft: "4px solid #2e7d32" }}>
              <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#2e7d32", marginBottom: "0.4rem" }}>Paid This Month</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#2e7d32" }}>₹{fxSummary.paid.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{(fixedExpenses || []).filter(f => f.active !== false && fxPaymentMap[f.id]?.status === "paid").length} items paid</div>
            </div>
            <div className="pos-panel" style={{ padding: "1.25rem", textAlign: "center", borderLeft: `4px solid ${fxSummary.unpaid > 0 ? "#b71c1c" : "#999"}` }}>
              <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: fxSummary.unpaid > 0 ? "#b71c1c" : "var(--a-muted)", marginBottom: "0.4rem" }}>Still Unpaid</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: fxSummary.unpaid > 0 ? "#b71c1c" : "inherit" }}>₹{fxSummary.unpaid.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{(fixedExpenses || []).filter(f => f.active !== false && fxPaymentMap[f.id]?.status !== "paid").length} items pending</div>
            </div>
          </div>

          {/* Header: Month picker + Add button */}
          <div className="table-wrap">
            <div className="table-header">
              <div className="table-title">📌 Fixed Expenses</div>
              <div className="table-actions" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>Tracking month:</span>
                <input
                  type="month"
                  className="admin-search"
                  value={fxMonth}
                  onChange={e => setFxMonth(e.target.value)}
                  style={{ width: 150 }}
                />
                <button
                  className="btn-add"
                  onClick={() => setFxModal({ name: "", category: "Rent", amount: "", due_day: 1, notes: "", active: true })}
                >
                  <Plus size={14} style={{ marginRight: 6 }} /> Add Fixed Expense
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Expense Name</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Monthly Amount</th>
                  <th style={{ textAlign: "center" }}>Due Day</th>
                  <th>Notes</th>
                  <th style={{ textAlign: "center" }}>Status ({new Date(fxMonth + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" })})</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(fixedExpenses || []).filter(f => f.active !== false).map(fx => {
                  const payment = fxPaymentMap[fx.id];
                  const isPaid = payment?.status === "paid";
                  return (
                    <tr key={fx.id}>
                      <td style={{ fontWeight: 600 }}>{fx.name}</td>
                      <td>
                        <span className="badge badge-gold" style={{ padding: "2px 8px" }}>{fx.category}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "0.95rem" }}>₹{Number(fx.amount).toLocaleString("en-IN")}</td>
                      <td style={{ textAlign: "center", color: "var(--a-muted)", fontSize: "0.72rem" }}>
                        {fx.due_day ? `${fx.due_day}${["st","nd","rd"][fx.due_day-1]||"th"} of month` : "—"}
                      </td>
                      <td style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>{fx.notes || "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePayment(fx.id, payment?.status)}
                          style={{
                            padding: "0.3rem 0.9rem",
                            borderRadius: "999px",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: "0.7rem",
                            letterSpacing: "0.06em",
                            background: isPaid ? "#e8f5e9" : "#fce4ec",
                            color: isPaid ? "#2e7d32" : "#b71c1c",
                            transition: "all 0.15s"
                          }}
                        >
                          {isPaid ? "✓ PAID" : "✗ UNPAID"}
                        </button>
                        {isPaid && payment?.paid_date && (
                          <div style={{ fontSize: "0.58rem", color: "var(--a-muted)", marginTop: "2px" }}>
                            Paid on {new Date(payment.paid_date).toLocaleDateString("en-IN")}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="tbl-btn"
                            style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }}
                            onClick={() => setFxModal({ ...fx })}
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            className="tbl-btn danger"
                            style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }}
                            onClick={() => handleDeleteFixedExpense(fx.id)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!(fixedExpenses || []).filter(f => f.active !== false).length && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📌</div>
                      No fixed expenses added yet. Click "Add Fixed Expense" to track rent, electricity and other recurring costs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add / Edit Modal */}
          {fxModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <form onSubmit={handleSaveFixedExpense} style={{ background: "#fff", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <div className="table-title">{fxModal.id ? "Edit Fixed Expense" : "Add Fixed Expense"}</div>
                  <button type="button" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setFxModal(null)}><X size={18} /></button>
                </div>
                <div className="form-group">
                  <label className="form-label">Expense Name *</label>
                  <input className="form-input" placeholder="e.g. Salon Rent, Staff Room Rent, Electricity..." value={fxModal.name} onChange={e => setFxModal({ ...fxModal, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Category *</label>
                    <select className="form-input" value={fxModal.category} onChange={e => setFxModal({ ...fxModal, category: e.target.value })} required>
                      {FX_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Monthly Amount (₹) *</label>
                    <input type="number" min="1" className="form-input" value={fxModal.amount} onChange={e => setFxModal({ ...fxModal, amount: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Day of Month (1–31)</label>
                  <input type="number" min="1" max="31" className="form-input" value={fxModal.due_day} onChange={e => setFxModal({ ...fxModal, due_day: e.target.value })} placeholder="e.g. 1 for 1st of every month" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Optional notes (e.g. landlord name, contract details)" value={fxModal.notes} onChange={e => setFxModal({ ...fxModal, notes: e.target.value })} />
                </div>
                <button className="btn-add" type="submit" style={{ width: "100%", marginTop: "0.5rem" }} disabled={fxSaving}>
                  {fxSaving ? "Saving..." : (fxModal.id ? "Update Fixed Expense" : "Add Fixed Expense")}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* TAB 3: PROFIT & LOSS */}
      {/* ================================================================= */}
      {activeTab === "pl" && (
        <>
          {/* Header filter */}
          <div className="pos-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="table-title">Monthly P&L Reporting</div>
              <input type="month" className="admin-search" value={plMonth} onChange={e => setPlMonth(e.target.value)} style={{ width: 180 }} />
            </div>
          </div>

          {/* Stats KPI grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Gross Revenue</div>
              <div className="stat-value">Rs {plStats.revenue.toLocaleString("en-IN")}</div>
              <div className="stat-sub">From client bill checkouts</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Outflow Expenses</div>
              <div className="stat-value" style={{ color: "#b71c1c" }}>Rs {plStats.totalExpenses.toLocaleString("en-IN")}</div>
              <div className="stat-sub">Salaries, Rent, Bills, Inventory...</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net Profit / Loss</div>
              <div className="stat-value" style={{ color: plStats.netProfit >= 0 ? "#2e7d32" : "#b71c1c" }}>
                {plStats.netProfit >= 0 ? "+" : ""} Rs {plStats.netProfit.toLocaleString("en-IN")}
              </div>
              <div className="stat-sub">{plStats.netProfit >= 0 ? "🟢 PROFITABLE CYCLE" : "🔴 UNPROFITABLE CYCLE"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Profit Margin</div>
              <div className="stat-value">{plStats.margin}%</div>
              <div className="stat-sub">Share of revenue saved</div>
            </div>
          </div>

          {/* Break-Even Progress Bar */}
          <div className="pos-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
              <span>Fixed Operating Costs Reconciled</span>
              <span>Rs {plStats.fixedCosts.toLocaleString("en-IN")} Target</span>
            </div>
            <div style={{ height: "16px", background: "rgba(0,0,0,0.03)", borderRadius: "8px", overflow: "hidden", position: "relative", marginBottom: "0.5rem" }}>
              <div style={{ 
                height: "100%", 
                width: `${Math.min(100, plStats.fixedCosts > 0 ? (plStats.revenue / plStats.fixedCosts) * 100 : 0)}%`, 
                background: plStats.revenue >= plStats.fixedCosts ? "#2e7d32" : "#c9a84c"
              }}></div>
            </div>
            <div style={{ fontSize: "0.75rem", color: plStats.revenue >= plStats.fixedCosts ? "#2e7d32" : "#666", display: "flex", alignItems: "center", gap: "4px" }}>
              {plStats.revenue >= plStats.fixedCosts ? (
                <>
                  <CheckCircle size={12} /> <strong>Break-even achieved!</strong> You are Rs {(plStats.revenue - plStats.fixedCosts).toLocaleString("en-IN")} above fixed operational costs.
                </>
              ) : (
                <>
                  <AlertTriangle size={12} /> You need Rs {(plStats.fixedCosts - plStats.revenue).toLocaleString("en-IN")} more in revenue to cover this month's fixed operating costs.
                </>
              )}
            </div>
          </div>

          {/* Categorized spending & monthly trends */}
          <div className="pos-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            <div className="pos-panel" style={{ padding: "1.5rem" }}>
              <div className="table-title" style={{ marginBottom: "1rem" }}>Operating Expenses Breakdown</div>
              <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--a-border)", textAlign: "left" }}>
                      <th style={{ padding: "0.4rem" }}>Category</th>
                      <th style={{ padding: "0.4rem", textAlign: "right" }}>Amount</th>
                      <th style={{ padding: "0.4rem", textAlign: "right" }}>Share %</th>
                      <th style={{ padding: "0.4rem", textAlign: "center" }}>Cost Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plCategoryBreakdown.map(cat => (
                      <tr key={cat.category} style={{ borderBottom: "1px dashed rgba(0,0,0,0.04)" }}>
                        <td style={{ padding: "0.5rem" }}>{cat.icon} {cat.category}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold" }}>Rs {cat.amount.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "var(--a-muted)" }}>{cat.pct}%</td>
                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                          <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: "2px", background: cat.isFixed ? "rgba(13,13,13,0.05)" : "none", border: cat.isFixed ? "1px solid #ccc" : "none" }}>
                            {cat.isFixed ? "FIXED" : "VARIABLE"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!plCategoryBreakdown.length && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--a-muted)" }}>
                          No expenses recorded for this month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly Trend bar chart */}
            <div className="pos-panel" style={{ padding: "1.5rem" }}>
              <div className="table-title" style={{ marginBottom: "1rem" }}>6-Month Revenue & Cash Flow Trends</div>
              <div style={{ display: "flex", height: "200px", alignItems: "flex-end", justifyContent: "space-around", paddingTop: "1rem" }}>
                {monthlyTrends.map(t => {
                  const revHeightPct = Math.round((t.revenue / maxTrendValue) * 100) || 5;
                  const expHeightPct = Math.round((t.expenses / maxTrendValue) * 100) || 5;
                  const isProfit = t.net >= 0;
                  return (
                    <div key={t.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "15%" }}>
                      {/* Double bars */}
                      <div style={{ display: "flex", gap: "2px", width: "100%", height: "140px", alignItems: "flex-end", justifyContent: "center" }}>
                        {/* Rev bar */}
                        <div style={{ height: `${revHeightPct}%`, width: "12px", background: isProfit ? "#2e7d32" : "#f57c00", borderRadius: "2px 2px 0 0" }} title={`Revenue: Rs ${t.revenue}`}></div>
                        {/* Exp bar */}
                        <div style={{ height: `${expHeightPct}%`, width: "12px", background: "#b71c1c", borderRadius: "2px 2px 0 0" }} title={`Expenses: Rs ${t.expenses}`}></div>
                      </div>
                      <span style={{ fontSize: "0.65rem", fontWeight: "bold", marginTop: "0.5rem", color: "var(--a-muted)" }}>{t.label}</span>
                      <span style={{ fontSize: "0.55rem", fontWeight: "bold", color: isProfit ? "#2e7d32" : "#b71c1c" }}>
                        {isProfit ? "PROFIT" : "LOSS"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* MODALS */}
      {/* ================================================================= */}

      {/* Create Custom Category Modal */}
      {categoryModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setCategoryModal(null)}>
          <div className="modal" style={{ maxWidth: "360px" }}>
            <div className="modal-header">
              <div className="modal-title">Create Custom Category</div>
              <button className="modal-close" onClick={() => setCategoryModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="category-form" onSubmit={handleSaveCustomCategory}>
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input className="form-input" value={categoryModal.name} onChange={e => setCategoryModal({ ...categoryModal, name: e.target.value })} placeholder="e.g. Refreshments, Sweeping..." required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Icon Emoji</label>
                    <input className="form-input" value={categoryModal.icon} onChange={e => setCategoryModal({ ...categoryModal, icon: e.target.value })} placeholder="e.g. 🍕" maxLength={2} />
                  </div>
                </div>
                <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <input type="checkbox" id="cat-is-fixed" checked={categoryModal.is_fixed} onChange={e => setCategoryModal({ ...categoryModal, is_fixed: e.target.checked })} style={{ width: 16, height: 16 }} />
                  <label htmlFor="cat-is-fixed" style={{ fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>Is Fixed Operating Cost?</label>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setCategoryModal(null)}>Cancel</button>
              <button type="submit" form="category-form" className="btn-add" disabled={saving}>
                {saving ? "Creating..." : "Create Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingExpense(null)}>
          <div className="modal" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <div className="modal-title">Edit Expense Entry</div>
              <button className="modal-close" onClick={() => setEditingExpense(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="edit-expense-form" onSubmit={handleUpdateExpense}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Category *</label>
                  <select className="form-input" value={editingExpense.category} onChange={e => setEditingExpense({ ...editingExpense, category: e.target.value })} required>
                    {(expenseCategories || []).map(c => (
                      <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Description / Vendor / Item Details</label>
                  <input className="form-input" value={editingExpense.description} onChange={e => setEditingExpense({ ...editingExpense, description: e.target.value })} placeholder="Details..." />
                </div>
                <div className="form-row" style={{ marginBottom: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input type="number" min="1" className="form-input" value={editingExpense.amount} onChange={e => setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transaction Date *</label>
                    <input type="date" className="form-input" value={editingExpense.date} onChange={e => setEditingExpense({ ...editingExpense, date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Payment Mode *</label>
                    <select className="form-input" value={editingExpense.payment_method} onChange={e => setEditingExpense({ ...editingExpense, payment_method: e.target.value })} required>
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ref Number / Bill Receipt No.</label>
                    <input className="form-input" value={editingExpense.reference || ""} onChange={e => setEditingExpense({ ...editingExpense, reference: e.target.value })} placeholder="Receipt number" />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setEditingExpense(null)}>Cancel</button>
              <button type="submit" form="edit-expense-form" className="btn-add" disabled={saving}>
                {saving ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

