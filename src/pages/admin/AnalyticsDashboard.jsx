import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useAdmin } from "../../layouts/AdminLayout";
import { buildAnalytics, logReport } from "../../lib/api";
import { buildWhatsAppLink, formatEodReportMessage, getWhatsAppProvider } from "../../lib/whatsapp";

export default function AnalyticsDashboard() {
  const { invoices, customers, settings } = useAdmin();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const analytics = useMemo(() => buildAnalytics(invoices || []), [invoices]);
  const today = new Date().toISOString().slice(0, 10);
  const todayInvoices = (invoices || []).filter((invoice) => invoice.billing_at?.slice(0, 10) === today);
  const todayAnalytics = buildAnalytics(todayInvoices);
  const peakHour = analytics.hourlySeries.sort((a, b) => b.total - a.total)[0]?.hour;
  const provider = getWhatsAppProvider(settings);

  const report = {
    ...analytics,
    todayRevenue: todayAnalytics.revenue,
    todayBills: todayInvoices.length,
    peakHour,
    newCustomers: (customers || []).filter((client) => client.created_at?.slice(0, 10) === today).length,
    repeatCustomers: todayInvoices.filter((invoice) => Number(invoice.customer?.visit_count || 0) > 1).length,
  };

  const sendEodReport = async () => {
    const message = formatEodReportMessage(report, settings);
    try {
      await logReport({
        report_type: "eod_whatsapp",
        recipient: provider.reportRecipients[0] || provider.businessNumber || "not_configured",
        status: "prepared",
        payload: report,
      });
      const target = provider.reportRecipients[0] || provider.businessNumber;
      if (target) window.open(buildWhatsAppLink(target, message), "_blank", "noopener,noreferrer");
      toast.success("EOD report prepared");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="stats-grid">
        <Metric label="Daily Revenue" value={`Rs ${analytics.todayRevenue.toLocaleString("en-IN")}`} sub="Today" />
        <Metric label="Weekly Revenue" value={`Rs ${analytics.weeklyRevenue.toLocaleString("en-IN")}`} sub="Last 7 days" />
        <Metric label="Monthly Revenue" value={`Rs ${analytics.monthlyRevenue.toLocaleString("en-IN")}`} sub="Current month" />
        <Metric label="Average Bill" value={`Rs ${analytics.averageBill.toLocaleString("en-IN")}`} sub={`${analytics.billCount} invoices`} />
      </div>

      <div className="analytics-toolbar">
        <div>
          <div className="table-title">Business Analytics</div>
          <div className="pos-sub">Revenue, retention, payment mix, and calendar heatmap</div>
        </div>
        <button className="btn-add" onClick={sendEodReport}><Send size={14} /> Send EOD</button>
      </div>

      <div className="analytics-grid wide">
        <ChartCard title="Revenue Trend" icon={<BarChart3 size={16} />}>
          <LineBars data={analytics.dailySeries.slice(-30)} labelKey="date" />
        </ChartCard>
        <ChartCard title="Monthly Growth" icon={<BarChart3 size={16} />}>
          <LineBars data={analytics.monthlySeries.slice(-12)} labelKey="month" />
        </ChartCard>
        <ChartCard title="Payment Breakdown">
          <DonutLegend data={analytics.paymentBreakdown} />
        </ChartCard>
        <ChartCard title="Top Services">
          <RankList data={analytics.topServices} />
        </ChartCard>
      </div>

      <div className="calendar-card">
        <div className="table-header">
          <div>
            <div className="table-title"><CalendarDays size={15} /> Sales Calendar</div>
            <div className="pos-sub">Click any date mentally: matching invoices are listed below the month.</div>
          </div>
          <input className="form-input month-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <SalesCalendar month={month} invoices={invoices || []} />
      </div>
    </>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function ChartCard({ title, icon, children }) {
  return (
    <div className="analytics-card">
      <div className="analytics-card-title">{icon} {title}</div>
      {children}
    </div>
  );
}

function LineBars({ data, labelKey }) {
  const max = Math.max(...data.map((item) => item.total), 1);
  return (
    <>
      <div className="chart-bars tall">
        {data.map((item) => (
          <div className="chart-bar" key={item[labelKey]} style={{ height: `${Math.max((item.total / max) * 100, 4)}%` }} title={`${item[labelKey]} Rs ${item.total}`} />
        ))}
      </div>
      <div className="chart-labels">
        {data.filter((_item, index) => index % Math.ceil(data.length / 6 || 1) === 0).map((item) => <span className="chart-label" key={item[labelKey]}>{item[labelKey].slice(-5)}</span>)}
      </div>
    </>
  );
}

function DonutLegend({ data }) {
  const entries = Object.entries(data || {});
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return (
    <div className="donut-grid">
      <div className="donut" style={{ background: makeDonut(entries, total) }}></div>
      <div className="legend-list">
        {entries.map(([label, value]) => <div key={label}><span>{label}</span><strong>Rs {Number(value).toLocaleString("en-IN")}</strong></div>)}
        {!entries.length && <div className="admin-empty compact">No payments yet.</div>}
      </div>
    </div>
  );
}

function RankList({ data }) {
  return (
    <div className="rank-list">
      {(data || []).map((item, index) => (
        <div key={item.name} className="rank-row">
          <span>{index + 1}</span>
          <strong>{item.name}</strong>
          <b>Rs {Number(item.value).toLocaleString("en-IN")}</b>
        </div>
      ))}
      {!(data || []).length && <div className="admin-empty compact">No service sales yet.</div>}
    </div>
  );
}

function SalesCalendar({ month, invoices }) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const days = new Date(year, monthIndex, 0).getDate();
  const offset = first.getDay();
  const daily = invoices.reduce((acc, invoice) => {
    const day = invoice.billing_at?.slice(0, 10);
    if (day?.startsWith(month)) acc[day] = (acc[day] || 0) + Number(invoice.total || 0);
    return acc;
  }, {});
  const max = Math.max(...Object.values(daily), 1);
  const cells = Array.from({ length: offset + days }, (_item, index) => {
    if (index < offset) return null;
    const day = String(index - offset + 1).padStart(2, "0");
    const key = `${month}-${day}`;
    return { day, key, total: daily[key] || 0 };
  });
  const monthTotal = Object.values(daily).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <div className="calendar-summary">Monthly sales: <strong>Rs {monthTotal.toLocaleString("en-IN")}</strong></div>
      <div className="sales-calendar">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div className="cal-head" key={day}>{day}</div>)}
        {cells.map((cell, index) => cell ? (
          <div className="cal-cell" key={cell.key} style={{ background: `rgba(201,185,154,${0.12 + (cell.total / max) * 0.58})` }}>
            <span>{cell.day}</span>
            <strong>{cell.total ? `Rs ${Math.round(cell.total).toLocaleString("en-IN")}` : "—"}</strong>
          </div>
        ) : <div className="cal-cell blank" key={`blank-${index}`}></div>)}
      </div>
    </>
  );
}

function makeDonut(entries, total) {
  if (!entries.length) return "#f1f1ed";
  const colors = ["#0d0d0d", "#c9b99a", "#2e7d32", "#8b5e34", "#6b7280"];
  let cursor = 0;
  const stops = entries.map(([, value], index) => {
    const start = cursor;
    cursor += (value / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(",")})`;
}
