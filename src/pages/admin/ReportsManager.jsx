import { useState, useMemo } from "react";
import { Clock, MessageSquareText, Mail, FileText, Calendar, Send } from "lucide-react";
import { useAdmin } from "../../layouts/AdminLayout";
import { buildAnalytics, sendEodEmailReport, format12HourTime, logReport } from "../../lib/api";
import { formatEodReportMessage, getWhatsAppProvider, buildWhatsAppLink } from "../../lib/whatsapp";
import toast from "react-hot-toast";

export default function ReportsManager() {
  const { invoices, customers, reportLogs, settings, staff, attendance, cashRegister, inventory } = useAdmin();
  const provider = getWhatsAppProvider(settings);
  
  // Date Range Filters for Metric Cards & Table
  const firstDayOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  };
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  // Date picker for daily EOD email
  const [emailReportDate, setEmailReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [emailRecipient, setEmailRecipient] = useState(settings?.email || "admin@example.com");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Filter invoices based on date range
  const filteredInvoices = useMemo(() => {
    return (invoices || []).filter(inv => {
      const invDate = inv.billing_at ? inv.billing_at.slice(0, 10) : "";
      return invDate >= startDate && invDate <= endDate && inv.status !== "void";
    });
  }, [invoices, startDate, endDate]);

  // Compute metrics for Cards
  const totals = useMemo(() => {
    let gross = 0;
    let gst = 0;
    let tips = 0;
    let net = 0;

    filteredInvoices.forEach(inv => {
      gross += Number(inv.total || 0);
      gst += Number(inv.tax || 0);
      tips += Number(inv.tip || 0);
      net += Number(inv.subtotal || 0) - Number(inv.discount || 0);
    });

    return { gross, gst, tips, net };
  }, [filteredInvoices]);

  // WhatsApp EOD Summary report
  const today = new Date().toISOString().slice(0, 10);
  const whatsappReport = useMemo(() => {
    const todayInvoices = (invoices || []).filter((invoice) => invoice.billing_at?.slice(0, 10) === today);
    const daily = buildAnalytics(todayInvoices);
    const peakHour = daily.hourlySeries.sort((a, b) => b.total - a.total)[0]?.hour;
    return {
      ...daily,
      todayRevenue: daily.revenue,
      todayBills: todayInvoices.length,
      peakHour,
      newCustomers: (customers || []).filter((client) => client.created_at?.slice(0, 10) === today).length,
      repeatCustomers: todayInvoices.filter((invoice) => Number(invoice.customer?.visit_count || 0) > 1).length,
    };
  }, [invoices, customers, today]);

  const generateUnifiedText = async () => {
    try {
      // Gather data for email date
      const dayInvoices = (invoices || []).filter(inv => inv.billing_at?.slice(0, 10) === emailReportDate && inv.status !== "void");
      const dayAttendance = (attendance || []).filter(att => att.date === emailReportDate);
      const dayRegister = (cashRegister || []).find(reg => reg.date === emailReportDate);

      // Generate the primary tabular report using the shared formatter
      const primaryReportText = formatEodReportMessage(whatsappReport, settings, dayInvoices, inventory);

      let text = primaryReportText + `\n\n`;

      // Attendance
      text += `2. STAFF ATTENDANCE\n`;
      text += `--------------------------------------------------\n`;
      if (dayAttendance.length > 0) {
        dayAttendance.forEach(att => {
          const staffMember = staff.find(s => s.id === att.staff_id);
          const name = staffMember?.name || "Staff";
          const times = (att.status === "present" || att.status === "late") ? ` (In: ${att.check_in ? format12HourTime(att.check_in) : "—"} / Out: ${att.check_out ? format12HourTime(att.check_out) : "—"})` : "";
          text += `${name} - Status: ${att.status?.toUpperCase()}${times}\n`;
        });
      } else {
        text += `No attendance logs recorded today.\n`;
      }
      text += `--------------------------------------------------\n\n`;

      // Cash Register
      text += `3. CASH REGISTER TRANSACTIONS\n`;
      text += `--------------------------------------------------\n`;
      if (dayRegister) {
        text += `Opening Cash: Rs ${dayRegister.opening_cash || 0}\n`;
        text += `Expenses/Petty Cash: Rs ${dayRegister.expenses || 0}\n`;
        if (dayRegister.expense_notes) {
          text += `Expense Notes: ${dayRegister.expense_notes}\n`;
        }
        text += `Closing Cash: Rs ${dayRegister.closing_cash || 0}\n`;
        text += `Register Status: ${dayRegister.status?.toUpperCase()}\n`;
      } else {
        text += `No cash register log for this date.\n`;
      }
      text += `--------------------------------------------------\n\n`;
      text += `Report generated automatically at ${new Date().toLocaleTimeString("en-IN")}\n`;

      return text;
    } catch (err) {
      toast.error(err.message || "Failed to generate report text");
      return null;
    }
  };

  const handleSendEmailReport = async () => {
    setSendingEmail(true);
    const text = await generateUnifiedText();
    if (!text) {
      setSendingEmail(false);
      return;
    }
    try {
      await sendEodEmailReport("", text, emailRecipient);
      toast.success("EOD Email Report prepared!");
    } catch (err) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const handleSendWhatsappReport = async () => {
    setSendingWhatsapp(true);
    const text = await generateUnifiedText();
    if (!text) {
      setSendingWhatsapp(false);
      return;
    }
    try {
      const target = provider.reportRecipients[0] || provider.businessNumber;
      if (!target) {
        toast.error("No WhatsApp recipients configured in settings!");
        return;
      }
      await logReport({
        report_type: "eod_whatsapp",
        recipient: target,
        status: "prepared",
        payload: { body: text },
      });
      window.open(buildWhatsAppLink(target, text), "_blank", "noopener,noreferrer");
      toast.success("EOD WhatsApp Report prepared!");
    } catch (err) {
      toast.error(err.message || "Failed to send WhatsApp message");
    } finally {
      setSendingWhatsapp(false);
    }
  };

  const handleSendBothReports = async () => {
    setSendingEmail(true);
    setSendingWhatsapp(true);
    const text = await generateUnifiedText();
    if (!text) {
      setSendingEmail(false);
      setSendingWhatsapp(false);
      return;
    }
    try {
      // 1. WhatsApp
      const target = provider.reportRecipients[0] || provider.businessNumber;
      if (target) {
        await logReport({
          report_type: "eod_whatsapp",
          recipient: target,
          status: "prepared",
          payload: { body: text },
        });
        window.open(buildWhatsAppLink(target, text), "_blank", "noopener,noreferrer");
      }
      // 2. Email
      await sendEodEmailReport("", text, emailRecipient);
      toast.success("EOD Email and WhatsApp Reports prepared!");
    } catch (err) {
      toast.error(err.message || "Failed to trigger unified EOD");
    } finally {
      setSendingEmail(false);
      setSendingWhatsapp(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Date Range Selection & Metrics */}
      <div className="table-wrap">
        <div className="table-header" style={{ paddingBottom: "1.5rem" }}>
          <div>
            <div className="table-title"><Calendar size={15} /> Reports Filter</div>
            <div className="pos-sub">Select custom range for revenue and invoice calculations</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#888" }}>From:</span>
              <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", width: "130px" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#888" }}>To:</span>
              <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem", width: "130px" }} />
            </div>
          </div>
        </div>

        <div className="stats-grid" style={{ padding: "1.5rem", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="stat-card">
            <div className="stat-label">Net Sales (Subtotal)</div>
            <div className="stat-value" style={{ color: "#fff" }}>Rs {totals.net.toLocaleString("en-IN")}</div>
            <div className="stat-sub">Before GST and Tips</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">GST Collected</div>
            <div className="stat-value" style={{ color: "#c9b99a" }}>Rs {totals.gst.toLocaleString("en-IN")}</div>
            <div className="stat-sub">GST tax component</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tips Received</div>
            <div className="stat-value" style={{ color: "#c9b99a" }}>Rs {totals.tips.toLocaleString("en-IN")}</div>
            <div className="stat-sub">Stylist tip distributions</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Gross Revenue</div>
            <div className="stat-value" style={{ color: "#c9b99a", fontWeight: "bold" }}>Rs {totals.gross.toLocaleString("en-IN")}</div>
            <div className="stat-sub">Total amount collected</div>
          </div>
        </div>
      </div>

      {/* Invoices List in Range */}
      <div className="table-wrap">
        <div className="table-header">
          <div className="table-title"><FileText size={15} /> Invoices Summary ({filteredInvoices.length})</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice Number</th>
              <th>Client</th>
              <th>Stylist</th>
              <th style={{ textAlign: "right" }}>Net Amount</th>
              <th style={{ textAlign: "right" }}>GST Tax</th>
              <th style={{ textAlign: "right" }}>Tips</th>
              <th style={{ textAlign: "right" }}>Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => {
              const netAmt = Number(inv.subtotal || 0) - Number(inv.discount || 0);
              return (
                <tr key={inv.id}>
                  <td>{inv.billing_at ? inv.billing_at.slice(0, 10) : "—"}</td>
                  <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.client_name}</div>
                    <div style={{ fontSize: "0.65rem", color: "#888" }}>{inv.mobile}</div>
                  </td>
                  <td>
                    {inv.staff_name ? (
                      <span className="badge badge-gold" style={{ padding: "2px 6px" }}>{inv.staff_name}</span>
                    ) : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>Rs {netAmt.toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right" }}>Rs {Number(inv.tax || 0).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", color: inv.tip > 0 ? "#c9b99a" : "inherit" }}>Rs {Number(inv.tip || 0).toLocaleString("en-IN")}</td>
                  <td style={{ textAlign: "right", fontWeight: "bold", color: "#c9b99a" }}>Rs {Number(inv.total || 0).toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
            {!filteredInvoices.length && <tr><td colSpan="8" style={{ textAlign: "center", padding: "2rem", color: "var(--a-faint)" }}>No invoices in this range.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="reports-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Unified EOD Control Center */}
        <div className="table-wrap" style={{ gridColumn: "span 2" }}>
          <div className="table-header">
            <div>
              <div className="table-title"><Mail size={15} /> Unified Daily EOD Report</div>
              <div className="pos-sub">Send client lists, services table, attendance and cash logs to both Email and WhatsApp in a unified layout</div>
            </div>
          </div>
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Report Date</label>
                <input type="date" className="form-input" value={emailReportDate} onChange={e => setEmailReportDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Recipient Email Address</label>
                <input type="email" className="form-input" placeholder="admin@example.com" value={emailRecipient} onChange={e => setEmailRecipient(e.target.value)} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn-add" onClick={handleSendEmailReport} disabled={sendingEmail} style={{ flex: 1, padding: "0.75rem", background: "transparent", border: "1px solid #c9b99a", color: "#c9b99a" }}>
                {sendingEmail ? "Preparing Email..." : "Send EOD Email"}
              </button>
              <button className="btn-add" onClick={handleSendWhatsappReport} disabled={sendingWhatsapp} style={{ flex: 1, padding: "0.75rem", background: "transparent", border: "1px solid #c9b99a", color: "#c9b99a" }}>
                {sendingWhatsapp ? "Opening WhatsApp..." : "Send EOD WhatsApp"}
              </button>
              <button className="btn-add" onClick={handleSendBothReports} disabled={sendingEmail || sendingWhatsapp} style={{ flex: 1, padding: "0.75rem" }}>
                Send to Both Channels
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Logs */}
      <div className="table-wrap report-log-table">
        <div className="table-header">
          <div className="table-title">Report Logs</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Recipient</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(reportLogs || []).map((log) => (
              <tr key={log.id}>
                <td>{log.report_type}</td>
                <td>{log.recipient}</td>
                <td><span className="badge badge-confirmed">{log.status}</span></td>
                <td>{new Date(log.created_at).toLocaleString("en-IN")}</td>
              </tr>
            ))}
            {!(reportLogs || []).length && <tr><td colSpan="4" style={{ textAlign: "center", padding: "2rem", color: "var(--a-faint)" }}>No reports logged yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
