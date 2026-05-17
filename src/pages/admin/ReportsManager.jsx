import { Clock, MessageSquareText } from "lucide-react";
import { useMemo } from "react";
import { useAdmin } from "../../layouts/AdminLayout";
import { buildAnalytics } from "../../lib/api";
import { formatEodReportMessage, getWhatsAppProvider } from "../../lib/whatsapp";

export default function ReportsManager() {
  const { invoices, customers, reportLogs, settings } = useAdmin();
  const provider = getWhatsAppProvider(settings);
  const today = new Date().toISOString().slice(0, 10);
  const report = useMemo(() => {
    const todayInvoices = (invoices || []).filter((invoice) => invoice.billing_at?.slice(0, 10) === today);
    const daily = buildAnalytics(todayInvoices);
    return {
      ...daily,
      todayRevenue: daily.revenue,
      todayBills: todayInvoices.length,
      peakHour: daily.hourlySeries.sort((a, b) => b.total - a.total)[0]?.hour,
      newCustomers: (customers || []).filter((client) => client.created_at?.slice(0, 10) === today).length,
      repeatCustomers: todayInvoices.filter((invoice) => Number(invoice.customer?.visit_count || 0) > 1).length,
    };
  }, [invoices, customers, today]);

  return (
    <div className="reports-grid">
      <div className="table-wrap">
        <div className="table-header">
          <div>
            <div className="table-title"><MessageSquareText size={15} /> EOD Report System</div>
            <div className="pos-sub">Provider-switchable WhatsApp architecture for invoices, reminders, and daily summaries.</div>
          </div>
        </div>
        <div className="report-preview">
          <pre>{formatEodReportMessage(report, settings)}</pre>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-header">
          <div>
            <div className="table-title"><Clock size={15} /> Delivery Configuration</div>
            <div className="pos-sub">Production send should run from a Supabase Edge Function or server cron.</div>
          </div>
        </div>
        <div className="report-settings">
          <div><span>WhatsApp Provider</span><strong>{provider.label}</strong></div>
          <div><span>Default Time</span><strong>{provider.eodTime}</strong></div>
          <div><span>Recipients</span><strong>{provider.reportRecipients.join(", ") || "Not configured"}</strong></div>
          <div><span>Email Support</span><strong>Architecture ready</strong></div>
          <div><span>Booking Confirmations</span><strong>Uses same provider abstraction</strong></div>
          <div><span>Customer Reminders</span><strong>Uses report/message logs</strong></div>
        </div>
      </div>

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
