import { useState, useMemo, useEffect } from "react";
import { 
  Plus, Trash2, X, Download, TrendingUp, TrendingDown, DollarSign, 
  PieChart, AlertTriangle, Mail, CheckCircle, History, Edit2, Clock, Calendar, Search, Filter, ShieldCheck, UserCheck, ArrowRight, CornerDownRight, Landmark
} from "lucide-react";
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
  deleteStaffAdvance,
  saveFixedExpense,
  deleteFixedExpense,
  saveFixedExpensePayment,
  saveStaffPayment,
  markSalaryPaid,
  isProductItem
} from "../../lib/api";

export default function FinanceManager() {
  const { 
    invoices, staff, attendance, inventory, cashRegister, expenses, 
    expenseCategories, settings, reload, fixedExpenses, fixedExpensePayments,
    staffPayments, staffAdvances, tipSplits
  } = useAdmin();

  // Active Tab: register | fixed_expenses | payroll | timeline | pl
  const [activeTab, setActiveTab] = useState("register");
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
  const [editingRegisterExpense, setEditingRegisterExpense] = useState(null);

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

  const handleOpenRegister = async () => {
    if (!isTodayOrYesterday(regDate)) {
      toast.error("Registers can only be opened for today or yesterday.");
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
      const label = cashRegisterExpenseCategory === "Staff Advance" ? "Staff Advance" : cashRegisterExpenseCategory;
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
          disbursed_from: "cash_drawer",
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

      toast.success("Expense logged in register successfully!");
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

  const handleRegisterExpenseDelete = async (item) => {
    if (!window.confirm("Delete this daily cash payout expense?")) return;
    try {
      await deleteExpense(item.id);
      const remaining = dailyCashExpensesList.filter(e => e.id !== item.id);
      const newSum = remaining.reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const newNotes = remaining.map(e => {
        const label = e.category === "Staff Advance" ? "Staff Advance" : e.category;
        const cleanDesc = e.description ? e.description.replace("Register Payout: ", "") : "Payout";
        return `${label}: ${cleanDesc} (Rs ${e.amount})`;
      }).join(" | ");
      
      await updateCashRegisterExpenses(activeRegister.id, newSum, newNotes);
      toast.success("Payout deleted successfully!");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete payout");
    }
  };

  const handleRegisterExpenseEditSave = async (e) => {
    e.preventDefault();
    if (!editingRegisterExpense.amount || Number(editingRegisterExpense.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await saveExpense({
        id: editingRegisterExpense.id,
        category: editingRegisterExpense.category,
        description: editingRegisterExpense.description,
        amount: Number(editingRegisterExpense.amount),
        date: editingRegisterExpense.date,
        payment_method: editingRegisterExpense.payment_method
      });
      
      const updatedList = dailyCashExpensesList.map(item => 
        item.id === editingRegisterExpense.id ? editingRegisterExpense : item
      );
      const newSum = updatedList.reduce((acc, e) => acc + Number(e.amount || 0), 0);
      const newNotes = updatedList.map(e => {
        const label = e.category === "Staff Advance" ? "Staff Advance" : e.category;
        const cleanDesc = e.description ? e.description.replace("Register Payout: ", "") : "Payout";
        return `${label}: ${cleanDesc} (Rs ${e.amount})`;
      }).join(" | ");
      
      await updateCashRegisterExpenses(activeRegister.id, newSum, newNotes);
      toast.success("Payout updated successfully!");
      setEditingRegisterExpense(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update payout");
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
      toast.error("Registers can only be reopened for today or yesterday.");
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
  // TAB 2: FIXED & MONTHLY OVERHEADS STATE & ACTIONS
  // ==========================================
  const [fxMonth, setFxMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [fxModal, setFxModal] = useState(null); // null | { id, name, category, amount, due_day, notes, active }
  const [fxEditAmountModal, setFxEditAmountModal] = useState(null); // null | { fxId, name, monthAmount, currentStatus }
  const [fxSaving, setFxSaving] = useState(false);

  const FX_CATEGORIES = ["Rent", "Royalty", "Electricity", "Water", "Internet", "Staff Room", "Laundry", "Maintenance", "Insurance", "Other"];

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
    if (!window.confirm("Delete this fixed expense template? Payment history for past months will remain intact.")) return;
    try {
      await deleteFixedExpense(id);
      toast.success("Fixed expense removed");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleTogglePayment = async (fxId, currentPaymentObj, defaultAmount) => {
    const isCurrentlyPaid = currentPaymentObj?.status === "paid";
    const newStatus = isCurrentlyPaid ? "unpaid" : "paid";
    try {
      await saveFixedExpensePayment({
        fixed_expense_id: fxId,
        work_month: fxMonth,
        status: newStatus,
        paid_amount: newStatus === "paid" ? (currentPaymentObj?.paid_amount ?? defaultAmount) : null,
        paid_date: newStatus === "paid" ? new Date().toISOString().slice(0, 10) : null
      });
      toast.success(newStatus === "paid" ? "Marked as Paid ✓" : "Marked as Unpaid");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleSaveMonthAmountOverride = async (e) => {
    e.preventDefault();
    if (!fxEditAmountModal || !fxEditAmountModal.monthAmount || Number(fxEditAmountModal.monthAmount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setFxSaving(true);
    try {
      await saveFixedExpensePayment({
        fixed_expense_id: fxEditAmountModal.fxId,
        work_month: fxMonth,
        status: fxEditAmountModal.currentStatus || "paid",
        paid_amount: Number(fxEditAmountModal.monthAmount),
        paid_date: new Date().toISOString().slice(0, 10)
      });
      toast.success("Updated monthly amount override!");
      setFxEditAmountModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to save override");
    } finally {
      setFxSaving(false);
    }
  };

  const fxPaymentMap = useMemo(() => {
    const map = {};
    (fixedExpensePayments || []).filter(p => p.work_month === fxMonth).forEach(p => {
      map[p.fixed_expense_id] = p;
    });
    return map;
  }, [fixedExpensePayments, fxMonth]);

  const fxSummary = useMemo(() => {
    const active = (fixedExpenses || []).filter(f => f.active !== false);
    let total = 0;
    let paid = 0;
    active.forEach(f => {
      const pm = fxPaymentMap[f.id];
      const amt = pm?.paid_amount != null ? Number(pm.paid_amount) : Number(f.amount || 0);
      total += amt;
      if (pm?.status === "paid") {
        paid += amt;
      }
    });
    return { total, paid, unpaid: total - paid, count: active.length };
  }, [fixedExpenses, fxPaymentMap]);


  // ==========================================
  // TAB 3: STAFF PAYROLL & ADVANCES
  // ==========================================
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [advanceModal, setAdvanceModal] = useState(null); // null | { staff_id, staff_name, amount, date, work_month, disbursed_from, notes }
  const [payoutModal, setPayoutModal] = useState(null); // null | { paymentId, staffId, workMonth, netPayable, staffName, paymentMethod, notes, paymentDate }
  const [draftPayments, setDraftPayments] = useState({});

  const handleDraftChange = (pId, field, value) => {
    setDraftPayments(prev => {
      if (field === "cancel") {
        const copy = { ...prev };
        delete copy[pId];
        return copy;
      }
      const original = (staffPayments || []).find(r => r.id === pId) || {};
      const currentDraft = prev[pId] || {
        base_salary: original.base_salary || 0,
        days_present: original.days_present || 0,
        tips_earned: original.tips_earned || 0,
        incentives: original.incentives || 0,
        advances_deducted: original.advances_deducted || 0,
        other_deductions: original.other_deductions || 0,
        scheduled_payment_date: original.scheduled_payment_date || "",
        notes: original.notes || ""
      };
      
      const updatedDraft = {
        ...currentDraft,
      };
      if (field !== "init") {
        updatedDraft[field] = value;
      }
      
      updatedDraft.net_payable = Math.max(0, 
        Number(updatedDraft.base_salary || 0) + 
        Number(updatedDraft.tips_earned || 0) + 
        Number(updatedDraft.incentives || 0) - 
        Number(updatedDraft.advances_deducted || 0) - 
        Number(updatedDraft.other_deductions || 0)
      );

      return {
        ...prev,
        [pId]: updatedDraft
      };
    });
  };

  const handleSaveDraftRow = async (pId) => {
    const draft = draftPayments[pId];
    if (!draft) return;
    const original = (staffPayments || []).find(rec => rec.id === pId);
    if (!original) return;

    setSaving(true);
    const payload = {
      ...original,
      base_salary: Number(draft.base_salary),
      days_present: Number(draft.days_present),
      tips_earned: Number(draft.tips_earned),
      incentives: Number(draft.incentives),
      advances_deducted: Number(draft.advances_deducted),
      other_deductions: Number(draft.other_deductions),
      net_payable: Number(draft.net_payable),
      notes: draft.notes
    };

    try {
      await saveStaffPayment(payload);
      toast.success("Payroll record updated!");
      setDraftPayments(prev => {
        const copy = { ...prev };
        delete copy[pId];
        return copy;
      });
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to update payroll record");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWorksheet = async () => {
    setSaving(true);
    try {
      const activeStaff = (staff || []).filter(s => s.active);
      let count = 0;
      let updatedCount = 0;
      for (const s of activeStaff) {
        const sNameNorm = (s.name || "").trim().toLowerCase();
        const monthTips = (tipSplits || []).filter(ts => ts.staff_name && ts.staff_name.trim().toLowerCase() === sNameNorm && (
          (invoices || []).some(inv => inv.id === ts.invoice_id && (inv.billing_at || "").slice(0, 7) === payrollMonth)
        ));
        const computedTips = monthTips.reduce((acc, t) => acc + Number(t.tip_amount || 0), 0);

        const monthAdvances = (staffAdvances || []).filter(a => a.staff_id === s.id && a.work_month === payrollMonth && a.status === "pending");
        const computedAdvances = monthAdvances.reduce((acc, a) => acc + Number(a.amount || 0), 0);

        const staffAtt = (attendance || []).filter(a => a.staff_id === s.id && (a.date || "").slice(0, 7) === payrollMonth);
        const computedDaysPresent = staffAtt.filter(a => a.status === "present" || a.status === "late").length;

        const net = Number(s.base_salary || 0) + computedTips - computedAdvances;

        const existingPayment = (staffPayments || []).find(p => p.staff_id === s.id && p.work_month === payrollMonth);

        if (!existingPayment) {
          await saveStaffPayment({
            staff_id: s.id,
            work_month: payrollMonth,
            base_salary: s.base_salary,
            days_present: computedDaysPresent,
            tips_earned: computedTips,
            incentives: 0,
            advances_deducted: computedAdvances,
            other_deductions: 0,
            net_payable: net,
            status: "unpaid",
            notes: ""
          });
          count++;
        } else if (existingPayment.status === "unpaid") {
          await saveStaffPayment({
            ...existingPayment,
            days_present: existingPayment.days_present !== null && existingPayment.days_present !== undefined ? existingPayment.days_present : computedDaysPresent,
            tips_earned: computedTips,
            advances_deducted: computedAdvances,
            net_payable: Number(existingPayment.base_salary || 0) + computedTips + Number(existingPayment.incentives || 0) - computedAdvances - Number(existingPayment.other_deductions || 0)
          });
          updatedCount++;
        }
      }
      toast.success(`Payroll generated! Created ${count} and updated ${updatedCount} records.`);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to generate worksheet");
    } finally {
      setSaving(false);
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

  const handleRecordAdvance = async (e) => {
    e.preventDefault();
    if (!advanceModal?.staff_id) {
      toast.error("Please select a staff member");
      return;
    }
    const amt = Number(advanceModal.amount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid advance amount");
      return;
    }
    setSaving(true);
    try {
      const emp = (staff || []).find(s => s.id === advanceModal.staff_id);
      await saveStaffAdvance({
        staff_id: advanceModal.staff_id,
        staff_name: emp ? emp.name : "Staff",
        amount: amt,
        date: advanceModal.date || new Date().toISOString().slice(0, 10),
        work_month: (advanceModal.date || new Date().toISOString().slice(0, 10)).slice(0, 7),
        disbursed_from: advanceModal.disbursed_from || "cash_drawer",
        notes: advanceModal.notes || "Staff Advance Payout"
      });
      toast.success(`Advance of ₹${amt} disbursed to ${emp ? emp.name : "staff"}`);
      setAdvanceModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to disburse advance");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdvanceItem = async (advId) => {
    if (!window.confirm("Are you sure you want to cancel this advance?")) return;
    try {
      await deleteStaffAdvance(advId);
      toast.success("Advance record cancelled");
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to delete advance");
    }
  };


  // ==========================================
  // TAB 4: CHRONOLOGICAL FINANCIAL ACTIVITY FEED
  // ==========================================
  const [timelineMonth, setTimelineMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [timelineCategory, setTimelineCategory] = useState("all"); // all | advance | payout | overhead | salary
  const [timelineStaffId, setTimelineStaffId] = useState("all");

  const timelineEvents = useMemo(() => {
    const list = [];

    // 1. Staff Advances
    (staffAdvances || []).forEach(adv => {
      const d = adv.date || "";
      if (d.slice(0, 7) === timelineMonth) {
        const emp = (staff || []).find(s => s.id === adv.staff_id);
        list.push({
          id: `adv-${adv.id}`,
          date: d,
          type: "advance",
          title: `Staff Advance — ${emp ? emp.name : (adv.staff_name || "Staff")}`,
          amount: Number(adv.amount || 0),
          categoryTag: "Staff Advance",
          paymentMethod: adv.notes?.includes("Personal UPI") ? "Personal UPI / Owner Pocket" : "Cash Drawer",
          notes: adv.notes || "Cash Advance",
          status: adv.status,
          rawObj: adv
        });
      }
    });

    // 2. Register Daily Cash Payouts & Expenses
    (expenses || []).forEach(exp => {
      const d = exp.date || "";
      if (d.slice(0, 7) === timelineMonth) {
        if (exp.category === "Salaries") {
          // Salary payout handled separately
        } else if (exp.category === "Staff Advance" && exp.is_system_entry) {
          // Skip system clone of advance to avoid duplicating advance line
        } else {
          list.push({
            id: `exp-${exp.id}`,
            date: d,
            type: "payout",
            title: exp.description || `Expense: ${exp.category}`,
            amount: Number(exp.amount || 0),
            categoryTag: exp.category,
            paymentMethod: exp.payment_method || "Cash",
            notes: exp.notes || "",
            status: "completed",
            rawObj: exp
          });
        }
      }
    });

    // 3. Fixed Overhead Payments
    (fixedExpensePayments || []).filter(p => p.work_month === timelineMonth && p.status === "paid").forEach(fp => {
      const parentFx = (fixedExpenses || []).find(f => f.id === fp.fixed_expense_id);
      const d = fp.paid_date || `${timelineMonth}-01`;
      list.push({
        id: `fxp-${fp.id}`,
        date: d,
        type: "overhead",
        title: `Overhead Paid: ${parentFx ? parentFx.name : "Fixed Expense"}`,
        amount: Number(fp.paid_amount || parentFx?.amount || 0),
        categoryTag: parentFx ? parentFx.category : "Fixed Overhead",
        paymentMethod: "Bank / Transfer",
        notes: fp.notes || "Monthly Overhead Settlement",
        status: "paid",
        rawObj: fp
      });
    });

    // 4. Staff Salary Disbursements
    (staffPayments || []).filter(p => p.work_month === timelineMonth && p.status === "paid").forEach(sp => {
      const emp = (staff || []).find(s => s.id === sp.staff_id);
      const d = sp.payment_date || `${timelineMonth}-28`;
      list.push({
        id: `sal-${sp.id}`,
        date: d,
        type: "salary",
        title: `Salary Paid — ${emp ? emp.name : "Staff Member"}`,
        amount: Number(sp.net_payable || 0),
        categoryTag: "Salary Payout",
        paymentMethod: sp.payment_method || "Bank Transfer",
        notes: sp.notes || `Base: ₹${sp.base_salary} | Inc: ₹${sp.incentives} | Adv: -₹${sp.advances_deducted}`,
        status: "paid",
        rawObj: sp
      });
    });

    // Sort descending by date
    list.sort((a, b) => b.date.localeCompare(a.date));

    // Apply filters
    return list.filter(item => {
      if (timelineCategory !== "all" && item.type !== timelineCategory) return false;
      if (timelineStaffId !== "all") {
        if (item.type === "advance" && item.rawObj?.staff_id !== timelineStaffId) return false;
        if (item.type === "salary" && item.rawObj?.staff_id !== timelineStaffId) return false;
      }
      return true;
    });
  }, [staffAdvances, expenses, fixedExpensePayments, fixedExpenses, staffPayments, staff, timelineMonth, timelineCategory, timelineStaffId]);


  // ==========================================
  // TAB 5: PROFIT & LOSS COMPUTATIONS
  // ==========================================
  const [plMonth, setPlMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const plStats = useMemo(() => {
    const monthInvoices = (invoices || []).filter(inv => 
      inv.status !== "void" && (inv.billing_at || "").slice(0, 7) === plMonth
    );
    const revenue = monthInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

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
    const netProfit = revenue - totalExpenses;
    const margin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0.0";

    const fixedCategories = new Set(
      (expenseCategories || []).filter(c => c.is_fixed).map(c => c.name)
    );
    const fixedCosts = monthExpenses
      .filter(e => fixedCategories.has(e.category))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return { revenue, totalExpenses, netProfit, margin, fixedCosts, monthExpenses, legacyRegSum };
  }, [invoices, expenses, cashRegister, expenseCategories, plMonth]);

  const plCategoryBreakdown = useMemo(() => {
    const groups = {};
    plStats.monthExpenses.forEach(e => {
      groups[e.category] = (groups[e.category] || 0) + Number(e.amount || 0);
    });

    if (plStats.legacyRegSum && plStats.legacyRegSum > 0) {
      groups["Other"] = (groups["Other"] || 0) + plStats.legacyRegSum;
    }

    const categoriesMap = {};
    (expenseCategories || []).forEach(c => { categoriesMap[c.name] = c; });

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

  const monthlyTrends = useMemo(() => {
    const trendList = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      const key = monthDate.toISOString().slice(0, 7);
      const label = monthDate.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      
      const rev = (invoices || [])
        .filter(inv => inv.status !== "void" && (inv.billing_at || "").slice(0, 7) === key)
        .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
        
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
      {/* Non-Tech Friendly Master Navigation Bar */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap", background: "#fff", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--a-border)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
        <button 
          className={`tbl-btn ${activeTab === "register" ? "active" : ""}`} 
          onClick={() => setActiveTab("register")}
          style={{ padding: "0.6rem 1.25rem", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
        >
          💵 Cash Drawer & Payouts
        </button>
        <button 
          className={`tbl-btn ${activeTab === "fixed_expenses" ? "active" : ""}`} 
          onClick={() => setActiveTab("fixed_expenses")}
          style={{ padding: "0.6rem 1.25rem", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
        >
          📌 Monthly Overhead Bills
        </button>
        <button 
          className={`tbl-btn ${activeTab === "payroll" ? "active" : ""}`} 
          onClick={() => setActiveTab("payroll")}
          style={{ padding: "0.6rem 1.25rem", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
        >
          👥 Staff Salaries & Advances
        </button>
        <button 
          className={`tbl-btn ${activeTab === "timeline" ? "active" : ""}`} 
          onClick={() => setActiveTab("timeline")}
          style={{ padding: "0.6rem 1.25rem", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
        >
          📜 Activity History Log
        </button>
        <button 
          className={`tbl-btn ${activeTab === "pl" ? "active" : ""}`} 
          onClick={() => setActiveTab("pl")}
          style={{ padding: "0.6rem 1.25rem", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
        >
          📊 Profit & Loss
        </button>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: CASH DRAWER & DAILY PAYOUTS */}
      {/* ================================================================= */}
      {activeTab === "register" && (
        <div className="pos-grid">
          <div className="pos-panel">
            <div className="pos-header" style={{ borderBottom: "1px solid var(--a-border)", paddingBottom: "1.5rem" }}>
              <div>
                <div className="table-title">💵 Daily Cash Drawer</div>
                <div className="pos-sub">Track entrance cash, today's cash sales, and daily petty cash payouts</div>
              </div>
              <input type="date" className="form-input" value={regDate} onChange={e => setRegDate(e.target.value)} style={{ maxWidth: 160, padding: "0.5rem 1rem", fontSize: "0.75rem" }} />
            </div>

            {!activeRegister ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem", color: "#999", marginBottom: "1rem" }}>💵</div>
                <h3 style={{ fontFamily: "serif", fontSize: "1.5rem", marginBottom: "0.5rem", color: "#1a1a1a" }}>Register Drawer is Closed</h3>
                <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "1.5rem", maxWidth: 320, margin: "0 auto 1.5rem" }}>
                  Enter starting float money (entrance cash) to open the cash register for {new Date(regDate).toLocaleDateString("en-IN")}.
                </p>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", maxWidth: 320, margin: "0 auto" }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Starting Cash Float (₹)" 
                    value={openingCashInput} 
                    onChange={e => setOpeningCashInput(e.target.value)} 
                    style={{ flex: 1 }}
                  />
                  <button className="btn-add" onClick={handleOpenRegister} disabled={saving}>
                    {saving ? "Opening..." : "Open Drawer"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "1rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: activeRegister.status === "open" ? "#2e7d32" : "#777" }}></span>
                    <span style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Drawer {activeRegister.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "2rem" }}>
                  <div style={{ border: "1px solid #e8e8e4", padding: "1rem", borderRadius: "6px", background: "#fff" }}>
                    <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", letterSpacing: "0.1em" }}>Opening Float</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>₹{Number(activeRegister.opening_cash).toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ border: "1px solid #e8e8e4", padding: "1rem", borderRadius: "6px", background: "#fff" }}>
                    <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", letterSpacing: "0.1em" }}>Today's Cash Sales</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#2e7d32" }}>+ ₹{salesForDate.cash.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ border: "1px solid #e8e8e4", padding: "1rem", borderRadius: "6px", background: "#fff" }}>
                    <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "#999", letterSpacing: "0.1em" }}>Daily Cash Payouts</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#b71c1c" }}>- ₹{dailyCashExpensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0).toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ border: "1px solid var(--a-border)", padding: "1rem", borderRadius: "6px", background: "rgba(201,185,154,0.08)" }}>
                    <div style={{ fontSize: "0.58rem", textTransform: "uppercase", color: "var(--a-muted)", letterSpacing: "0.1em", fontWeight: "600" }}>Expected Cash</div>
                    <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "var(--a-text)" }}>₹{expectedCash.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                {dailyCashExpensesList.length > 0 && (
                  <div style={{ marginBottom: "2rem" }}>
                    <div style={{ fontSize: "0.68rem", textTransform: "uppercase", color: "#666", fontWeight: "bold", marginBottom: "0.75rem" }}>Logged Daily Cash Payouts</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {dailyCashExpensesList.map((item) => (
                        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e8e8e4", padding: "0.75rem 1rem", borderRadius: "6px", borderLeft: "4px solid #b71c1c" }}>
                          <div>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#333" }}>{item.description}</span>
                            <div style={{ fontSize: "0.68rem", color: "var(--a-muted)" }}>Category: {item.category}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#b71c1c" }}>
                              ₹{Number(item.amount || 0).toLocaleString("en-IN")}
                            </span>
                            {!item.is_system_entry ? (
                              <div style={{ display: "flex", gap: "0.25rem" }}>
                                <button type="button" className="tbl-btn" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => setEditingRegisterExpense(item)}>Edit</button>
                                <button type="button" className="tbl-btn danger" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => handleRegisterExpenseDelete(item)}>Delete</button>
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.6rem", color: "var(--a-muted)", background: "rgba(0,0,0,0.03)", padding: "2px 6px", borderRadius: "2px", fontWeight: "bold" }}>SYSTEM</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeRegister.status === "open" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
                    <form onSubmit={handleAddRegisterExpense} style={{ background: "#fcfcfa", padding: "1.25rem", border: "1px dashed var(--a-border)", borderRadius: "6px" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem", color: "#b71c1c" }}>
                        Log Cash Payout / Petty Cash Withdrawal
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
                            <option value="Royalty">Royalty</option>
                            {(expenseCategories || [])
                              .filter(c => c.name !== "Other" && c.name !== "Staff Advance" && c.name !== "Royalty")
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
                              <option value="" disabled>-- Select Staff Member --</option>
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
                          <label className="form-label">Description / Note</label>
                          <input type="text" className="form-input" value={cashRegisterExpenseNotesInput} onChange={e => setCashRegisterExpenseNotesInput(e.target.value)} placeholder="e.g. sweeping materials, laundry, tea..." />
                        </div>
                      </div>
                      <button type="submit" className="tbl-btn danger" style={{ marginTop: "0.5rem", width: "100%", padding: "0.6rem" }} disabled={saving}>
                        Log Cash Withdrawal
                      </button>
                    </form>

                    <form onSubmit={handleCloseRegister} style={{ background: "#fafafa", padding: "1.5rem", border: "1px solid var(--a-border)", borderRadius: "6px" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1.25rem" }}>
                        Close Register Reconciliation
                      </div>
                      <div className="form-group">
                        <label className="form-label">Actual Physical Cash Counted in Drawer (₹) *</label>
                        <input type="number" min="0" className="form-input" value={closingCashInput} onChange={e => setClosingCashInput(e.target.value)} placeholder="Enter counted drawer cash..." required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Daily Notes</label>
                        <textarea className="form-input" rows="2" value={registerNotes} onChange={e => setRegisterNotes(e.target.value)} placeholder="Notes on count difference, if any..."></textarea>
                      </div>
                      <button type="submit" className="btn-add" style={{ width: "100%", background: "#000", color: "#fff", padding: "0.6rem" }} disabled={saving}>
                        {saving ? "Closing..." : "Reconcile & Close Register Drawer"}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ padding: "1rem", border: "1px solid #2e7d32", background: "#e8f5e9", borderRadius: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#2e7d32", fontWeight: "bold", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                      <CheckCircle size={14} /> Drawer Reconciled & Closed
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", fontSize: "0.75rem", color: "#333" }}>
                      <div>Counted Closing Cash: <strong>₹{Number(activeRegister.closing_cash).toLocaleString("en-IN")}</strong></div>
                      <div>Difference: <strong style={{ color: Number(activeRegister.closing_cash) - expectedCash < 0 ? "#b71c1c" : "#2e7d32" }}>
                        ₹{(Number(activeRegister.closing_cash) - expectedCash).toLocaleString("en-IN")}
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
                      🔓 Re-open Register Drawer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="invoice-preview">
            <div className="preview-card" style={{ background: "#fff", border: "1px solid #e8e8e4", padding: "1.5rem", borderRadius: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div className="table-title">Daily Sales Summary</div>
                  <div style={{ fontSize: "0.65rem", color: "#999", textTransform: "uppercase", marginTop: "0.2rem" }}>
                    {new Date(regDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                <button className="tbl-btn" onClick={handleSendEodEmail} disabled={!activeRegister || saving} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.65rem", padding: "0.4rem 0.8rem" }}>
                  <Mail size={12} /> Email EOD
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem", background: "#f8f8f6", padding: "1rem", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                  <span>UPI Sales</span>
                  <strong>₹{salesForDate.upi.toLocaleString("en-IN")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                  <span>Card Sales</span>
                  <strong>₹{salesForDate.card.toLocaleString("en-IN")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", borderTop: "1px solid #eee", paddingTop: "0.5rem" }}>
                  <span>Non-Cash Revenue</span>
                  <strong>₹{(salesForDate.upi + salesForDate.card).toLocaleString("en-IN")}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", borderTop: "1px double #ccc", paddingTop: "0.5rem" }}>
                  <span style={{ fontWeight: "bold" }}>Total Sales ({salesForDate.count} bills)</span>
                  <strong style={{ fontSize: "0.9rem", color: "var(--a-text)" }}>₹{salesForDate.revenue.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              <div style={{ fontSize: "0.65rem", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.05em", color: "#999", marginBottom: "0.75rem" }}>
                Today's Invoices
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "220px", overflowY: "auto", paddingRight: "4px" }}>
                {salesForDate.invoiceList.map(inv => (
                  <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e8e8e4", padding: "0.6rem 0.8rem", borderRadius: "4px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1a1a1a" }}>{inv.client_name}</span>
                      <span style={{ fontSize: "0.65rem", color: "#666" }}>
                        <strong style={{ color: "var(--gold)" }}>{inv.invoice_number}</strong> · {inv.payment_method}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#2e7d32" }}>
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
          </aside>
        </div>
      )}


      {/* ================================================================= */}
      {/* TAB 2: FIXED & MONTHLY OVERHEADS */}
      {/* ================================================================= */}
      {activeTab === "fixed_expenses" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="pos-panel" style={{ padding: "1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--a-muted)", marginBottom: "0.4rem" }}>Total Monthly Overheads</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>₹{fxSummary.total.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>{fxSummary.count} recurring expenses</div>
            </div>
            <div className="pos-panel" style={{ padding: "1.25rem", textAlign: "center", borderLeft: "4px solid #2e7d32" }}>
              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#2e7d32", marginBottom: "0.4rem" }}>Paid This Month</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#2e7d32" }}>₹{fxSummary.paid.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>{(fixedExpenses || []).filter(f => f.active !== false && fxPaymentMap[f.id]?.status === "paid").length} items paid</div>
            </div>
            <div className="pos-panel" style={{ padding: "1.25rem", textAlign: "center", borderLeft: `4px solid ${fxSummary.unpaid > 0 ? "#b71c1c" : "#999"}` }}>
              <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: fxSummary.unpaid > 0 ? "#b71c1c" : "var(--a-muted)", marginBottom: "0.4rem" }}>Still Unpaid</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: fxSummary.unpaid > 0 ? "#b71c1c" : "inherit" }}>₹{fxSummary.unpaid.toLocaleString("en-IN")}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>{(fixedExpenses || []).filter(f => f.active !== false && fxPaymentMap[f.id]?.status !== "paid").length} items pending</div>
            </div>
          </div>

          <div className="table-wrap">
            <div className="table-header">
              <div className="table-title">📌 Monthly Overhead Bills & Overrides</div>
              <div className="table-actions" style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--a-muted)" }}>Tracking month:</span>
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
                  <Plus size={14} style={{ marginRight: 6 }} /> Add Overhead Expense
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
                  const effectiveAmount = payment?.paid_amount != null ? Number(payment.paid_amount) : Number(fx.amount || 0);

                  return (
                    <tr key={fx.id}>
                      <td style={{ fontWeight: 600 }}>{fx.name}</td>
                      <td>
                        <span className="badge badge-gold" style={{ padding: "2px 8px" }}>{fx.category}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                          <span style={{ fontWeight: "bold", fontSize: "0.95rem" }}>₹{effectiveAmount.toLocaleString("en-IN")}</span>
                          <button
                            type="button"
                            className="tbl-btn"
                            title="Edit amount for this specific month (e.g. fluctuating electricity or water bill)"
                            style={{ padding: "0.15rem 0.4rem", fontSize: "0.65rem", display: "inline-flex", alignItems: "center", gap: "2px" }}
                            onClick={() => setFxEditAmountModal({ fxId: fx.id, name: fx.name, monthAmount: effectiveAmount, currentStatus: payment?.status || "paid" })}
                          >
                            <Edit2 size={10} /> Edit
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", color: "var(--a-muted)", fontSize: "0.72rem" }}>
                        {fx.due_day ? `${fx.due_day}${["st","nd","rd"][fx.due_day-1]||"th"} of month` : "—"}
                      </td>
                      <td style={{ fontSize: "0.72rem", color: "var(--a-muted)" }}>{fx.notes || "—"}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleTogglePayment(fx.id, payment, fx.amount)}
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
                      No overhead expenses added yet. Click "Add Overhead Expense" to track rent, electricity, and other monthly bills.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add / Edit Fixed Expense Template Modal */}
          {fxModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <form onSubmit={handleSaveFixedExpense} style={{ background: "#fff", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: 460, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <div className="table-title">{fxModal.id ? "Edit Overhead Expense" : "Add Overhead Expense"}</div>
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
                    <label className="form-label">Monthly Base Amount (₹) *</label>
                    <input type="number" min="1" className="form-input" value={fxModal.amount} onChange={e => setFxModal({ ...fxModal, amount: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Day of Month (1–31)</label>
                  <input type="number" min="1" max="31" className="form-input" value={fxModal.due_day} onChange={e => setFxModal({ ...fxModal, due_day: e.target.value })} placeholder="e.g. 1 for 1st of month" />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-input" placeholder="Contract notes, account details..." value={fxModal.notes || ""} onChange={e => setFxModal({ ...fxModal, notes: e.target.value })} />
                </div>
                <button className="btn-add" type="submit" style={{ width: "100%", marginTop: "0.5rem" }} disabled={fxSaving}>
                  {fxSaving ? "Saving..." : (fxModal.id ? "Update Overhead Expense" : "Add Overhead Expense")}
                </button>
              </form>
            </div>
          )}

          {/* Edit Month Amount Override Modal */}
          {fxEditAmountModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <form onSubmit={handleSaveMonthAmountOverride} style={{ background: "#fff", padding: "1.75rem", borderRadius: "8px", width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div className="table-title">Override {fxEditAmountModal.name} Amount</div>
                  <button type="button" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setFxEditAmountModal(null)}><X size={18} /></button>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--a-muted)", marginBottom: "1rem" }}>
                  Set exact bill amount for <strong>{new Date(fxMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong> (for fluctuating bills like Electricity or Water):
                </p>
                <div className="form-group">
                  <label className="form-label">Bill Amount for {fxMonth} (₹) *</label>
                  <input type="number" min="1" className="form-input" value={fxEditAmountModal.monthAmount} onChange={e => setFxEditAmountModal({ ...fxEditAmountModal, monthAmount: e.target.value })} required autoFocus />
                </div>
                <button className="btn-add" type="submit" style={{ width: "100%", marginTop: "0.5rem" }} disabled={fxSaving}>
                  {fxSaving ? "Saving..." : "Save Month Amount"}
                </button>
              </form>
            </div>
          )}
        </>
      )}


      {/* ================================================================= */}
      {/* TAB 3: STAFF PAYROLL & ADVANCES */}
      {/* ================================================================= */}
      {activeTab === "payroll" && (
        <>
          <div className="pos-panel" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div className="table-title">👥 Staff Salaries, Incentives & Advance Recovery</div>
                <div style={{ fontSize: "0.75rem", color: "var(--a-muted)" }}>
                  Auto-calculates Base + Incentives + Tips - Advances = Net Pay. Click any field to edit.
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input type="month" className="admin-search" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)} style={{ width: 150 }} />
                <button className="tbl-btn" onClick={handleGenerateWorksheet} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  🔄 Sync Payroll
                </button>
                <button 
                  className="btn-add" 
                  onClick={() => setAdvanceModal({ staff_id: "", amount: "", date: new Date().toISOString().slice(0, 10), disbursed_from: "cash_drawer", notes: "" })}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={14} /> Disburse Staff Advance
                </button>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th style={{ textAlign: "right" }}>Base Salary</th>
                  <th style={{ textAlign: "right" }}>Incentives (Commissions)</th>
                  <th style={{ textAlign: "right" }}>Tips</th>
                  <th style={{ textAlign: "right" }}>Advances Deducted</th>
                  <th style={{ textAlign: "right" }}>Other Deductions</th>
                  <th style={{ textAlign: "right" }}>Net Payable</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(staffPayments || []).filter(p => p.work_month === payrollMonth).map(pay => {
                  const emp = (staff || []).find(s => s.id === pay.staff_id);
                  const isPaid = pay.status === "paid";
                  const isEditing = !!draftPayments[pay.id];
                  const draft = draftPayments[pay.id] || {
                    base_salary: pay.base_salary || 0,
                    incentives: pay.incentives || 0,
                    tips_earned: pay.tips_earned || 0,
                    advances_deducted: pay.advances_deducted || 0,
                    other_deductions: pay.other_deductions || 0,
                    net_payable: pay.net_payable || 0
                  };

                  return (
                    <tr key={pay.id}>
                      <td style={{ fontWeight: 600 }}>
                        {emp ? emp.name : "Staff"}
                        <div style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>{emp?.role || "Stylist"}</div>
                        
                        {/* Non-Tech Step-by-Step Formula Breakdown Pill */}
                        <div style={{ fontSize: "0.65rem", color: "#444", marginTop: "6px", background: "rgba(0,0,0,0.03)", padding: "4px 8px", borderRadius: "4px", border: "1px solid rgba(0,0,0,0.06)", display: "inline-block" }}>
                          🧮 <span>Base ₹{Number(isEditing ? draft.base_salary : pay.base_salary || 0).toLocaleString("en-IN")}</span>
                          {Number(isEditing ? draft.incentives : pay.incentives) > 0 && <span style={{ color: "#2e7d32" }}> + Inc ₹{Number(isEditing ? draft.incentives : pay.incentives).toLocaleString("en-IN")}</span>}
                          {Number(isEditing ? draft.tips_earned : pay.tips_earned) > 0 && <span style={{ color: "#2e7d32" }}> + Tip ₹{Number(isEditing ? draft.tips_earned : pay.tips_earned).toLocaleString("en-IN")}</span>}
                          {Number(isEditing ? draft.advances_deducted : pay.advances_deducted) > 0 && <span style={{ color: "#b71c1c", fontWeight: "bold" }}> - Adv ₹{Number(isEditing ? draft.advances_deducted : pay.advances_deducted).toLocaleString("en-IN")}</span>}
                          {Number(isEditing ? draft.other_deductions : pay.other_deductions) > 0 && <span style={{ color: "#b71c1c" }}> - Ded ₹{Number(isEditing ? draft.other_deductions : pay.other_deductions).toLocaleString("en-IN")}</span>}
                          <span> = </span>
                          <strong style={{ color: "#2e7d32" }}>₹{Number(isEditing ? draft.net_payable : pay.net_payable || 0).toLocaleString("en-IN")} To Be Paid</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isEditing ? (
                          <input type="number" className="form-input" style={{ width: 90, textAlign: "right", padding: "0.2rem" }} value={draft.base_salary} onChange={e => handleDraftChange(pay.id, "base_salary", e.target.value)} />
                        ) : (
                          <span>₹{Number(pay.base_salary || 0).toLocaleString("en-IN")}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isEditing ? (
                          <input type="number" className="form-input" style={{ width: 90, textAlign: "right", padding: "0.2rem" }} value={draft.incentives} onChange={e => handleDraftChange(pay.id, "incentives", e.target.value)} />
                        ) : (
                          <span style={{ color: Number(pay.incentives) > 0 ? "#2e7d32" : "inherit" }}>+ ₹{Number(pay.incentives || 0).toLocaleString("en-IN")}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span>+ ₹{Number(pay.tips_earned || 0).toLocaleString("en-IN")}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isEditing ? (
                          <input type="number" className="form-input" style={{ width: 90, textAlign: "right", padding: "0.2rem" }} value={draft.advances_deducted} onChange={e => handleDraftChange(pay.id, "advances_deducted", e.target.value)} />
                        ) : (
                          <span style={{ color: Number(pay.advances_deducted) > 0 ? "#b71c1c" : "inherit" }}>- ₹{Number(pay.advances_deducted || 0).toLocaleString("en-IN")}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {isEditing ? (
                          <input type="number" className="form-input" style={{ width: 90, textAlign: "right", padding: "0.2rem" }} value={draft.other_deductions} onChange={e => handleDraftChange(pay.id, "other_deductions", e.target.value)} />
                        ) : (
                          <span>- ₹{Number(pay.other_deductions || 0).toLocaleString("en-IN")}</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "bold", fontSize: "0.95rem", color: "#2e7d32" }}>
                        ₹{(isEditing ? draft.net_payable : Number(pay.net_payable || 0)).toLocaleString("en-IN")}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`badge ${isPaid ? "badge-green" : "badge-orange"}`}>
                          {isPaid ? "PAID ✓" : "UNPAID"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "flex-end" }}>
                          {isEditing ? (
                            <>
                              <button type="button" className="tbl-btn" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem", background: "#2e7d32", color: "#fff" }} onClick={() => handleSaveDraftRow(pay.id)}>Save</button>
                              <button type="button" className="tbl-btn" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => handleDraftChange(pay.id, "cancel", null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              {!isPaid && (
                                <button type="button" className="tbl-btn" style={{ padding: "0.15rem 0.45rem", fontSize: "0.7rem" }} onClick={() => handleDraftChange(pay.id, "init", null)}>
                                  <Edit2 size={11} /> Edit
                                </button>
                              )}
                              {!isPaid ? (
                                <button 
                                  type="button" 
                                  className="btn-add" 
                                  style={{ padding: "0.15rem 0.6rem", fontSize: "0.7rem" }}
                                  onClick={() => setPayoutModal({
                                    paymentId: pay.id,
                                    staffId: pay.staff_id,
                                    workMonth: payrollMonth,
                                    netPayable: pay.net_payable,
                                    staffName: emp ? emp.name : "Staff",
                                    paymentMethod: "Bank Transfer",
                                    paymentDate: new Date().toISOString().slice(0, 10)
                                  })}
                                >
                                  Pay Salary
                                </button>
                              ) : (
                                <span style={{ fontSize: "0.65rem", color: "var(--a-muted)" }}>Paid {pay.payment_date}</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!(staffPayments || []).filter(p => p.work_month === payrollMonth).length && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "3rem", color: "var(--a-muted)" }}>
                      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👥</div>
                      No payroll records generated for {payrollMonth}. Click <strong>"Sync Payroll"</strong> to auto-calculate salaries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Disburse Staff Advance Modal */}
          {advanceModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <form onSubmit={handleRecordAdvance} style={{ background: "#fff", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: 440, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                  <div className="table-title">💸 Disburse Staff Cash Advance</div>
                  <button type="button" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setAdvanceModal(null)}><X size={18} /></button>
                </div>
                <div className="form-group">
                  <label className="form-label">Select Employee *</label>
                  <select 
                    className="form-input" 
                    value={advanceModal.staff_id} 
                    onChange={e => setAdvanceModal({ ...advanceModal, staff_id: e.target.value })} 
                    required
                  >
                    <option value="" disabled>-- Select Staff Member --</option>
                    {(staff || []).filter(s => s.active).map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Advance Amount (₹) *</label>
                    <input type="number" min="1" className="form-input" value={advanceModal.amount} onChange={e => setAdvanceModal({ ...advanceModal, amount: e.target.value })} required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Disburse Date *</label>
                    <input type="date" className="form-input" value={advanceModal.date} onChange={e => setAdvanceModal({ ...advanceModal, date: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Funding Source *</label>
                  <select 
                    className="form-input" 
                    value={advanceModal.disbursed_from} 
                    onChange={e => setAdvanceModal({ ...advanceModal, disbursed_from: e.target.value })}
                  >
                    <option value="cash_drawer">Cash Drawer (Deducts from Daily Register)</option>
                    <option value="owner_pocket">Owner Pocket / Personal Bank</option>
                    <option value="personal_upi">Personal UPI / Wallet</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes / Reason</label>
                  <input className="form-input" placeholder="e.g. Emergency advance for medical..." value={advanceModal.notes} onChange={e => setAdvanceModal({ ...advanceModal, notes: e.target.value })} />
                </div>
                <button className="btn-add" type="submit" style={{ width: "100%", marginTop: "0.5rem" }} disabled={saving}>
                  {saving ? "Disbursing..." : "Disburse Advance"}
                </button>
              </form>
            </div>
          )}

          {/* Pay Salary Modal */}
          {payoutModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <form onSubmit={handleMarkPaid} style={{ background: "#fff", padding: "2rem", borderRadius: "8px", width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                  <div className="table-title">Confirm Salary Payment</div>
                  <button type="button" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setPayoutModal(null)}><X size={18} /></button>
                </div>
                <p style={{ fontSize: "0.8rem", color: "#333", marginBottom: "1rem" }}>
                  Mark salary of <strong>₹{Number(payoutModal.netPayable).toLocaleString("en-IN")}</strong> as PAID for <strong>{payoutModal.staffName}</strong> ({payoutModal.workMonth})?
                </p>
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input type="date" className="form-input" value={payoutModal.paymentDate} onChange={e => setPayoutModal({ ...payoutModal, paymentDate: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Method *</label>
                  <select className="form-input" value={payoutModal.paymentMethod} onChange={e => setPayoutModal({ ...payoutModal, paymentMethod: e.target.value })} required>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI Payment</option>
                    <option value="Cash">Cash Payout</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <button className="btn-add" type="submit" style={{ width: "100%", marginTop: "0.5rem", background: "#2e7d32" }} disabled={saving}>
                  {saving ? "Processing..." : "Confirm & Mark as Paid"}
                </button>
              </form>
            </div>
          )}
        </>
      )}


      {/* ================================================================= */}
      {/* TAB 4: CHRONOLOGICAL FINANCIAL ACTIVITY FEED */}
      {/* ================================================================= */}
      {activeTab === "timeline" && (
        <>
          <div className="pos-panel" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div className="table-title">📜 Chronological Financial Activity Log</div>
                <div style={{ fontSize: "0.75rem", color: "var(--a-muted)" }}>
                  Itemized activity feed for advances, daily payouts, overhead bills, and salary disbursements by date.
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <input type="month" className="admin-search" value={timelineMonth} onChange={e => setTimelineMonth(e.target.value)} style={{ width: 140 }} />
                <select className="admin-search" value={timelineCategory} onChange={e => setTimelineCategory(e.target.value)} style={{ width: 140 }}>
                  <option value="all">All Event Types</option>
                  <option value="advance">💸 Advances</option>
                  <option value="payout">💵 Daily Payouts</option>
                  <option value="overhead">📌 Overheads</option>
                  <option value="salary">💰 Salaries</option>
                </select>
                <select className="admin-search" value={timelineStaffId} onChange={e => setTimelineStaffId(e.target.value)} style={{ width: 140 }}>
                  <option value="all">All Staff</option>
                  {(staff || []).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {timelineEvents.map(evt => {
              const dateObj = new Date(evt.date);
              const formattedDate = dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
              
              let badgeColor = "#777";
              let badgeBg = "#eee";
              let icon = "💳";
              if (evt.type === "advance") { badgeColor = "#e65100"; badgeBg = "#fff3e0"; icon = "💸"; }
              else if (evt.type === "payout") { badgeColor = "#b71c1c"; badgeBg = "#ffebee"; icon = "💵"; }
              else if (evt.type === "overhead") { badgeColor = "#1565c0"; badgeBg = "#e3f2fd"; icon = "📌"; }
              else if (evt.type === "salary") { badgeColor = "#2e7d32"; badgeBg = "#e8f5e9"; icon = "💰"; }

              return (
                <div key={evt.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", border: "1px solid #e8e8e4", borderRadius: "8px", padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ background: badgeBg, color: badgeColor, width: "42px", height: "42px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", fontWeight: "bold" }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1a1a1a" }}>{evt.title}</span>
                        <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: "999px", background: badgeBg, color: badgeColor, fontWeight: 700 }}>
                          {evt.categoryTag}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--a-muted)", marginTop: "2px" }}>
                        📅 <strong>{formattedDate}</strong> · Payment Method: {evt.paymentMethod} {evt.notes ? `· Notes: ${evt.notes}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: evt.type === "salary" || evt.type === "overhead" || evt.type === "payout" ? "#b71c1c" : "#e65100" }}>
                      ₹{evt.amount.toLocaleString("en-IN")}
                    </div>
                    {evt.type === "advance" && evt.status === "pending" && (
                      <button 
                        type="button" 
                        className="tbl-btn danger" 
                        style={{ padding: "0.1rem 0.4rem", fontSize: "0.65rem", marginTop: "4px" }}
                        onClick={() => handleDeleteAdvanceItem(evt.rawObj.id)}
                      >
                        Cancel Advance
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!timelineEvents.length && (
              <div style={{ textAlign: "center", padding: "3rem", background: "#fff", border: "1px solid #e8e8e4", borderRadius: "8px", color: "var(--a-muted)" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📜</div>
                No financial activities logged for {timelineMonth}.
              </div>
            )}
          </div>
        </>
      )}


      {/* ================================================================= */}
      {/* TAB 5: PROFIT & LOSS REPORTING */}
      {/* ================================================================= */}
      {activeTab === "pl" && (
        <>
          <div className="pos-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="table-title">Monthly P&L Reporting</div>
              <input type="month" className="admin-search" value={plMonth} onChange={e => setPlMonth(e.target.value)} style={{ width: 180 }} />
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Gross Sales Revenue</div>
              <div className="stat-value">₹{plStats.revenue.toLocaleString("en-IN")}</div>
              <div className="stat-sub">From client bill checkouts</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Outflow Expenses</div>
              <div className="stat-value" style={{ color: "#b71c1c" }}>₹{plStats.totalExpenses.toLocaleString("en-IN")}</div>
              <div className="stat-sub">Salaries, Rent, Bills, Payouts...</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net Profit / Loss</div>
              <div className="stat-value" style={{ color: plStats.netProfit >= 0 ? "#2e7d32" : "#b71c1c" }}>
                {plStats.netProfit >= 0 ? "+" : ""} ₹{plStats.netProfit.toLocaleString("en-IN")}
              </div>
              <div className="stat-sub">{plStats.netProfit >= 0 ? "🟢 PROFITABLE CYCLE" : "🔴 UNPROFITABLE CYCLE"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Profit Margin</div>
              <div className="stat-value">{plStats.margin}%</div>
              <div className="stat-sub">Share of revenue saved</div>
            </div>
          </div>

          <div className="pos-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
              <span>Fixed Overhead Costs Target</span>
              <span>₹{plStats.fixedCosts.toLocaleString("en-IN")} Target</span>
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
                  <CheckCircle size={12} /> <strong>Break-even achieved!</strong> You are ₹{(plStats.revenue - plStats.fixedCosts).toLocaleString("en-IN")} above fixed operational costs.
                </>
              ) : (
                <>
                  <AlertTriangle size={12} /> You need ₹{(plStats.fixedCosts - plStats.revenue).toLocaleString("en-IN")} more in revenue to cover this month's fixed operating costs.
                </>
              )}
            </div>
          </div>

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
                        <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "bold" }}>₹{cat.amount.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "0.5rem", textAlign: "right", color: "var(--a-muted)" }}>{cat.pct}%</td>
                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                          <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: "2px", background: cat.isFixed ? "rgba(13,13,13,0.05)" : "none", border: cat.isFixed ? "1px solid #ccc" : "none" }}>
                            {cat.isFixed ? "FIXED" : "VARIABLE"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pos-panel" style={{ padding: "1.5rem" }}>
              <div className="table-title" style={{ marginBottom: "1rem" }}>6-Month Revenue & Cash Flow Trends</div>
              <div style={{ display: "flex", height: "200px", alignItems: "flex-end", justifyContent: "space-around", paddingTop: "1rem" }}>
                {monthlyTrends.map(t => {
                  const revHeightPct = Math.round((t.revenue / maxTrendValue) * 100) || 5;
                  const expHeightPct = Math.round((t.expenses / maxTrendValue) * 100) || 5;
                  const isProfit = t.net >= 0;
                  return (
                    <div key={t.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "15%" }}>
                      <div style={{ display: "flex", gap: "2px", width: "100%", height: "140px", alignItems: "flex-end", justifyContent: "center" }}>
                        <div style={{ height: `${revHeightPct}%`, width: "12px", background: isProfit ? "#2e7d32" : "#f57c00", borderRadius: "2px 2px 0 0" }} title={`Revenue: ₹${t.revenue}`}></div>
                        <div style={{ height: `${expHeightPct}%`, width: "12px", background: "#b71c1c", borderRadius: "2px 2px 0 0" }} title={`Expenses: ₹${t.expenses}`}></div>
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

      {/* Edit Register Expense Modal */}
      {editingRegisterExpense && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingRegisterExpense(null)}>
          <div className="modal" style={{ maxWidth: "420px" }}>
            <div className="modal-header">
              <div className="modal-title">Edit Cash Drawer Payout</div>
              <button className="modal-close" onClick={() => setEditingRegisterExpense(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="edit-reg-expense-form" onSubmit={handleRegisterExpenseEditSave}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Expense Category *</label>
                  <select 
                    className="form-input" 
                    value={editingRegisterExpense.category} 
                    onChange={e => setEditingRegisterExpense({ ...editingRegisterExpense, category: e.target.value })} 
                    required
                  >
                    <option value="Rent">Rent</option>
                    <option value="Royalty">Royalty</option>
                    <option value="Electricity">Electricity</option>
                    <option value="Water">Water</option>
                    <option value="Staff Payout">Staff Payout</option>
                    <option value="Refreshments">Refreshments</option>
                    <option value="Laundry">Laundry</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Description / Note *</label>
                  <input 
                    className="form-input" 
                    value={editingRegisterExpense.description} 
                    onChange={e => setEditingRegisterExpense({ ...editingRegisterExpense, description: e.target.value })} 
                    required 
                    placeholder="Details..."
                  />
                </div>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label className="form-label">Amount (₹) *</label>
                  <input 
                    type="number" 
                    min="1" 
                    className="form-input" 
                    value={editingRegisterExpense.amount} 
                    onChange={e => setEditingRegisterExpense({ ...editingRegisterExpense, amount: Number(e.target.value) })} 
                    required 
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="tbl-btn" onClick={() => setEditingRegisterExpense(null)}>Cancel</button>
              <button type="submit" form="edit-reg-expense-form" className="btn-add" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
