import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, X, Download, TrendingUp, TrendingDown, DollarSign, PieChart, AlertTriangle, Mail, CheckCircle, History } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import toast from "react-hot-toast";
import { 
  openCashRegister, 
  updateCashRegisterExpenses, 
  closeCashRegister, 
  sendEodEmailReport, 
  saveExpense, 
  deleteExpense, 
  saveExpenseCategory, 
  deleteExpenseCategory 
} from "../../lib/api";

export default function FinanceManager() {
  const { invoices, staff, attendance, inventory, cashRegister, expenses, expenseCategories, settings, reload } = useAdmin();

  const [activeTab, setActiveTab] = useState("register"); // register | expenses | pl

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
    setSaving(true);
    try {
      const currentExpenses = Number(activeRegister.expenses || 0) + amt;
      const separator = activeRegister.expense_notes ? " | " : "";
      const currentNotes = (activeRegister.expense_notes || "") + separator + `${cashRegisterExpenseNotesInput} (Rs ${amt})`;

      await updateCashRegisterExpenses(activeRegister.id, currentExpenses, currentNotes);
      
      // Sync into the main expenses table automatically (under category 'Other' or custom selected)
      await saveExpense({
        category: "Other",
        description: `Register Payout: ${cashRegisterExpenseNotesInput}`,
        amount: amt,
        date: regDate,
        payment_method: "Cash"
      });

      toast.success("Expense logged in register and sync'd to expense manager!");
      setCashRegisterExpenseAmount("");
      setCashRegisterExpenseNotesInput("");
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
  // TAB 2: EXPENSES STATE & ACTIONS
  // ==========================================
  const [expenseMonth, setExpenseMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [expenseCatFilter, setExpenseCatFilter] = useState("all");
  const [categoryModal, setCategoryModal] = useState(null); // null | { name, icon, is_fixed }
  
  // Add Expense form state
  const [newExpense, setNewExpense] = useState({
    category: "Rent",
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    payment_method: "Cash",
    reference: ""
  });

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!isTodayOrYesterday(newExpense.date)) {
      toast.error("Expenses can only be logged for today or yesterday.");
      return;
    }
    if (!newExpense.category) {
      toast.error("Please select a category");
      return;
    }
    if (!newExpense.amount || Number(newExpense.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await saveExpense({
        category: newExpense.category,
        description: newExpense.description,
        amount: Number(newExpense.amount),
        date: newExpense.date,
        payment_method: newExpense.payment_method,
        reference: newExpense.reference
      });
      toast.success("Expense log added");
      setNewExpense({
        category: "Rent",
        description: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        payment_method: "Cash",
        reference: ""
      });
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to log expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    const exp = (expenses || []).find(x => x.id === id);
    if (exp && !isTodayOrYesterday(exp.date)) {
      toast.error("Expenses can only be deleted for today or yesterday.");
      return;
    }
    if (!window.confirm("Delete this expense record?")) return;
    try {
      await deleteExpense(id);
      toast.success("Expense record deleted");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete expense");
    }
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();

    if (!isTodayOrYesterday(editingExpense.date)) {
      toast.error("Expenses can only be modified for today or yesterday.");
      return;
    }
    if (!editingExpense.category) {
      toast.error("Please select a category");
      return;
    }
    if (!editingExpense.amount || Number(editingExpense.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await saveExpense(editingExpense);
      toast.success("Expense updated successfully!");
      setEditingExpense(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update expense");
    } finally {
      setSaving(false);
    }
  };



  const handleSaveCustomCategory = async (e) => {
    e.preventDefault();
    if (!categoryModal.name) return;
    setSaving(true);
    try {
      await saveExpenseCategory({
        name: categoryModal.name,
        icon: categoryModal.icon || "💳",
        is_fixed: categoryModal.is_fixed
      });
      toast.success("Custom category added!");
      setCategoryModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Category already exists or failed to create");
    } finally {
      setSaving(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      const eMonth = (e.date || "").slice(0, 7);
      if (expenseMonth && eMonth !== expenseMonth) return false;
      if (expenseCatFilter !== "all" && e.category !== expenseCatFilter) return false;
      return true;
    });
  }, [expenses, expenseMonth, expenseCatFilter]);

  const totalFilteredExpense = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [filteredExpenses]);

  const exportExpensesCSV = () => {
    if (!filteredExpenses.length) {
      toast.error("No expenses to export");
      return;
    }
    const headers = ["Date", "Category", "Description", "Amount", "Payment Method", "Reference", "Notes"];
    const rows = filteredExpenses.map(e => [
      e.date || "",
      e.category || "",
      e.description || "",
      e.amount || 0,
      e.payment_method || "",
      e.reference || "",
      e.notes || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expenses_ledger_${expenseMonth || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

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
      monthExpenses
    };
  }, [invoices, expenses, expenseCategories, plMonth]);

  // Group monthly expenses by category for pie/donut table
  const plCategoryBreakdown = useMemo(() => {
    const groups = {};
    plStats.monthExpenses.forEach(e => {
      groups[e.category] = (groups[e.category] || 0) + Number(e.amount || 0);
    });

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
  }, [plStats.monthExpenses, plStats.totalExpenses, expenseCategories]);

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
      const exp = (expenses || [])
        .filter(e => (e.date || "").slice(0, 7) === key)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);

      trendList.push({ key, label, revenue: rev, expenses: exp, net: rev - exp });
    }
    return trendList;
  }, [invoices, expenses]);

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
        <button className={`tbl-btn ${activeTab === "expenses" ? "active" : ""}`} onClick={() => setActiveTab("expenses")}>
          💳 Expenses Ledger
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
                          <label className="form-label">Expense Amount (₹)</label>
                          <input type="number" min="1" className="form-input" value={cashRegisterExpenseAmount} onChange={e => setCashRegisterExpenseAmount(e.target.value)} placeholder="e.g. 150" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Expense Description</label>
                          <input type="text" className="form-input" value={cashRegisterExpenseNotesInput} onChange={e => setCashRegisterExpenseNotesInput(e.target.value)} placeholder="e.g. sweep materials, snack tea..." />
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
      {/* TAB 2: EXPENSES LEDGER */}
      {/* ================================================================= */}
      {activeTab === "expenses" && (
        <>
          {/* Quick categories pills & custom creator */}
          <div className="pos-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <button className={`tbl-btn ${expenseCatFilter === "all" ? "active" : ""}`} onClick={() => setExpenseCatFilter("all")}>All Categories</button>
                {(expenseCategories || []).map(cat => (
                  <button key={cat.id} className={`tbl-btn ${expenseCatFilter === cat.name ? "active" : ""}`} onClick={() => setExpenseCatFilter(cat.name)}>
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
              <button className="btn-add" onClick={() => setCategoryModal({ name: "", icon: "💳", is_fixed: false })}>
                + Create Custom Category
              </button>
            </div>
          </div>

          {/* Row form for adding expenses */}
          <form onSubmit={handleAddExpense} className="pos-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div className="table-title" style={{ marginBottom: "1rem", fontSize: "0.85rem" }}>Log Business Expense</div>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Category *</label>
                <select className="form-input" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} required>
                  {(expenseCategories || []).map(c => (
                    <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label">Description / Vendor / Item Details</label>
                <input className="form-input" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} placeholder="e.g. swept materials, water cans, tea..." />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Amount (₹) *</label>
                <input type="number" min="1" className="form-input" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} required />
              </div>
            </div>
            <div className="form-row" style={{ marginTop: "0.5rem" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Transaction Date *</label>
                <input type="date" className="form-input" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Payment Mode *</label>
                <select className="form-input" value={newExpense.payment_method} onChange={e => setNewExpense({ ...newExpense, payment_method: e.target.value })} required>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Ref Number / Bill Reciept No.</label>
                <input className="form-input" value={newExpense.reference} onChange={e => setNewExpense({ ...newExpense, reference: e.target.value })} placeholder="Optional receipt no." />
              </div>
            </div>
            <button className="btn-add" type="submit" style={{ marginTop: "1rem", width: "100%" }} disabled={saving}>
              {saving ? "Adding..." : "+ Record Expense Entry"}
            </button>
          </form>

          {/* Expenses Log Table */}
          <div className="table-wrap">
            <div className="table-header">
              <div className="table-title">Expenses Ledger (Filtered)</div>
              <div className="table-actions" style={{ display: "flex", gap: "0.5rem" }}>
                <input type="month" className="admin-search" value={expenseMonth} onChange={e => setExpenseMonth(e.target.value)} style={{ width: 150 }} />
                <button className="tbl-btn" onClick={exportExpensesCSV}>
                  <Download size={14} style={{ marginRight: 6 }} /> Export
                </button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e => {
                  const categoryMeta = (expenseCategories || []).find(cat => cat.name === e.category);
                  const icon = categoryMeta ? categoryMeta.icon : "💳";
                  return (
                    <tr key={e.id}>
                      <td style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>{e.date}</td>
                      <td>
                        <span className="badge badge-gold" style={{ padding: "2px 6px" }}>{icon} {e.category}</span>
                      </td>
                      <td>
                        <div>{e.description || "—"}</div>
                        {e.notes && <div style={{ fontSize: "0.62rem", color: "var(--a-muted)" }}>{e.notes}</div>}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "bold" }}>Rs {Number(e.amount).toLocaleString("en-IN")}</td>
                      <td>{e.payment_method}</td>
                      <td>
                        {e.is_system_entry ? (
                          <span style={{ fontSize: "0.65rem", background: "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: "2px", fontWeight: "bold" }}>🔗 SYSTEM PAY</span>
                        ) : e.reference || "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!e.is_system_entry ? (
                          <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                            <button type="button" className="tbl-btn" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => setEditingExpense(e)}>Edit</button>
                            <button type="button" className="tbl-btn danger" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => handleDeleteExpense(e.id)}>Delete</button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.72rem", color: "#999" }}>Locked</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
                <tr style={{ background: "rgba(0,0,0,0.02)", fontWeight: "bold" }}>
                  <td colSpan={3}>Total Expenses this month:</td>
                  <td style={{ textAlign: "right", fontSize: "0.95rem" }}>Rs {totalFilteredExpense.toLocaleString("en-IN")}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>
          </div>
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

